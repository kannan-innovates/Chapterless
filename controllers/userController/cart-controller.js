


const getCart = async (req,res) => {
     try {
          res.render('cart')
     } catch (error) {
          console.log('Error in rendering Cart')
     }
}

module.exports = {getCart}