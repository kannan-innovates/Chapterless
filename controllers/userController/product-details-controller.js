const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper");

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.id;

    // Fetch the product with its category
    const product = await Product.findById(productId).populate("category");
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).render("pageNotFound");
    }

    // Get active offer for this product
    const activeOffer = await getActiveOfferForProduct(product._id, product.category._id);
    
    // Calculate discount if offer exists
    const { discountAmount, discountPercentage } = calculateDiscount(
      activeOffer, 
      product.regularPrice
    );
    
    // Add offer information to product
    product.activeOffer = activeOffer;
    product.discountAmount = discountAmount;
    product.discountPercentage = discountPercentage;
    product.finalPrice = product.salePrice;

    // Fetch related products (randomly select 4 products from different categories)
    const relatedProducts = await Product.aggregate([
      { $match: { _id: { $ne: product._id }, isListed: true, isDeleted: false } },
      { $sample: { size: 4 } },
    ]);

    // Get active offers for related products
    for (const relatedProduct of relatedProducts) {
      const offer = await getActiveOfferForProduct(relatedProduct._id, relatedProduct.category);
      const { discountPercentage } = calculateDiscount(offer, relatedProduct.regularPrice);
      relatedProduct.activeOffer = offer;
      relatedProduct.discountPercentage = discountPercentage;
    }

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
