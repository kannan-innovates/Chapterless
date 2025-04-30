const productDetails = async (req,res) => {
     try {
          res.render('product-details')
     } catch (error) {
          console.log(`Error in rendering shop Page ${error}`)
     }
}

module.exports = {productDetails}