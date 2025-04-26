const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['signup', 'password-reset'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // expires: 300 // TTL of 5 minutes (300 seconds)
  }
});

// Create index on createdAt for TTL
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('OTP', otpSchema);