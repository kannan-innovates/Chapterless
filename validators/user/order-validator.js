const { createValidationMiddleware, validateObjectId, validateText } = require('../../helpers/validation-helper');
const { HttpStatus } = require('../../helpers/status-code');

/**
 * Validate place order request
 */
const validatePlaceOrder = createValidationMiddleware({
  addressId: {
    type: 'objectId',
    fieldName: 'Address ID'
  },
  paymentMethod: {
    type: 'text',
    fieldName: 'Payment Method',
    pattern: /^(razorpay|cod|wallet)$/,
    required: true
  },
  couponCode: {
    type: 'text',
    fieldName: 'Coupon Code',
    required: false,
    max: 20
  }
});

/**
 * Validate cancel order request
 */
const validateCancelOrder = createValidationMiddleware({
  orderId: {
    type: 'objectId',
    fieldName: 'Order ID'
  },
  reason: {
    type: 'text',
    fieldName: 'Cancellation Reason',
    required: false,
    max: 500
  }
});

/**
 * Validate return order request
 */
const validateReturnOrder = createValidationMiddleware({
  orderId: {
    type: 'objectId',
    fieldName: 'Order ID'
  },
  reason: {
    type: 'text',
    fieldName: 'Return Reason',
    required: true,
    min: 10,
    max: 500
  }
});

/**
 * Validate order ownership
 */
const validateOrderOwnership = (req, res, next) => {
  try {
    const userId = req.session.user_id || req.user?._id;
    
    if (!userId) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: 'Please login to manage orders'
      });
    }
    
    req.validatedData = { ...req.validatedData, userId };
    next();
  } catch (error) {
    console.error('Order ownership validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Validate Razorpay payment verification
 */
const validateRazorpayPayment = createValidationMiddleware({
  razorpay_order_id: {
    type: 'text',
    fieldName: 'Razorpay Order ID',
    required: true,
    min: 10,
    max: 50
  },
  razorpay_payment_id: {
    type: 'text',
    fieldName: 'Razorpay Payment ID',
    required: true,
    min: 10,
    max: 50
  },
  razorpay_signature: {
    type: 'text',
    fieldName: 'Razorpay Signature',
    required: true,
    min: 10,
    max: 200
  }
});

/**
 * Validate reorder request
 */
const validateReorder = createValidationMiddleware({
  orderId: {
    type: 'objectId',
    fieldName: 'Order ID'
  }
});

/**
 * Validate order status update (admin)
 */
const validateOrderStatusUpdate = createValidationMiddleware({
  orderId: {
    type: 'objectId',
    fieldName: 'Order ID'
  },
  status: {
    type: 'text',
    fieldName: 'Order Status',
    pattern: /^(pending|confirmed|shipped|delivered|cancelled|returned)$/,
    required: true
  },
  notes: {
    type: 'text',
    fieldName: 'Status Notes',
    required: false,
    max: 500
  }
});

/**
 * Validate order search/filter parameters
 */
const validateOrderSearch = (req, res, next) => {
  try {
    const { page, limit, status, startDate, endDate, search } = req.query;
    const sanitizedQuery = {};
    
    // Validate page number
    if (page) {
      const pageNum = parseInt(page);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid page number'
        });
      }
      sanitizedQuery.page = pageNum;
    }
    
    // Validate limit
    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid limit (1-100)'
        });
      }
      sanitizedQuery.limit = limitNum;
    }
    
    // Validate status
    if (status) {
      const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];
      if (!validStatuses.includes(status)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid order status'
        });
      }
      sanitizedQuery.status = status;
    }
    
    // Validate dates
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid start date'
        });
      }
      sanitizedQuery.startDate = start;
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid end date'
        });
      }
      sanitizedQuery.endDate = end;
    }
    
    // Validate search term
    if (search) {
      const sanitizedSearch = search.trim();
      if (sanitizedSearch.length > 100) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Search term too long'
        });
      }
      sanitizedQuery.search = sanitizedSearch;
    }
    
    req.validatedQuery = sanitizedQuery;
    next();
  } catch (error) {
    console.error('Order search validation error:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  validatePlaceOrder,
  validateCancelOrder,
  validateReturnOrder,
  validateOrderOwnership,
  validateRazorpayPayment,
  validateReorder,
  validateOrderStatusUpdate,
  validateOrderSearch
};
