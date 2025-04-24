const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../../controllers/userController/userController");
const signupController = require("../../controllers/userController/signupController");
const signupValidator = require("../../validators/user/signupValidation");
const loginController =  require("../../controllers/userController/loginController");

const passwordController = require("../../controllers/userController/forgotPasswordController")


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


router.get("/forgotPassword",passwordController.getForgotPassword);
router.post("/forgotPassword",passwordController.postForgotPassword);

router.get("/otpForgotPassword",passwordController.getOtpForgotPassword);
router.post("/otpForgotPassword",passwordController.verifyOtp);

router.get("/resetPassword",passwordController.getResetPassword)
router.patch("/resetPassword",passwordController.patchResetPassword)
module.exports = router;
