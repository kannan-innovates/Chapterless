// utils/offer-helper.js
const Offer = require("../models/offerSchema")

/**
 * Get active offer for a product
 * @param {string} productId - The product ID
 * @param {string} categoryId - The category ID
 * @returns {Promise<Object|null>} - The offer object or null if no active offer
 */
const getActiveOfferForProduct = async (productId, categoryId) => {
  try {
    const now = new Date()

    // First check for product-specific offers
    const productOffer = await Offer.findOne({
      $or: [
        { product: productId, applicableOn: "product" },
        { category: categoryId, applicableOn: "category" },
      ],
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ discountValue: -1 }) // Get the best offer if multiple apply

    return productOffer
  } catch (error) {
    console.error("Error fetching active offer:", error)
    return null
  }
}

/**
 * Calculate discount amount and percentage based on offer
 * @param {Object} offer - The offer object
 * @param {number} price - The product price
 * @returns {Object} - Discount information
 */
const calculateDiscount = (offer, price) => {
  if (!offer) return { discountAmount: 0, discountPercentage: 0 }

  let discountAmount = 0
  let discountPercentage = 0

  if (offer.discountType === "percentage") {
    discountAmount = (price * offer.discountValue) / 100
    discountPercentage = offer.discountValue
  } else if (offer.discountType === "fixed") {
    discountAmount = offer.discountValue
    discountPercentage = Math.round((offer.discountValue / price) * 100)
  }

  // Ensure discount doesn't exceed product price
  discountAmount = Math.min(discountAmount, price)

  return { discountAmount, discountPercentage }
}

module.exports = {
  getActiveOfferForProduct,
  calculateDiscount,
}
