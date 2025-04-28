const Product = require("../../models/productSchema");

const getProducts = async function (req, res) {
  try {
    // Render the template with a dummy search value for UI testing
    res.render("getProducts", {
      search: "", // Pass an empty string to avoid ReferenceError
      products: [], // Optional: Pass an empty array for now (if your template loops over products)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

module.exports = { getProducts };