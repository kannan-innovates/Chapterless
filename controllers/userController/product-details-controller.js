const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper");

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category");
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(404).render("pageNotFound");
    }

    const activeOffer = await getActiveOfferForProduct(product._id, product.category._id);
    
    const { discountAmount, discountPercentage, finalPrice } = calculateDiscount(
      activeOffer, 
      product.regularPrice
    );
    
    product.activeOffer = activeOffer;
    product.discountAmount = discountAmount;
    product.discountPercentage = discountPercentage;
    product.finalPrice = finalPrice || product.salePrice; // Use offer price or fallback to salePrice


    const relatedProducts = await Product.aggregate([
      { $match: { _id: { $ne: product._id }, isListed: true, isDeleted: false } },
      { $sample: { size: 4 } },
    ]);

    for (const relatedProduct of relatedProducts) {
      const offer = await getActiveOfferForProduct(relatedProduct._id, relatedProduct.category);
      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(offer, relatedProduct.regularPrice);
      relatedProduct.activeOffer = offer;
      relatedProduct.discountPercentage = discountPercentage;
      relatedProduct.discountAmount = discountAmount;
      relatedProduct.finalPrice = finalPrice || relatedProduct.salePrice;
      
    }

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