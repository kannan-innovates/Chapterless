const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const shopPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const categoryId = req.query.category || null;
    let query = { isListed: true }; // Add filter for listed products

    if (categoryId) {
      query.category = categoryId;
    }

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category')
      .skip(skip)
      .limit(limit);

    const categories = await Category.find({ isListed: true });

    const totalPages = Math.ceil(totalProducts / limit);

    res.render('shop-page', {
      products,
      categories,
      currentPage: page,
      totalPages,
      categoryId,
    });
  } catch (error) {
    console.log(`Error in rendering Shop Page: ${error}`);
    res.status(500).send("Server Error");
  }
};

module.exports = { shopPage };