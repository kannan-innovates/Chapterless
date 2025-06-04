const { createValidationMiddleware, validateName, validatePhone, validateText } = require('../../helpers/validation-helper');
const { HttpStatus } = require('../../helpers/status-code');

/**
 * Indian states for validation
 */
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * Validate add/update address request
 */
const validateAddressData = createValidationMiddleware({
  fullName: {
    type: 'name',
    fieldName: 'Full Name'
  },
  phone: {
    type: 'phone',
    fieldName: 'Phone Number'
  },
  pincode: {
    type: 'text',
    fieldName: 'Pincode',
    pattern: /^\d{6}$/,
    required: true
  },
  district: {
    type: 'text',
    fieldName: 'District',
    min: 2,
    max: 50,
    pattern: /^[A-Za-z\s]+$/,
    required: true
  },
  state: {
    type: 'text',
    fieldName: 'State',
    required: true
  },
  street: {
    type: 'text',
    fieldName: 'Street Address',
    min: 10,
    max: 200,
    required: true
  },
  landmark: {
    type: 'text',
    fieldName: 'Landmark',
    required: false,
    max: 100
  },
  addressType: {
    type: 'text',
    fieldName: 'Address Type',
    pattern: /^(home|work|other)$/,
    required: true
  }
});

/**
 * Additional validation for state
 */
const validateState = (req, res, next) => {
  try {
    const { state } = req.validatedData;
    
    if (!INDIAN_STATES.includes(state)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Please select a valid Indian state',
        errors: ['Invalid state selected']
      });
    }
    
    next();
  } catch (error) {
    console.error('State validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate user authentication for address operations
 */
const validateAddressAuth = (req, res, next) => {
  try {
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to manage addresses'
      });
    }
    
    req.validatedData = { ...req.validatedData, userId };
    next();
  } catch (error) {
    console.error('Address auth validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate address ID for update/delete operations
 */
const validateAddressId = createValidationMiddleware({
  addressId: {
    type: 'objectId',
    fieldName: 'Address ID'
  }
});

/**
 * Validate set default address request
 */
const validateSetDefaultAddress = createValidationMiddleware({
  addressId: {
    type: 'objectId',
    fieldName: 'Address ID'
  }
});

/**
 * Validate address ownership
 */
const validateAddressOwnership = async (req, res, next) => {
  try {
    const { addressId, userId } = req.validatedData;
    
    // This would typically check if the address belongs to the user
    // For now, we'll just pass the data along
    req.validatedData = { ...req.validatedData, addressId, userId };
    next();
  } catch (error) {
    console.error('Address ownership validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate pincode format and basic checks
 */
const validatePincodeDetails = (req, res, next) => {
  try {
    const { pincode } = req.validatedData;
    
    // Basic pincode validation (already done in main validator)
    // Additional checks can be added here (like API calls to verify pincode)
    
    next();
  } catch (error) {
    console.error('Pincode validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  validateAddressData,
  validateState,
  validateAddressAuth,
  validateAddressId,
  validateSetDefaultAddress,
  validateAddressOwnership,
  validatePincodeDetails,
  INDIAN_STATES
};
