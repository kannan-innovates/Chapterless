// controllers/adminController/offer-controller.js
const Offer = require("../../models/offerSchema")
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")

// Helper to format date for display
const formatDateForDisplay = (date) => {
  if (!date) return ""
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// Helper to format date for input type="date"
const formatDateForInput = (date) => {
  if (!date) return ""
  const d = new Date(date)
  const year = d.getFullYear()
  const month = `0${d.getMonth() + 1}`.slice(-2)
  const day = `0${d.getDate()}`.slice(-2)
  return `${year}-${month}-${day}`
}

const getOffers = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const query = {}
    const filters = {
      status: req.query.status || "all",
      type: req.query.type || "all",
      application: req.query.application || "all",
      search: req.query.search || "",
    }

    if (filters.search) {
      query.title = { $regex: filters.search, $options: "i" }
    }

    const now = new Date()
    if (filters.status !== "all") {
      if (filters.status === "active") {
        query.isActive = true
        query.endDate = { $gte: now }
        query.startDate = { $lte: now }
      } else if (filters.status === "inactive") {
        query.isActive = false
      } else if (filters.status === "expired") {
        query.endDate = { $lt: now }
      }
    }

    if (filters.type !== "all") {
      query.discountType = filters.type
    }

    if (filters.application !== "all") {
      query.appliesTo = filters.application
    }

    const totalOffers = await Offer.countDocuments(query)
    const offersData = await Offer.find(query)
      .populate("applicableCategories", "name")
      .populate("applicableProducts", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    offersData.forEach((offer) => {
      offer.displayStartDate = formatDateForDisplay(offer.startDate)
      offer.displayEndDate = formatDateForDisplay(offer.endDate)

      if (!offer.isActive) {
        offer.currentStatus = "Inactive"
        offer.statusClass = "inactive"
      } else if (new Date(offer.endDate) < now) {
        offer.currentStatus = "Expired"
        offer.statusClass = "expired"
      } else if (new Date(offer.startDate) > now) {
        offer.currentStatus = "Upcoming"
        offer.statusClass = "upcoming"
      } else {
        offer.currentStatus = "Active"
        offer.statusClass = "active"
      }

      switch (offer.appliesTo) {
        case "all_products":
          offer.appliesToDisplay = "All Products"
          break
        case "specific_products":
          offer.appliesToDisplay =
            offer.applicableProducts && offer.applicableProducts.length > 0
              ? `${offer.applicableProducts.length} Product(s)`
              : "Specific Products (None Selected)"
          if (offer.applicableProducts && offer.applicableProducts.length === 1 && offer.applicableProducts[0]) {
            offer.appliesToDisplay = `${offer.applicableProducts[0].title} (Product)`
          }
          break
        case "all_categories":
          offer.appliesToDisplay = "All Categories"
          break
        case "specific_categories":
          offer.appliesToDisplay =
            offer.applicableCategories && offer.applicableCategories.length > 0
              ? `${offer.applicableCategories.length} Categories(s)`
              : "Specific Categories (None Selected)"
          if (offer.applicableCategories && offer.applicableCategories.length === 1 && offer.applicableCategories[0]) {
            offer.appliesToDisplay = `${offer.applicableCategories[0].name} (Category)`
          }
          break
        default:
          offer.appliesToDisplay = "N/A"
      }
    })

    const categories = await Category.find({ isListed: true }).select("name _id").lean()
    const products = await Product.find({ isDeleted: false, isListed: true }).select("title _id").lean()

    const totalPages = Math.ceil(totalOffers / limit)
    const pagination = {
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
      start: totalOffers > 0 ? skip + 1 : 0,
      end: Math.min(skip + limit, totalOffers),
      totalOffers,
      limit,
    }

    res.render("offers", {
      title: "Manage Offers",
      offers: offersData,
      categories,
      products,
      pagination,
      filters,
      currentPath: req.path,
    })
  } catch (error) {
    console.error("Error fetching offers:", error)
    res.status(500).render("error", { message: "Internal server error while fetching offers" })
  }
}

const getOfferDetails = async (req, res) => {
  try {
    const offerId = req.params.id
    const offer = await Offer.findById(offerId)
      .populate("applicableCategories", "name _id")
      .populate("applicableProducts", "title _id")
      .lean()

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found" })
    }

    offer.startDate = formatDateForInput(offer.startDate)
    offer.endDate = formatDateForInput(offer.endDate)

    if (offer.applicableCategories) {
      offer.applicableCategories = offer.applicableCategories.map((cat) => ({ ...cat, _id: cat._id.toString() }))
    }
    if (offer.applicableProducts) {
      offer.applicableProducts = offer.applicableProducts.map((prod) => ({ ...prod, _id: prod._id.toString() }))
    }

    res.status(200).json(offer) // Note: no 'success:true' wrapper here, sending data directly
  } catch (error) {
    console.error("Error fetching offer details:", error)
    res.status(500).json({ success: false, message: "Internal server error", error: error.message })
  }
}

const createOffer = async (req, res) => {
  try {
    const {
      title,
      isActive,
      description,
      discountType,
      discountValue,
      appliesTo,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
    } = req.body

    // Fix: Handle arrays and single values for applicableProducts and applicableCategories
    let productIds = []
    let categoryIds = []

    if (appliesTo === "specific_products") {
      if (Array.isArray(applicableProducts)) {
        productIds = applicableProducts
      } else if (applicableProducts) {
        productIds = [applicableProducts]
      }

      if (productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one product for a product-specific offer.",
        })
      }
    }

    if (appliesTo === "specific_categories") {
      if (Array.isArray(applicableCategories)) {
        categoryIds = applicableCategories
      } else if (applicableCategories) {
        categoryIds = [applicableCategories]
      }

      if (categoryIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one category for a category-specific offer.",
        })
      }
    }

    const offerData = {
      title,
      description: description || "",
      discountType,
      discountValue: Number.parseFloat(discountValue),
      appliesTo,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive === "true" || isActive === true,
      createdByAdmin: req.session.admin ? req.session.admin._id : null,
      applicableProducts: productIds,
      applicableCategories: categoryIds,
    }

    const newOffer = new Offer(offerData)
    await newOffer.save()

    res.status(201).json({ success: true, message: "Offer created successfully." })
  } catch (error) {
    console.error("Error creating offer:", error)

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((val) => val.message)
        .join(". ")
      return res.status(400).json({ success: false, message: messages })
    }

    const customValidationMessages = [
      "End date must be after start date.",
      "Percentage discount must be between 1 and 100.",
      "Fixed discount must be greater than 0.",
      "Please select at least one product for a product-specific offer.",
      "Please select at least one category for a category-specific offer.",
    ]
    if (customValidationMessages.includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message })
    }

    res.status(500).json({ success: false, message: "An internal server error occurred while creating the offer." })
  }
}

const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id
    const {
      title,
      isActive,
      description,
      discountType,
      discountValue,
      appliesTo,
      applicableProducts,
      applicableCategories,
      startDate,
      endDate,
    } = req.body

    // Fix: Handle arrays and single values for applicableProducts and applicableCategories
    let productIds = []
    let categoryIds = []

    if (appliesTo === "specific_products") {
      if (Array.isArray(applicableProducts)) {
        productIds = applicableProducts
      } else if (applicableProducts) {
        productIds = [applicableProducts]
      }

      if (productIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one product for a product-specific offer.",
        })
      }
    }

    if (appliesTo === "specific_categories") {
      if (Array.isArray(applicableCategories)) {
        categoryIds = applicableCategories
      } else if (applicableCategories) {
        categoryIds = [applicableCategories]
      }

      if (categoryIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one category for a category-specific offer.",
        })
      }
    }

    const offerToUpdate = await Offer.findById(offerId)
    if (!offerToUpdate) {
      return res.status(404).json({ success: false, message: "Offer not found." })
    }

    offerToUpdate.title = title
    offerToUpdate.description = description || ""
    offerToUpdate.discountType = discountType
    offerToUpdate.discountValue = Number.parseFloat(discountValue)
    offerToUpdate.appliesTo = appliesTo
    offerToUpdate.startDate = new Date(startDate)
    offerToUpdate.endDate = new Date(endDate)
    offerToUpdate.isActive = isActive === "true" || isActive === true

    offerToUpdate.applicableProducts = productIds
    offerToUpdate.applicableCategories = categoryIds

    await offerToUpdate.save()
    res.status(200).json({ success: true, message: "Offer updated successfully." })
  } catch (error) {
    console.error("Error updating offer:", error)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((val) => val.message)
        .join(". ")
      return res.status(400).json({ success: false, message: messages })
    }
    const customValidationMessages = [
      "End date must be after start date.",
      "Percentage discount must be between 1 and 100.",
      "Fixed discount must be greater than 0.",
      "Please select at least one product for a product-specific offer.",
      "Please select at least one category for a category-specific offer.",
    ]
    if (customValidationMessages.includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message })
    }
    res.status(500).json({ success: false, message: "An internal server error occurred while updating the offer." })
  }
}

const toggleOfferStatus = async (req, res) => {
  try {
    const offerId = req.params.id
    const offer = await Offer.findById(offerId)

    if (!offer) {
      return res.status(404).json({ success: false, message: "Offer not found." })
    }

    offer.isActive = !offer.isActive
    await offer.save()

    const now = new Date()
    let currentStatusText
    if (!offer.isActive) {
      currentStatusText = "Inactive"
    } else if (new Date(offer.endDate) < now) {
      currentStatusText = "Expired"
    } else if (new Date(offer.startDate) > now) {
      currentStatusText = "Upcoming"
    } else {
      currentStatusText = "Active"
    }

    res.status(200).json({
      success: true,
      message: `Offer status changed. It is now ${currentStatusText.toLowerCase()}.`,
      isActive: offer.isActive,
      currentStatus: currentStatusText,
    })
  } catch (error) {
    console.error("Error toggling offer status:", error)
    res.status(500).json({ success: false, message: "An internal server error occurred while toggling status." })
  }
}

module.exports = {
  getOffers,
  getOfferDetails,
  createOffer,
  updateOffer,
  toggleOfferStatus,
}
