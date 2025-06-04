const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      enum: ["general", "order", "recommendation", "feedback", "partnership", "other"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["new", "read", "replied", "closed"],
      default: "new",
    },
    isReplied: {
      type: Boolean,
      default: false,
    },
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for searching and sorting
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ subject: 1 });

module.exports = mongoose.model("Contact", contactSchema);
