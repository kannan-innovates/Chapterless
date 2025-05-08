const getAddress = async (req,res) => {
     try {
          res.render('address')
     } catch (error) {
          console.log('Error in rendering address page',error)
     }
}

module.exports = {getAddress}