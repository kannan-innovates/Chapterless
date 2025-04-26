const User = require("../../models/userSchema");
const hashPasswordHelper = require("../../helpers/hash");
const sendOtpEmail = require("../../helpers/sendMail");
const { text } = require("express");

const getOtp = async (req, res) => {
  try {
    res.render("verify-otp");
  } catch (error) {
    console.log("error during render", error);
    res.status(500).json({ message: "Server error" });
  }
};

const otpGenerator = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const getSignup = async (req, res) => {
  try {
    res.render("signup");
  } catch (error) {
    console.log(`Error:,${error.message}`);
  }
};

const postSignup = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, password } = req.body;

    const existingUser = await User.findOne({
      $or: [{ email }, { phone: phoneNumber }],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email or phone number already exists!",
      });
    }

    const otp = otpGenerator();
    console.log(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    let subjectContent = "Verify your email for Chapterless";
    await sendOtpEmail(email, fullName, otp, subjectContent);

    const hashedPassword = await hashPasswordHelper.hashPassword(password);

    const newUser = new User({
      fullName,
      email,
      phone: phoneNumber,
      password: hashedPassword,
      otp: otp,
      otpExpires: expiresAt,
    });

    await newUser.save();

    req.session.email = email;

    return res.json({ message: "redirecting to otp page", success: true });
  } catch (error) {
    console.error(`Error in posting user`, error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = req.session.email;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found", success: false });
    }

    console.log("db otp", user.otp);

    if (user.otpExpires && user.otpExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (otp !== user.otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verification successful",
    });
  } catch (error) {
    console.log(error);
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.session.email;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otp = otpGenerator();
    console.log(otp);
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    let subjectContent = "Your new OTP for Chapterless";
    await sendOtpEmail(email, user.fullName, otp, subjectContent);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = { getSignup, postSignup, verifyOtp, getOtp, resendOtp };
