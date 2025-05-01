const signupValidator = (req, res, next) => {
     const { fullName, email,  password, confirmPassword } = req.body;
     const errors = {};
   
     // Normalize inputs
     req.body.fullName = fullName?.trim();
     req.body.email = email?.toLowerCase().trim();
   
     // Full Name
     if (!req.body.fullName || req.body.fullName.length < 3) {
       errors.fullName = 'Full name must be at least 3 characters';
     }
   
     // Email
     const emailRegex = /^\S+@\S+\.\S+$/;
     if (!email || !emailRegex.test(req.body.email)) {
       errors.email = 'Enter a valid email address';
     }
   
    
     // Password
     if (!password || password.length < 6) {
       errors.password = 'Password must be at least 6 characters';
     }
   
     // Confirm Password
     if (password !== confirmPassword) {
       errors.confirmPassword = 'Passwords do not match';
     }
   
     if (Object.keys(errors).length > 0) {
       return res.status(400).json({ success: false, errors });
     }
   
     next();
   };
   
   module.exports = {signupValidator};