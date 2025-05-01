const loginValidator = (req, res, next) => {
     const { email, password } = req.body;
     const errors = {};
   
     // Normalize email
     req.body.email = email?.toLowerCase().trim();
   
     // Email validation
     const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
     if (!email || !emailRegex.test(req.body.email)) {
       errors.email = "Valid email is required";
     }
   
     // Password validation
     if (!password || password.length < 8) {
       errors.password = "Password must be at least 8 characters";
     }
   
     if (Object.keys(errors).length > 0) {
       return res.status(400).json({
         success: false,
         message: Object.values(errors).join(", "),
       });
     }
   
     next();
   };
   
   module.exports = { loginValidator };