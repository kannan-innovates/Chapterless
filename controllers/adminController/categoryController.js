const Category = require("../../models/categorySchema");


const getCategory = async (req,res) => {
  try{
    res.render('categories')
  }catch(error){
    console.log("Error in rendering Categories Page.")
  }
}

module.exports = {getCategory}