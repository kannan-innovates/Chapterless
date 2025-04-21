const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    // required: true,
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 5 * 60 * 1000, // 5 minutes from now
  },
  signupData: {
    fullName: String,
    phone: String,
    password: String,
  },
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);