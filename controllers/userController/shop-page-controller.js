const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');

const shopPage = async (req,res) => {
     try {
          const categories = await Category.find({isListed: true});
          const products = await Product.find({isListed: true}).populate('category');
          return res.render('shop-page',{categories, products});
       
     } catch (error) {
          console.log(`Error in rendering shop Page ${error}`);
          res.status(500).send("Server Error");
     }
}

module.exports = {shopPage}