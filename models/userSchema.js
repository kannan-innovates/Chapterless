const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phone:{
    type: String,
    required: false,
    unique: true,
    sparse:  true,
    // default: null
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: false,
    
  },
  googleId: {
    type: String,
    unique: true,
    // sparse: true,
    // default: null, 
  },
  otp: {
    type: String,
    default: null, 
  },
  // otpExpiresAt: {
  //   type: Date,
  //   default: null, 
  // },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  cart: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    }
  ],
  wallet: {
    type: Number,
    default: 0,
  },
  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wishlist"
    }
  ],
  orderHistory: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order"
    }
  ],
  searchHistory: [{
    category:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category"
    }
  }]
}, {
  timestamps: true
},
);

module.exports = mongoose.model('User', userSchema);