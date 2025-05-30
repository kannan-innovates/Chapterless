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
    enum: ['signup', 'password-reset', 'email-update'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

// Create index on createdAt for TTL (60 seconds = 1 minute)
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 });

module.exports = mongoose.model('OTP', otpSchema);