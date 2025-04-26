const passport = require("passport");
// googleAuthController.js
const googleController = (req, res, next) => {
  passport.authenticate('google', { failureRedirect: '/signup' }, (err, user, info) => {
    if (err) {
      console.error("Google auth error:", err);
      return next(err);
    }
    
    if (!user) {
      console.log("No user found after Google auth, redirecting to login");
      return res.redirect('/login');
    }
    
    // Log in the user
    req.login(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      console.log("Google auth successful, user:", user);
      req.session.user_id = user._id;
      console.log("Setting session user_id:", req.session.user_id);
      
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        console.log("Session saved, redirecting to home");
        return res.redirect('/');
      });
    });
  })(req, res, next);
};

module.exports = { googleController };

  module.exports = {googleController}