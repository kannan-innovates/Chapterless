const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../../controllers/userController/userController");
const signupController = require("../../controllers/userController/signupController");
const signupValidator = require("../../validators/user/signupValidation");
const loginController =  require("../../controllers/userController/loginController")

router.get("/", userController.loadHomePage);
router.get("/pageNotFound", userController.pageNotFound);

router.get("/signup", signupController.getSignup);
router.post(
  "/signup",
  signupValidator.signupValidator,
  signupController.postSignup
);

router.get("/verify-otp", signupController.getOtp);
router.post("/verify-otp", signupController.verifyOtp);

router.get("/login",loginController.getLogin)
router.post("/login",loginController.postLogin)

router.get("/auth/google", passport.authenticate("google", {scope: ["profile", "email"]}));
router.get("/auth/google/callback", passport.authenticate("google", {failureRedirect: "/signup"}), (req, res) => {
  res.redirect("/");
});
module.exports = router;
