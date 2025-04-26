const User = require("../../models/userSchema");
const OTP = require("../../models/otpSchema"); // Import the new OTP model
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

    let subjectContent = "Verify your email for Chapterless";
    await sendOtpEmail(email, fullName, otp, subjectContent);

    const hashedPassword = await hashPasswordHelper.hashPassword(password);

    // Create user without OTP fields
    const newUser = new User({
      fullName,
      email,
      phone: phoneNumber,
      password: hashedPassword,
      // No longer storing OTP in user document
    });

    await newUser.save();

    // Store OTP in separate collection
    const otpDoc = new OTP({
      email,
      otp,
      purpose: 'signup'
    });
    
    await otpDoc.save();
    
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
    
    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found", success: false });
    }

    // Find OTP document
    const otpDoc = await OTP.findOne({ email, purpose: 'signup' });
    
    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired or doesn't exist. Please request a new one.",
      });
    }

    if (otp !== otpDoc.otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // OTP is valid - verify the user
    user.isVerified = true;
    await user.save();
    
    // Delete the OTP document
    await OTP.deleteOne({ _id: otpDoc._id });

    return res.status(200).json({
      success: true,
      message: "OTP verification successful",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
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

    // Delete any existing OTP for this email and purpose
    await OTP.deleteMany({ email, purpose: 'signup' });
    
    // Create new OTP document
    const otpDoc = new OTP({
      email,
      otp,
      purpose: 'signup'
    });
    
    await otpDoc.save();

    let subjectContent = "Your new OTP for Chapterless";
    await sendOtpEmail(email, user.fullName, otp, subjectContent);

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