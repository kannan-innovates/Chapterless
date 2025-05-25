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
      console.log("❌ No active offers found")
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
    console.error("❌ Error fetching active offer:", error)
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
      
      } else {
        console.log(`❌ No offer for product ${product._id}`)
      }
    }

    
    return offerMap
  } catch (error) {
    console.error("❌ Error fetching offers for products:", error)
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


module.exports = {
  getActiveOfferForProduct,
  calculateDiscount,
  getActiveOffersForProducts,
  isOfferActive,
  getOfferStatus,
  getOfferPriority,

}
