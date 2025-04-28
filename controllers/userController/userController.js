const categoryController = require("../../controllers/userController/categoryController")

const pageNotFound = async (req, res) => {
  try {
    res.render("page-404");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};

const loadHomePage = async (req, res) => {
  try {
    const categories = await categoryController.getCategories()
    return res.render("home",{categories});
  } catch (error) {
    console.log(`Error in rendering Home Page`);
    res.status(500).send(`Server Error`);
  }
};

module.exports = {
  loadHomePage,
  pageNotFound,
};
