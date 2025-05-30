const Category = require("../../models/categorySchema");

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).sort({
      createdAt: -1,
    });
    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
};

module.exports = {
  getCategories,
};
