const User = require("../../models/userSchema");
// const bcrypt = require("../../helpers/hash");
const bcrypt = require("bcrypt");
const { model } = require("mongoose");

const getAdminLogin = async (req, res) => {
  try {
    res.render("adminLogin");
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
    console.log(error);
  }
};

const postAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin not found or not authorized",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    req.session.admin_id = admin._id;

    return res.status(200).json({
      success: true,
      message: "Welcome Admin",
      redirectTo: '/admin/adminDashboard',
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Admin login error",
    });
  }
};

const getAdminDashboard = async (req, res) => {
  try {
    return res.render('adminDashboard')
   
  } catch (error) {
    console.error("Admin home error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load Home Page",
    });
  }
};

const logoutAdminDashboard = async (req,res) => {
  try{
    req.session.destroy((error) =>{
      if(error){
        console.log('Error in destroying session')
        return res.status(500).send('Logout Failed')
      }
      res.redirect('/adminLogin')
    })
  }catch(error){
    console.log('Error in AdminLogout',error);
    res.status(500).json({message:'Internal Server Error'})
  }
}

module.exports = { getAdminLogin, postAdminLogin,getAdminDashboard,logoutAdminDashboard};
