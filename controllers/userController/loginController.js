const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");

const getLogin = async (req, res) => {
  try {
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

    req.session.user_id = existingUser._id;

    return res.status(200).json({
      success: true,
      message: "Welcome to Chapterless",
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
