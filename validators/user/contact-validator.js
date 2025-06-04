const { HttpStatus } = require("../../helpers/status-code");

const contactValidator = (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Trim inputs
    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPhone = phone?.trim();
    const trimmedMessage = message?.trim();

    const errors = [];

    // Name validation
    if (!trimmedName) {
      errors.push("Full name is required");
    } else if (trimmedName.length < 2) {
      errors.push("Full name must be at least 2 characters long");
    } else if (trimmedName.length > 50) {
      errors.push("Full name must not exceed 50 characters");
    } else if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
      errors.push("Full name can only contain letters and spaces");
    }

    // Email validation
    if (!trimmedEmail) {
      errors.push("Email address is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.push("Please enter a valid email address");
    } else if (trimmedEmail.length > 100) {
      errors.push("Email address must not exceed 100 characters");
    }

    // Phone validation (optional)
    if (trimmedPhone) {
      if (!/^[0-9+\-\s()]+$/.test(trimmedPhone)) {
        errors.push("Phone number can only contain numbers, +, -, spaces, and parentheses");
      } else if (trimmedPhone.replace(/[^0-9]/g, '').length < 10) {
        errors.push("Phone number must contain at least 10 digits");
      } else if (trimmedPhone.length > 20) {
        errors.push("Phone number must not exceed 20 characters");
      }
    }

    // Subject validation
    const validSubjects = ["general", "order", "recommendation", "feedback", "partnership", "other"];
    if (!subject) {
      errors.push("Subject is required");
    } else if (!validSubjects.includes(subject)) {
      errors.push("Please select a valid subject");
    }

    // Message validation
    if (!trimmedMessage) {
      errors.push("Message is required");
    } else if (trimmedMessage.length < 10) {
      errors.push("Message must be at least 10 characters long");
    } else if (trimmedMessage.length > 1000) {
      errors.push("Message must not exceed 1000 characters");
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: errors,
      });
    }

    // Add sanitized data to request body
    req.body.name = trimmedName;
    req.body.email = trimmedEmail;
    req.body.phone = trimmedPhone || null;
    req.body.message = trimmedMessage;

    next();
  } catch (error) {
    console.error("Error in contact validator:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during validation",
    });
  }
};

module.exports = {
  contactValidator,
};
