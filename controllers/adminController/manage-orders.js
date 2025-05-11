const Order = require("../../models/orderSchema");

const getManageOrders = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Orders per page
    const skip = (page - 1) * limit;

    // Build query
    const query = { isDeleted: false };

    // Handle Order Status filter
    const validStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    let status = req.query.status || '';
    if (status === 'Pending') status = 'Placed'; // Map "Pending" to "Placed" as per schema
    if (status && validStatuses.includes(status)) {
      query.orderStatus = status;
    }

    // Handle Payment Method filter
    const validPaymentMethods = ['COD', 'UPI', 'Card', 'Wallet'];
    let payment = req.query.payment || '';
    if (payment === 'CARD') payment = 'Card'; // Normalize for schema
    if (payment === 'UPI') payment = 'UPI'; // Already matches schema
    if (payment && validPaymentMethods.includes(payment)) {
      query.paymentMethod = payment;
    }

    // Handle Order Amount filter
    const minAmount = parseFloat(req.query.min_amount) || 0;
    const maxAmount = parseFloat(req.query.max_amount) || Infinity;
    if (minAmount > 0 || maxAmount < Infinity) {
      query.total = {};
      if (minAmount > 0) query.total.$gte = minAmount;
      if (maxAmount < Infinity) query.total.$lte = maxAmount;
    }

    // Handle Order Date filter
    const startDate = req.query.start_date ? new Date(req.query.start_date) : null;
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null;
    if (startDate && !isNaN(startDate)) {
      query.createdAt = query.createdAt || {};
      query.createdAt.$gte = startDate;
    }
    if (endDate && !isNaN(endDate)) {
      // Set endDate to the end of the day
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = query.createdAt || {};
      query.createdAt.$lte = endDate;
    }

    // Fetch total number of orders based on the query
    const totalOrders = await Order.countDocuments(query);

    // Fetch orders with pagination, populate user details, and apply filters
    const orders = await Order.find(query)
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

    // Prepare filter values to pre-select in the form
    const filters = {
      status: status || '',
      payment: payment || '',
      min_amount: req.query.min_amount || '',
      max_amount: req.query.max_amount || '',
      start_date: req.query.start_date || '',
      end_date: req.query.end_date || '',
    };

    // Render the manage-orders view
    res.render('manage-orders', {
      orders,
      pagination,
      title: 'Manage Orders',
      filters, // Pass filter values for the form
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    // Validate the new status
    const validStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Fetch the order
    const order = await Order.findById(orderId);
    if (!order || order.isDeleted) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Define allowed status transitions
    const statusTransitions = {
      'Placed': ['Processing', 'Cancelled'],
      'Processing': ['Shipped', 'Cancelled'],
      'Shipped': ['Delivered'],
      'Delivered': ['Returned'],
      'Cancelled': [],
      'Returned': [],
    };

    // Check if the transition is allowed
    const allowedStatuses = statusTransitions[order.orderStatus] || [];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Cannot update order status from ${order.orderStatus} to ${status}`,
      });
    }

    // Update the order status and relevant timestamps
    const now = new Date();
    order.orderStatus = status;

    // Reset timestamps to null before setting the relevant one
    order.deliveredAt = null;
    order.cancelledAt = null;
    order.returnedAt = null;

    // Set the appropriate timestamp based on the new status
    if (status === 'Delivered') {
      order.deliveredAt = now;
    } else if (status === 'Cancelled') {
      order.cancelledAt = now;
    } else if (status === 'Returned') {
      order.returnedAt = now;
    }

    await order.save();

    res.status(200).json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getManageOrders, updateOrderStatus };