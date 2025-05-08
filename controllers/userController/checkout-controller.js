const getCheckout = async (req,res) => {
     try {
          res.render('checkout')
     } catch (error) {
          console.log('Error in rendering checkout page',error)
     }
}
module.exports = {getCheckout}