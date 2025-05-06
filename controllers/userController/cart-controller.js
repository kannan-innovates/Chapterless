const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");

const getCart = async (req, res) => {
  try{
    res.render('cart')
  }catch(error){
    console.log('Error in rendering cart',error)
  }

}
module.exports = { getCart }
