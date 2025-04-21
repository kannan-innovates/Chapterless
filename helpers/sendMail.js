require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOtpEmail = async (toEmail, name, otp,subjectContent) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Chapterless 📚" <${process.env.EMAIL}>`,
      to: toEmail,
      subject:subjectContent,
      text: `Hello ${name},\n\nYour OTP for Chapterless signup is: ${otp}\n\nThanks,\nTeam Chapterless`,
    };

    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully");
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};

module.exports = sendOtpEmail;