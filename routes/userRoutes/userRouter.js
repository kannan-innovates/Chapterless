const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../../controllers/userController/userController");
const signupController = require("../../controllers/userController/signupController");
const signupValidator = require("../../validators/user/signupValidation");
const loginValidator = require('../../validators/user/loginValidator');
const loginController = require("../../controllers/userController/loginController");
const logoutController = require("../../controllers/userController/logoutController");

const passwordController = require("../../controllers/userController/forgotPasswordController");
const googleController = require("../../controllers/userController/googleAuthController");

const shopPageController = require('../../controllers/userController/shop-page-controller');
const productDetailsController = require('../../controllers/userController/product-details-controller');

const cartController = require('../../controllers/userController/cart-controller');
const wishlistController = require('../../controllers/userController/wishlist-controller');

const { isAuthenticated, isNotAuthenticated, preventBackButtonCache } = require('../../middlewares/authMiddleware');

const { searchProducts } = require('../../controllers/userController/searchController');

const profileController = require('../../controllers/userController/profile-controller');

const addressController = require('../../controllers/userController/address-controller');

const checkoutController = require('../../controllers/userController/checkout-controller');

const orderController = require('../../controllers/userController/order-controller');

const newPasswordController = require('../../controllers/userController/change-password-controller');

const userCouponController = require('../../controllers/userController/user-coupon-controller');

const walletController = require('../../controllers/userController/wallet-controller');

const referralController = require('../../controllers/userController/referral-controller');

const contactController = require('../../controllers/userController/contact-controller');

// Public routes
router.get("/", userController.loadHomePage);
router.get("/pageNotFound", userController.pageNotFound);

// Auth routes
router.get("/signup", isNotAuthenticated, preventBackButtonCache, signupController.getSignup);
router.post("/signup", isNotAuthenticated, signupValidator.signupValidator, signupController.postSignup);

router.get("/verify-otp", isNotAuthenticated, preventBackButtonCache, signupController.getOtp);
router.post("/verify-otp", isNotAuthenticated, signupController.verifyOtp);

router.get("/login", isNotAuthenticated, preventBackButtonCache, loginController.getLogin);
router.post("/login", isNotAuthenticated, loginValidator.loginValidator, loginController.postLogin);

// Password reset routes
router.get("/forgotPassword", isNotAuthenticated, preventBackButtonCache, passwordController.getForgotPassword);
router.post("/forgotPassword", isNotAuthenticated, passwordController.postForgotPassword);

router.get("/otpForgotPassword", isNotAuthenticated, preventBackButtonCache, passwordController.getOtpForgotPassword);
router.post("/otpForgotPassword", isNotAuthenticated, passwordController.verifyOtp);

router.post("/resend-otp", isNotAuthenticated, passwordController.resendOtp);
router.post("/resend-signup-otp", isNotAuthenticated, signupController.resendOtp);

router.get("/resetPassword", isNotAuthenticated, preventBackButtonCache, passwordController.getResetPassword);
router.patch("/resetPassword", isNotAuthenticated, passwordController.patchResetPassword);

// Logout route
router.get("/logout", isAuthenticated, logoutController.logout);

// OAuth routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", googleController.googleController);

// Product routes
router.get('/shopPage', shopPageController.shopPage);
router.get('/products/:id', productDetailsController.productDetails);

// Cart routes
router.get('/cart', isAuthenticated, cartController.getCart);
router.post('/cart/add', cartController.addToCart);
router.post('/cart/update', isAuthenticated, cartController.updateCartItem);
router.post('/cart/remove', isAuthenticated, cartController.removeCartItem);
router.post('/cart/clear', isAuthenticated, cartController.clearCart);

// Wishlist routes
router.get('/wishlist', isAuthenticated, wishlistController.getWishlist);
router.post('/wishlist/toggle', wishlistController.toggleWishlist);
router.post('/wishlist/add-all-to-cart', isAuthenticated, wishlistController.addAllToCart);
router.post('/wishlist/clear', isAuthenticated, wishlistController.clearWishlist);

// Search route
router.get('/search', searchProducts);

// Profile Routes
router.get('/profile', isAuthenticated, profileController.getProfile);
router.patch('/profile', isAuthenticated, profileController.updateProfile);
router.post('/profile/image', isAuthenticated, profileController.uploadProfileImage);
router.post('/request-email-update', isAuthenticated, profileController.requestEmailUpdate);
router.get('/verify-email-otp', isAuthenticated, preventBackButtonCache, (req, res) => res.render('profile-otp'));
router.post('/verify-email-otp', isAuthenticated, profileController.verifyEmailOtp);
router.post('/resend-email-otp', isAuthenticated, profileController.resendEmailOtp);

// Address routes
router.get('/address', isAuthenticated, addressController.getAddress);
router.post('/address', isAuthenticated, addressController.addAddress);
router.put('/address/:id', isAuthenticated, addressController.updateAddress);
router.delete('/address/:id', isAuthenticated, addressController.deleteAddress);
router.patch('/address/:id/default', isAuthenticated, addressController.setDefaultAddress);
router.get('/address/:id', isAuthenticated, addressController.getAddressById);

// Checkout routes
router.get('/checkout', isAuthenticated, checkoutController.getCheckout);
router.post('/checkout/place-order', isAuthenticated, checkoutController.placeOrder);
router.post("/checkout/apply-coupon", isAuthenticated, checkoutController.applyCoupon);
router.post("/checkout/remove-coupon", isAuthenticated, checkoutController.removeCoupon);

// Razorpay routes
router.post('/checkout/create-razorpay-order', isAuthenticated, checkoutController.createRazorpayOrder);
router.post('/checkout/verify-payment', isAuthenticated, checkoutController.verifyRazorpayPayment);
router.post('/checkout/payment-failure', isAuthenticated, checkoutController.handlePaymentFailure);

// Order routes
router.get('/orders', isAuthenticated, orderController.getOrders);
router.get('/orders/:id', isAuthenticated, orderController.getOrderDetails);
router.get('/order-success/:id', isAuthenticated, orderController.getOrderSuccess);
router.get('/payment-failure', isAuthenticated, orderController.getPaymentFailure);
router.get('/orders/:id/invoice', isAuthenticated, orderController.downloadInvoice);

router.post('/orders/:id/cancel',isAuthenticated,orderController.cancelOrder);
router.post('/orders/:id/items/:productId/cancel',isAuthenticated, orderController.cancelOrderItem);
router.post('/orders/:id/return',  isAuthenticated,orderController.returnOrder);
router.post('/orders/:id/items/:productId/return',isAuthenticated,orderController.returnOrderItem);
router.post('/orders/:id/reorder',isAuthenticated, orderController.reorder);

// Password change route
router.post('/change-password', isAuthenticated, newPasswordController.changePassword);

// Coupon routes
router.get('/user-coupons', isAuthenticated, userCouponController.getUserCoupons);

// Wallet routes
router.get('/wallet',isAuthenticated,walletController.getWallet)

// Referral routes
router.get('/referrals', isAuthenticated, referralController.getReferrals);
router.post('/validate-referral', referralController.validateReferral);

// Contact routes
const contactValidator = require('../../validators/user/contact-validator');
router.get('/contact', contactController.getContact);
router.post('/contact', contactValidator.contactValidator, contactController.postContact);

// About us route
router.get('/about', userController.getAboutPage);

module.exports = router;