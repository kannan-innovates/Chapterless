// Validate full name
function validateFullName(fullName) {
  const trimmedName = fullName.trim();
  if (trimmedName.length < 3) return false;
  return /^[A-Za-z\s'-]+$/.test(trimmedName);
}

// Validate phone number
function validatePhoneNumber(phoneNumber) {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  if (cleanPhone.length !== 10) {
    return false;
  }
  if (
    /^(.)\1+$/.test(cleanPhone) ||
    /^0{10}$/.test(cleanPhone) ||
    /^1{10}$/.test(cleanPhone)
  ) {
    return false;
  }
  return true;
}

// Validate pincode
function validatePincode(pincode) {
  const cleanPincode = pincode.replace(/\D/g, "");
  return cleanPincode.length === 6 && /^\d+$/.test(cleanPincode);
}



// Validate address form
function validateAddressForm(formData) {
  const errors = {};

  if (!formData.fullName || !validateFullName(formData.fullName)) {
    errors.fullName = "Valid full name is required";
  }

  if (!formData.phone || !validatePhoneNumber(formData.phone)) {
    errors.phone = "Valid 10-digit phone number is required";
  }

  if (!formData.pincode || !validatePincode(formData.pincode)) {
    errors.pincode = "Valid 6-digit pincode is required";
  }

  if (!formData.district || formData.district.trim().length < 3) {
    errors.district = "District is required";
  }

  if (!formData.state) {
    errors.state = "Please select a state";
  }

  if (!formData.street || formData.street.trim().length < 10) {
    errors.street = "Complete address is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = {
  validateFullName,
  validatePhoneNumber,
  validatePincode,
  validateCardNumber,
  validateExpiryDate,
  validateCVV,
  validateUPI,
  validateAddressForm,
};
