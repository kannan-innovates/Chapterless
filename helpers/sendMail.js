require("dotenv").config();
const nodemailer = require("nodemailer");

const sendOtpEmail = async (email, name, otp, subject, purpose = "signup") => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
      }
  });

  let messageText;

  switch (purpose) {
    case "resend":
      messageText = `Hello ${name},\n\nHere's your new OTP for Chapterless signup: ${otp}\n\nIf you didn't request this, please ignore.\n\nThanks,\nTeam Chapterless`;
      break;
    case "forgot-password":
      messageText = `Hello ${name},\n\nYour OTP to reset your Chapterless password is: ${otp}.\n\nThanks,\nTeam Chapterless`;
      break;
    default:
      messageText = `Hello ${name},\n\nYour OTP for Chapterless signup is: ${otp}\n\nThanks,\nTeam Chapterless`;
  }

  const mailOptions = {
    from: '"Chapterless" <your@email.com>',
    to: email,
    subject,
    text: messageText,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendOtpEmail;