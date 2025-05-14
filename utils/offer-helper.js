// utils/offer-helper.js
const Offer = require("../models/offerSchema");
const Product = require("../models/productSchema"); // To get category of a product

/**
 * Get active offer for a product
 * @param {string} productId - The product ID
 * @param {string} productCategoryId - The category ID of the product
 * @returns {Promise<Object|null>} - The offer object or null if no active offer
 */
const getActiveOfferForProduct = async (productId, productCategoryId) => {
  try {
    const now = new Date();
    let categoryToQuery = productCategoryId;

    if (!categoryToQuery && productId) {
      const productDoc = await Product.findById(productId).select('category').lean();
      if (productDoc && productDoc.category) {
        categoryToQuery = productDoc.category.toString();
      }
    }

    const offerQueryConditions = [];

    // Offers for "All Products"
    offerQueryConditions.push({ appliesTo: "all_products" });
    
    // Offers for "Specific Products"
    if (productId) {
      offerQueryConditions.push({ appliesTo: "specific_products", applicableProducts: productId });
    }

    // Offers for "All Categories"
    // This means the offer is generally available for any product belonging to any category.
    // It's a broad offer type, less specific than product-specific or category-specific for a *particular* category.
    offerQueryConditions.push({ appliesTo: "all_categories" });

    // Offers for "Specific Categories"
    if (categoryToQuery) {
      offerQueryConditions.push({ appliesTo: "specific_categories", applicableCategories: categoryToQuery });
    }
    
    const potentialOffers = await Offer.find({
      $or: offerQueryConditions,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
    .lean(); // Get all potential offers

    if (!potentialOffers || potentialOffers.length === 0) {
      return null;
    }

    // Prioritize and select the best offer
    // Priority:
    // 1. Specific Product offer
    // 2. Specific Category offer (for the product's category)
    // 3. All Products offer
    // 4. All Categories offer
    // Within each priority level, higher discountValue is better.
    // If discountValue is the same, percentage is often preferred over fixed unless fixed is very high.

    let bestOffer = null;

    for (const offer of potentialOffers) {
      if (!bestOffer) {
        bestOffer = offer;
        continue;
      }

      // Determine current best offer's priority
      let currentBestPriority = 4; // Default to lowest (All Categories)
      if (bestOffer.appliesTo === 'specific_products') currentBestPriority = 1;
      else if (bestOffer.appliesTo === 'specific_categories') currentBestPriority = 2;
      else if (bestOffer.appliesTo === 'all_products') currentBestPriority = 3;

      // Determine new offer's priority
      let newOfferPriority = 4;
      if (offer.appliesTo === 'specific_products') newOfferPriority = 1;
      else if (offer.appliesTo === 'specific_categories') newOfferPriority = 2;
      else if (offer.appliesTo === 'all_products') newOfferPriority = 3;
      
      if (newOfferPriority < currentBestPriority) {
        bestOffer = offer;
      } else if (newOfferPriority === currentBestPriority) {
        // If same priority, compare discount values
        // (Assuming higher discountValue is better. Percentage vs Fixed might need price context)
        // For simplicity here, higher discountValue wins.
        // If discount types are different, a more complex comparison involving price would be ideal.
        // This simplified comparison prioritizes percentage if values are equal.
        if (offer.discountType === 'percentage' && bestOffer.discountType === 'fixed') {
            bestOffer = offer;
        } else if (offer.discountType === bestOffer.discountType && offer.discountValue > bestOffer.discountValue) {
            bestOffer = offer;
        } else if (offer.discountType === 'fixed' && bestOffer.discountType === 'percentage' && offer.discountValue > 0) {
            // Only consider fixed if it's definitively better than current percentage (hard without price)
            // This part is tricky without price. Let's assume higher discountValue is generally better.
            if (offer.discountValue > bestOffer.discountValue) { // Simple comparison
                 // bestOffer = offer; // Commenting this out to prefer percentage in ties or ambiguity
            }
        } else if (offer.discountValue > bestOffer.discountValue) {
             bestOffer = offer;
        }
      }
    }
    return bestOffer;

  } catch (error) {
    console.error("Error fetching active offer:", error);
    return null;
  }
};

/**
 * Calculate discount amount and percentage based on offer
 * @param {Object} offer - The offer object
 * @param {number} price - The product price
 * @returns {Object} - Discount information { discountAmount, discountPercentage, finalPrice }
 */
const calculateDiscount = (offer, price) => {
  if (!offer || typeof price !== 'number' || price <= 0) {
    return { discountAmount: 0, discountPercentage: 0, finalPrice: price };
  }

  let discountAmount = 0;
  let discountPercentage = 0;

  if (offer.discountType === "percentage") {
    discountAmount = (price * offer.discountValue) / 100;
    discountPercentage = offer.discountValue;
  } else if (offer.discountType === "fixed") {
    discountAmount = offer.discountValue;
  }
  
  // Ensure discount doesn't exceed product price
  discountAmount = Math.min(discountAmount, price);
  
  if (price > 0 && discountAmount > 0 && offer.discountType === "fixed") {
      discountPercentage = (discountAmount / price) * 100;
  }


  const finalPrice = Math.max(0, price - discountAmount); // Ensure final price isn't negative

  return { 
    discountAmount: parseFloat(discountAmount.toFixed(2)), 
    discountPercentage: parseFloat(discountPercentage.toFixed(2)), 
    finalPrice: parseFloat(finalPrice.toFixed(2))
  };
};

module.exports = {
  getActiveOfferForProduct,
  calculateDiscount,
};