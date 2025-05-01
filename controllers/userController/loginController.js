const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const getLogin = async (req, res) => {
  try {
    // Apply cache-control headers here as well for added security
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    
    res.render("login");
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", success: false });
  }
};

const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      return res.status(401).json({
        success: false,
        message: "Email Not found",
      });
    }

    if (existingUser.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact support.",
      });
    }

    const verifiedPassword = await bcrypt.compare(
      password,
      existingUser.password
    );

    if (!verifiedPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid Email or Password",
      });
    }

    // Set user session
    req.session.user_id = existingUser._id;
    req.session.user_email = existingUser.email;
    
    // Ensure session is saved before sending response
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ success: false, message: "Session error" });
      }
      
      return res.status(200).json({
        success: true,
        message: "Welcome to Chapterless",
      });
    });
  } catch (error) {
    console.log("Signin ERROR", error);
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = {
  getLogin,
  postLogin,
};