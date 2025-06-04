const { HttpStatus } = require('./status-code');

/**
 * Central validation helper for API endpoints
 * Provides reusable validation functions and patterns
 */

// Common validation patterns
const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^[6-9]\d{9}$/,
  NAME: /^[A-Za-z\s'-]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/,
  ALPHANUMERIC_SPECIAL: /^[a-zA-Z0-9\s\-:,.'&()]+$/,
  PINCODE: /^\d{6}$/,
  PRICE: /^\d+(\.\d{1,2})?$/,
  MONGODB_ID: /^[0-9a-fA-F]{24}$/
};

// Common validation rules
const VALIDATION_RULES = {
  NAME: { min: 2, max: 50 },
  EMAIL: { max: 100 },
  PHONE: { length: 10 },
  PASSWORD: { min: 8, max: 128 },
  TITLE: { min: 3, max: 100 },
  DESCRIPTION: { min: 10, max: 2000 },
  PRICE: { min: 0, max: 100000 },
  QUANTITY: { min: 1, max: 10 },
  STOCK: { min: 0, max: 10000 },
  PINCODE: { length: 6 },
  ADDRESS: { min: 10, max: 200 }
};

/**
 * Sanitize and trim input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/\s+/g, ' ');
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  if (!email) return { isValid: false, message: 'Email is required' };
  
  const sanitized = sanitizeInput(email).toLowerCase();
  
  if (sanitized.length > VALIDATION_RULES.EMAIL.max) {
    return { isValid: false, message: 'Email is too long' };
  }
  
  if (!VALIDATION_PATTERNS.EMAIL.test(sanitized)) {
    return { isValid: false, message: 'Invalid email format' };
  }
  
  return { isValid: true, sanitized };
};

/**
 * Validate phone number
 */
const validatePhone = (phone) => {
  if (!phone) return { isValid: false, message: 'Phone number is required' };
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length !== VALIDATION_RULES.PHONE.length) {
    return { isValid: false, message: 'Phone number must be 10 digits' };
  }
  
  if (!VALIDATION_PATTERNS.PHONE.test(cleaned)) {
    return { isValid: false, message: 'Invalid phone number format' };
  }
  
  // Check for obviously fake patterns
  if (/^(.)\1+$/.test(cleaned) || /^0{10}$/.test(cleaned)) {
    return { isValid: false, message: 'Invalid phone number' };
  }
  
  return { isValid: true, sanitized: cleaned };
};

/**
 * Validate name (full name, first name, etc.)
 */
const validateName = (name, fieldName = 'Name') => {
  if (!name) return { isValid: false, message: `${fieldName} is required` };
  
  const sanitized = sanitizeInput(name);
  
  if (sanitized.length < VALIDATION_RULES.NAME.min) {
    return { isValid: false, message: `${fieldName} must be at least ${VALIDATION_RULES.NAME.min} characters` };
  }
  
  if (sanitized.length > VALIDATION_RULES.NAME.max) {
    return { isValid: false, message: `${fieldName} must not exceed ${VALIDATION_RULES.NAME.max} characters` };
  }
  
  if (!VALIDATION_PATTERNS.NAME.test(sanitized)) {
    return { isValid: false, message: `${fieldName} contains invalid characters` };
  }
  
  return { isValid: true, sanitized };
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (!password) return { isValid: false, message: 'Password is required' };
  
  if (password.length < VALIDATION_RULES.PASSWORD.min) {
    return { isValid: false, message: `Password must be at least ${VALIDATION_RULES.PASSWORD.min} characters` };
  }
  
  if (password.length > VALIDATION_RULES.PASSWORD.max) {
    return { isValid: false, message: `Password must not exceed ${VALIDATION_RULES.PASSWORD.max} characters` };
  }
  
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&_\-#]/.test(password);
  
  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return { 
      isValid: false, 
      message: 'Password must contain uppercase, lowercase, number, and special character' 
    };
  }
  
  return { isValid: true };
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) return { isValid: false, message: `${fieldName} is required` };
  
  if (!VALIDATION_PATTERNS.MONGODB_ID.test(id)) {
    return { isValid: false, message: `Invalid ${fieldName} format` };
  }
  
  return { isValid: true };
};

/**
 * Validate price
 */
const validatePrice = (price, fieldName = 'Price') => {
  if (price === undefined || price === null) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  const numPrice = parseFloat(price);
  
  if (isNaN(numPrice)) {
    return { isValid: false, message: `${fieldName} must be a valid number` };
  }
  
  if (numPrice < VALIDATION_RULES.PRICE.min) {
    return { isValid: false, message: `${fieldName} must be at least ₹${VALIDATION_RULES.PRICE.min}` };
  }
  
  if (numPrice > VALIDATION_RULES.PRICE.max) {
    return { isValid: false, message: `${fieldName} must not exceed ₹${VALIDATION_RULES.PRICE.max}` };
  }
  
  return { isValid: true, sanitized: numPrice };
};

/**
 * Validate quantity
 */
const validateQuantity = (quantity, fieldName = 'Quantity') => {
  if (quantity === undefined || quantity === null) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  const numQuantity = parseInt(quantity);
  
  if (isNaN(numQuantity)) {
    return { isValid: false, message: `${fieldName} must be a valid number` };
  }
  
  if (numQuantity < VALIDATION_RULES.QUANTITY.min) {
    return { isValid: false, message: `${fieldName} must be at least ${VALIDATION_RULES.QUANTITY.min}` };
  }
  
  if (numQuantity > VALIDATION_RULES.QUANTITY.max) {
    return { isValid: false, message: `${fieldName} must not exceed ${VALIDATION_RULES.QUANTITY.max}` };
  }
  
  return { isValid: true, sanitized: numQuantity };
};

/**
 * Validate text field with custom rules
 */
const validateText = (text, rules, fieldName = 'Field') => {
  if (!text && rules.required !== false) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  if (!text) return { isValid: true, sanitized: '' };
  
  const sanitized = sanitizeInput(text);
  
  if (rules.min && sanitized.length < rules.min) {
    return { isValid: false, message: `${fieldName} must be at least ${rules.min} characters` };
  }
  
  if (rules.max && sanitized.length > rules.max) {
    return { isValid: false, message: `${fieldName} must not exceed ${rules.max} characters` };
  }
  
  if (rules.pattern && !rules.pattern.test(sanitized)) {
    return { isValid: false, message: `${fieldName} contains invalid characters` };
  }
  
  return { isValid: true, sanitized };
};

/**
 * Create validation middleware
 */
const createValidationMiddleware = (validationRules) => {
  return (req, res, next) => {
    const errors = [];
    const sanitizedData = {};
    
    for (const [field, rules] of Object.entries(validationRules)) {
      const value = req.body[field];
      let result;
      
      switch (rules.type) {
        case 'email':
          result = validateEmail(value);
          break;
        case 'phone':
          result = validatePhone(value);
          break;
        case 'name':
          result = validateName(value, rules.fieldName || field);
          break;
        case 'password':
          result = validatePassword(value);
          break;
        case 'objectId':
          result = validateObjectId(value, rules.fieldName || field);
          break;
        case 'price':
          result = validatePrice(value, rules.fieldName || field);
          break;
        case 'quantity':
          result = validateQuantity(value, rules.fieldName || field);
          break;
        case 'text':
          result = validateText(value, rules, rules.fieldName || field);
          break;
        default:
          result = { isValid: true, sanitized: value };
      }
      
      if (!result.isValid) {
        errors.push(result.message);
      } else if (result.sanitized !== undefined) {
        sanitizedData[field] = result.sanitized;
      }
    }
    
    if (errors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    
    // Add sanitized data to request
    req.validatedData = sanitizedData;
    next();
  };
};

module.exports = {
  VALIDATION_PATTERNS,
  VALIDATION_RULES,
  sanitizeInput,
  validateEmail,
  validatePhone,
  validateName,
  validatePassword,
  validateObjectId,
  validatePrice,
  validateQuantity,
  validateText,
  createValidationMiddleware
};
