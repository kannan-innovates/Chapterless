const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const productDetails = async (req, res) => {
  try {
    const productId = req.params.id; // Get the product ID from the URL
    const product = await Product.findById(productId).populate('category'); // Fetch the product and populate category

    if (!product || !product.isListed) {
      return res.status(404).render('pageNotFound'); // Handle if product not found or not listed
    }

    // Fetch related products (same category, exclude current product, limit to 4)
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: productId }, // Exclude the current product
      isListed: true
    }).limit(4);

    res.render('product-details', { product, relatedProducts });
  } catch (error) {
    console.log(`Error in rendering Product Details Page: ${error}`);
    res.status(500).send("Server Error");
  }
};

module.exports = { productDetails };