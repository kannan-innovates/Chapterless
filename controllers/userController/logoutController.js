const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).send("Logout failed");
      }
      
      // Set cache-control headers to prevent back button access
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
      
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = { logout };