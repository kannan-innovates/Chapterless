const categoryController = require("../../controllers/userController/categoryController");
const Product = require('../../models/productSchema');

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
    const topSellingProducts = await Product.find()
      .sort({ stock: -1 }) // Highest stock
      .limit(LIMIT);

    // New arrivals (based on dateAdded)
    const newArrivals = await Product.find()
      .sort({ createdAt: -1  }) // Newest first
      .limit(LIMIT);

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