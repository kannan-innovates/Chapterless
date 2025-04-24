const User = require("../../models/userSchema");
const hashPasswordHelper = require("../../helpers/hash");
const sendOtpEmail = require("../../helpers/sendMail");
const { session } = require("passport");

const getForgotPassword = async (req, res) => {
  try {
    res.render("forgotPassword");
  } catch (error) {
    console.log("Error in getting getForgotPassword", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
    });
  }
};

const postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email not exists",
      });
    }

    const otpGenerator = () =>
      Math.floor(100000 + Math.random() * 900000).toString();

    const otp = otpGenerator();
    console.log(otp);

    
    const otpExpires = new Date(Date.now() + 30 * 1000);

    let subjectContent = "OTP for Resetting your Password";
    await sendOtpEmail(email, otp, subjectContent);

    req.session.user_email = email;

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    return res.status(200).json({
      message: "OTP sent successfully",
      success: true,
      expiresIn: 30 // Send expiration time to frontend in seconds
    });
  } catch (error) {
    console.log("Error in sending otp for Forgot Password");
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const  email  = req.session.user_email

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Email not exists",
      });
    }

    const otpGenerator = () =>
      Math.floor(100000 + Math.random() * 900000).toString();

    const otp = otpGenerator();
    console.log("New OTP generated:", otp);
    
    // Set expiration to 30 seconds
    const otpExpires = new Date(Date.now() + 30 * 1000);

    let subjectContent = "New OTP for Resetting your Password";
    await sendOtpEmail(email, otp, subjectContent);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    return res.status(200).json({
      message: "New OTP sent successfully",
      success: true,
      expiresIn: 30 
    });
  } catch (error) {
    console.log("Error in resending OTP");
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};



const getOtpForgotPassword = async (req, res) => {
  try {
    res.render("otpForgotPassword"); 
  } catch (error) {
    console.log("Error in getting OTP verification page", error);
    res.status(400).json({
      success: false,
      message: "Server Error",
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log(otp);
    const email = req.session.user_email;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired! Please request a new one",
      });
    }

    if (String(otp) !== String(user.otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Clear OTP after successful verification
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verification successful. You can now reset your password",
    });
  } catch (error) {
    console.log("Error verifying reset OTP", error);
    return res.status(400).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getResetPassword = async (req, res) => {
  try {
    res.render("resetPasswordForm");
  } catch (error) {
    return res.status(400).json({ message: "Server Error" });
  }
};

const patchResetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords don't match",
      });
    }

    const email = req.session.user_email;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hashedPassword = await hashPasswordHelper.hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    req.session.destroy();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. Please login again.",
    });
  } catch (error) {
    console.log("Error in updating password", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = { 
  getForgotPassword, 
  postForgotPassword, 
  getOtpForgotPassword, 
  verifyOtp,
  getResetPassword, 
  patchResetPassword,
  resendOtp  
};