const Category = require("../../models/categorySchema");
const cloudinary = require("../../config/cloudinary");
const fs = require("fs");

const getCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    };

    const totalCategories = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort({ createdAt: -1 }) // Sort by latest first
      .skip(skip)
      .limit(limit);

    res.render("categories", {
      categories,
      currentPage: page,
      totalPages: Math.ceil(totalCategories / limit),
      search,
    });
  } catch (error) {
    console.error("Error in rendering Categories Page:", error);
    res.status(500).send("Server Error");
  }
};

// Add Category
// Updated addCategory function
const addCategory = async (req, res) => {
  try {
    const { name, description, isListed } = req.body;

    // Check if category already exists (case insensitive)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
      // Return 200 status with a warning flag instead of 400 error
      return res.status(200).json({
        warning: true,
        message: "This category already exists in the database."
      });
    }

    // Upload image to Cloudinary
    let imageUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
        quality: 'auto:best',
        fetch_format: 'auto',
        flags: 'preserve_transparency'
      });
      imageUrl = result.secure_url;
      // Delete local file after upload
      fs.unlinkSync(req.file.path);
    }

    const category = new Category({
      name,
      description,
      image: imageUrl,
      isListed: isListed === "on",
    });

    await category.save();
    res.status(201).json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

//  editCategory function
const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isListed } = req.body;

    // Check if category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check for duplicate name (excluding current category)
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id }
    });
    if (existingCategory) {
      // Return 200 status with a warning flag instead of 400 error
      return res.status(200).json({
        warning: true,
        message: "Another category with this name already exists."
      });
    }

    // Upload new image if provided
    let imageUrl = category.image;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "categories",
        quality: 'auto:best',
        fetch_format: 'auto',
        flags: 'preserve_transparency'
      });
      imageUrl = result.secure_url;
      // Delete local file
      fs.unlinkSync(req.file.path);
    }

    category.name = name;
    category.description = description;
    category.image = imageUrl;
    category.isListed = isListed === "on";

    await category.save();
    res.json({ message: "Category updated successfully" });
  } catch (error) {
    console.error("Error editing category:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

// Toggle List/Unlist Category
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    category.isListed = !category.isListed;
    await category.save();
    res.json({
      message: `Category ${
        category.isListed ? "listed" : "unlisted"
      } successfully`,
    });
  } catch (error) {
    console.error("Error toggling category status:", error);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = {
  getCategory,
  addCategory,
  editCategory,
  toggleCategoryStatus,
};