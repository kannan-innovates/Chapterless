const User = require("../../models/userSchema");
const hashPasswordHelper = require("../../helpers/hash");
const sendOtpEmail = require("../../helpers/sendMail");
const { text } = require("express");

const getOtp = async (req, res) => {
  try {
    res.render("verify-otp");
  } catch (error) {
    console.log("error during render", error);
    res.status(500).json({message:"Server error"});
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
        .json({ success: false, message: "User not found" ,success:false});
    }

    console.log("db otp", user.otp);

    if (otp !== user.otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verification successful",
    });
  } catch (error) {
    console.log(error);
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
    });

    req.session.email = email;
    await newUser.save();

    return res.json({ message: "redirecting to otp page", success: true });
  } catch (error) {
    console.error(`Error in posting user`, error);

    // if (error.code === 11000) {
    //   return res.status(409).json({
    //     success: false,
    //     message: "Phone number or email already exists.",
    //   });
    // }

    
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

// const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });

//     if (!otpRecord) {
//       return res.status(404).json({
//         success: false,
//         message: "OTP not found. Please sign up again.",
//       });
//     }

//     if (otpRecord.otp !== otp) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid OTP. Please check again.",
//       });
//     }

//     if (otpRecord.expiresAt < new Date()) {
//       return res.status(410).json({
//         success: false,
//         message: "OTP expired. Please request a new one.",
//       });
//     }

//     // Mark user as verified
//     const updatedUser = await User.findOneAndUpdate(
//       { email },
//       { isVerified: true },
//       { new: true }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found. Try signing up again.",
//       });
//     }

//     // Delete OTP after success
//     await Otp.deleteMany({ email });

//     return res.status(200).json({
//       success: true,
//       message: "Email verified successfully!",
//     });
//   } catch (error) {
//     console.error("Error in verifyOtp:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

module.exports = { getSignup, postSignup, verifyOtp, getOtp };
