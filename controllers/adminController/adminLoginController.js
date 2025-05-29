const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const getAdminLogin = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.render("adminLogin");
  } catch (error) {
    console.error("Error loading admin login page:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const postAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin user
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin not found or not authorized",
      });
    }

    // Check if admin is blocked
    if (admin.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "This admin account has been blocked",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Set session
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

// Dashboard functionality moved to dashboard-controller.js

const logoutAdminDashboard = async (req, res) => {
  try {
    req.session.destroy((error) => {
      if (error) {
        console.error('Error destroying session:', error);
        return res.status(500).send('Logout Failed');
      }


      res.clearCookie('connect.sid');
      res.redirect('/admin/adminLogin');
    });
  } catch (error) {
    console.error('Error in AdminLogout:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

module.exports = {
  getAdminLogin,
  postAdminLogin,
  logoutAdminDashboard
};