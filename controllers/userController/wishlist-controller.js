const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const productSchema = require("../../models/productSchema");

const getWishlist = async (req, res) => {
 try {
  res.render('wishlist')
 } catch (error) {
  console.log('Error in rendering wishlist',error)
 }
}
module.exports = { getWishlist}