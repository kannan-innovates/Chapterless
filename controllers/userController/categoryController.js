const Category = require("../../models/categorySchema");

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).sort({
      createdAt: -1,
    });
    return categories; // Return categories for use in home controller
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
};

module.exports = {
  getCategories,
};
