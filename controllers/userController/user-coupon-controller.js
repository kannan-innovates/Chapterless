const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');

const getUserCoupons = async (req, res) => {
  try {
    // Check if user is authenticated
    const userId = req.session.user_id; // Changed from req.session.user?._id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to view coupons' });
    }

    // Verify user exists and is not blocked
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Your account is blocked' });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 6; // Coupons per page
    const skip = (page - 1) * limit;

    // Current date for expiry check
    const currentDate = new Date();

    // Fetch all active coupons (for counting)
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: currentDate },
      expiryDate: { $gte: currentDate },
    })
      .populate('applicableCategories', 'name')
      .populate('applicableProducts', 'title')
      .lean();

    // Filter coupons based on usage limits
    const filteredCoupons = coupons.filter(coupon => {
      // Check global usage limit
      if (coupon.usageLimitGlobal && coupon.usedCount >= coupon.usageLimitGlobal) {
        return false;
      }
      // Check per-user usage limit
      const userUsage = coupon.usedBy.find(usage => usage.userId.toString() === userId.toString());
      if (userUsage && userUsage.count >= coupon.usageLimitPerUser) {
        return false;
      }
      return true;
    });

    // Calculate pagination details
    const totalCoupons = filteredCoupons.length;
    const totalPages = Math.ceil(totalCoupons / limit);
    const start = totalCoupons > 0 ? skip + 1 : 0;
    const end = Math.min(skip + limit, totalCoupons);

    // Validate page number
    if (page < 1 || (page > totalPages && totalPages > 0)) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    // Slice coupons for the current page
    const paginatedCoupons = filteredCoupons.slice(skip, skip + limit);

    // Format coupons for display
    const formattedCoupons = paginatedCoupons.map(coupon => {
      const userUsage = coupon.usedBy.find(usage => usage.userId.toString() === userId.toString());
      const remainingUses = coupon.usageLimitPerUser - (userUsage ? userUsage.count : 0);
      const discountDisplay = coupon.discountType === 'percentage'
        ? `${coupon.discountValue}% OFF${coupon.maxDiscountValue ? ` (up to ₹${coupon.maxDiscountValue})` : ''}`
        : `₹${coupon.discountValue} OFF`;
      const applicabilityDisplay = coupon.applicableCategories.length > 0
        ? `Applicable on: ${coupon.applicableCategories.map(cat => cat.name).join(', ')}`
        : coupon.applicableProducts.length > 0
        ? `Applicable on: ${coupon.applicableProducts.map(prod => prod.title).join(', ')}`
        : 'Applicable on all products';

      return {
        ...coupon,
        discountDisplay,
        applicabilityDisplay,
        validityText: `Valid till: ${coupon.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        minOrderText: coupon.minOrderAmount > 0 ? `Min. order: ₹${coupon.minOrderAmount}` : '',
        remainingUses: remainingUses > 0 && coupon.usageLimitPerUser > 1 ? `Uses left: ${remainingUses}` : '',
      };
    });

    // Sort coupons by expiry date (ascending)
    formattedCoupons.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    // Pagination metadata
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

    res.render('user-coupons', {
      coupons: formattedCoupons,
      user,
      noCoupons: totalCoupons === 0,
      pagination,
      title: 'Available Coupons',
      currentPage: 'coupons',
      isAuthenticated: true // Add this to ensure the view knows the user is authenticated
    });
  } catch (error) {
    console.error('Error fetching user coupons:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getUserCoupons };