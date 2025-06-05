const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const { processReturnRefund, calculateItemRefundAmount } = require("../userController/wallet-controller");
const { HttpStatus } = require('../../helpers/status-code');

/**
 * ENHANCED RETURN MANAGEMENT - PRODUCTION OPTIMIZED
 * Handles return requests with detailed refund calculations and tax handling
 */

/**
 * Calculate estimated refund amount for return requests (OPTIMIZED)
 * @param {Object} order - Order object with items
 * @returns {Object} Refund calculation summary
 */
const calculateEstimatedRefund = (order) => {
  try {
    // **OPTIMIZED: Early validation and filtering**
    if (!order?.items?.length) {
      return { total: 0, base: 0, tax: 0, breakdown: [] };
    }

    const returnRequestedItems = order.items.filter(item => item.status === 'Return Requested');
    if (returnRequestedItems.length === 0) {
      return { total: 0, base: 0, tax: 0, breakdown: [] };
    }

    // **OPTIMIZED: Single calculation pass**
    const isFullOrderReturn = returnRequestedItems.length === order.items.length;
    let totalRefund = 0;
    let totalBase = 0;
    let totalTax = 0;

    // **OPTIMIZED: Reduce array operations**
    for (const item of returnRequestedItems) {
      const refundResult = calculateItemRefundAmount(item, order, 'return', isFullOrderReturn);

      if (refundResult?.breakdown) {
        totalRefund += refundResult.amount || 0;
        totalBase += refundResult.breakdown.finalPrice || 0;
        totalTax += refundResult.breakdown.taxRefundAmount || 0;
      }
    }

    return {
      total: Number(totalRefund.toFixed(2)),
      base: Number(totalBase.toFixed(2)),
      tax: Number(totalTax.toFixed(2)),
      isFullOrderReturn,
      itemCount: returnRequestedItems.length
    };
  } catch (error) {
    console.error('Error calculating estimated refund:', error.message);
    return { total: 0, base: 0, tax: 0, breakdown: [] };
  }
};

/**
 * Get all orders with return requests for admin management
 */
const getReturnRequests = async (req, res) => {
  try {
    // Pagination parameters
    const page = Number.parseInt(req.query.page) || 1;
    const limit = 10; // Orders per page
    const skip = (page - 1) * limit;

    // Build query for orders with return requests
    const query = {
      isDeleted: false,
      $or: [
        { orderStatus: 'Return Requested' },
        { 'items.status': 'Return Requested' }
      ]
    };

    // Handle status filter
    const status = req.query.status || "";
    if (status === "pending") {
      query.orderStatus = 'Return Requested';
    } else if (status === "individual") {
      query.orderStatus = 'Delivered';
      query['items.status'] = 'Return Requested';
    }

    // Fetch total number of orders with return requests
    const totalOrders = await Order.countDocuments(query);

    // Fetch orders with return requests
    const orders = await Order.find(query)
      .populate("user", "fullName email")
      .sort({ updatedAt: -1 }) // Sort by most recent updates
      .skip(skip)
      .limit(limit)
      .lean();

    // Process orders to extract return request information
    const processedOrders = orders.map(order => {
      const returnRequestedItems = order.items.filter(item => item.status === 'Return Requested');

      // **CALCULATE ESTIMATED REFUND**
      const estimatedRefund = calculateEstimatedRefund(order);

      return {
        ...order,
        returnRequestedItems,
        returnRequestCount: returnRequestedItems.length,
        formattedDate: new Date(order.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        formattedTotal: `₹${order.total.toFixed(2)}`,
        customerName: order.user ? order.user.fullName : "Unknown",
        customerEmail: order.user ? order.user.email : "N/A",
        hasIndividualReturns: returnRequestedItems.length > 0 && order.orderStatus === 'Delivered',
        hasFullOrderReturn: order.orderStatus === 'Return Requested',
        estimatedRefund: estimatedRefund // **NEW: Include refund breakdown**
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit);

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

    // Prepare filter values
    const filters = {
      status: status || "",
    };

    // Get error message from session and clear it
    const errorMessage = req.session.errorMessage;
    delete req.session.errorMessage;

    // Render the return management view
    res.render("admin/return-management", {
      orders: processedOrders,
      pagination,
      title: "Return Management",
      filters,
      totalReturnRequests: totalOrders,
      errorMessage
    });
  } catch (error) {
    console.error("Error fetching return requests:", error);
    res.redirect('/admin/dashboard');
  }
};

/**
 * Get detailed view of a specific return request
 */
const getReturnRequestDetails = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("user", "fullName email phone")
      .lean();

    if (!order || order.isDeleted) {
      return res.status(HttpStatus.NOT_FOUND).render('admin/page-404', {
        title: 'Return Request Not Found'
      });
    }

    // Filter items with return requests
    const returnRequestedItems = order.items.filter(item => item.status === 'Return Requested');

    if (returnRequestedItems.length === 0) {
      // If no return requests found, redirect with a message
      req.session.errorMessage = 'No pending return requests found for this order.';
      return res.redirect('/admin/return-management');
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    order.formattedTotal = `₹${order.total.toFixed(2)}`;

    // **CORRECTED REFUND CALCULATION - EXACT CUSTOMER PAID AMOUNT**
    let totalRefundAmount = 0;
    returnRequestedItems.forEach(item => {
      if (item.priceBreakdown && item.priceBreakdown.finalPrice) {
        totalRefundAmount += item.priceBreakdown.finalPrice;
      } else {
        // Fallback calculation
        totalRefundAmount += item.discountedPrice * item.quantity;
      }
    });

    res.render('admin/return-request-details', {
      title: `Return Request - Order #${order.orderNumber}`,
      order,
      returnRequestedItems,
      totalRefundAmount: totalRefundAmount.toFixed(2),
      customer: order.user || {}
    });

  } catch (error) {
    console.error('Error in getReturnRequestDetails:', error);
    res.redirect('/admin/return-management');
  }
};

/**
 * Process individual return request (approve/reject)
 */
const processReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { approved } = req.body;

    const order = await Order.findById(orderId);
    if (!order || order.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Find items with return requests
    const returnRequestedItems = order.items.filter(item => item.status === 'Return Requested');

    if (returnRequestedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No return requests found for this order'
      });
    }

    const now = new Date();

    for (const item of returnRequestedItems) {
      if (approved) {
        // Approve return
        item.status = 'Returned';
        item.returnedAt = now;

        // Restore product stock
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      } else {
        // Reject return
        item.status = 'Active';
        item.returnRequestedAt = null;
        item.returnReason = null;
      }
    }

    // Update order status
    const hasActiveItems = order.items.some(i => i.status === 'Active');
    const hasReturnRequestedItems = order.items.some(i => i.status === 'Return Requested');

    if (!hasActiveItems && !hasReturnRequestedItems) {
      order.orderStatus = 'Returned';
    } else if (!hasReturnRequestedItems) {
      order.orderStatus = 'Delivered';
    }

    // Process refund if approved
    if (approved) {
      console.log('Processing return refund for order:', orderId, {
        paymentStatus: order.paymentStatus,
        userId: order.user,
        returnedItems: order.items.filter(i => i.status === 'Returned').length
      });

      // Process refund based on payment method and status
      let refundProcessed = false;

      if (order.paymentMethod === 'COD') {
        // For COD orders, only process refund if order was delivered (cash was paid)
        // Check multiple indicators that the order was delivered and cash was collected
        const wasDeliveredAndPaid = order.paymentStatus === 'Paid' ||
                                    order.orderStatus === 'Delivered' ||
                                    order.deliveredAt ||
                                    order.items.some(item =>
                                      item.status === 'Delivered' ||
                                      item.status === 'Returned' ||
                                      (item.status === 'Active' && order.orderStatus === 'Delivered')
                                    );

        if (wasDeliveredAndPaid) {
          const refundSuccess = await processReturnRefund(order.user, order);
          if (refundSuccess) {
            refundProcessed = true;
            console.log('COD return refund processed successfully');
          } else {
            console.error('Failed to process COD return refund');
            return res.status(500).json({
              success: false,
              message: 'Failed to process refund. Please try again.'
            });
          }
        } else {
          console.log('COD order not delivered/paid yet - no refund needed');
          refundProcessed = true; // No refund needed, but mark as processed
        }
      } else {
        // **ENHANCED REFUND PROCESSING WITH TAX HANDLING**
        if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded') {
          console.log('Processing online payment return refund with enhanced logic');

          const refundSuccess = await processReturnRefund(order.user, order);
          if (refundSuccess) {
            refundProcessed = true;
            console.log('Enhanced online payment return refund processed successfully');
          } else {
            console.error('Failed to process enhanced online payment return refund');
            return res.status(500).json({
              success: false,
              message: 'Failed to process refund with tax calculation. Please try again.'
            });
          }
        } else {
          console.log('Order not paid - no refund needed');
          refundProcessed = true; // No refund needed, but mark as processed
        }
      }

      // Update payment status based on refund processing
      if (refundProcessed) {
        if (order.paymentMethod === 'COD' && order.paymentStatus !== 'Paid') {
          // COD order not delivered yet - set to failed
          order.paymentStatus = 'Failed';
        } else if (hasActiveItems) {
          order.paymentStatus = 'Partially Refunded';
        } else {
          order.paymentStatus = 'Refunded';
        }
      }
    }

    await order.save();

    res.json({
      success: true,
      message: approved
        ? 'Return request approved and refund processed successfully'
        : 'Return request rejected successfully'
    });

  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Bulk approve/reject return requests
 */
const bulkProcessReturns = async (req, res) => {
  try {
    const { orderIds, action } = req.body; // action: 'approve' or 'reject'

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'No orders selected'
      });
    }

    const approved = action === 'approve';
    let processedCount = 0;
    let errors = [];

    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId);
        if (!order) continue;

        const returnRequestedItems = order.items.filter(item => item.status === 'Return Requested');

        for (const item of returnRequestedItems) {
          if (approved) {
            // Approve return
            item.status = 'Returned';
            item.returnedAt = new Date();

            // Restore product stock
            await Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: item.quantity } }
            );
          } else {
            // Reject return
            item.status = 'Active';
            item.returnRequestedAt = null;
            item.returnReason = null;
          }
        }

        // Update order status
        const hasActiveItems = order.items.some(i => i.status === 'Active');
        const hasReturnRequestedItems = order.items.some(i => i.status === 'Return Requested');

        if (!hasActiveItems && !hasReturnRequestedItems) {
          order.orderStatus = 'Returned';
        } else if (!hasReturnRequestedItems) {
          order.orderStatus = 'Delivered';
        }

        // Process refund if approved - handle all payment methods
        if (approved) {
          let refundProcessed = false;

          if (order.paymentMethod === 'COD') {
            // For COD orders, only process refund if order was delivered (cash was paid)
            // Check multiple indicators that the order was delivered and cash was collected
            const wasDeliveredAndPaid = order.paymentStatus === 'Paid' ||
                                        order.orderStatus === 'Delivered' ||
                                        order.deliveredAt ||
                                        order.items.some(item =>
                                          item.status === 'Delivered' ||
                                          item.status === 'Returned' ||
                                          (item.status === 'Active' && order.orderStatus === 'Delivered')
                                        );

            if (wasDeliveredAndPaid) {
              console.log('Processing COD return refund with enhanced tax logic');
              const refundSuccess = await processReturnRefund(order.user, order);
              if (refundSuccess) {
                refundProcessed = true;
                console.log('Enhanced COD return refund processed successfully');
              }
            } else {
              refundProcessed = true; // No refund needed for unpaid COD
            }
          } else {
            // For online payment methods
            if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded') {
              const refundSuccess = await processReturnRefund(order.user, order);
              if (refundSuccess) {
                refundProcessed = true;
              }
            } else {
              refundProcessed = true; // No refund needed for unpaid orders
            }
          }

          // Update payment status based on refund processing
          if (refundProcessed) {
            if (order.paymentMethod === 'COD' && order.paymentStatus !== 'Paid') {
              order.paymentStatus = 'Failed';
            } else if (hasActiveItems) {
              order.paymentStatus = 'Partially Refunded';
            } else {
              order.paymentStatus = 'Refunded';
            }
          }
        }

        await order.save();
        processedCount++;
      } catch (error) {
        console.error(`Error processing order ${orderId}:`, error);
        errors.push(`Order ${orderId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `${approved ? 'Approved' : 'Rejected'} ${processedCount} return request(s)`,
      processedCount,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error("Error in bulk process returns:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = {
  getReturnRequests,
  getReturnRequestDetails,
  processReturnRequest,
  bulkProcessReturns
};
