// controllers/adminController/offer-controller.js
const Offer = require('../../models/offerSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

// Helper to format date for display
const formatDateForDisplay = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Helper to format date for input type="date"
const formatDateForInput = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};


const getOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Offers per page
    const skip = (page - 1) * limit;

    const query = {};
    const filters = {
      status: req.query.status || 'all',
      type: req.query.type || 'all',
      application: req.query.application || 'all',
      search: req.query.search || '',
    };

    if (filters.search) {
      query.title = { $regex: filters.search, $options: 'i' };
    }

    const now = new Date();
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        query.isActive = true;
        query.endDate = { $gte: now };
        query.startDate = { $lte: now };
      } else if (filters.status === 'inactive') {
        query.isActive = false;
      } else if (filters.status === 'expired') {
        query.isActive = true; // Could be active but past its end date
        query.endDate = { $lt: now };
      }
    }

    if (filters.type !== 'all') {
      query.discountType = filters.type;
    }

    if (filters.application !== 'all') {
      query.applicableOn = filters.application;
    }

    const totalOffers = await Offer.countDocuments(query);
    const offers = await Offer.find(query)
      .populate({ path: 'category', select: 'name' })
      .populate({ path: 'product', select: 'title' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    offers.forEach(offer => {
      offer.displayStartDate = formatDateForDisplay(offer.startDate);
      offer.displayEndDate = formatDateForDisplay(offer.endDate);
      offer.inputStartDate = formatDateForInput(offer.startDate);
      offer.inputEndDate = formatDateForInput(offer.endDate);

      if (!offer.isActive) {
        offer.currentStatus = 'Inactive';
        offer.statusClass = 'inactive';
      } else if (new Date(offer.endDate) < now) {
        offer.currentStatus = 'Expired';
        offer.statusClass = 'expired';
      } else if (new Date(offer.startDate) > now) {
        offer.currentStatus = 'Upcoming'; // Optional: if start date is in future
        offer.statusClass = 'upcoming'; // You'd need CSS for this
      }
      else {
        offer.currentStatus = 'Active';
        offer.statusClass = 'active';
      }
    });

    const categories = await Category.find({ isListed: true }).lean();
    const products = await Product.find({ isDeleted: false, isListed: true }).lean(); // Assuming products also have isListed

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
      limit
    };

    res.render('offers', {
      title: 'Manage Offers',
      offers,
      categories,
      products,
      pagination,
      filters,
      currentPath: req.path // For sidebar active state
    });

  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).render('error', { message: 'Internal server error while fetching offers' });
  }
};

const getOfferDetails = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId)
      .populate('category', 'name')
      .populate('product', 'title')
      .lean();

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    // Prepare dates for date input fields
    offer.startDate = formatDateForInput(offer.startDate);
    offer.endDate = formatDateForInput(offer.endDate);
    
    res.status(200).json(offer);
  } catch (error) {
    console.error('Error fetching offer details:', error);
    res.status(500).json({ message: 'Internal server error' });
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
      applicableOn,
      category, // ID
      product,  // ID
      startDate,
      endDate,
    } = req.body;

    // Basic Validations
    if (!title || !discountType || !discountValue || !applicableOn || !startDate || !endDate) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'End date must be after start date.' });
    }
    if (discountType === 'percentage' && (parseFloat(discountValue) <= 0 || parseFloat(discountValue) > 100)) {
        return res.status(400).json({ message: 'Percentage discount must be between 1 and 100.' });
    }
    if (discountType === 'fixed' && parseFloat(discountValue) <= 0) {
        return res.status(400).json({ message: 'Fixed discount must be greater than 0.' });
    }
    if (applicableOn === 'category' && !category) {
        return res.status(400).json({ message: 'Please select a category.' });
    }
    if (applicableOn === 'product' && !product) {
        return res.status(400).json({ message: 'Please select a product.' });
    }

    const newOffer = new Offer({
      title,
      description: description || '',
      discountType,
      discountValue: parseFloat(discountValue),
      applicableOn,
      category: applicableOn === 'category' ? category : null,
      product: applicableOn === 'product' ? product : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive === 'true' || isActive === true, // Handle string 'true' from form
      createdByAdmin: req.session.admin ? req.session.admin._id : null, // Assuming admin ID in session
    });

    await newOffer.save();
    res.status(201).json({ success: true, message: 'Offer created successfully.' });

  } catch (error) {
    console.error('Error creating offer:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error while creating offer.' });
  }
};

const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const {
      title,
      isActive,
      description,
      discountType,
      discountValue,
      applicableOn,
      category,
      product,
      startDate,
      endDate,
    } = req.body;

    if (!title || !discountType || !discountValue || !applicableOn || !startDate || !endDate) {
        return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ message: 'End date must be after start date.' });
    }
    if (discountType === 'percentage' && (parseFloat(discountValue) <= 0 || parseFloat(discountValue) > 100)) {
        return res.status(400).json({ message: 'Percentage discount must be between 1 and 100.' });
    }
    if (discountType === 'fixed' && parseFloat(discountValue) <= 0) {
        return res.status(400).json({ message: 'Fixed discount must be greater than 0.' });
    }
    if (applicableOn === 'category' && !category) {
        return res.status(400).json({ message: 'Please select a category.' });
    }
    if (applicableOn === 'product' && !product) {
        return res.status(400).json({ message: 'Please select a product.' });
    }

    const offerToUpdate = await Offer.findById(offerId);
    if (!offerToUpdate) {
      return res.status(404).json({ message: 'Offer not found.' });
    }

    offerToUpdate.title = title;
    offerToUpdate.description = description || '';
    offerToUpdate.discountType = discountType;
    offerToUpdate.discountValue = parseFloat(discountValue);
    offerToUpdate.applicableOn = applicableOn;
    offerToUpdate.category = applicableOn === 'category' ? category : null;
    offerToUpdate.product = applicableOn === 'product' ? product : null;
    offerToUpdate.startDate = new Date(startDate);
    offerToUpdate.endDate = new Date(endDate);
    offerToUpdate.isActive = isActive === 'true' || isActive === true;

    await offerToUpdate.save();
    res.status(200).json({ success: true, message: 'Offer updated successfully.' });

  } catch (error) {
    console.error('Error updating offer:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Internal server error while updating offer.' });
  }
};

const toggleOfferStatus = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found.' });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    // Determine current status text after toggle
    const now = new Date();
    let currentStatusText;
    if (!offer.isActive) {
        currentStatusText = 'Inactive';
    } else if (new Date(offer.endDate) < now) {
        currentStatusText = 'Expired';
    } else {
        currentStatusText = 'Active';
    }

    res.status(200).json({
        success: true,
        message: `Offer status changed. It is now ${currentStatusText}.`,
        isActive: offer.isActive,
        currentStatus: currentStatusText // Send back the determined status
    });

  } catch (error) {
    console.error('Error toggling offer status:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};


module.exports = {
  getOffers,
  getOfferDetails,
  createOffer,
  updateOffer,
  toggleOfferStatus,
};