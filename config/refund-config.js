/**
 * ENHANCED REFUND SYSTEM CONFIGURATION
 * Production-ready configuration for refund calculations and policies
 */

const REFUND_CONFIG = {
  
  // **TAX HANDLING POLICIES**
  tax: {
    // Tax refund for cancellations (before shipment)
    cancellationTaxRefund: 'FULL', // Always refund full tax for cancellations
    
    // Tax refund for returns (after delivery)
    returnTaxRefund: {
      fullOrder: 'FULL',        // Full tax refund for complete order returns
      partialOrder: 'PROPORTIONAL' // Proportional tax refund for partial returns
    },
    
    // Tax calculation precision
    precision: 2, // Round to 2 decimal places
    
    // Default tax rate (can be overridden by order)
    defaultRate: 0.08 // 8%
  },

  // **REFUND CALCULATION SETTINGS**
  calculation: {
    // Floating point precision tolerance
    precisionTolerance: 0.01, // 1 paisa tolerance for calculations
    
    // Rounding method
    roundingMethod: 'ROUND', // Options: 'ROUND', 'FLOOR', 'CEIL'
    
    // Include tax in refund calculations
    includeTaxInRefund: true,
    
    // Coupon handling for partial refunds
    couponDistribution: 'PROPORTIONAL' // Distribute coupon discount proportionally
  },

  // **PAYMENT METHOD POLICIES**
  paymentMethods: {
    // Online payment refund policies
    online: {
      razorpay: {
        refundToWallet: true,
        processingTime: 'IMMEDIATE'
      },
      wallet: {
        refundToWallet: true,
        processingTime: 'IMMEDIATE'
      }
    },
    
    // COD refund policies
    cod: {
      // Only refund COD if cash was actually collected
      refundConditions: {
        orderDelivered: true,
        paymentReceived: true
      },
      refundToWallet: true,
      processingTime: 'IMMEDIATE'
    }
  },

  // **BUSINESS RULES**
  businessRules: {
    // Duplicate refund prevention
    preventDuplicateRefunds: true,
    
    // Refund validation
    validateRefundAmounts: true,
    
    // Maximum refund amount (safety check)
    maxRefundAmount: 100000, // ₹1,00,000
    
    // Minimum refund amount
    minRefundAmount: 0.01 // 1 paisa
  },

  // **LOGGING AND MONITORING**
  logging: {
    // Log all refund calculations
    logCalculations: true,
    
    // Log refund processing
    logProcessing: true,
    
    // Log errors and warnings
    logErrors: true,
    
    // Performance monitoring
    monitorPerformance: true
  },

  // **ERROR HANDLING**
  errorHandling: {
    // Retry failed refund calculations
    retryCalculations: true,
    maxRetries: 3,
    
    // Fallback behavior for calculation errors
    fallbackToZero: true,
    
    // Alert on critical errors
    alertOnErrors: true
  },

  // **PERFORMANCE OPTIMIZATION**
  performance: {
    // Cache price breakdowns
    cachePriceBreakdowns: true,
    
    // Batch process multiple refunds
    batchProcessing: true,
    maxBatchSize: 100,
    
    // Optimize database queries
    optimizeQueries: true
  },

  // **VALIDATION RULES**
  validation: {
    // Required fields for refund calculation
    requiredFields: [
      'item.discountedPrice',
      'item.quantity',
      'order.tax',
      'order.paymentMethod',
      'order.paymentStatus'
    ],
    
    // Data type validation
    validateDataTypes: true,
    
    // Range validation
    validateRanges: true
  }
};

/**
 * Get refund configuration
 * @returns {Object} Complete refund configuration
 */
const getRefundConfig = () => {
  return REFUND_CONFIG;
};

/**
 * Get tax refund policy for specific scenario
 * @param {string} refundType - 'cancellation' or 'return'
 * @param {boolean} isFullOrder - Whether entire order is being refunded
 * @returns {string} Tax refund policy
 */
const getTaxRefundPolicy = (refundType, isFullOrder = false) => {
  if (refundType === 'cancellation') {
    return REFUND_CONFIG.tax.cancellationTaxRefund;
  }
  
  if (refundType === 'return') {
    return isFullOrder 
      ? REFUND_CONFIG.tax.returnTaxRefund.fullOrder
      : REFUND_CONFIG.tax.returnTaxRefund.partialOrder;
  }
  
  return 'NONE';
};

/**
 * Get payment method refund policy
 * @param {string} paymentMethod - Payment method (razorpay, wallet, cod)
 * @returns {Object} Refund policy for payment method
 */
const getPaymentMethodPolicy = (paymentMethod) => {
  const method = paymentMethod?.toLowerCase();
  
  if (method === 'cod') {
    return REFUND_CONFIG.paymentMethods.cod;
  }
  
  return REFUND_CONFIG.paymentMethods.online[method] || 
         REFUND_CONFIG.paymentMethods.online.razorpay; // Default to razorpay policy
};

/**
 * Validate refund amount
 * @param {number} amount - Refund amount to validate
 * @returns {boolean} Whether amount is valid
 */
const validateRefundAmount = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return false;
  }
  
  return amount >= REFUND_CONFIG.businessRules.minRefundAmount && 
         amount <= REFUND_CONFIG.businessRules.maxRefundAmount;
};

/**
 * Round amount according to configuration
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
const roundAmount = (amount) => {
  const precision = REFUND_CONFIG.calculation.precision;
  const method = REFUND_CONFIG.calculation.roundingMethod;
  
  switch (method) {
    case 'FLOOR':
      return Math.floor(amount * Math.pow(10, precision)) / Math.pow(10, precision);
    case 'CEIL':
      return Math.ceil(amount * Math.pow(10, precision)) / Math.pow(10, precision);
    default:
      return Number(amount.toFixed(precision));
  }
};

module.exports = {
  getRefundConfig,
  getTaxRefundPolicy,
  getPaymentMethodPolicy,
  validateRefundAmount,
  roundAmount,
  REFUND_CONFIG
};
