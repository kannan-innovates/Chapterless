const { createValidationMiddleware, validateObjectId, validateQuantity } = require('../../helpers/validation-helper');
const { HttpStatus } = require('../../helpers/status-code');

/**
 * Validate add to cart request
 */
const validateAddToCart = createValidationMiddleware({
  productId: {
    type: 'objectId',
    fieldName: 'Product ID'
  },
  quantity: {
    type: 'quantity',
    fieldName: 'Quantity'
  }
});

/**
 * Validate update cart quantity request
 */
const validateUpdateCartQuantity = createValidationMiddleware({
  productId: {
    type: 'objectId',
    fieldName: 'Product ID'
  },
  quantity: {
    type: 'quantity',
    fieldName: 'Quantity'
  }
});

/**
 * Validate remove from cart request
 */
const validateRemoveFromCart = createValidationMiddleware({
  productId: {
    type: 'objectId',
    fieldName: 'Product ID'
  }
});

/**
 * Validate cart item existence and user ownership
 */
const validateCartItemOwnership = async (req, res, next) => {
  try {
    const { productId } = req.validatedData || req.body;
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to manage cart'
      });
    }
    
    // Add user ID to validated data for use in controller
    req.validatedData = { ...req.validatedData, userId };
    next();
  } catch (error) {
    console.error('Cart validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate cart checkout request
 */
const validateCartCheckout = (req, res, next) => {
  try {
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to proceed with checkout'
      });
    }
    
    req.validatedData = { userId };
    next();
  } catch (error) {
    console.error('Cart checkout validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  validateAddToCart,
  validateUpdateCartQuantity,
  validateRemoveFromCart,
  validateCartItemOwnership,
  validateCartCheckout
};
