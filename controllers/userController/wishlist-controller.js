const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const productSchema = require("../../models/productSchema");

const getWishlist = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.render("wishlist", { user: null });
    }
    let wishlist = await Wishlist.findOne({
      user: req.session.user_id,
    }).populate({
      path: "items.product",
      match: { isListed: true },
    });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.session.user_id,
        items: [],
      });
    }
    wishlist.items = wishlist.items.filter((item) => item.product !== null);

    res.render("wishlist", {
      wishlist: wishlist.items,
      user: req.session.user_id,
    });
  } catch (error) {
    console.log("Error in rendering wishlist:", error);
    res.status(500).send("Server Error");
  }
};

const addToWishlist = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        redirect: "/login",
      });
    }

    const productId = req.body.productID;

    const product = await Product.findById(productId);

    if (!product || !product.isListed) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unlisted",
      });
    }

    let wishlist = await Wishlist.findOne({ user: req.session.user_id });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.session.user_id,
        items: [],
      });
    }

    const exists = wishlist.items.some(
      (item) => item.product.toString() === productId
    );

    if (exists) {
      return res.json({
        success: false,
        message: "Already in wishlist",
        isInWishlist: true,
      });
    }

    wishlist.items.unshift({ product: productId });
    await wishlist.save();

    return res.json({
      success: true,
      message: "Added to wishlist",
      count: wishlist.items.length,
      isInWishlist: true,
    });
  } catch (error) {
    console.log("Error in adding to Wishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        redirect: "/login",
      });
    }

    const productId = req.body.productId;

    const wishlist = await Wishlist.findOne({ user: req.session.user_id });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    wishlist.items = wishlist.items.filter(
      (item) => item.product.toString() !== productId
    );
    await wishlist.save();
    return res.json({
      success: true,
      message: "Removed from wishlist",
      count: wishlist.items.length,
      isInWishlist: false,
    });
  } catch (error) {
    console.log("Error removing from wishlist:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = { getWishlist, addToWishlist, removeFromWishlist };