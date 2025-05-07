const getProfile = async (req,res) => {
     try {
          res.render('profile')
     } catch (error) {
          console.log('Error in rendering profile page',error)
     }
}

module.exports = {getProfile}