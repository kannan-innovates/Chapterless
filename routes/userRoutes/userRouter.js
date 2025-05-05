const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../../controllers/userController/userController");
const signupController = require("../../controllers/userController/signupController");
const signupValidator = require("../../validators/user/signupValidation");
const loginValidator = require('../../validators/user/loginValidator')
const loginController = require("../../controllers/userController/loginController");
const logoutController = require("../../controllers/userController/logoutController");

const passwordController = require("../../controllers/userController/forgotPasswordController");
const googleController = require("../../controllers/userController/googleAuthController");

const shopPageController = require('../../controllers/userController/shop-page-controller');
const productDetailsController = require('../../controllers/userController/product-details-controller');

const cartController = require('../../controllers/userController/cart-controller');
const wishlistController = require('../../controllers/userController/wishlist-controller')

// Import the auth middleware
const { isAuthenticated, isNotAuthenticated, preventBackButtonCache } = require('../../middlewares/authMiddleware');

const { searchProducts } = require('../../controllers/userController/searchController');

// Public routes (accessible to all)
router.get("/", userController.loadHomePage);
router.get("/pageNotFound", userController.pageNotFound);

// Auth routes (only for non-authenticated users)
router.get("/signup", isNotAuthenticated, preventBackButtonCache, signupController.getSignup);
router.post("/signup", isNotAuthenticated, signupValidator.signupValidator, signupController.postSignup);

router.get("/verify-otp", isNotAuthenticated, preventBackButtonCache, signupController.getOtp);
router.post("/verify-otp", isNotAuthenticated, signupController.verifyOtp);

router.get("/login", isNotAuthenticated, preventBackButtonCache, loginController.getLogin);
router.post("/login", isNotAuthenticated, loginValidator.loginValidator, loginController.postLogin);

// Password reset routes (only for non-authenticated users)
router.get("/forgotPassword", isNotAuthenticated, preventBackButtonCache, passwordController.getForgotPassword);
router.post("/forgotPassword", isNotAuthenticated, passwordController.postForgotPassword);

router.get("/otpForgotPassword", isNotAuthenticated, preventBackButtonCache, passwordController.getOtpForgotPassword);
router.post("/otpForgotPassword", isNotAuthenticated, passwordController.verifyOtp);

router.post("/resend-otp", isNotAuthenticated, passwordController.resendOtp);
router.post("/resend-signup-otp", isNotAuthenticated, signupController.resendOtp);

router.get("/resetPassword", isNotAuthenticated, preventBackButtonCache, passwordController.getResetPassword);
router.patch("/resetPassword", isNotAuthenticated, passwordController.patchResetPassword);

// Logout route (only for authenticated users)
router.get("/logout", isAuthenticated, logoutController.logout);

// OAuth routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", googleController.googleController);

// Product routes (accessible to all)
router.get('/shopPage', shopPageController.shopPage);
router.get('/products/:id', productDetailsController.productDetails);

// Cart and Wishlist routes
router.get('/cart', cartController.getCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/remove', cartController.removeFromCart);

router.get('/wishlist', wishlistController.getWishlist);
router.post('/wishlist/add', wishlistController.addToWishlist);
router.post('/wishlist/remove', wishlistController.removeFromWishlist);

router.get('/search', searchProducts);

module.exports = router;