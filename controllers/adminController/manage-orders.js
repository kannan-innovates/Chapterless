const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const { processReturnRefund } = require("../userController/wallet-controller")

const getManageOrders = async (req, res) => {
  try {
    // Pagination parameters
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10 // Orders per page
    const skip = (page - 1) * limit

    // Build query
    const query = { isDeleted: false }

    // Handle Order Status filter
    const validStatuses = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Partially Cancelled", "Partially Returned"]
    let status = req.query.status || ""
    if (status === "Pending") status = "Placed" // Map "Pending" to "Placed" as per schema
    if (status && validStatuses.includes(status)) {
      query.orderStatus = status
    }

    // Handle Payment Method filter
    const validPaymentMethods = ["COD", "UPI", "Card", "Wallet"]
    let payment = req.query.payment || ""
    if (payment === "CARD") payment = "Card" 
    if (payment === "UPI") payment = "UPI" 
    if (payment && validPaymentMethods.includes(payment)) {
      query.paymentMethod = payment
    }

    // Handle Order Amount filter
    const minAmount = Number.parseFloat(req.query.min_amount) || 0
    const maxAmount = Number.parseFloat(req.query.max_amount) || Number.POSITIVE_INFINITY
    if (minAmount > 0 || maxAmount < Number.POSITIVE_INFINITY) {
      query.total = {}
      if (minAmount > 0) query.total.$gte = minAmount
      if (maxAmount < Number.POSITIVE_INFINITY) query.total.$lte = maxAmount
    }

    // Handle Order Date filter
    const startDate = req.query.start_date ? new Date(req.query.start_date) : null
    const endDate = req.query.end_date ? new Date(req.query.end_date) : null
    if (startDate && !isNaN(startDate)) {
      query.createdAt = query.createdAt || {}
      query.createdAt.$gte = startDate
    }
    if (endDate && !isNaN(endDate)) {
      // Set endDate to the end of the day
      endDate.setHours(23, 59, 59, 999)
      query.createdAt = query.createdAt || {}
      query.createdAt.$lte = endDate
    }

    // Fetch total number of orders based on the query
    const totalOrders = await Order.countDocuments(query)

    // Fetch orders with pagination, populate user details, and apply filters
    const orders = await Order.find(query)
      .populate("user", "fullName") // Populate user to get customer name
      .sort({ createdAt: -1 }) // Sort by date, newest first
      .skip(skip)
      .limit(limit)
      .lean()

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit)

    // Format order data for display
    orders.forEach((order) => {
      order.formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      order.formattedTotal = `₹${order.total.toFixed(2)}`
      order.customerName = order.user ? order.user.fullName : "Unknown"
    })

    // Pagination data
    const pagination = {
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
    }

    // Prepare filter values to pre-select in the form
    const filters = {
      status: status || "",
      payment: payment || "",
      min_amount: req.query.min_amount || "",
      max_amount: req.query.max_amount || "",
      start_date: req.query.start_date || "",
      end_date: req.query.end_date || "",
    }

    // Render the manage-orders view
    res.render("manage-orders", {
      orders,
      pagination,
      title: "Manage Orders",
      filters, // Pass filter values for the form
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    res.redirect('/admin/dashboard');
  }
}

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('user', 'fullName email phone address')
      .populate({
        path: 'items.product',
        select: 'title author isbn image price'
      })
      .lean();

    if (!order) {
      return res.redirect('/admin/getOrders');
    }

    // Format dates
    order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Process each item to include price details
    order.items = order.items.map(item => {
      // Basic price formatting
      const originalPrice = Number(item.price);
      const quantity = Number(item.quantity || 1);

      // Handle price breakdown if available
      if (item.priceBreakdown) {
        const breakdown = {
          originalPrice: Number(item.priceBreakdown.originalPrice),
          priceAfterOffer: Number(item.priceBreakdown.priceAfterOffer),
          offerDiscount: Number(item.priceBreakdown.offerDiscount || 0),
          couponDiscount: Number(item.priceBreakdown.couponDiscount || 0),
          finalPrice: Number(item.priceBreakdown.finalPrice),
          offerTitle: item.priceBreakdown.offerTitle || ''
        };

        // Format all prices
        item.formattedOriginalPrice = `₹${breakdown.originalPrice.toFixed(2)}`;
        item.formattedPriceAfterOffer = `₹${breakdown.priceAfterOffer.toFixed(2)}`;
        item.formattedFinalPrice = `₹${breakdown.finalPrice.toFixed(2)}`;
        
        // Calculate per unit savings
        const offerSavingsPerUnit = breakdown.offerDiscount;
        const couponSavingsPerUnit = breakdown.couponDiscount;
        
        // Calculate total amounts
        item.totalOriginalPrice = breakdown.originalPrice * quantity;
        item.totalPriceAfterOffer = breakdown.priceAfterOffer * quantity;
        item.totalFinalPrice = breakdown.finalPrice * quantity;
        item.totalOfferSavings = offerSavingsPerUnit * quantity;
        item.totalCouponSavings = couponSavingsPerUnit * quantity;

        // Format total amounts
        item.formattedTotalOriginalPrice = `₹${item.totalOriginalPrice.toFixed(2)}`;
        item.formattedTotalFinalPrice = `₹${item.totalFinalPrice.toFixed(2)}`;

        // Calculate and format savings percentage
        if (breakdown.offerDiscount > 0) {
          const offerSavingPercent = (breakdown.offerDiscount / breakdown.originalPrice) * 100;
          item.offerSavingText = `Save ${offerSavingPercent.toFixed(0)}% with ${breakdown.offerTitle}`;
        }

        // Handle refund amount for cancelled/returned items
        if (item.status === 'Cancelled' || item.status === 'Returned') {
          item.refundAmount = breakdown.finalPrice * quantity;
          item.formattedRefund = `₹${item.refundAmount.toFixed(2)}`;
        }

      } else {
        // Fallback for orders without price breakdown
        const discountedPrice = Number(item.discountedPrice || item.price);
        
        item.formattedOriginalPrice = `₹${originalPrice.toFixed(2)}`;
        item.formattedDiscountedPrice = `₹${discountedPrice.toFixed(2)}`;
        
        item.totalOriginalPrice = originalPrice * quantity;
        item.totalDiscountedPrice = discountedPrice * quantity;
        
        item.formattedTotalOriginalPrice = `₹${item.totalOriginalPrice.toFixed(2)}`;
        item.formattedTotalDiscountedPrice = `₹${item.totalDiscountedPrice.toFixed(2)}`;

        if (originalPrice > discountedPrice) {
          const savingPercent = ((originalPrice - discountedPrice) / originalPrice) * 100;
          item.savingText = `Save ${savingPercent.toFixed(0)}%`;
        }

        if (item.status === 'Cancelled' || item.status === 'Returned') {
          item.refundAmount = discountedPrice * quantity;
          item.formattedRefund = `₹${item.refundAmount.toFixed(2)}`;
        }
      }

      return item;
    });

    // Calculate order totals
    const totals = {
      subtotal: 0,
      offerDiscount: 0,
      couponDiscount: 0,
      tax: Number(order.tax || 0),
      shipping: Number(order.shipping || 0),
      totalRefunded: 0
    };

    // Calculate totals from items
    order.items.forEach(item => {
      if (item.priceBreakdown) {
        totals.subtotal += item.totalOriginalPrice;
        totals.offerDiscount += item.totalOfferSavings;
        totals.couponDiscount += item.totalCouponSavings;
        
        if (item.status === 'Cancelled' || item.status === 'Returned') {
          totals.totalRefunded += item.refundAmount;
        }
      } else {
        totals.subtotal += item.totalOriginalPrice;
        totals.offerDiscount += (item.totalOriginalPrice - item.totalDiscountedPrice);
        
        if (item.status === 'Cancelled' || item.status === 'Returned') {
          totals.totalRefunded += item.refundAmount;
        }
      }
    });

    // Format order totals
    order.formattedSubtotal = `₹${totals.subtotal.toFixed(2)}`;
    order.formattedOfferDiscount = totals.offerDiscount > 0 ? `₹${totals.offerDiscount.toFixed(2)}` : null;
    order.formattedCouponDiscount = totals.couponDiscount > 0 ? `₹${totals.couponDiscount.toFixed(2)}` : null;
    order.formattedTax = `₹${totals.tax.toFixed(2)}`;
    order.formattedShipping = totals.shipping > 0 ? `₹${totals.shipping.toFixed(2)}` : 'Free';
    order.formattedTotal = `₹${order.total.toFixed(2)}`;
    order.formattedTotalRefunded = totals.totalRefunded > 0 ? `₹${totals.totalRefunded.toFixed(2)}` : null;

    // Check item statuses
    const hasActiveItems = order.items.some(item => 
      item.status !== 'Cancelled' && item.status !== 'Returned'
    );

    const hasReturnRequestedItems = order.items.some(item => 
      item.status === 'Return Requested'
    );

    // Generate timeline data
    const timeline = [];
    
    timeline.push({
      status: 'Order Placed',
      timestamp: new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      message: 'Order has been placed successfully',
      completed: true
    });

    if (order.processedAt || order.orderStatus === 'Processing') {
      timeline.push({
        status: 'Processing',
        timestamp: order.processedAt ? new Date(order.processedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Pending',
        message: 'Order is being processed',
        completed: !!order.processedAt
      });
    }

    if (order.shippedAt || order.orderStatus === 'Shipped') {
      timeline.push({
        status: 'Shipped',
        timestamp: order.shippedAt ? new Date(order.shippedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Pending',
        message: order.trackingId ? `Order shipped with tracking ID: ${order.trackingId}` : 'Order has been shipped',
        completed: !!order.shippedAt
      });
    }

    if (order.deliveredAt || order.orderStatus === 'Delivered') {
      timeline.push({
        status: 'Delivered',
        timestamp: order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Pending',
        message: 'Order has been delivered',
        completed: !!order.deliveredAt
      });
    }

    if (order.orderStatus.includes('Cancelled') || order.orderStatus.includes('Returned')) {
      timeline.push({
        status: order.orderStatus,
        timestamp: (order.cancelledAt || order.returnedAt) ? 
          new Date(order.cancelledAt || order.returnedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : 'N/A',
        message: `Order has been ${order.orderStatus.toLowerCase()}`,
        completed: true,
        refundAmount: order.formattedTotalRefunded
      });
    }

    res.render('manage-order-details', {
      title: `Order #${order.orderNumber}`,
      order,
      hasActiveItems,
      hasReturnRequestedItems,
      timeline,
      customer: order.user || {}
    });

  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    res.redirect('/admin/getOrders');
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id
    const { status, itemId } = req.body

    // Validate the new status
    const validStatuses = ["Placed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Partially Cancelled", "Partially Returned"]
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" })
    }

    // Fetch the order
    const order = await Order.findById(orderId)
    if (!order || order.isDeleted) {
      return res.status(404).json({ success: false, message: "Order not found" })
    }

    // If itemId is provided, update just that item
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ success: false, message: "Item not found in order" });
      }

      // Define allowed item status transitions
      const itemStatusTransitions = {
        'Active': ['Cancelled', 'Returned'],
        'Cancelled': [],
        'Returned': []
      };

      // Check if the transition is allowed for this item
      const allowedItemStatuses = itemStatusTransitions[item.status] || [];
      if (!allowedItemStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot update item status from ${item.status} to ${status}`
        });
      }

      // Update the item status
      const now = new Date();
      item.status = status;
      
      if (status === 'Cancelled') {
        item.cancelledAt = now;
        item.cancellationReason = 'Cancelled by admin';
        
        // Restore product stock
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      } else if (status === 'Returned') {
        item.returnedAt = now;
        item.returnReason = 'Returned by admin';
        
        // Restore product stock
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }

      // Update overall order status based on item statuses
      const hasActiveItems = order.items.some(i => i.status === 'Active');
      const hasCancelledItems = order.items.some(i => i.status === 'Cancelled');
      const hasReturnedItems = order.items.some(i => i.status === 'Returned');

      if (!hasActiveItems) {
        // If no active items remain
        if (hasReturnedItems && !hasCancelledItems) {
          order.orderStatus = 'Returned';
        } else if (hasCancelledItems && !hasReturnedItems) {
          order.orderStatus = 'Cancelled';
        } else if (hasReturnedItems && hasCancelledItems) {
          // Both returned and cancelled items exist
          order.orderStatus = 'Partially Returned';
        }
      } else {
        // Some active items remain
        if (hasReturnedItems && hasCancelledItems) {
          // Both returned and cancelled items exist
          order.orderStatus = 'Partially Returned';
        } else if (hasReturnedItems) {
          order.orderStatus = 'Partially Returned';
        } else if (hasCancelledItems) {
          order.orderStatus = 'Partially Cancelled';
        }
      }

      await order.save();
      return res.status(200).json({ success: true, message: "Item status updated successfully" });
    }

    // Define allowed status transitions for the entire order
    const statusTransitions = {
      Placed: ["Processing", "Cancelled"],
      Processing: ["Shipped", "Cancelled"],
      Shipped: ["Delivered"],
      Delivered: ["Returned"],
      Cancelled: [],
      Returned: [],
      "Partially Cancelled": ["Shipped", "Cancelled"],
      "Partially Returned": ["Returned"],
    }

    // Check if the transition is allowed
    const allowedStatuses = statusTransitions[order.orderStatus] || []
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update order status from ${order.orderStatus} to ${status}`,
      })
    }

    // Update the order status and set timestamps
    const now = new Date()
    order.orderStatus = status

    // For partial statuses, we need special handling
    if (order.orderStatus === "Partially Cancelled" || order.orderStatus === "Partially Returned") {
      if (status === "Cancelled") {
        // Cancel all remaining active items
        order.items.forEach((item) => {
          if (item.status === "Active") {
            item.status = "Cancelled"
            item.cancelledAt = now
            item.cancellationReason = "Cancelled by admin"
            
            // Restore product stock
            Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: item.quantity } }
            ).catch(err => console.error("Error updating product stock:", err));
          }
        })
      } else if (status === "Returned") {
        // Return all remaining active items
        order.items.forEach((item) => {
          if (item.status === "Active") {
            item.status = "Returned"
            item.returnedAt = now
            item.returnReason = "Returned by admin"
            
            // Restore product stock
            Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: item.quantity } }
            ).catch(err => console.error("Error updating product stock:", err));
          }
        })
      }
    } else if (status === "Cancelled") {
      // Cancel all items
      order.items.forEach((item) => {
        if (item.status === "Active") {
          item.status = "Cancelled"
          item.cancelledAt = now
          item.cancellationReason = "Cancelled by admin"
          
          // Restore product stock
          Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } }
          ).catch(err => console.error("Error updating product stock:", err));
        }
      })
    } else if (status === "Returned") {
      // Return all items
      order.items.forEach((item) => {
        if (item.status === "Active") {
          item.status = "Returned"
          item.returnedAt = now
          item.returnReason = "Returned by admin"
          
          // Restore product stock
          Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } }
          ).catch(err => console.error("Error updating product stock:", err));
        }
      })
    }

    // Set the appropriate timestamp based on the new status
    if (status === "Processing") {
      order.processedAt = now
    } else if (status === "Shipped") {
      order.shippedAt = now
      // Ensure processedAt is set if not already (for consistency)
      if (!order.processedAt) {
        order.processedAt = order.createdAt
      }
    } else if (status === "Delivered") {
      order.deliveredAt = now
      // Ensure processedAt and shippedAt are set if not already
      if (!order.processedAt) {
        order.processedAt = order.createdAt
      }
      if (!order.shippedAt) {
        order.shippedAt = new Date(order.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      }
      // For COD orders, update payment status to "Paid" upon delivery
      if (order.paymentMethod === "COD") {
        order.paymentStatus = "Paid"
      }
    } else if (status === "Cancelled") {
      order.cancelledAt = now
      // If order is cancelled, payment status should reflect as "Failed" for COD
      if (order.paymentMethod === "COD") {
        order.paymentStatus = "Failed"
      } else if (order.paymentStatus === "Paid") {
        order.paymentStatus = "Refund Initiated"
      }
    } else if (status === "Returned") {
      order.returnedAt = now
      // For COD orders, if returned, payment status should be "Refunded" (assuming payment was collected)
      if (order.paymentMethod === "COD" && order.paymentStatus === "Paid") {
        order.paymentStatus = "Refunded"
      } else if (order.paymentStatus === "Paid") {
        order.paymentStatus = "Refund Processing"
      }
    }

    await order.save()

    res.status(200).json({ success: true, message: "Order status updated successfully" })
  } catch (error) {
    console.error("Error updating order status:", error)
    res.status(500).json({ success: false, message: "Failed to update order status" })
  }
}

const updateItemStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const itemId = req.params.itemId;
    const { status, reason } = req.body;

    // Validate the new status
    const validStatuses = ["Cancelled", "Returned"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    // Fetch the order
    const order = await Order.findById(orderId);
    if (!order || order.isDeleted) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Find the item
    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in order" });
    }

    // Check if item can be updated
    if (item.status !== "Active") {
      return res.status(400).json({ 
        message: `Item cannot be ${status.toLowerCase()} in its current state (${item.status})` 
      });
    }

    // Update the item status
    const now = new Date();
    item.status = status;
    
    if (status === "Cancelled") {
      item.cancelledAt = now;
      item.cancellationReason = reason || "Cancelled by admin";
      
      // Restore product stock
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    } else if (status === "Returned") {
      item.returnedAt = now;
      item.returnReason = reason || "Returned by admin";
      
      // Restore product stock
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } }
      );
    }

    // Update overall order status based on item statuses
    const hasActiveItems = order.items.some(i => i.status === "Active");
    const hasCancelledItems = order.items.some(i => i.status === "Cancelled");
    const hasReturnedItems = order.items.some(i => i.status === "Returned");

    if (!hasActiveItems) {
      // If no active items remain
      if (hasReturnedItems && !hasCancelledItems) {
        order.orderStatus = "Returned";
      } else if (hasCancelledItems && !hasReturnedItems) {
        order.orderStatus = "Cancelled";
      } else if (hasReturnedItems && hasCancelledItems) {
        // Both returned and cancelled items exist
        order.orderStatus = "Partially Returned";
      }
    } else {
      // Some active items remain
      if (hasReturnedItems && hasCancelledItems) {
        // Both returned and cancelled items exist
        order.orderStatus = "Partially Returned";
      } else if (hasReturnedItems) {
        order.orderStatus = "Partially Returned";
      } else if (hasCancelledItems) {
        order.orderStatus = "Partially Cancelled";
      }
    }

    // Update payment status if needed
    if (status === "Cancelled" || status === "Returned") {
      if (order.paymentStatus === "Paid") {
        if (!hasActiveItems) {
          order.paymentStatus = status === "Cancelled" ? "Refund Initiated" : "Refund Processing";
        } else {
          order.paymentStatus = "Partially Refunded";
        }
      }
    }

    await order.save();

    res.status(200).json({ 
      message: `Item ${status.toLowerCase()} successfully`,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus
    });
  } catch (error) {
    console.error(`Error updating item status:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.id

    // Fetch the order
    const order = await Order.findOne({
      _id: orderId,
      isDeleted: false,
    }).lean()

    if (!order) {
      return res.status(404).send("Order not found")
    }

    // Fetch user data
    const user = await User.findById(order.user, "fullName email").lean()
    if (!user) {
      return res.status(401).send("User not found")
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    order.formattedTotal = `₹${order.total.toFixed(2)}`
    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`
    order.formattedTax = `₹${order.tax.toFixed(2)}`
    order.formattedDiscount = order.discount ? `₹${order.discount.toFixed(2)}` : "₹0.00"
    order.formattedCouponDiscount = order.couponDiscount ? `₹${order.couponDiscount.toFixed(2)}` : "₹0.00"

    order.items.forEach((item) => {
      item.formattedPrice = `₹${item.price.toFixed(2)}`
      item.formattedDiscountedPrice = item.discountedPrice ? `₹${item.discountedPrice.toFixed(2)}` : item.formattedPrice
      item.formattedOfferDiscount = item.offerDiscount ? `₹${item.offerDiscount.toFixed(2)}` : "₹0.00"
    })

    // Create PDF with proper margins
    const PDFDocument = require("pdfkit")
    const path = require("path")
    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
    })

    const filename = `invoice-${order.orderNumber}.pdf`

    // Set response headers
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    // Pipe PDF to response
    doc.pipe(res)

    // Calculate page dimensions with margins
    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const borderX = 50 // Starting x (margin)
    const borderY = 50 // Starting y (margin)
    const borderWidth = pageWidth - 100 // Width minus left and right margins
    const borderHeight = pageHeight - 100 // Height minus top and bottom margins

    // Draw invoice-box border
    doc.roundedRect(borderX, borderY, borderWidth, borderHeight, 10).lineWidth(1).strokeColor("#ddd").stroke()

    // Content padding inside the border
    const contentX = borderX + 30
    const contentY = borderY + 30
    const contentWidth = borderWidth - 60

    // Add logo
    const logoPath = path.join(__dirname, "../../public/assets/harryPotter.jpeg")
    doc.image(logoPath, contentX, contentY, { width: 55 })

    // Brand and slogan
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .fillColor("#212529")
      .text("Chapterless", contentX + 65, contentY)
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("#6c757d")
      .text("WHERE STORIES FIND LOST SOULS", contentX + 65, contentY + 30, { uppercase: true })

    // Invoice header (right-aligned)
    const headerX = contentX + contentWidth - 150
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333")
    doc.text(`Invoice #: ${order.orderNumber}`, headerX, contentY, { width: 150, align: "right" })
    doc.text(`Date: ${order.formattedDate}`, headerX, contentY + 15, { width: 150, align: "right" })

    // Billing details
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Billing To:", contentX, contentY + 80)
    doc.fontSize(12).font("Helvetica")

    // Calculate y position for billing info
    let billingY = contentY + 105

    doc.font("Helvetica-Bold").text(order.shippingAddress.fullName || "N/A", contentX, billingY)
    billingY += 15

    doc.font("Helvetica")
    doc.text(order.shippingAddress.street || "", contentX, billingY)
    billingY += 15

    if (order.shippingAddress.landmark) {
      doc.text(order.shippingAddress.landmark, contentX, billingY)
      billingY += 15
    }

    doc.text(
      `${order.shippingAddress.district || ""}, ${order.shippingAddress.state || ""} ${order.shippingAddress.pincode || ""}`,
      contentX,
      billingY,
    )
    billingY += 15

    doc.text("India", contentX, billingY)
    billingY += 15

    doc.text(user.email || "", contentX, billingY)
    billingY += 30 // Extra space before order details

    // Order items table
    doc.fontSize(14).font("Helvetica-Bold").text("Order Details:", contentX, billingY)
    billingY += 25

    // Table dimensions
    const tableTop = billingY

    // Column widths
    const colBook = contentX // Book column start
    const colBookWidth = contentWidth * 0.45 // 45% of content width

    const colPrice = colBook + colBookWidth // Price column start
    const colPriceWidth = contentWidth * 0.15 // 15% of content width

    const colQty = colPrice + colPriceWidth // Qty column start
    const colQtyWidth = contentWidth * 0.15 // 15% of content width

    const colSubtotal = colQty + colQtyWidth // Subtotal column start
    const colSubtotalWidth = contentWidth * 0.25 // 25% of content width

    const rowHeight = 30
    const headerHeight = 30

    // Table header background
    doc.rect(colBook, tableTop, contentWidth, headerHeight).fillColor("#f8f9fa").fill()

    // Table headers
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333")
    doc.text("Book", colBook + 5, tableTop + 10, { width: colBookWidth - 10 })
    doc.text("Price", colPrice + 5, tableTop + 10, { width: colPriceWidth - 10, align: "center" })
    doc.text("Qty", colQty + 5, tableTop + 10, { width: colQtyWidth - 10, align: "center" })
    doc.text("Subtotal", colSubtotal + 5, tableTop + 10, { width: colSubtotalWidth - 10, align: "right" })

    // Table rows
    doc.fontSize(12).font("Helvetica")
    let y = tableTop + headerHeight

    order.items.forEach((item, index) => {
      doc.fillColor("#333")

      // Book title with offer info if applicable
      let itemTitle = item.title || "Unknown Product";
      if (item.status === 'Cancelled') {
        itemTitle += ' (Cancelled)';
      } else if (item.status === 'Returned') {
        itemTitle += ' (Returned)';
      }
      
      if (item.offerTitle) {
        doc
          .font("Helvetica-Bold")
          .text(itemTitle, colBook + 5, y + 5, { width: colBookWidth - 10 })
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#d63031")
          .text(item.offerTitle, colBook + 5, y + 20, { width: colBookWidth - 10 })
        doc.fontSize(12).fillColor("#333")
      } else {
        doc.text(itemTitle, colBook + 5, y + 10, { width: colBookWidth - 10 })
      }

      // Price with original and discounted if applicable
      if (item.discountedPrice && item.discountedPrice < item.price) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#666")
          .text(item.formattedPrice, colPrice + 5, y + 5, { width: colPriceWidth - 10, align: "center", strike: true })
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#28a745")
          .text(item.formattedDiscountedPrice, colPrice + 5, y + 18, { width: colPriceWidth - 10, align: "center" })
      } else {
        doc.text(item.formattedPrice, colPrice + 5, y + 10, { width: colPriceWidth - 10, align: "center" })
      }

      // Quantity
      doc.fillColor("#333").font("Helvetica")
      doc.text(item.quantity.toString() || "1", colQty + 5, y + 10, { width: colQtyWidth - 10, align: "center" })

      // Subtotal - only count active items for total
      const itemTotal = item.status === 'Active' ? 
        (item.discountedPrice ? item.discountedPrice * item.quantity : item.price * item.quantity) : 0;
      doc.text(`₹${itemTotal.toFixed(2)}`, colSubtotal + 5, y + 10, {
        width: colSubtotalWidth - 10,
        align: "right",
      })

      y += rowHeight
    })

    // Summary rows
    const summaryStartY = y
    const summaryLabelX = colQty - 20
    const summaryValueX = colSubtotal

    // Subtotal row
    doc.text("Subtotal", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.formattedSubtotal, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: "right" })
    y += rowHeight

    // Offer Discount row (if applicable)
    if (order.discount && order.discount > 0) {
      doc.text("Offer Discount", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
      doc.fillColor("#28a745").text(`-${order.formattedDiscount}`, summaryValueX + 5, y + 10, {
        width: colSubtotalWidth - 10,
        align: "right",
      })
      doc.fillColor("#333")
      y += rowHeight
    }

    // Coupon Discount row (if applicable)
    if (order.couponDiscount && order.couponDiscount > 0) {
      doc.text("Coupon Discount", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
      doc.fillColor("#28a745").text(`-${order.formattedCouponDiscount}`, summaryValueX + 5, y + 10, {
        width: colSubtotalWidth - 10,
        align: "right",
      })
      if (order.couponCode) {
        doc
          .fillColor("#666")
          .fontSize(9)
          .text(`(Code: ${order.couponCode})`, summaryLabelX - 80, y + 10, { width: colQtyWidth + 20, align: "right" })
      }
      doc.fillColor("#333").fontSize(12)
      y += rowHeight
    }

    // Tax row
    doc.text("Tax", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.formattedTax, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: "right" })
    y += rowHeight

    // Total row (with larger font)
    doc.font("Helvetica-Bold").fontSize(16)
    doc.text("Total", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.formattedTotal, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: "right" })
    y += rowHeight

    // Payment method row
    doc.font("Helvetica").fontSize(12)
    doc.text("Payment Method", summaryLabelX, y + 10, { width: colQtyWidth + 20, align: "right" })
    doc.text(order.paymentMethod || "Cash on Delivery", summaryValueX + 5, y + 10, {
      width: colSubtotalWidth - 10,
      align: "right",
    })

    // Draw table borders
    const totalTableHeight = y + rowHeight - tableTop

    // Outer border for the entire table
    doc.rect(colBook, tableTop, contentWidth, totalTableHeight).lineWidth(1).strokeColor("#ddd").stroke()

    // Column dividers
    const colDividers = [colPrice, colQty, colSubtotal, colBook + contentWidth]
    colDividers.forEach((x) => {
      doc
        .moveTo(x, tableTop)
        .lineTo(x, tableTop + totalTableHeight)
        .stroke()
    })

    // Row dividers (header and items)
    let rowY = tableTop + headerHeight
    doc
      .moveTo(colBook, rowY)
      .lineTo(colBook + contentWidth, rowY)
      .stroke()

    order.items.forEach((_, i) => {
      rowY += rowHeight
      doc
        .moveTo(colBook, rowY)
        .lineTo(colBook + contentWidth, rowY)
        .stroke()
    })

    // Summary section divider
    doc
      .moveTo(colBook, summaryStartY)
      .lineTo(colBook + contentWidth, summaryStartY)
      .stroke()

    // Footer
    const footerY = y + rowHeight + 50
    doc
      .fontSize(12)
      .fillColor("#666")
      .text("This is a computer-generated invoice and does not require a signature.", contentX, footerY, {
        align: "center",
        width: contentWidth,
      })

    doc.text("Thank you for shopping at Chapterless", contentX, footerY + 20, { align: "center", width: contentWidth })

    // Finalize PDF
    doc.end()
  } catch (error) {
    console.error("Error generating invoice:", error)
    res.status(500).send("Internal server error")
  }
}

const approveReturnRequest = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { itemId, approved } = req.body;

    // Fetch the order
    const order = await Order.findById(orderId);
    if (!order || order.isDeleted) {
      return res.status(404).json({ message: "Order not found" });
    }

    // If itemId is provided, update just that item
    if (itemId) {
      const item = order.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found in order" });
      }

      if (item.status !== 'Return Requested') {
        return res.status(400).json({
          message: `Cannot process return for item with status ${item.status}`
        });
      }

      const now = new Date();
      
      if (approved) {
        // Approve the return
        item.status = 'Returned';
        item.returnedAt = now;
        
        // Restore product stock
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );

        // Process refund to wallet if payment was made
        if (order.paymentStatus === 'Paid') {
          const refundSuccess = await processReturnRefund(order.user, order, itemId);
          if (refundSuccess) {
            const allItemsRefunded = order.items.every(i => 
              i.status === 'Returned' || i.status === 'Cancelled'
            );
            order.paymentStatus = allItemsRefunded ? 'Refunded' : 'Partially Refunded';
          } else {
            order.paymentStatus = 'Refund Processing';
          }
        }
      } else {
        // Reject the return request
        item.status = 'Active';
        item.returnRequestedAt = null;
        item.returnReason = null;
      }

      // Update overall order status based on item statuses
      const hasActiveItems = order.items.some(i => i.status === 'Active');
      const hasReturnRequestedItems = order.items.some(i => i.status === 'Return Requested');
      const hasCancelledItems = order.items.some(i => i.status === 'Cancelled');
      const hasReturnedItems = order.items.some(i => i.status === 'Returned');

      if (!hasActiveItems && !hasReturnRequestedItems) {
        if (hasReturnedItems && !hasCancelledItems) {
          order.orderStatus = 'Returned';
        } else if (hasCancelledItems && !hasReturnedItems) {
          order.orderStatus = 'Cancelled';
        } else if (hasReturnedItems && hasCancelledItems) {
          order.orderStatus = 'Partially Returned';
        }
      } else {
        if (hasReturnRequestedItems) {
          order.orderStatus = 'Partially Return Requested';
        } else if (hasReturnedItems || hasCancelledItems) {
          if (hasReturnedItems && hasCancelledItems) {
            order.orderStatus = 'Partially Returned';
          } else if (hasReturnedItems) {
            order.orderStatus = 'Partially Returned';
          } else {
            order.orderStatus = 'Partially Cancelled';
          }
        } else {
          order.orderStatus = 'Delivered';
        }
      }

      await order.save();
      return res.status(200).json({ 
        message: approved ? "Return request approved" : "Return request rejected",
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus
      });
    }

    // Handle entire order return request
    if (order.orderStatus !== 'Return Requested' && order.orderStatus !== 'Partially Return Requested') {
      return res.status(400).json({
        message: `Cannot process return for order with status ${order.orderStatus}`
      });
    }

    const now = new Date();
    
    if (approved) {
      // Process all return requested items
      let allItemsProcessed = true;
      for (const item of order.items) {
        if (item.status === 'Return Requested') {
          item.status = 'Returned';
          item.returnedAt = now;
          
          try {
            // Restore product stock
            await Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: item.quantity } }
            );
          } catch (error) {
            console.error('Error restoring stock:', error);
            allItemsProcessed = false;
          }
        }
      }
      
      // Update order status
      const hasActiveItems = order.items.some(i => i.status === 'Active');
      const hasCancelledItems = order.items.some(i => i.status === 'Cancelled');
      const hasReturnedItems = order.items.some(i => i.status === 'Returned');
      
      if (!hasActiveItems) {
        if (hasCancelledItems) {
          order.orderStatus = 'Partially Returned';
        } else {
          order.orderStatus = 'Returned';
        }
      } else {
        order.orderStatus = 'Partially Returned';
      }
      
      // Process refund to wallet if payment was made
      if (order.paymentStatus === 'Paid') {
        const refundSuccess = await processReturnRefund(order.user, order);
        if (refundSuccess) {
          order.paymentStatus = hasActiveItems ? 'Partially Refunded' : 'Refunded';
        } else {
          order.paymentStatus = 'Refund Processing';
        }
      }
      
      order.returnedAt = now;
    } else {
      // Reject all return requests
      order.items.forEach(item => {
        if (item.status === 'Return Requested') {
          item.status = 'Active';
          item.returnRequestedAt = null;
          item.returnReason = null;
        }
      });
      
      // Update order status
      const hasCancelledItems = order.items.some(i => i.status === 'Cancelled');
      const hasReturnedItems = order.items.some(i => i.status === 'Returned');
      
      if (hasCancelledItems && hasReturnedItems) {
        order.orderStatus = 'Partially Returned';
      } else if (hasCancelledItems) {
        order.orderStatus = 'Partially Cancelled';
      } else if (hasReturnedItems) {
        order.orderStatus = 'Partially Returned';
      } else {
        order.orderStatus = 'Delivered';
      }
    }
    
    await order.save();
    
    return res.status(200).json({
      message: approved ? "All return requests approved" : "All return requests rejected",
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus
    });
  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { 
  getManageOrders, 
  getOrderDetails, 
  updateOrderStatus, 
  updateItemStatus, 
  downloadInvoice,
  approveReturnRequest
};