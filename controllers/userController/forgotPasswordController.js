const User = require("../../models/userSchema");
const OTP = require("../../models/otpSchema");
const hashPasswordHelper = require("../../helpers/hash");
const { sendOtpEmail } = require("../../helpers/sendMail");

const {
  validateBasicOtp,
  validateOtpSession,
} = require("../../validators/user/basic-otp-validator");
const { HttpStatus } = require("../../helpers/status-code");

const getForgotPassword = async (req, res) => {
  try {
    res.render("forgotPassword");
  } catch (error) {
    console.log("Error in getting getForgotPassword", error);
    res.status(HttpStatus.BAD_REQUEST).json({
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
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Email not exists",
      });
    }

    const otpGenerator = () =>
      Math.floor(100000 + Math.random() * 900000).toString();

    const otp = otpGenerator();

    // Delete any existing OTP docs for this email and purpose
    await OTP.deleteMany({ email, purpose: "password-reset" });

    // Create new OTP document with 30 second expiry for password reset
    const otpDoc = new OTP({
      email,
      otp,
      purpose: "password-reset",
      createdAt: new Date(), // Will expire in 5 minutes by default
    });
    console.log(otp);

    await otpDoc.save();

    let subjectContent = "Reset Your Chapterless Password";
    await sendOtpEmail(email, user.fullName, otp, subjectContent, "forgot-password");

    req.session.user_email = email;

    return res.status(HttpStatus.OK).json({
      message: "OTP sent successfully",
      success: true,
      expiresIn: 60,
    });
  } catch (error) {
    console.log("Error in sending otp for Forgot Password");
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.session.user_email;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Email not exists",
      });
    }

    const otpGenerator = () =>
      Math.floor(100000 + Math.random() * 900000).toString();

    const otp = otpGenerator();
    console.log("New OTP generated:", otp);

    // Delete any existing OTP docs for this email
    await OTP.deleteMany({ email, purpose: "password-reset" });

    // Create new OTP document
    const otpDoc = new OTP({
      email,
      otp,
      purpose: "password-reset",
    });

    await otpDoc.save();

    let subjectContent = "New Password Reset Code - Chapterless";
    await sendOtpEmail(email, user.fullName, otp, subjectContent, "forgot-password");

    return res.status(HttpStatus.OK).json({
      message: "New OTP sent successfully",
      success: true,
      expiresIn: 60,
    });
  } catch (error) {
    console.log("Error in resending OTP");
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
    res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: "Server Error",
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    // Basic OTP validation using utility
    const otpValidation = validateBasicOtp(otp);
    if (!otpValidation.isValid) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: otpValidation.message,
      });
    }

    // Session validation using utility
    const sessionValidation = validateOtpSession(req, "password-reset");
    if (!sessionValidation.isValid) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: sessionValidation.message,
        sessionExpired: sessionValidation.sessionExpired,
      });
    }

    console.log("Verifying OTP:", otp);
    const email = req.session.user_email;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
    }

    // Find OTP document
    const otpDoc = await OTP.findOne({ email, purpose: "password-reset" });

    if (!otpDoc) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "OTP has expired! Please request a new one",
      });
    }

    if (String(otp) !== String(otpDoc.otp)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Clear OTP after successful verification
    await OTP.deleteOne({ _id: otpDoc._id });

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "OTP verification successful. You can now reset your password",
    });
  } catch (error) {
    console.log("Error verifying reset OTP", error);
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message: "Server Error",
    });
  }
};

const getResetPassword = async (req, res) => {
  try {
    res.render("resetPasswordForm");
  } catch (error) {
    return res.status(HttpStatus.BAD_REQUEST).json({ message: "Server Error" });
  }
};

const patchResetPassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Passwords don't match",
      });
    }

    const email = req.session.user_email;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
    }

    const hashedPassword = await hashPasswordHelper.hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    req.session.destroy();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Password updated successfully. Please login again.",
    });
  } catch (error) {
    console.log("Error in updating password", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
  resendOtp,
};
