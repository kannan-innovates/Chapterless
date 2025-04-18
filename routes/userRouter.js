const express= require("express");
const router = express.Router();
const userController = require("../controllers/userController")

router.get("/",userController.loadHomePage)
router.get("/pageNotFound",userController.pageNotFound)

module.exports = router;