/**
 * Email Masking Helper
 * Provides professional email masking for privacy and security
 */

/**
 * Masks an email address for display purposes
 * Examples:
 * - john.doe@example.com → joh***@example.com
 * - a@test.com → a***@test.com
 * - verylongemail@domain.co.uk → ver***@domain.co.uk
 * 
 * @param {string} email - The email address to mask
 * @returns {string} - The masked email address
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return 'your***@example.com';
  }

  // Split email into local and domain parts
  const [localPart, domain] = email.split('@');
  
  if (!localPart || !domain) {
    return 'your***@example.com';
  }

  // Determine how many characters to show
  let visibleChars;
  if (localPart.length <= 2) {
    visibleChars = 1; // Show at least 1 character
  } else if (localPart.length <= 4) {
    visibleChars = 2; // Show 2 characters for short emails
  } else {
    visibleChars = 3; // Show 3 characters for longer emails
  }

  // Create masked local part
  const visiblePart = localPart.substring(0, visibleChars);
  const maskedPart = '***';
  
  return `${visiblePart}${maskedPart}@${domain}`;
};

/**
 * Masks an email address with custom masking character
 * 
 * @param {string} email - The email address to mask
 * @param {string} maskChar - Character to use for masking (default: '*')
 * @param {number} visibleCount - Number of characters to show (default: 3)
 * @returns {string} - The masked email address
 */
const maskEmailCustom = (email, maskChar = '*', visibleCount = 3) => {
  if (!email || typeof email !== 'string') {
    return `your${maskChar.repeat(3)}@example.com`;
  }

  const [localPart, domain] = email.split('@');
  
  if (!localPart || !domain) {
    return `your${maskChar.repeat(3)}@example.com`;
  }

  const visibleChars = Math.min(visibleCount, localPart.length - 1);
  const visiblePart = localPart.substring(0, Math.max(1, visibleChars));
  const maskedPart = maskChar.repeat(3);
  
  return `${visiblePart}${maskedPart}@${domain}`;
};

/**
 * Creates a professional message for OTP verification
 * 
 * @param {string} email - The email address to mask
 * @param {string} purpose - Purpose of OTP (signup, forgot-password, etc.)
 * @returns {object} - Object containing masked email and message
 */
const createOtpMessage = (email, purpose = 'verification') => {
  const maskedEmail = maskEmail(email);
  
  const messages = {
    'signup': `We've sent a verification code to ${maskedEmail}`,
    'forgot-password': `Password reset code sent to ${maskedEmail}`,
    'resend': `New verification code sent to ${maskedEmail}`,
    'verification': `Verification code sent to ${maskedEmail}`,
    'email-update': `Email verification code sent to ${maskedEmail}`
  };

  return {
    maskedEmail,
    message: messages[purpose] || messages['verification'],
    fullMessage: `Enter the verification code sent to ${maskedEmail}`
  };
};

/**
 * Validates if an email format is correct before masking
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email format is valid
 */
const isValidEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  maskEmail,
  maskEmailCustom,
  createOtpMessage,
  isValidEmailFormat
};
