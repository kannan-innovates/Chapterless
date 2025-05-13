const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const { hashPassword } = require("../../helpers/hash");

// Change Password
const changePassword = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        message: "Please login to change password",
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        field: !currentPassword
          ? "currentPassword"
          : !newPassword
          ? "newPassword"
          : "confirmPassword",
      });
    }

    // Validate new password complexity
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9!@#$%^&*(),.?":{}|<>]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters with uppercase, lowercase, and number/special character",
        field: "newPassword",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match",
        field: "confirmPassword",
      });
    }

    const user = await User.findById(req.session.user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password cannot be changed for accounts created via Google",
        field: "currentPassword",
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
        field: "currentPassword",
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
        field: "newPassword",
      });
    }

    const hashedNewPassword = await hashPassword(newPassword);

    user.password = hashedNewPassword;
    await user.save();
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password. Please try again.",
    });
  }
};

module.exports = { changePassword };
