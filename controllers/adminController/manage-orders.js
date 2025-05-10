const Order = require("../../models/orderSchema");

const getManageOrders = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Orders per page
    const skip = (page - 1) * limit;

    // Fetch total number of orders
    const totalOrders = await Order.countDocuments({ isDeleted: false });

    // Fetch orders with pagination and populate user details
    const orders = await Order.find({ isDeleted: false })
      .populate('user', 'fullName') // Populate user to get customer name
      .sort({ createdAt: -1 }) // Sort by date, newest first
      .skip(skip)
      .limit(limit)
      .lean();

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit);

    // Format order data for display
    orders.forEach(order => {
      order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      order.formattedTotal = `₹${order.total.toFixed(2)}`;
      order.customerName = order.user ? order.user.fullName : 'Unknown';
    });

    // Pagination data
    const pagination = {
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
    };

    // Render the manage-orders view
    res.render('manage-orders', {
      orders,
      pagination,
      title: 'Manage Orders',
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

module.exports = { getManageOrders };