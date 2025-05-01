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
      console.log("Setting session user_id:", req.session.user_id);

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