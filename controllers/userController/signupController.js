const User = require("../../models/userSchema");
const OTP = require("../../models/otpSchema"); // Import the new OTP model
const hashPasswordHelper = require("../../helpers/hash");
const sendOtpEmail = require("../../helpers/sendMail");
const { validateBasicOtp, validateOtpSession } = require("../../validators/user/basic-otp-validator");
const { HttpStatus } = require("../../helpers/status-code");

const getOtp = async (req, res) => {
  try {
    res.render("verify-otp");
  } catch (error) {
    console.log("error during render", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Server error" });
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

    // Trim and sanitize inputs
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();
    const trimmedPhone = phoneNumber.trim();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: trimmedEmail }, { phone: trimmedPhone }],
    });

    if (existingUser) {
      return res.status(HttpStatus.CONFLICT).json({
        success: false,
        message: "User with this email or phone number already exists!",
      });
    }

    // Generate OTP
    const otp = otpGenerator();
    console.log("Generated OTP:", otp);

    const subjectContent = "Verify your email for Chapterless";

    // ✅ Try sending the email first
    try {
      await sendOtpEmail(trimmedEmail, trimmedName, otp, subjectContent,"signup");
    } catch (err) {
      
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send OTP email. Please try again later.",
      });
    }

    const hashedPassword = await hashPasswordHelper.hashPassword(password);

    // Delete any existing OTPs (optional but safe)
    await OTP.deleteMany({ email: trimmedEmail, purpose: "signup" });

    // Store OTP in DB
    const otpDoc = new OTP({
      email: trimmedEmail,
      otp,
      purpose: "signup",
    });
    await otpDoc.save();

    // Temporarily store user data in session
    req.session.tempUser = {
      fullName: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      password: hashedPassword,
    };

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "OTP sent successfully. Redirecting to OTP page.",
    });

  } catch (error) {
    console.error("Error in postSignup:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error",
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
    const sessionValidation = validateOtpSession(req, 'signup');
    if (!sessionValidation.isValid) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: sessionValidation.message,
        sessionExpired: sessionValidation.sessionExpired,
      });
    }

    const tempUser = req.session.tempUser;

    const otpDoc = await OTP.findOne({ email: tempUser.email, purpose: "signup" });

    if (!otpDoc) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "OTP has expired or doesn't exist. Please request a new one.",
      });
    }

    if (otp !== otpDoc.otp) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid OTP"
      });
    }


    const newUser = new User({
      fullName: tempUser.fullName,
      email: tempUser.email,
      phone: tempUser.phone,
      password: tempUser.password,
      isVerified: true, 
    });
    await newUser.save();

    // Clean up
    await OTP.deleteOne({ _id: otpDoc._id });
    delete req.session.tempUser;

    return res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error) {
    console.log("Error in verifyOtp:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const resendOtp = async (req, res) => {
  try {
    const email = req.session.tempUser?.email;

    if (!email) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Session expired. Please sign up again.",
      });
    }

    const otp = otpGenerator();
    console.log("Resending OTP:", otp);

    // Delete old OTP
    await OTP.deleteMany({ email, purpose: "signup" });

    // Save new OTP
    const otpDoc = new OTP({
      email,
      otp,
      purpose: "signup",
    });
    await otpDoc.save();

    const fullName = req.session.tempUser.fullName;
    const subjectContent = "Your new OTP for Chapterless";

    await sendOtpEmail(email, fullName, otp, subjectContent, "resend");

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
module.exports = { getSignup, postSignup, verifyOtp, getOtp, resendOtp };