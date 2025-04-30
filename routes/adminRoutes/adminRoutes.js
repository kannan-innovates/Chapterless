const express = require('express');
const adminRoute = express.Router();

const adminController = require('../../controllers/adminController/adminLoginController');
const adminUserController = require('../../controllers/adminController/getUserController');
const categoryController = require('../../controllers/adminController/categoryController');
const productController = require('../../controllers/adminController/productController.js');
const manageProductController = require('../../controllers/adminController/manageProducts');

const upload = require('../../config/multer');

// Admin Login
adminRoute.get('/adminLogin', adminController.getAdminLogin);
adminRoute.post('/adminLogin', adminController.postAdminLogin);

// Admin Dashboard
adminRoute.get('/adminDashboard', adminController.getAdminDashboard);
adminRoute.get('/adminLogout', adminController.logoutAdminDashboard);

// User Management
adminRoute.get('/getUsers', adminUserController.getUsers);
adminRoute.put('/getUsers/:id/block', adminUserController.blockUser);
adminRoute.put('/getUsers/:id/unblock', adminUserController.unblockUser);

// Category Management
adminRoute.get('/categories', categoryController.getCategory);
adminRoute.post('/categories', upload.single('image'), categoryController.addCategory);
adminRoute.put('/categories/:id', upload.single('image'), categoryController.editCategory);
adminRoute.put('/categories/:id/toggle', categoryController.toggleCategoryStatus);

// Product Management
adminRoute.get('/getProducts', productController.getProducts);
adminRoute.get('/add-product', manageProductController.getAddProduct);
adminRoute.post(
  '/products',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'subImages', maxCount: 3 },
  ]),
  productController.addProduct
);
adminRoute.put('/products/:id/toggle', productController.toggleProductStatus);

// Category List for Dropdown
adminRoute.get('/categories/list', async (req, res) => {
  try {
    const categories = await require('../../models/categorySchema').find({ isListed: true });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = adminRoute;