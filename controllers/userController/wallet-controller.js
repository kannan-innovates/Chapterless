const getWallet = async (req,res) => {
     try {
          res.render('wallet')
     } catch (error) {
          console.log(error);
     }
}

module.exports = {
     getWallet,
}