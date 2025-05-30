// ============================================================================
// BASIC OTP VALIDATION UTILITIES
// ============================================================================

/**
 * Basic OTP validation function to prevent letters and ensure 6 digits
 * @param {string} otp - The OTP to validate
 * @returns {object} - Validation result with success status and message
 */
const validateBasicOtp = (otp) => {
  // Check if OTP is provided
  if (!otp) {
    return {
      isValid: false,
      message: "OTP is required"
    };
  }

  // Convert to string and trim whitespace
  const otpString = otp.toString().trim();

  // Check if OTP contains only digits and is exactly 6 characters
  if (!/^\d{6}$/.test(otpString)) {
    return {
      isValid: false,
      message: "Please provide a valid 6-digit OTP"
    };
  }

  return {
    isValid: true,
    message: "OTP format is valid",
    sanitizedOtp: otpString
  };
};

/**
 * Middleware function for basic OTP validation
 * Can be used in routes to validate OTP before processing
 */
const basicOtpValidationMiddleware = (req, res, next) => {
  const { otp } = req.body;
  
  const validation = validateBasicOtp(otp);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  // Store sanitized OTP in request for further processing
  req.sanitizedOtp = validation.sanitizedOtp;
  next();
};

/**
 * Email validation for OTP requests
 * @param {string} email - The email to validate
 * @returns {object} - Validation result
 */
const validateBasicEmail = (email) => {
  if (!email) {
    return {
      isValid: false,
      message: "Email is required"
    };
  }

  const emailString = email.toString().trim().toLowerCase();
  
  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(emailString)) {
    return {
      isValid: false,
      message: "Please provide a valid email address"
    };
  }

  return {
    isValid: true,
    message: "Email format is valid",
    sanitizedEmail: emailString
  };
};

/**
 * Session validation for different OTP purposes
 * @param {object} req - Express request object
 * @param {string} purpose - OTP purpose (signup, password-reset, email-update)
 * @returns {object} - Validation result
 */
const validateOtpSession = (req, purpose) => {
  switch (purpose) {
    case 'signup':
      if (!req.session.tempUser || !req.session.tempUser.email) {
        return {
          isValid: false,
          message: "Session expired. Please sign up again.",
          sessionExpired: true
        };
      }
      break;
      
    case 'password-reset':
      if (!req.session.user_email) {
        return {
          isValid: false,
          message: "Session expired. Please start the password reset process again.",
          sessionExpired: true
        };
      }
      break;
      
    case 'email-update':
      if (!req.session.user_id || !req.session.newEmail) {
        return {
          isValid: false,
          message: "Session expired. Please start the email update process again.",
          sessionExpired: true
        };
      }
      break;
      
    default:
      return {
        isValid: false,
        message: "Invalid OTP purpose"
      };
  }

  return {
    isValid: true,
    message: "Session is valid"
  };
};

/**
 * Sanitize OTP input by removing non-digit characters
 * @param {string} otp - The OTP to sanitize
 * @returns {string} - Sanitized OTP with only digits
 */
const sanitizeOtp = (otp) => {
  if (!otp) return '';
  return otp.toString().replace(/\D/g, '');
};

/**
 * Check if OTP format is valid (6 digits only)
 * @param {string} otp - The OTP to check
 * @returns {boolean} - True if valid format, false otherwise
 */
const isValidOtpFormat = (otp) => {
  if (!otp) return false;
  const sanitized = sanitizeOtp(otp);
  return /^\d{6}$/.test(sanitized);
};

/**
 * Generate error response for invalid OTP
 * @param {string} message - Custom error message (optional)
 * @returns {object} - Standardized error response
 */
const createOtpErrorResponse = (message = "Please provide a valid 6-digit OTP") => {
  return {
    success: false,
    message: message,
    code: "INVALID_OTP_FORMAT"
  };
};

/**
 * Generate success response for valid OTP
 * @param {string} message - Custom success message (optional)
 * @param {object} data - Additional data to include (optional)
 * @returns {object} - Standardized success response
 */
const createOtpSuccessResponse = (message = "OTP verified successfully", data = {}) => {
  return {
    success: true,
    message: message,
    ...data
  };
};

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

module.exports = {
  // Main validation functions
  validateBasicOtp,
  validateBasicEmail,
  validateOtpSession,
  
  // Utility functions
  sanitizeOtp,
  isValidOtpFormat,
  
  // Response helpers
  createOtpErrorResponse,
  createOtpSuccessResponse,
  
  // Middleware
  basicOtpValidationMiddleware,
};
