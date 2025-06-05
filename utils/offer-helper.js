// utils/offer-helper.js
const Offer = require("../models/offerSchema")
const Product = require("../models/productSchema")

/**
 * Get the best active offer for a product
 * Applies the largest discount (highest monetary value)
 * @param {string} productId - The product ID
 * @param {string} productCategoryId - The category ID of the product (optional)
 * @param {number} productPrice - The product price (required for accurate comparison)
 * @returns {Promise<Object|null>} - The best offer object or null if no active offer
 */
const getActiveOfferForProduct = async (productId, productCategoryId, productPrice) => {
  try {
    const now = new Date()
    let categoryToQuery = productCategoryId

    // Get product category if not provided
    if (!categoryToQuery && productId) {
      const productDoc = await Product.findById(productId).select("category").lean()
      if (productDoc && productDoc.category) {
        categoryToQuery = productDoc.category.toString()
      }
    }

    // Build query conditions for all applicable offers
    const offerQueryConditions = []

    // Offers for "All Products"
    offerQueryConditions.push({ appliesTo: "all_products" })

    // Offers for "Specific Products"
    if (productId) {
      offerQueryConditions.push({
        appliesTo: "specific_products",
        applicableProducts: { $in: [productId] },
      })
    }

    // Offers for "All Categories"
    offerQueryConditions.push({ appliesTo: "all_categories" })

    // Offers for "Specific Categories"
    if (categoryToQuery) {
      offerQueryConditions.push({
        appliesTo: "specific_categories",
        applicableCategories: { $in: [categoryToQuery] },
      })
    }

    // Find all active offers that apply to this product
    const potentialOffers = await Offer.find({
      $or: offerQueryConditions,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean()

    if (!potentialOffers || potentialOffers.length === 0) {
      return null
    }

    // Calculate actual discount amounts for each offer and find the best one
    let bestOffer = null
    let bestDiscountAmount = 0

    for (const offer of potentialOffers) {
      const discountInfo = calculateDiscount(offer, productPrice)

      // Compare by actual discount amount (monetary value)
      if (discountInfo.discountAmount > bestDiscountAmount) {
        bestOffer = offer
        bestDiscountAmount = discountInfo.discountAmount
      } else if (discountInfo.discountAmount === bestDiscountAmount && bestOffer) {
        // If discount amounts are equal, prioritize by specificity
        const currentPriority = getOfferPriority(bestOffer)
        const newPriority = getOfferPriority(offer)

        if (newPriority < currentPriority) {
          bestOffer = offer
        }
      }
    }

    return bestOffer
  } catch (error) {
    console.error("Error fetching active offer:", error)
    return null
  }
}

/**
 * Get offer priority (lower number = higher priority)
 * @param {Object} offer - The offer object
 * @returns {number} - Priority number
 */
const getOfferPriority = (offer) => {
  switch (offer.appliesTo) {
    case "specific_products":
      return 1
    case "specific_categories":
      return 2
    case "all_products":
      return 3
    case "all_categories":
      return 4
    default:
      return 5
  }
}

/**
 * Calculate discount amount and percentage based on offer
 * @param {Object} offer - The offer object
 * @param {number} price - The product price
 * @returns {Object} - Discount information { discountAmount, discountPercentage, finalPrice }
 */
const calculateDiscount = (offer, price) => {
  if (!offer || typeof price !== "number" || price <= 0) {
    return { discountAmount: 0, discountPercentage: 0, finalPrice: price || 0 }
  }

  let discountAmount = 0
  let discountPercentage = 0

  if (offer.discountType === "percentage") {
    discountPercentage = Math.min(offer.discountValue, 100) // Cap at 100%
    discountAmount = (price * discountPercentage) / 100
  } else if (offer.discountType === "fixed") {
    discountAmount = offer.discountValue
    discountPercentage = price > 0 ? (discountAmount / price) * 100 : 0
  }

  // Ensure discount doesn't exceed product price
  discountAmount = Math.min(discountAmount, price)
  discountPercentage = Math.min(discountPercentage, 100)

  const finalPrice = Math.max(0, price - discountAmount)

  return {
    discountAmount: Number.parseFloat(discountAmount.toFixed(2)),
    discountPercentage: Number.parseFloat(discountPercentage.toFixed(2)),
    finalPrice: Number.parseFloat(finalPrice.toFixed(2)),
    offer: offer,
  }
}

/**
 * Get all active offers for multiple products
 * @param {Array} products - Array of product objects with _id, price, and category
 * @returns {Promise<Object>} - Object with productId as key and offer info as value
 */
const getActiveOffersForProducts = async (products) => {
  try {
    const offerMap = {}

    for (const product of products) {
      const offer = await getActiveOfferForProduct(
        product._id.toString(),
        product.category ? product.category.toString() : null,
        product.price,
      )

      if (offer) {
        offerMap[product._id.toString()] = calculateDiscount(offer, product.price)
      }
    }

    return offerMap
  } catch (error) {
    console.error("Error fetching offers for products:", error)
    return {}
  }
}

/**
 * Check if an offer is currently active
 * @param {Object} offer - The offer object
 * @returns {boolean} - True if offer is active
 */
const isOfferActive = (offer) => {
  if (!offer || !offer.isActive) return false

  const now = new Date()
  const startDate = new Date(offer.startDate)
  const endDate = new Date(offer.endDate)

  return startDate <= now && endDate >= now
}

/**
 * Get offer status text
 * @param {Object} offer - The offer object
 * @returns {string} - Status text
 */
const getOfferStatus = (offer) => {
  if (!offer) return "No Offer"

  const now = new Date()
  const startDate = new Date(offer.startDate)
  const endDate = new Date(offer.endDate)

  if (!offer.isActive) return "Inactive"
  if (endDate < now) return "Expired"
  if (startDate > now) return "Upcoming"
  return "Active"
}

/**
 * Calculate proportional coupon discount for each item
 * @param {Object} coupon - The coupon object
 * @param {Array} items - Array of items with discountedPrice and quantity
 * @returns {Object} - Object with total discount and per-item discounts
 */
const calculateProportionalCouponDiscount = (coupon, items) => {
  if (!coupon || !items || items.length === 0) {
    return { totalDiscount: 0, itemDiscounts: {} }
  }

  // Calculate cart total from prices after offer
  const cartTotal = items.reduce((sum, item) => {
    const itemTotal = item.discountedPrice * item.quantity;
    return sum + itemTotal;
  }, 0);

  if (cartTotal <= 0) {
    return { totalDiscount: 0, itemDiscounts: {} }
  }

  // Calculate total coupon discount
  let totalCouponDiscount = 0;
  if (coupon.discountType === "percentage") {
    totalCouponDiscount = (cartTotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountValue) {
      totalCouponDiscount = Math.min(totalCouponDiscount, coupon.maxDiscountValue);
    }
  } else {
    totalCouponDiscount = Math.min(coupon.discountValue, cartTotal);
  }

  const itemDiscounts = {};

  // Split discount among items proportionally based on their price after offer
  items.forEach((item) => {
    const itemTotal = item.discountedPrice * item.quantity;
    const proportion = itemTotal / cartTotal;
    
    // Calculate item's share of the discount using the formula
    const itemDiscount = Math.round((totalCouponDiscount * proportion) * 100) / 100;
    
    // Ensure discount doesn't exceed item's price after offer
    const finalDiscount = Math.min(itemDiscount, itemTotal);

    itemDiscounts[item.product.toString()] = {
      amount: finalDiscount,
      proportion: proportion
    };
  });

  // Recalculate total discount based on individual item discounts
  const actualTotalDiscount = Object.values(itemDiscounts)
    .reduce((sum, discount) => sum + discount.amount, 0);

  return {
    totalDiscount: actualTotalDiscount,
    itemDiscounts
  }
}

/**
 * Get detailed price breakdown for an item including proportional coupon discount
 * @param {Object} item - Cart/Order item
 * @param {Object} couponInfo - Coupon discount info for this item
 * @returns {Object} - Detailed price breakdown
 */
const getItemPriceDetails = (item, couponInfo = null) => {
  const originalPrice = item.price || item.priceAtAddition
  const quantity = item.quantity
  const subtotal = originalPrice * quantity
  
  // Get offer discount
  const offerDiscount = item.offerDiscount || 0
  const priceAfterOffer = item.discountedPrice * quantity

  // Get coupon discount
  const couponDiscount = couponInfo ? couponInfo.amount : 0
  
  // Calculate final price
  const finalPrice = priceAfterOffer - couponDiscount

  return {
    originalPrice,
    quantity,
    subtotal,
    offerDiscount,
    priceAfterOffer,
    couponDiscount,
    finalPrice,
    couponProportion: couponInfo ? couponInfo.proportion : 0
  }
}

/**
 * Calculate final price for an item considering all discounts
 * @param {Object} item - The item object with price, quantity, and discounts
 * @param {Object} order - The order object containing coupon information
 * @returns {Object} - Object containing all price calculations
 */
const calculateFinalItemPrice = (item, order = null) => {
  try {
    // Start with base price
    const originalPrice = item.price || item.priceAtAddition;
    const quantity = item.quantity || 1;
    const subtotal = originalPrice * quantity;
    
    // Get offer discount
    const offerDiscount = item.offerDiscount || 0;
    const priceAfterOffer = (item.discountedPrice || originalPrice) * quantity;
    
    // Calculate coupon discount if applicable
    let couponDiscount = 0;
    let couponProportion = 0;
    
    if (order && order.couponDiscount > 0 && item.priceBreakdown?.couponProportion) {
      couponProportion = item.priceBreakdown.couponProportion;
      couponDiscount = order.couponDiscount * couponProportion;
    }
    
    // Calculate final price
    const finalPrice = priceAfterOffer - couponDiscount;
    
    return {
      originalPrice,
      quantity,
      subtotal,
      offerDiscount,
      priceAfterOffer,
      couponDiscount,
      couponProportion,
      finalPrice: Math.max(0, Number(finalPrice.toFixed(2)))
    };
  } catch (error) {
    console.error('Error in calculateFinalItemPrice:', error);
    return {
      originalPrice: item.price || 0,
      quantity: item.quantity || 1,
      subtotal: (item.price || 0) * (item.quantity || 1),
      offerDiscount: 0,
      priceAfterOffer: (item.price || 0) * (item.quantity || 1),
      couponDiscount: 0,
      couponProportion: 0,
      finalPrice: (item.price || 0) * (item.quantity || 1)
    };
  }
};

/**
 * Unified price calculation for consistent pricing across all modules
 * @param {Object} item - The order item
 * @param {Object} order - The order object
 * @returns {Object} - Standardized price breakdown
 */
const getUnifiedPriceBreakdown = (item, order = null) => {
  try {
    // **CRITICAL FIX: Add null/undefined validation**
    if (!item) {
      console.warn('getUnifiedPriceBreakdown: item is null or undefined');
      return null;
    }

    const quantity = item.quantity || 1;

    // 1. Original price (base price before any discounts)
    const originalPrice = item.price || item.priceAtAddition || 0;
    const originalTotal = originalPrice * quantity;

    // 2. Price after offer discount
    const discountedPrice = item.discountedPrice || originalPrice;
    const offerDiscount = originalPrice - discountedPrice;
    const offerDiscountTotal = offerDiscount * quantity;
    const priceAfterOffer = discountedPrice * quantity;

    // 3. Coupon discount (if applicable)
    let couponDiscount = 0;
    let couponProportion = 0;

    if (item.priceBreakdown && item.priceBreakdown.couponDiscount) {
      couponDiscount = item.priceBreakdown.couponDiscount;
      couponProportion = item.priceBreakdown.couponProportion || 0;
    } else if (item.couponDiscount) {
      couponDiscount = item.couponDiscount;
      couponProportion = item.couponProportion || 0;
    }

    // 4. Final price after all discounts
    const finalPrice = priceAfterOffer - couponDiscount;

    // 5. Tax calculation (proportional to item's contribution)
    let taxAmount = 0;
    if (order && order.tax && order.total) {
      // Calculate item's proportion of the order total (excluding tax)
      const orderSubtotal = order.total - order.tax;
      if (orderSubtotal > 0) {
        const itemProportion = finalPrice / orderSubtotal;
        taxAmount = order.tax * itemProportion;
      }
    }

    // 6. Final total including tax
    const finalTotal = finalPrice + taxAmount;

    return {
      originalPrice,
      originalTotal,
      discountedPrice,
      offerDiscount,
      offerDiscountTotal,
      priceAfterOffer,
      couponDiscount,
      couponProportion,
      finalPrice,
      taxAmount,
      finalTotal,
      quantity,
      // Formatted values for display
      formattedOriginalPrice: `₹${originalPrice.toFixed(2)}`,
      formattedOriginalTotal: `₹${originalTotal.toFixed(2)}`,
      formattedDiscountedPrice: `₹${discountedPrice.toFixed(2)}`,
      formattedOfferDiscount: `₹${offerDiscount.toFixed(2)}`,
      formattedPriceAfterOffer: `₹${priceAfterOffer.toFixed(2)}`,
      formattedCouponDiscount: `₹${couponDiscount.toFixed(2)}`,
      formattedFinalPrice: `₹${finalPrice.toFixed(2)}`,
      formattedTaxAmount: `₹${taxAmount.toFixed(2)}`,
      formattedFinalTotal: `₹${finalTotal.toFixed(2)}`
    };
  } catch (error) {
    console.error('Error in getUnifiedPriceBreakdown:', error);
    return {
      originalPrice: 0,
      originalTotal: 0,
      discountedPrice: 0,
      offerDiscount: 0,
      offerDiscountTotal: 0,
      priceAfterOffer: 0,
      couponDiscount: 0,
      couponProportion: 0,
      finalPrice: 0,
      taxAmount: 0,
      finalTotal: 0,
      quantity: item.quantity || 1,
      formattedOriginalPrice: '₹0.00',
      formattedOriginalTotal: '₹0.00',
      formattedDiscountedPrice: '₹0.00',
      formattedOfferDiscount: '₹0.00',
      formattedPriceAfterOffer: '₹0.00',
      formattedCouponDiscount: '₹0.00',
      formattedFinalPrice: '₹0.00',
      formattedTaxAmount: '₹0.00',
      formattedFinalTotal: '₹0.00'
    };
  }
};

module.exports = {
  getActiveOfferForProduct,
  calculateDiscount,
  getActiveOffersForProducts,
  isOfferActive,
  getOfferStatus,
  getOfferPriority,
  calculateProportionalCouponDiscount,
  getItemPriceDetails,
  calculateFinalItemPrice,
  getUnifiedPriceBreakdown
}
