const Wishlist = require("../../models/wishlistSchema")
const Product = require("../../models/productSchema")
const Cart = require("../../models/cartSchema")
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper")

const getWishlist = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect("/login")
    }

    const userId = req.session.user_id
    const page = Number.parseInt(req.query.page) || 1
    const limit = 5
    const skip = (page - 1) * limit

    const wishlist = await Wishlist.findOne({ user: userId }).populate("items.product")
    const cart = await Cart.findOne({ user: userId })

    let wishlistItems = []
    let totalItems = 0
    let inStockItems = 0
    let lowStockItems = 0
    let outOfStockItems = 0
    let cartCount = 0
    let wishlistCount = 0

    if (wishlist && wishlist.items.length > 0) {
      wishlistItems = wishlist.items.filter((item) => item.product && item.product.isListed && !item.product.isDeleted)
      totalItems = wishlistItems.length
      wishlistCount = totalItems

      // Get active offers for all products in wishlist
      for (const item of wishlistItems) {
        const offer = await getActiveOfferForProduct(item.product._id, item.product.category)

        const { discountPercentage } = calculateDiscount(offer, item.product.regularPrice)

        item.product.activeOffer = offer
        item.product.discountPercentage = discountPercentage
      }

      wishlistItems.forEach((item) => {
        if (item.product.stock > 10) {
          inStockItems++
        } else if (item.product.stock > 0) {
          lowStockItems++
        } else {
          outOfStockItems++
        }
      })

      wishlistItems = wishlistItems.slice(skip, skip + limit)
    }

    if (cart) {
      cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    }

    const totalPages = Math.ceil(totalItems / limit)

    // Fetch recently viewed products (randomly select 4 products)
    const recentlyViewed = await Product.aggregate([
      { $match: { isListed: true, isDeleted: false } },
      { $sample: { size: 4 } },
    ])

    // Get active offers for recently viewed products
    for (const product of recentlyViewed) {
      const offer = await getActiveOfferForProduct(product._id, product.category)
      const { discountPercentage } = calculateDiscount(offer, product.regularPrice)
      product.activeOffer = offer
      product.discountPercentage = discountPercentage
    }

    res.render("wishlist", {
      wishlistItems,
      totalItems,
      inStockItems,
      lowStockItems,
      outOfStockItems,
      recentlyViewed,
      currentPage: page,
      totalPages,
      cartCount,
      wishlistCount,
      user: userId ? { id: userId } : null,
      isAuthenticated: true,
    })
  } catch (error) {
    console.log("Error in rendering wishlist:", error)
    res.status(500).send("Server Error")
  }
}


const toggleWishlist = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in to manage wishlist' });
    }

    const userId = req.session.user_id;
    const { productId } = req.body;
    const product = await Product.findById(productId);

    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    let wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: userId,
        items: [{ product: productId }]
      });
      await wishlist.save();
      return res.json({ success: true, message: 'Added to wishlist', isWishlisted: true, wishlistCount: 1 });
    }

    const itemIndex = wishlist.items.findIndex(item => item.product.toString() === productId);

    if (itemIndex > -1) {
      wishlist.items.splice(itemIndex, 1);
      await wishlist.save();
      return res.json({ success: true, message: 'Removed from wishlist', isWishlisted: false, wishlistCount: wishlist.items.length });
    } else {
      wishlist.items.push({ product: productId });
      await wishlist.save();
      return res.json({ success: true, message: 'Added to wishlist', isWishlisted: true, wishlistCount: wishlist.items.length });
    }
  } catch (error) {
    console.log('Error toggling wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addAllToCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in' });
    }

    const userId = req.session.user_id;
    const wishlist = await Wishlist.findOne({ user: userId }).populate('items.product');

    if (!wishlist || wishlist.items.length === 0) {
      return res.status(404).json({ success: false, message: 'Wishlist is empty' });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], totalAmount: 0 });
    }

    const messages = [];
    const availableItems = wishlist.items.filter(item => item.product && item.product.isListed && !item.product.isDeleted && item.product.stock > 0);

    for (const item of availableItems) {
      const product = item.product;
      const itemIndex = cart.items.findIndex(cartItem => cartItem.product.toString() === product._id.toString());

      if (itemIndex > -1) {
        const newQuantity = cart.items[itemIndex].quantity + 1;
        if (newQuantity <= product.stock) {
          cart.items[itemIndex].quantity = newQuantity;
          cart.items[itemIndex].priceAtAddition = product.salePrice;
        } else {
          messages.push(`${product.title}: Only ${product.stock} items in stock`);
          continue;
        }
      } else {
        cart.items.push({
          product: product._id,
          quantity: 1,
          priceAtAddition: product.salePrice
        });
      }
    }

    cart.totalAmount = cart.items.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);
    await cart.save();

    // Remove added items from wishlist
    wishlist.items = wishlist.items.filter(item => !availableItems.some(avail => avail.product._id.toString() === item.product.toString()));
    await wishlist.save();

    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const wishlistCount = wishlist.items.length;

    res.json({
      success: true,
      message: 'Available items added to cart',
      cartCount,
      wishlistCount,
      warnings: messages
    });
  } catch (error) {
    console.log('Error adding all to cart:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const clearWishlist = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Please log in' });
    }

    const userId = req.session.user_id;
    await Wishlist.findOneAndDelete({ user: userId });

    res.json({ success: true, message: 'Wishlist cleared', wishlistCount: 0 });
  } catch (error) {
    console.log('Error clearing wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getWishlist, toggleWishlist, addAllToCart, clearWishlist };