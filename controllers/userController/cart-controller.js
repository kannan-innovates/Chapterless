const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper");

const getCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const wishlist = await Wishlist.findOne({ user: userId });

    let cartItems = [];
    let totalAmount = 0;
    let totalDiscount = 0;
    let cartCount = 0;
    let wishlistCount = 0;

    if (cart && cart.items.length > 0) {
      // Filter valid products
      cartItems = cart.items.filter(item => item.product && item.product.isListed);
      
      // Calculate discounted prices and totals
      for (const item of cartItems) {
        const offer = await getActiveOfferForProduct(
          item.product._id, 
          item.product.category,
          item.product.regularPrice
        );
        
        const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(
          offer, 
          item.product.regularPrice
        );
        
        item.product.activeOffer = offer;
        item.product.discountPercentage = discountPercentage;
        item.product.discountAmount = discountAmount;
        item.product.finalPrice = finalPrice;
        item.product.regularPrice = item.product.regularPrice || item.product.salePrice;
        item.product.salePrice = finalPrice;
        
        // Update totals
        totalAmount += item.quantity * finalPrice;
        totalDiscount += item.quantity * discountAmount;
      }
      
      cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    if (wishlist) {
      wishlistCount = wishlist.items.length;
    }

    const relatedProducts = await Product.aggregate([
      { $match: { isListed: true, isDeleted: false } },
      { $sample: { size: 4 } }
    ]);

    // Get active offers for related products
    for (const product of relatedProducts) {
      const offer = await getActiveOfferForProduct(product._id, product.category, product.regularPrice);
      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(offer, product.regularPrice);
      product.activeOffer = offer;
      product.discountPercentage = discountPercentage;
      product.discountAmount = discountAmount;
      product.finalPrice = finalPrice;
      product.regularPrice = product.regularPrice || product.salePrice;
      product.salePrice = finalPrice;
    }

    res.render('cart', {
      cartItems,
      totalAmount: totalAmount.toFixed(2),
      totalDiscount: totalDiscount.toFixed(2),
      relatedProducts,
      cartCount,
      wishlistCount,
      user: userId ? { id: userId } : null,
      isAuthenticated: true
    });
  } catch (error) {
    console.log('Error in rendering cart:', error);
    res.status(500).send("Server Error");
  }
};

const addToCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in to add to cart' });
    }

    const userId = req.session.user_id;
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);

    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    // Get active offer and calculate discounted price
    const offer = await getActiveOfferForProduct(product._id, product.category);
    const { finalPrice } = calculateDiscount(offer, product.regularPrice);

    // Fetch the user's cart to check existing quantity
    let cart = await Cart.findOne({ user: userId });
    let existingQuantity = 0;

    if (cart) {
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
      if (itemIndex > -1) {
        existingQuantity = cart.items[itemIndex].quantity;
      }
    }

    // Calculate total quantity
    const totalQuantity = existingQuantity + parseInt(quantity);

    // Check stock
    if (totalQuantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${quantity} more items. Only ${product.stock - existingQuantity} items left in stock.`,
      });
    }

    // Create or update cart
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{
          product: productId,
          quantity: parseInt(quantity),
          priceAtAddition: finalPrice
        }],
        totalAmount: parseInt(quantity) * finalPrice
      });
    } else {
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity = totalQuantity;
        cart.items[itemIndex].priceAtAddition = finalPrice;
      } else {
        cart.items.push({
          product: productId,
          quantity: parseInt(quantity),
          priceAtAddition: finalPrice
        });
      }

      cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);
    }

    await cart.save();

    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    res.json({ success: true, message: 'Added to cart', cartCount });
  } catch (error) {
    console.log('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateCartItem = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in' });
    }

    const userId = req.session.user_id;
    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Item not found in cart' });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    if (quantity > product.stock) {
      return res.status(400).json({ success: false, message: `Only ${product.stock} items in stock` });
    }

    // Get active offer and calculate discounted price
    const offer = await getActiveOfferForProduct(product._id, product.category);
    const { finalPrice } = calculateDiscount(offer, product.regularPrice);

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.items[itemIndex].priceAtAddition = finalPrice;
    cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);

    await cart.save();

    res.json({
      success: true,
      message: 'Cart updated',
      totalAmount: cart.totalAmount,
      itemTotal: cart.items[itemIndex].quantity * cart.items[itemIndex].priceAtAddition,
      cartCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
    });
  } catch (error) {
    console.log('Error updating cart item:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in' });
    }

    const userId = req.session.user_id;
    const { productId } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);

    await cart.save();

    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    res.json({ success: true, message: 'Item removed', cartCount, totalAmount: cart.totalAmount });
  } catch (error) {
    console.log('Error removing cart item:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const clearCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in' });
    }

    const userId = req.session.user_id;
    await Cart.findOneAndDelete({ user: userId });

    res.json({ success: true, message: 'Cart cleared', cartCount: 0, totalAmount: 0 });
  } catch (error) {
    console.log('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };