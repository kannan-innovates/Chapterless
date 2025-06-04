const { createValidationMiddleware, validateEmail, validateName, validatePhone, validatePassword } = require('../../helpers/validation-helper');
const { HttpStatus } = require('../../helpers/status-code');

/**
 * Validate profile update request
 */
const validateProfileUpdate = createValidationMiddleware({
  fullName: {
    type: 'name',
    fieldName: 'Full Name'
  },
  phoneNumber: {
    type: 'phone',
    fieldName: 'Phone Number'
  },
  dateOfBirth: {
    type: 'text',
    fieldName: 'Date of Birth',
    required: false,
    pattern: /^\d{4}-\d{2}-\d{2}$/
  },
  gender: {
    type: 'text',
    fieldName: 'Gender',
    required: false,
    pattern: /^(male|female|other)$/
  }
});

/**
 * Validate email update request
 */
const validateEmailUpdate = createValidationMiddleware({
  newEmail: {
    type: 'email',
    fieldName: 'New Email'
  }
});

/**
 * Validate password change request
 */
const validatePasswordChange = (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const errors = [];
    
    // Validate current password
    if (!currentPassword) {
      errors.push('Current password is required');
    }
    
    // Validate new password
    const newPasswordValidation = validatePassword(newPassword);
    if (!newPasswordValidation.isValid) {
      errors.push(newPasswordValidation.message);
    }
    
    // Validate confirm password
    if (!confirmPassword) {
      errors.push('Confirm password is required');
    } else if (newPassword !== confirmPassword) {
      errors.push('New password and confirm password do not match');
    }
    
    // Check if new password is different from current
    if (currentPassword === newPassword) {
      errors.push('New password must be different from current password');
    }
    
    if (errors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    
    req.validatedData = {
      currentPassword,
      newPassword
    };
    
    next();
  } catch (error) {
    console.error('Password change validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate profile image upload
 */
const validateProfileImage = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Profile image is required'
      });
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Invalid image format. Only JPEG, PNG, and WebP are allowed'
      });
    }
    
    if (req.file.size > maxSize) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Image size must be less than 5MB'
      });
    }
    
    next();
  } catch (error) {
    console.error('Profile image validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate user authentication for profile operations
 */
const validateProfileAuth = (req, res, next) => {
  try {
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to update profile'
      });
    }
    
    req.validatedData = { ...req.validatedData, userId };
    next();
  } catch (error) {
    console.error('Profile auth validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate date of birth
 */
const validateDateOfBirth = (req, res, next) => {
  try {
    const { dateOfBirth } = req.validatedData;
    
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      const minAge = 13; // Minimum age requirement
      const maxAge = 120; // Maximum reasonable age
      
      if (isNaN(dob.getTime())) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid date of birth format'
        });
      }
      
      const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));
      
      if (age < minAge) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: `You must be at least ${minAge} years old`
        });
      }
      
      if (age > maxAge) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid date of birth'
        });
      }
      
      if (dob > today) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Date of birth cannot be in the future'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Date of birth validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate account deletion request
 */
const validateAccountDeletion = (req, res, next) => {
  try {
    const { password, confirmDeletion } = req.body;
    const errors = [];
    
    if (!password) {
      errors.push('Password is required to delete account');
    }
    
    if (confirmDeletion !== 'DELETE') {
      errors.push('Please type "DELETE" to confirm account deletion');
    }
    
    if (errors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    
    req.validatedData = { password };
    next();
  } catch (error) {
    console.error('Account deletion validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  validateProfileUpdate,
  validateEmailUpdate,
  validatePasswordChange,
  validateProfileImage,
  validateProfileAuth,
  validateDateOfBirth,
  validateAccountDeletion
};
