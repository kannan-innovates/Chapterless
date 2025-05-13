const Coupon = require('../../models/couponSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

const getCoupons = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Coupons per page
    const skip = (page - 1) * limit;

    // Build query
    const query = {};

    // Handle search
    const search = req.query.search || '';
    if (search) {
      query.code = { $regex: search, $options: 'i' };
    }

    // Handle status filter
    const status = req.query.status || 'all';
    if (status !== 'all') {
      if (status === 'active') {
        query.isActive = true;
        query.expiryDate = { $gte: new Date() };
      } else if (status === 'inactive') {
        query.isActive = false;
      } else if (status === 'expired') {
        query.expiryDate = { $lt: new Date() };
      }
    }

    // Handle discount type filter
    const type = req.query.type || 'all';
    if (type !== 'all') {
      query.discountType = type;
    }

    // Fetch total number of coupons
    const totalCoupons = await Coupon.countDocuments(query);

    // Fetch coupons with pagination
    const coupons = await Coupon.find(query)
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch categories and products for the modals
    const categories = await Category.find({ isListed: true }).lean();
    const products = await Product.find({ isDeleted: false }).lean();

    // Calculate pagination details
    const totalPages = Math.ceil(totalCoupons / limit);
    const start = totalCoupons > 0 ? skip + 1 : 0;
    const end = Math.min(skip + limit, totalCoupons);

    const pagination = {
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
      start,
      end,
      totalCoupons,
    };

    const filters = {
      status,
      type,
      search,
    };

    res.render('coupons', {
      coupons,
      categories,
      products,
      pagination,
      filters,
      title: 'Manage Coupons',
    });
  } catch (error) {
    console.error('Error in loading coupons page:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

const getCouponDetails = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId)
      .populate('applicableCategories', 'name')
      .populate('applicableProducts', 'title')
      .lean();

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // Convert ObjectIds to strings for applicableCategories and applicableProducts
    coupon.applicableCategories = coupon.applicableCategories.map(cat => cat._id.toString());
    coupon.applicableProducts = coupon.applicableProducts.map(prod => prod._id.toString());

    res.status(200).json(coupon);
  } catch (error) {
    console.error('Error fetching coupon details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const createCoupon = async (req, res) => {
  try {
    const {
      code,
      isActive,
      description,
      discountType,
      discountValue,
      maxDiscountValue,
      minOrderAmount,
      startDate,
      expiryDate,
      usageLimitGlobal,
      usageLimitPerUser,
      applicableCategories,
      applicableProducts,
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !startDate || !expiryDate) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    // Validate dates
    const start = new Date(startDate);
    const expiry = new Date(expiryDate);
    if (start >= expiry) {
      return res.status(400).json({ message: 'Expiry date must be after start date' });
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({ message: 'Percentage discount must be between 0 and 100' });
    }
    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({ message: 'Fixed discount must be greater than 0' });
    }

    // Create new coupon
    const coupon = new Coupon({
      code: code.toUpperCase(),
      isActive,
      description: description || '',
      discountType,
      discountValue,
      maxDiscountValue: discountType === 'percentage' ? maxDiscountValue : null,
      minOrderAmount: minOrderAmount || 0,
      startDate: start,
      expiryDate: expiry,
      usageLimitGlobal: usageLimitGlobal || null,
      usageLimitPerUser: usageLimitPerUser || 1,
      applicableCategories: applicableCategories || [],
      applicableProducts: applicableProducts || [],
      createdByAdmin: req.session.admin, // Assuming admin ID is stored in session
    });

    await coupon.save();
    res.status(201).json({ success: true, message: 'Coupon created successfully' });
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      code,
      isActive,
      description,
      discountType,
      discountValue,
      maxDiscountValue,
      minOrderAmount,
      startDate,
      expiryDate,
      usageLimitGlobal,
      usageLimitPerUser,
      applicableCategories,
      applicableProducts,
    } = req.body;

    // Validate required fields
    if (!code || !discountType || !discountValue || !startDate || !expiryDate) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Fetch the existing coupon
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    // Check if coupon code already exists (excluding current coupon)
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase(), _id: { $ne: couponId } });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    // Validate dates
    const start = new Date(startDate);
    const expiry = new Date(expiryDate);
    if (start >= expiry) {
      return res.status(400).json({ message: 'Expiry date must be after start date' });
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({ message: 'Percentage discount must be between 0 and 100' });
    }
    if (discountType === 'fixed' && discountValue <= 0) {
      return res.status(400).json({ message: 'Fixed discount must be greater than 0' });
    }

    // Update coupon
    coupon.code = code.toUpperCase();
    coupon.isActive = isActive;
    coupon.description = description || '';
    coupon.discountType = discountType;
    coupon.discountValue = discountValue;
    coupon.maxDiscountValue = discountType === 'percentage' ? maxDiscountValue : null;
    coupon.minOrderAmount = minOrderAmount || 0;
    coupon.startDate = start;
    coupon.expiryDate = expiry;
    coupon.usageLimitGlobal = usageLimitGlobal || null;
    coupon.usageLimitPerUser = usageLimitPerUser || 1;
    coupon.applicableCategories = applicableCategories || [];
    coupon.applicableProducts = applicableProducts || [];

    await coupon.save();
    res.status(200).json({ success: true, message: 'Coupon updated successfully' });
  } catch (error) {
    console.error('Error updating coupon:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.status(200).json({ success: true, message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('Error toggling coupon status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getCoupons,
  getCouponDetails,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
};