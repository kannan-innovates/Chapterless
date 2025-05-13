const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");

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
    let cartCount = 0;
    let wishlistCount = 0;

    if (cart && cart.items.length > 0) {
      cartItems = cart.items.filter(item => item.product && item.product.isListed);
      totalAmount = cartItems.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);
      cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    if (wishlist) {
      wishlistCount = wishlist.items.length;
    }

    const relatedProducts = await Product.aggregate([
      { $match: { isListed: true, isDeleted: false } },
      { $sample: { size: 4 } }
    ]);

    res.render('cart', {
      cartItems,
      totalAmount,
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

    // Fetch the user's cart to check existing quantity
    let cart = await Cart.findOne({ user: userId });
    let existingQuantity = 0;

    if (cart) {
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
      if (itemIndex > -1) {
        existingQuantity = cart.items[itemIndex].quantity;
      }
    }

    // Calculate total quantity (existing + new)
    const totalQuantity = existingQuantity + parseInt(quantity);

    // Check if total quantity exceeds stock
    if (totalQuantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${quantity} more items. Only ${product.stock - existingQuantity} items left in stock.`,
      });
    }

    // If cart doesn't exist, create a new one
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{
          product: productId,
          quantity: parseInt(quantity),
          priceAtAddition: product.salePrice
        }],
        totalAmount: parseInt(quantity) * product.salePrice
      });
    } else {
      const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);

      if (itemIndex > -1) {
        // Update existing item
        cart.items[itemIndex].quantity = totalQuantity; // Use the calculated total
        cart.items[itemIndex].priceAtAddition = product.salePrice;
      } else {
        // Add new item
        cart.items.push({
          product: productId,
          quantity: parseInt(quantity),
          priceAtAddition: product.salePrice
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

    cart.items[itemIndex].quantity = parseInt(quantity);
    cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);

    await cart.save();

    res.json({
      success: true,
      message: 'Cart updated',
      totalAmount: cart.totalAmount,
      itemTotal: cart.items[itemIndex].quantity * cart.items[itemIndex].priceAtAddition
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