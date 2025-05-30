const User = require('../models/userSchema');
const { HttpStatus } = require('../helpers/status-code');

/**
 * Admin middleware for session validation and cache prevention
 */
const adminMiddleware = {
  /**
   * Middleware to protect admin routes
   * Redirects to login if session is missing or invalid
   */
  isAdminAuthenticated: async (req, res, next) => {
    try {
      if (req.session?.admin_id) {
        const admin = await User.findOne({ _id: req.session.admin_id, isAdmin: true });
        if (admin) {
          res.locals.admin = admin; // Pass admin to templates
          return next();
        }
      }
      return res.redirect('/admin/adminLogin');
    } catch (err) {
      console.error('Admin auth error:', err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect('/admin/adminLogin');
    }
  },

  /**
   * Middleware to block login page for logged-in admins
   */
  isAdminNotAuthenticated: async (req, res, next) => {
    try {
      if (req.session?.admin_id) {
        const admin = await User.findOne({ _id: req.session.admin_id, isAdmin: true });
        if (admin) {
          return res.redirect('/admin/adminDashboard');
        }
      }
      next();
    } catch (err) {
      console.error('Admin not-auth error:', err);
      next();
    }
  },

  /**
   * Prevents caching of admin pages
   * Use after isAdminAuthenticated
   */
  preventCache: (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  }
};

module.exports = adminMiddleware;