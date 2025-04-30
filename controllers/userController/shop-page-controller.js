const shopPage = async (req,res) => {
     try {
          res.render('shop-page')
     } catch (error) {
          console.log(`Error in rendering shop Page ${error}`)
     }
}

module.exports = {shopPage}