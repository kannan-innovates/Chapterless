const User = require("../../models/userSchema");

const getProfile = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        message: "Please Login",
      });
    }
    const user = await User.findOne({ _id: req.session.user_id });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User Not Found" });
    }

    res.render("profile", { user });
  } catch (error) {
    console.log("Error in rendering profile page", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = { getProfile };
