const Product = require('../../models/productSchema');

const getAddProduct = async (req,res) => {
     try {
          res.render('manageProducts.ejs')
     } catch (error) {
          res.status(500).json({
               message: 'Server Error'
          })
     }
}


module.exports = {getAddProduct}