const User = require("../../models/userSchema");
const OTP = require("../../models/otpSchema");
const sendOtpEmail = require("../../helpers/sendMail");
const upload = require("../../config/multer");
const cloudinary = require("../../config/cloudinary");
const path = require("path");
const fs = require("fs");

// Get Profile
const getProfile = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        message: "Please Login",
      });
    }
    const user = await User.findOne({ _id: req.session.user_id }).lean();
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User Not Found" });
    }
    console.log("User profileImage:", user.profileImage); // Debug log
    res.render("profile", { user });
  } catch (error) {
    console.error("Error in rendering profile page:", error);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};

// Update Profile
const updateProfile = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        message: "Please login to update profile",
      });
    }

    const { fullName, phone } = req.body;

    // Validate inputs
    if (!fullName || fullName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Full name must be at least 3 characters",
      });
    }

    const nameWords = fullName.trim().split(/\s+/);
    if (nameWords.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide both first and last name",
      });
    }

    if (!/^[A-Za-z\s'-]+$/.test(fullName.trim())) {
      return res.status(400).json({
        success: false,
        message: "Full name contains invalid characters",
      });
    }

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "");
      if (
        cleanPhone.length !== 10 &&
        (cleanPhone.length < 11 || cleanPhone.length > 15)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number must be 10 digits or include a valid country code",
        });
      }
      if (
        /^(.)\1+$/.test(cleanPhone) ||
        /^0{10}$/.test(cleanPhone) ||
        /^1{10}$/.test(cleanPhone)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
        });
      }

      // Check for existing phone number
      const existingPhone = await User.findOne({
        phone: phone.trim(),
        _id: { $ne: req.session.user_id },
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use",
        });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.session.user_id,
      {
        fullName: fullName.trim(),
        phone: phone ? phone.trim() : undefined,
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        email: updatedUser.email,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Phone number already in use",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// Upload Profile Image
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        message: "Please login to upload image",
      });
    }

    // Use multer middleware to handle file upload
    upload.single("profileImage")(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to upload image",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      // Upload to Cloudinary
      const tempFilePath = path.join(
        __dirname,
        "../../Uploads",
        req.file.filename
      );
      console.log(`Uploading to Cloudinary: ${tempFilePath}`);
      let cloudinaryResult;
      try {
        cloudinaryResult = await cloudinary.uploader.upload(tempFilePath, {
          folder: "profile_images",
          transformation: [
            { width: 300, height: 300, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
          ],
        });
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
        });
      }

      // Delete temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`Deleted temporary file: ${tempFilePath}`);
      }

      // Delete previous image from Cloudinary if exists
      const user = await User.findById(req.session.user_id);
      if (user.profileImage) {
        const publicId = user.profileImage
          .split("/")
          .pop()
          .split(".")[0]
          .split("profile_images/")[1];
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(`profile_images/${publicId}`);
            console.log(
              `Deleted previous Cloudinary image: profile_images/${publicId}`
            );
          } catch (deleteError) {
            console.error(
              "Error deleting previous Cloudinary image:",
              deleteError
            );
            
          }
        }
      }

      // Update user with new Cloudinary image URL
      const imageUrl = cloudinaryResult.secure_url;
      const updatedUser = await User.findByIdAndUpdate(
        req.session.user_id,
        { profileImage: imageUrl },
        { new: true }
      ).lean();

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      console.log(`Profile image updated to: ${imageUrl}`);
      res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        profileImage: imageUrl,
      });
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    // Clean up temporary file if it exists
    const tempFilePath = req.file
      ? path.join(__dirname, "../../Uploads", req.file.filename)
      : null;
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    res.status(500).json({
      success: false,
      message: "Failed to upload profile image",
    });
  }
};

// Request Email Update
const requestEmailUpdate = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({
        success: false,
        message: "Please login to update email",
      });
    }

    const { email } = req.body;
    if (
      !email ||
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Check for disposable email domains
    const disposableDomains = [
      "mailinator.com",
      "tempmail.com",
      "temp-mail.org",
      "guerrillamail.com",
      "yopmail.com",
      "sharklasers.com",
    ];
    const domain = email.split("@")[1];
    if (disposableDomains.includes(domain)) {
      return res.status(400).json({
        success: false,
        message: "Please use a non-disposable email address",
      });
    }

    const user = await User.findById(req.session.user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (email.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "New email must be different from current email",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email address already in use",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.deleteMany({
      email: email.toLowerCase(),
      purpose: "email-update",
    });
    await OTP.create({
      email: email.toLowerCase(),
      otp,
      purpose: "email-update",
    });
    console.log(`Generated OTP: ${otp}`);

    // Send OTP email
    try {
      await sendOtpEmail(
        email,
        user.fullName,
        otp,
        "Email Update Verification",
        "email-update"
      );
    } catch (emailError) {
      console.error("Email delivery failed:", emailError);
      // Clean up OTP record to avoid stale OTPs
      await OTP.deleteMany({
        email: email.toLowerCase(),
        purpose: "email-update",
      });
      return res.status(500).json({
        success: false,
        message:
          "Email failed to send. Please check your email service configuration or try again later.",
      });
    }

    // Store new email in session for verification
    req.session.newEmail = email.toLowerCase();

    res.status(200).json({
      success: true,
      message: "OTP sent to new email address",
    });
  } catch (error) {
    console.error("Error requesting email update:", error);
    // Clean up OTP record in case of other errors
    await OTP.deleteMany({
      email: req.body.email?.toLowerCase(),
      purpose: "email-update",
    });
    res.status(500).json({
      success: false,
      message: "Failed to process email update request. Please try again.",
    });
  }
};

// Verify Email OTP
const verifyEmailOtp = async (req, res) => {
  try {
    if (!req.session.user_id || !req.session.newEmail) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or invalid session",
      });
    }

    const { otp } = req.body;
    if (!otp || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 6-digit OTP",
      });
    }

    const otpRecord = await OTP.findOne({
      email: req.session.newEmail,
      otp,
      purpose: "email-update",
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update user's email
    const updatedUser = await User.findByIdAndUpdate(
      req.session.user_id,
      { email: req.session.newEmail, isVerified: true },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Clean up
    await OTP.deleteMany({
      email: req.session.newEmail,
      purpose: "email-update",
    });
    delete req.session.newEmail;

    res.status(200).json({
      success: true,
      message: "Email updated successfully",
      email: updatedUser.email,
    });
  } catch (error) {
    console.error("Error verifying email OTP:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email address already in use",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

// Resend Email OTP
const resendEmailOtp = async (req, res) => {
  try {
    if (!req.session.user_id || !req.session.newEmail) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized or invalid session",
      });
    }

    const user = await User.findById(req.session.user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.deleteMany({
      email: req.session.newEmail,
      purpose: "email-update",
    });
    await OTP.create({
      email: req.session.newEmail,
      otp,
      purpose: "email-update",
    });

    // Send OTP email
    try {
      await sendOtpEmail(
        req.session.newEmail,
        user.fullName,
        otp,
        "Email Update Verification",
        "email-update"
      );
    } catch (emailError) {
      console.error("Email delivery failed for resend:", emailError);
      // Clean up OTP record
      await OTP.deleteMany({
        email: req.session.newEmail,
        purpose: "email-update",
      });
      return res.status(500).json({
        success: false,
        message:
          "Email failed to send. Please check your email service configuration or try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent to email address",
    });
  } catch (error) {
    console.error("Error resending email OTP:", error);
    // Clean up OTP record in case of other errors
    await OTP.deleteMany({
      email: req.session.newEmail,
      purpose: "email-update",
    });
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP. Please try again.",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  requestEmailUpdate,
  verifyEmailOtp,
  resendEmailOtp,
};
