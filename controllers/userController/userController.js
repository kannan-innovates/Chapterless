const categoryController = require("../../controllers/userController/categoryController");
const Product = require('../../models/productSchema');
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper");

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadHomePage = async (req, res) => {
  try {
    const categories = await categoryController.getCategories();

    const LIMIT = 4;

    // Top selling (assumed based on stock, ideally use soldCount)
    const topSellingProducts = await Product.find({ isListed: true, isDeleted: false })
      .populate('category')  // Populate category for offer calculation
      .sort({ stock: -1 }) // Highest stock
      .limit(LIMIT);

    // New arrivals (based on dateAdded)
    const newArrivals = await Product.find({ isListed: true, isDeleted: false })
      .populate('category')  // Populate category for offer calculation
      .sort({ createdAt: -1  }) // Newest first
      .limit(LIMIT);

    // Calculate offers for top selling products
    for (const product of topSellingProducts) {
      const offer = await getActiveOfferForProduct(
        product._id,
        product.category._id,
        product.regularPrice
      );

      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(
        offer,
        product.regularPrice
      );

      product.activeOffer = offer;
      product.discountPercentage = discountPercentage;
      product.discountAmount = discountAmount;
      product.finalPrice = finalPrice;
      product.regularPrice = product.regularPrice || product.salePrice;
    }

    // Calculate offers for new arrivals
    for (const product of newArrivals) {
      const offer = await getActiveOfferForProduct(
        product._id,
        product.category._id,
        product.regularPrice
      );

      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(
        offer,
        product.regularPrice
      );

      product.activeOffer = offer;
      product.discountPercentage = discountPercentage;
      product.discountAmount = discountAmount;
      product.finalPrice = finalPrice;
      product.regularPrice = product.regularPrice || product.salePrice;
    }

    return res.render("home", { categories, topSellingProducts, newArrivals });
  } catch (error) {
    console.log(`Error in rendering Home Page: ${error}`);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadHomePage,
  pageNotFound,
};