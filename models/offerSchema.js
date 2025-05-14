// models/offerSchema.js
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  discountType: {
    type: String,
    enum: ['fixed', 'percentage'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  applicableOn: {
    type: String,
    enum: ['product', 'category'],
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: function () {
      return this.applicableOn === 'product';
    },
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: function () {
      return this.applicableOn === 'category';
    },
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin', // Assuming an Admin model exists and its ID is in req.session.admin._id
  }
}, {
  timestamps: true,
});

// Index for searching and sorting
offerSchema.index({ title: 'text' });
offerSchema.index({ isActive: 1, endDate: 1, startDate: 1 });

module.exports = mongoose.model('Offer', offerSchema);