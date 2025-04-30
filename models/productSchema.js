const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: 
  { type: String,
     required: true },
  author: {
     type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  regularPrice: { type: Number, required: true },
  salePrice: { type: Number, required: true },
  stock: { type: Number, required: true },
  pages: { type: Number, required: true },
  language: { type: String, required: true },
  publisher: { type: String, required: true },
  publishedDate: { type: Date },
  isbn: { type: String },
  mainImage: { type: String, required: true },
  subImages: [{ type: String }],
  isListed: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Product", productSchema);
