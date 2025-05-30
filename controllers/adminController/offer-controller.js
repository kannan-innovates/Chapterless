const Offer = require("../../models/offerSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const { HttpStatus } = require('../../helpers/status-code');

// Helper to format date for display
const formatDateForDisplay = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Helper to format date for input type="date" (YYYY-MM-DD format)
const formatDateForInput = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `0${d.getMonth() + 1}`.slice(-2);
  const day = `0${d.getDate()}`.slice(-2);
  return `${year}-${month}-${day}`;
};

// Validation helper
const validateOfferData = (data) => {
  const errors = [];

  // Required field validations
  if (!data.title || !data.title.trim()) {
    errors.push("Offer title is required");
  }

  if (
    !data.discountType ||
    !["percentage", "fixed"].includes(data.discountType)
  ) {
    errors.push("Valid discount type is required");
  }

  if (
    !data.discountValue ||
    isNaN(data.discountValue) ||
    Number(data.discountValue) <= 0
  ) {
    errors.push("Valid discount value is required");
  }

  if (
    data.discountType === "percentage" &&
    (Number(data.discountValue) < 1 || Number(data.discountValue) > 100)
  ) {
    errors.push("Percentage discount must be between 1 and 100");
  }

  if (data.discountType === "fixed" && Number(data.discountValue) <= 0) {
    errors.push("Fixed discount must be greater than 0");
  }

  if (!data.startDate) {
    errors.push("Start date is required");
  }

  if (!data.endDate) {
    errors.push("End date is required");
  }

  if (data.startDate && data.endDate) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (startDate >= endDate) {
      errors.push("End date must be after start date");
    }

    // Only check if start date is in the past for new offers (not edits)
    if (!data.isEdit) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      if (startDate < now) {
        errors.push("Start date cannot be in the past");
      }
    }
  }

  if (
    !data.appliesTo ||
    ![
      "all_products",
      "specific_products",
      "all_categories",
      "specific_categories",
    ].includes(data.appliesTo)
  ) {
    errors.push("Valid application type is required");
  }

  // Specific validations for product/category selection
  if (data.appliesTo === "specific_products") {
    if (!data.applicableProducts || data.applicableProducts.length === 0) {
      errors.push(
        "Please select at least one product for a product-specific offer"
      );
    }
  }

  if (data.appliesTo === "specific_categories") {
    if (!data.applicableCategories || data.applicableCategories.length === 0) {
      errors.push(
        "Please select at least one category for a category-specific offer"
      );
    }
  }

  return errors;
};

const getOffers = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = {};
    const filters = {
      status: req.query.status || "all",
      type: req.query.type || "all",
      application: req.query.application || "all",
      search: req.query.search || "",
    };

    if (filters.search) {
      query.title = { $regex: filters.search, $options: "i" };
    }

    const now = new Date();
    if (filters.status !== "all") {
      if (filters.status === "active") {
        query.isActive = true;
        query.endDate = { $gte: now };
        query.startDate = { $lte: now };
      } else if (filters.status === "inactive") {
        query.isActive = false;
      } else if (filters.status === "expired") {
        query.endDate = { $lt: now };
      }
    }

    if (filters.type !== "all") {
      query.discountType = filters.type;
    }

    if (filters.application !== "all") {
      query.appliesTo = filters.application;
    }

    const totalOffers = await Offer.countDocuments(query);
    const offersData = await Offer.find(query)
      .populate("applicableCategories", "name")
      .populate("applicableProducts", "title")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    offersData.forEach((offer) => {
      offer.displayStartDate = formatDateForDisplay(offer.startDate);
      offer.displayEndDate = formatDateForDisplay(offer.endDate);

      if (!offer.isActive) {
        offer.currentStatus = "Inactive";
        offer.statusClass = "inactive";
      } else if (new Date(offer.endDate) < now) {
        offer.currentStatus = "Expired";
        offer.statusClass = "expired";
      } else if (new Date(offer.startDate) > now) {
        offer.currentStatus = "Upcoming";
        offer.statusClass = "upcoming";
      } else {
        offer.currentStatus = "Active";
        offer.statusClass = "active";
      }

      switch (offer.appliesTo) {
        case "all_products":
          offer.appliesToDisplay = "All Products";
          break;
        case "specific_products":
          offer.appliesToDisplay =
            offer.applicableProducts && offer.applicableProducts.length > 0
              ? `${offer.applicableProducts.length} Product(s)`
              : "Specific Products (None Selected)";
          if (
            offer.applicableProducts &&
            offer.applicableProducts.length === 1 &&
            offer.applicableProducts[0]
          ) {
            offer.appliesToDisplay = `${offer.applicableProducts[0].title} (Product)`;
          }
          break;
        case "all_categories":
          offer.appliesToDisplay = "All Categories";
          break;
        case "specific_categories":
          offer.appliesToDisplay =
            offer.applicableCategories && offer.applicableCategories.length > 0
              ? `${offer.applicableCategories.length} Categories(s)`
              : "Specific Categories (None Selected)";
          if (
            offer.applicableCategories &&
            offer.applicableCategories.length === 1 &&
            offer.applicableCategories[0]
          ) {
            offer.appliesToDisplay = `${offer.applicableCategories[0].name} (Category)`;
          }
          break;
        default:
          offer.appliesToDisplay = "N/A";
      }
    });

    const categories = await Category.find({ isListed: true })
      .select("name _id")
      .lean();
    const products = await Product.find({ isDeleted: false, isListed: true })
      .select("title _id")
      .lean();

    const totalPages = Math.ceil(totalOffers / limit);
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
    };

    res.render("offers", {
      title: "Manage Offers",
      offers: offersData,
      categories,
      products,
      pagination,
      filters,
      currentPath: req.path,
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .render("error", {
        message: "Internal server error while fetching offers",
      });
  }
};

const getOfferDetails = async (req, res) => {
  try {
    const offerId = req.params.id;

    if (!offerId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await Offer.findById(offerId)
      .populate("applicableCategories", "name _id")
      .populate("applicableProducts", "title _id")
      .lean();

    if (!offer) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Offer not found" });
    }

    // Format dates properly for HTML date inputs
    offer.startDate = formatDateForInput(offer.startDate);
    offer.endDate = formatDateForInput(offer.endDate);

    if (offer.applicableCategories) {
      offer.applicableCategories = offer.applicableCategories.map((cat) => ({
        ...cat,
        _id: cat._id.toString(),
      }));
    }
    if (offer.applicableProducts) {
      offer.applicableProducts = offer.applicableProducts.map((prod) => ({
        ...prod,
        _id: prod._id.toString(),
      }));
    }

    res.status(HttpStatus.OK).json(offer);
  } catch (error) {
    console.error("Error fetching offer details:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
  }
};

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
    } = req.body;

    // Normalize arrays
    let productIds = [];
    let categoryIds = [];

    if (appliesTo === "specific_products") {
      if (Array.isArray(applicableProducts)) {
        productIds = applicableProducts.filter((id) => id && id.trim());
      } else if (applicableProducts && applicableProducts.trim()) {
        productIds = [applicableProducts.trim()];
      }
    }

    if (appliesTo === "specific_categories") {
      if (Array.isArray(applicableCategories)) {
        categoryIds = applicableCategories.filter((id) => id && id.trim());
      } else if (applicableCategories && applicableCategories.trim()) {
        categoryIds = [applicableCategories.trim()];
      }
    }

    // Prepare validation data
    const validationData = {
      title,
      discountType,
      discountValue,
      startDate,
      endDate,
      appliesTo,
      applicableProducts: productIds,
      applicableCategories: categoryIds,
      isEdit: false,
    };

    // Validate data
    const validationErrors = validateOfferData(validationData);
    if (validationErrors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: validationErrors.join(". "),
      });
    }

    // Check for duplicate title
    const existingOffer = await Offer.findOne({
      title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
    });

    if (existingOffer) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "An offer with this title already exists",
      });
    }

    // Verify products exist
    if (productIds.length > 0) {
      const existingProducts = await Product.find({
        _id: { $in: productIds },
        isDeleted: false,
        isListed: true,
      }).select("_id");

      if (existingProducts.length !== productIds.length) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "One or more selected products are invalid or not available",
        });
      }
    }

    // Verify categories exist
    if (categoryIds.length > 0) {
      const existingCategories = await Category.find({
        _id: { $in: categoryIds },
        isListed: true,
      }).select("_id");

      if (existingCategories.length !== categoryIds.length) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:
            "One or more selected categories are invalid or not available",
        });
      }
    }

    const offerData = {
      title: title.trim(),
      description: description ? description.trim() : "",
      discountType,
      discountValue: Number.parseFloat(discountValue),
      appliesTo,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive === "true" || isActive === true,
      createdByAdmin: req.session.admin ? req.session.admin._id : null,
      applicableProducts: productIds,
      applicableCategories: categoryIds,
    };

    const newOffer = new Offer(offerData);
    await newOffer.save();

    res
      .status(HttpStatus.CREATED)
      .json({ success: true, message: "Offer created successfully" });
  } catch (error) {
    console.error("Error creating offer:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((val) => val.message)
        .join(". ");
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: messages });
    }

    if (error.code === 11000) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message: "An offer with this title already exists",
        });
    }

    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "An internal server error occurred while creating the offer",
      });
  }
};

const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;

    if (!offerId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid offer ID" });
    }

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
    } = req.body;

    // Check if offer exists
    const offerToUpdate = await Offer.findById(offerId);
    if (!offerToUpdate) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Offer not found" });
    }

    // Normalize arrays
    let productIds = [];
    let categoryIds = [];

    if (appliesTo === "specific_products") {
      if (Array.isArray(applicableProducts)) {
        productIds = applicableProducts.filter((id) => id && id.trim());
      } else if (applicableProducts && applicableProducts.trim()) {
        productIds = [applicableProducts.trim()];
      }
    }

    if (appliesTo === "specific_categories") {
      if (Array.isArray(applicableCategories)) {
        categoryIds = applicableCategories.filter((id) => id && id.trim());
      } else if (applicableCategories && applicableCategories.trim()) {
        categoryIds = [applicableCategories.trim()];
      }
    }

    // Prepare validation data
    const validationData = {
      title,
      discountType,
      discountValue,
      startDate,
      endDate,
      appliesTo,
      applicableProducts: productIds,
      applicableCategories: categoryIds,
      isEdit: true, // This is an edit operation
    };

    // Validate data
    const validationErrors = validateOfferData(validationData);
    if (validationErrors.length > 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: validationErrors.join(". "),
      });
    }

    // Check for duplicate title (excluding current offer)
    const existingOffer = await Offer.findOne({
      title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
      _id: { $ne: offerId },
    });

    if (existingOffer) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "An offer with this title already exists",
      });
    }

    // Verify products exist
    if (productIds.length > 0) {
      const existingProducts = await Product.find({
        _id: { $in: productIds },
        isDeleted: false,
        isListed: true,
      }).select("_id");

      if (existingProducts.length !== productIds.length) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "One or more selected products are invalid or not available",
        });
      }
    }

    // Verify categories exist
    if (categoryIds.length > 0) {
      const existingCategories = await Category.find({
        _id: { $in: categoryIds },
        isListed: true,
      }).select("_id");

      if (existingCategories.length !== categoryIds.length) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:
            "One or more selected categories are invalid or not available",
        });
      }
    }

    // Update offer
    offerToUpdate.title = title.trim();
    offerToUpdate.description = description ? description.trim() : "";
    offerToUpdate.discountType = discountType;
    offerToUpdate.discountValue = Number.parseFloat(discountValue);
    offerToUpdate.appliesTo = appliesTo;
    offerToUpdate.startDate = new Date(startDate);
    offerToUpdate.endDate = new Date(endDate);
    offerToUpdate.isActive = isActive === "true" || isActive === true;
    offerToUpdate.applicableProducts = productIds;
    offerToUpdate.applicableCategories = categoryIds;

    await offerToUpdate.save();
    res
      .status(HttpStatus.OK)
      .json({ success: true, message: "Offer updated successfully" });
  } catch (error) {
    console.error("Error updating offer:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((val) => val.message)
        .join(". ");
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: messages });
    }

    if (error.code === 11000) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({
          success: false,
          message: "An offer with this title already exists",
        });
    }

    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "An internal server error occurred while updating the offer",
      });
  }
};

const toggleOfferStatus = async (req, res) => {
  try {
    const offerId = req.params.id;

    if (!offerId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ success: false, message: "Invalid offer ID" });
    }

    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ success: false, message: "Offer not found" });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    const now = new Date();
    let currentStatusText;
    if (!offer.isActive) {
      currentStatusText = "Inactive";
    } else if (new Date(offer.endDate) < now) {
      currentStatusText = "Expired";
    } else if (new Date(offer.startDate) > now) {
      currentStatusText = "Upcoming";
    } else {
      currentStatusText = "Active";
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: `Offer status changed. It is now ${currentStatusText.toLowerCase()}`,
      isActive: offer.isActive,
      currentStatus: currentStatusText,
    });
  } catch (error) {
    console.error("Error toggling offer status:", error);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "An internal server error occurred while toggling status",
      });
  }
};

module.exports = {
  getOffers,
  getOfferDetails,
  createOffer,
  updateOffer,
  toggleOfferStatus,
};
