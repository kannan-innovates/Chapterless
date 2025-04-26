const Category = require('../../models/categorySchema');

const getCategory = async (req,res) => {
     try {
          res.render('categories')
     } catch (error) {
          console.log('Error in fetching categories',error)
          res.status(500).json({
               message:'Failed to load Categories',
               success : false
          })
     }
}

module.exports = {getCategory}