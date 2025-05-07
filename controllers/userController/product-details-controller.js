const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.id;

    // Fetch the product with its category
    const product = await Product.findById(productId).populate("category");
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).render("pageNotFound");
    }

    // Fetch related products (randomly select 4 products from different categories)
    const relatedProducts = await Product.aggregate([
      { $match: { _id: { $ne: product._id }, isListed: true, isDeleted: false } },
      { $sample: { size: 4 } },
    ]);

    // Fetch cart and wishlist counts
    let cartCount = 0;
    let wishlistCount = 0;
    let isInCart = false;
    let isWishlisted = false;

    if (userId) {
      const cart = await Cart.findOne({ user: userId });
      if (cart) {
        cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        isInCart = cart.items.some(item => item.product.toString() === productId);
      }

      const wishlist = await Wishlist.findOne({ user: userId });
      if (wishlist) {
        wishlistCount = wishlist.items.length;
        isWishlisted = wishlist.items.some(item => item.product.toString() === productId);
      }
    }

    res.render("product-details", {
      product,
      relatedProducts,
      isInCart,
      isWishlisted,
      cartCount,
      wishlistCount,
      user: userId ? { id: userId } : null,
      isAuthenticated: !!userId,
    });
  } catch (error) {
    console.log("Error fetching product details:", error);
    res.status(500).render("pageNotFound");
  }
};

module.exports = { productDetails };