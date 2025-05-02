const Product = require('../../models/productSchema');

const searchProducts = async (req, res) => {
  try {
    const query = req.query.q || '';
    if (query.length < 2) {
      return res.json([]);
    }

    const products = await Product.find({
      isListed: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
      ],
    })
      .select('title author mainImage _id')
      .limit(10); // Limit to 10 results for performance

    res.json(products);
  } catch (error) {
    console.error(`Error in searchProducts: ${error}`);
    res.status(500).json({ error: 'Server Error' });
  }
};

module.exports = { searchProducts };