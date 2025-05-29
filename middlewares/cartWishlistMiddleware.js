const Cart = require('../models/cartSchema');
const Wishlist = require('../models/wishlistSchema');

/**
 * Middleware to add cart and wishlist counts to all pages
 * Makes cartCount and wishlistCount available in all templates
 */
const cartWishlistMiddleware = async (req, res, next) => {
  try {
    // Initialize counts
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;

    // Only fetch counts for authenticated users
    if (req.session && req.session.user_id) {
      const userId = req.session.user_id;

      // Fetch cart count
      const cart = await Cart.findOne({ user: userId });
      if (cart && cart.items) {
        res.locals.cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      }

      // Fetch wishlist count
      const wishlist = await Wishlist.findOne({ user: userId });
      if (wishlist && wishlist.items) {
        res.locals.wishlistCount = wishlist.items.length;
      }
    }

    next();
  } catch (error) {
    console.error('Error in cartWishlistMiddleware:', error);
    // Set default values on error
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    next();
  }
};

module.exports = cartWishlistMiddleware;
