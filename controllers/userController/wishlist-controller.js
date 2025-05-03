

const  getWishlist = async (req,res) => {
     try {
          res.render('wishlist')
     } catch (error) {
          console.log('Error in rendering wishlist')
     }
}

module.exports = {getWishlist}