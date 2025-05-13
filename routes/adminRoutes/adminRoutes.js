const express = require('express');
const adminRoute = express.Router();

const adminController = require('../../controllers/adminController/adminLoginController');
const adminUserController = require('../../controllers/adminController/getUserController');
const categoryController = require('../../controllers/adminController/categoryController');
const productController = require('../../controllers/adminController/productController.js');
const manageProductController = require('../../controllers/adminController/manageProducts');

const manageOrderController = require('../../controllers/adminController/manage-orders.js')

// Import admin middleware
const { isAdminAuthenticated, isAdminNotAuthenticated, preventCache } = require('../../middlewares/adminMiddleware');

const upload = require('../../config/multer');

// Public admin routes (no authentication required)
adminRoute.get('/adminLogin', isAdminNotAuthenticated, preventCache, adminController.getAdminLogin);
adminRoute.post('/adminLogin', isAdminNotAuthenticated, adminController.postAdminLogin);

// Protected admin routes (authentication required)
// Apply middleware to all protected routes

adminRoute.use(isAdminAuthenticated);
adminRoute.use(preventCache);

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

adminRoute.get('/products/:id/edit', productController.getEditProduct);
adminRoute.post('/products/:id', upload.fields([{ name: 'mainImage' }, { name: 'subImages', maxCount: 3 }]), productController.updateProduct);
adminRoute.put('/products/:id/soft-delete', productController.softDeleteProduct);

// Order Management
adminRoute.get('/getOrders', manageOrderController.getManageOrders);
adminRoute.get('/orders/:id', manageOrderController.getOrderDetails);
adminRoute.put('/orders/:id/status', manageOrderController.updateOrderStatus);
adminRoute.get('/orders/:id/invoice', manageOrderController.downloadInvoice);

module.exports = adminRoute;