const express = require("express");
const adminRoute = express.Router();

const adminController = require("../../controllers/adminController/adminLoginController");

adminRoute.get("/adminlogin", adminController.getAdminLogin);
adminRoute.post("/adminLogin", adminController.postAdminLogin);


module.exports = adminRoute