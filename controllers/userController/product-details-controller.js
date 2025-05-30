const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper");

const {HttpStatus} = require('../../helpers/status-code')

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category");
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(HttpStatus.NOT_FOUND).render("pageNotFound");
    }

    // Get active offer and calculate discount
    const activeOffer = await getActiveOfferForProduct(
      product._id, 
      product.category._id,
      product.regularPrice
    );
    
    const { discountAmount, discountPercentage, finalPrice } = calculateDiscount(
      activeOffer, 
      product.regularPrice
    );
    
    // Add offer and price information to product object
    product.activeOffer = activeOffer;
    product.discountAmount = discountAmount;
    product.discountPercentage = discountPercentage;
    product.finalPrice = finalPrice;
    product.regularPrice = product.regularPrice || product.salePrice; // Ensure regularPrice exists

    // Get related products
    const relatedProducts = await Product.aggregate([
      { 
        $match: { 
          _id: { $ne: product._id }, 
          isListed: true, 
          isDeleted: false,
          category: product.category._id 
        }
      },
      { $sample: { size: 4 } },
    ]);

    // Calculate offers for related products
    for (const relatedProduct of relatedProducts) {
      const offer = await getActiveOfferForProduct(
        relatedProduct._id, 
        relatedProduct.category,
        relatedProduct.regularPrice || relatedProduct.salePrice
      );
      
      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(
        offer, 
        relatedProduct.regularPrice || relatedProduct.salePrice
      );
      
      relatedProduct.activeOffer = offer;
      relatedProduct.discountPercentage = discountPercentage;
      relatedProduct.discountAmount = discountAmount;
      relatedProduct.finalPrice = finalPrice;
      relatedProduct.regularPrice = relatedProduct.regularPrice || relatedProduct.salePrice;
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

    // Log the product data for debugging
    console.log('Product details with offer:', {
      title: product.title,
      regularPrice: product.regularPrice,
      finalPrice: product.finalPrice,
      discountPercentage: product.discountPercentage,
      hasOffer: !!product.activeOffer,
      offerTitle: product.activeOffer?.title
    });

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
    console.error("Error fetching product details:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("pageNotFound");
  }
};

module.exports = { productDetails };

