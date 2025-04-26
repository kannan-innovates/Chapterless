const express = require("express");
const adminRoute = express.Router();

const adminController = require("../../controllers/adminController/adminLoginController");
const adminUserController = require("../../controllers/adminController/getUserController");

const categoryController = require('../../controllers/adminController/categoryController')

adminRoute.get("/adminLogin", adminController.getAdminLogin);
adminRoute.post("/adminLogin", adminController.postAdminLogin);

adminRoute.get('/adminDashboard',adminController.getAdminDashboard);
adminRoute.get('/adminLogout',adminController.logoutAdminDashboard);

adminRoute.get('/getUsers',adminUserController.getUsers);

adminRoute.put("/getUsers/:id/block",adminUserController.blockUser);
adminRoute.put("/getUsers/:id/unblock",adminUserController.unblockUser);

adminRoute.get('/categories',categoryController.getCategory)



module.exports =  adminRoute