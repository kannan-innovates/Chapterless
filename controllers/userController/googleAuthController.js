const passport = require("passport");

const googleController = (req, res, next) => {
  passport.authenticate("google", { failureRedirect: "/login" }, (err, user, info) => {
    if (err) {
      console.error("Google auth error:", err);
      return next(err);
    }

    if (!user) {
      console.log("Google auth failed:", info?.message || "No user found");
      // Redirect with error query parameter for blocked users
      if (info?.message?.includes("blocked")) {
        return res.redirect("/login?error=blocked");
      }
      return res.redirect("/login");
    }

    // Log in the user
    req.login(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }

      console.log("Google auth successful, user:", user.email);
      req.session.user_id = user._id;
      req.session.user_email = user.email;
      console.log("Setting session user_id:", req.session.user_id);

      // Set cache control headers
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return next(err);
        }
        console.log("Session saved, redirecting to home");
        return res.redirect("/");
      });
    });
  })(req, res, next);
};

module.exports = { googleController };