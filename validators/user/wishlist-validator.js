const { createValidationMiddleware } = require('../../helpers/validation-helper');
const { HttpStatus } = require('../../helpers/status-code');

/**
 * Validate wishlist toggle request
 */
const validateWishlistToggle = createValidationMiddleware({
  productId: {
    type: 'objectId',
    fieldName: 'Product ID'
  }
});

/**
 * Validate user authentication for wishlist operations
 */
const validateWishlistAuth = (req, res, next) => {
  try {
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to manage wishlist'
      });
    }
    
    // Add user ID to validated data
    req.validatedData = { ...req.validatedData, userId };
    next();
  } catch (error) {
    console.error('Wishlist auth validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate remove from wishlist request
 */
const validateRemoveFromWishlist = createValidationMiddleware({
  productId: {
    type: 'objectId',
    fieldName: 'Product ID'
  }
});

/**
 * Validate clear wishlist request
 */
const validateClearWishlist = (req, res, next) => {
  try {
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to clear wishlist'
      });
    }
    
    req.validatedData = { userId };
    next();
  } catch (error) {
    console.error('Clear wishlist validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  validateWishlistToggle,
  validateWishlistAuth,
  validateRemoveFromWishlist,
  validateClearWishlist
};
