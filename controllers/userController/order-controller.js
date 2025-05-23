const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema"); // Added Cart import
const PDFDocument = require('pdfkit');
const path = require('path');

/**
 * Get all orders for the current user with pagination, filtering, and sorting
 */
const getOrders = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;

    // Fetch user data
    const user = await User.findById(userId, 'fullName email profileImage').lean();
    if (!user) {
      return res.redirect('/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Handle filter
    const validFilters = ['All', 'Delivered', 'Processing', 'Shipped', 'Placed', 'Cancelled', 'Returned', 'Partially Cancelled', 'Partially Returned'];
    let filter = req.query.filter || 'All';
    if (!validFilters.includes(filter)) {
      filter = 'All';
    }
    const query = { user: userId, isDeleted: false };
    if (filter !== 'All') {
      query.orderStatus = filter;
    }

    // Handle sort
    const validSorts = {
      'createdAt-desc': { createdAt: -1 },
      'createdAt-asc': { createdAt: 1 },
      'total-desc': { total: -1 },
      'total-asc': { total: 1 }
    };
    let sort = req.query.sort || 'createdAt-desc';
    if (!validSorts[sort]) {
      sort = 'createdAt-desc';
    }
    const sortCriteria = validSorts[sort];

    // Fetch orders with filter and sort
    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalOrders / limit);
    const pagination = {
      currentPage: page,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      pages: Array.from({ length: totalPages }, (_, i) => i + 1),
    };

    // Format order data
    orders.forEach(order => {
      order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      order.formattedTotal = `₹${order.total.toFixed(2)}`;
      order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`;
      order.formattedTax = `₹${order.tax.toFixed(2)}`;
      order.formattedDiscount = `₹${order.discount ? order.discount.toFixed(2) : '0.00'}`;
      order.formattedCouponDiscount = `₹${order.couponDiscount ? order.couponDiscount.toFixed(2) : '0.00'}`;
      
      order.items.forEach(item => {
        item.formattedPrice = `₹${item.price.toFixed(2)}`;
        item.formattedTotal = `₹${(item.price * item.quantity).toFixed(2)}`;
        if (item.discountedPrice) {
          item.formattedDiscountedPrice = `₹${item.discountedPrice.toFixed(2)}`;
        }
      });
    });

    // Map sort values to display text
    const sortDisplay = {
      'createdAt-desc': 'Newest First',
      'createdAt-asc': 'Oldest First',
      'total-desc': 'Price: High to Low',
      'total-asc': 'Price: Low to High'
    };

    res.render('order', {
      orders,
      pagination,
      user: {
        id: userId,
        fullName: user.fullName || 'User',
        email: user.email || '',
        profileImage: user.profileImage || '/api/placeholder/120/120'
      },
      isAuthenticated: true,
      currentFilter: filter,
      currentSort: sort,
      sortDisplay: sortDisplay[sort]
    });
  } catch (error) {
    console.error('Error in rendering orders:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

/**
 * Get details of a specific order
 */
const getOrderDetails = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;

    // Fetch the order and populate shipping address
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    }).lean();

    if (!order) {
      return res.status(404).render('error', {
        message: 'Order not found or you do not have access to this order',
        isAuthenticated: true
      });
    }

    // Fetch user data for sidebar
    const user = await User.findById(userId, 'fullName email profileImage').lean();
    if (!user) {
      return res.redirect('/login');
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    order.formattedTotal = `₹${order.total.toFixed(2)}`;
    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`;
    order.formattedTax = `₹${order.tax.toFixed(2)}`;
    order.formattedDiscount = order.discount ? `₹${order.discount.toFixed(2)}` : "₹0.00";
    order.formattedCouponDiscount = order.couponDiscount ? `₹${order.couponDiscount.toFixed(2)}` : "₹0.00";
    
    order.items.forEach(item => {
      item.formattedPrice = `₹${item.price.toFixed(2)}`;
      item.formattedTotal = `₹${(item.price * item.quantity).toFixed(2)}`;
      if (item.discountedPrice) {
        item.formattedDiscountedPrice = `₹${item.discountedPrice.toFixed(2)}`;
      }
    });

    // Check if the order can be cancelled or returned
    const canBeCancelled = ['Placed', 'Processing'].includes(order.orderStatus);
    const canBeReturned = order.orderStatus === 'Delivered';
    
    // Check if individual items can be cancelled or returned
    order.items.forEach(item => {
      item.canBeCancelled = canBeCancelled && item.status === 'Active';
      item.canBeReturned = canBeReturned && item.status === 'Active';
    });

    // Create timeline based on order status using actual timestamps
    const timeline = [
      {
        status: 'Order Placed',
        timestamp: new Date(order.createdAt).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        completed: true
      },
      {
        status: 'Payment Confirmed',
        timestamp: new Date(order.createdAt).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        completed: ['Placed', 'Processing', 'Shipped', 'Delivered', 'Returned', 'Partially Cancelled', 'Partially Returned'].includes(order.orderStatus)
      },
      {
        status: 'Processing',
        timestamp: order.processedAt
          ? new Date(order.processedAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : ['Shipped', 'Delivered', 'Returned', 'Partially Returned'].includes(order.orderStatus)
          ? new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Estimated: ' + new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
        completed: ['Processing', 'Shipped', 'Delivered', 'Returned', 'Partially Returned'].includes(order.orderStatus),
        active: order.orderStatus === 'Processing'
      },
      {
        status: 'Shipped',
        timestamp: order.shippedAt
          ? new Date(order.shippedAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : ['Delivered', 'Returned', 'Partially Returned'].includes(order.orderStatus)
          ? new Date(order.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Estimated: ' + new Date(order.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
        completed: ['Shipped', 'Delivered', 'Returned', 'Partially Returned'].includes(order.orderStatus),
        active: order.orderStatus === 'Shipped'
      },
      {
        status: 'Out for Delivery',
        timestamp: order.deliveredAt
          ? new Date(order.deliveredAt.getTime() - 24 * 60 * 60 * 1000).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Estimated: ' + new Date(order.createdAt.getTime() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
        completed: ['Delivered', 'Returned', 'Partially Returned'].includes(order.orderStatus),
        active: false
      },
      {
        status: 'Delivered',
        timestamp: order.deliveredAt
          ? new Date(order.deliveredAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : 'Estimated: ' + new Date(order.createdAt.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
        completed: ['Delivered', 'Returned', 'Partially Returned'].includes(order.orderStatus),
        active: ['Delivered', 'Partially Returned'].includes(order.orderStatus)
      }
    ];

    if (order.orderStatus === 'Returned' || order.orderStatus === 'Partially Returned') {
      timeline.push({
        status: order.orderStatus,
        timestamp: order.returnedAt 
          ? new Date(order.returnedAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
        completed: true,
        returned: true
      });
    }

    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Partially Cancelled') {
      timeline.push({
        status: order.orderStatus,
        timestamp: order.cancelledAt 
          ? new Date(order.cancelledAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
        completed: true,
        cancelled: true
      });
    }

    res.render('order-details', {
      order,
      timeline,
      canBeCancelled,
      canBeReturned,
      user: {
        id: userId,
        fullName: user.fullName || 'User',
        email: user.email || '',
        profileImage: user.profileImage || '/api/placeholder/120/120'
      },
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error in rendering order details:', error);
    res.status(500).render('error', { message: 'Internal server error', isAuthenticated: true });
  }
};

/**
 * Get order success page
 */
const getOrderSuccess = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;

    // Fetch the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    }).lean();

    if (!order) {
      return res.status(404).render('error', {
        message: 'Order not found or you do not have access to this order',
        isAuthenticated: true
      });
    }

    // Fetch user data
    const user = await User.findById(userId, 'fullName email profileImage').lean();
    if (!user) {
      return res.redirect('/login');
    }

    res.render('order-success', {
      orderNumber: order.orderNumber,
      orderId: order._id,
      paymentMethod: order.paymentMethod,
      total: order.total,
      user: {
        id: userId,
        fullName: user.fullName || 'User',
        email: user.email || '',
        profileImage: user.profileImage || '/api/placeholder/120/120'
      },
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error rendering order success page:', error);
    res.status(500).render('error', { 
      message: 'Internal server error', 
      isAuthenticated: req.session.user_id ? true : false 
    });
  }
};

/**
 * Get payment failure page
 */
const getPaymentFailure = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;
    const errorMessage = req.query.error || 'Payment could not be processed';
    const orderId = req.query.orderId || null;

    // Fetch user data
    const user = await User.findById(userId, 'fullName email profileImage').lean();
    if (!user) {
      return res.redirect('/login');
    }

    // If orderId is provided, verify it belongs to the user
    let order = null;
    if (orderId) {
      order = await Order.findOne({
        _id: orderId,
        user: userId,
        isDeleted: false
      }).lean();
    }

    res.render('payment-failure', {
      errorMessage,
      orderId: order ? order._id : null,
      user: {
        id: userId,
        fullName: user.fullName || 'User',
        email: user.email || '',
        profileImage: user.profileImage || '/api/placeholder/120/120'
      },
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error rendering payment failure page:', error);
    res.status(500).render('error', { 
      message: 'Internal server error', 
      isAuthenticated: req.session.user_id ? true : false 
    });
  }
};

/**
 * Generate and download invoice for an order
 */
const downloadInvoice = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).send('Unauthorized');
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;

    // Fetch the order with all necessary details
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    }).lean();

    if (!order) {
      return res.status(404).send('Order not found or you do not have access to this order');
    }

    // Fetch user data
    const user = await User.findById(userId, 'fullName email').lean();
    if (!user) {
      return res.status(401).send('User not found');
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Create PDF document
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4'
    });
    
    const filename = `invoice-${order.orderNumber}.pdf`;

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Define colors and styles
    const colors = {
      primary: '#4F46E5',      // Indigo
      secondary: '#6B7280',    // Gray
      dark: '#111827',         // Dark gray
      light: '#F9FAFB',        // Light gray
      success: '#10B981',      // Green
      border: '#E5E7EB'        // Border gray
    };

    // Document dimensions
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100;
    const leftMargin = 50;
    const rightMargin = pageWidth - 50;

    // Add logo and company info
    doc.image(path.join(__dirname, '../../public/assets/harryPotter.jpeg'), leftMargin, 50, { width: 60 })
       .font('Helvetica-Bold')
       .fontSize(22)
       .fillColor(colors.primary)
       .text('Chapterless', leftMargin + 70, 60)
       .font('Helvetica')
       .fontSize(10)
       .fillColor(colors.secondary)
       .text('WHERE STORIES FIND LOST SOULS', leftMargin + 70, 85);

    // Add invoice title and details
    doc.font('Helvetica-Bold')
       .fontSize(28)
       .fillColor(colors.dark)
       .text('INVOICE', rightMargin - 150, 50, { align: 'right', width: 150 })
       .fontSize(10)
       .fillColor(colors.secondary)
       .text(`Invoice Number: #${order.orderNumber}`, rightMargin - 150, 85, { align: 'right', width: 150 })
       .text(`Date: ${order.formattedDate}`, rightMargin - 150, 100, { align: 'right', width: 150 });

    // Add separator line
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(leftMargin, 120)
       .lineTo(rightMargin, 120)
       .stroke();

    // Add billing and shipping info
    const billingStartY = 140;
    
    // Billing info
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(colors.dark)
       .text('Bill To:', leftMargin, billingStartY)
       .font('Helvetica')
       .fontSize(10)
       .fillColor(colors.secondary)
       .text(order.shippingAddress.fullName || user.fullName || 'N/A', leftMargin, billingStartY + 20)
       .text(order.shippingAddress.street || '', leftMargin, billingStartY + 35)
       .text(`${order.shippingAddress.district || ''}, ${order.shippingAddress.state || ''} - ${order.shippingAddress.pincode || ''}`, leftMargin, billingStartY + 50)
       .text(`Phone: ${order.shippingAddress.phone || 'N/A'}`, leftMargin, billingStartY + 65)
       .text(`Email: ${user.email || 'N/A'}`, leftMargin, billingStartY + 80);

    // Payment info
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(colors.dark)
       .text('Payment Details:', rightMargin - 200, billingStartY, { width: 200, align: 'left' })
       .font('Helvetica')
       .fontSize(10)
       .fillColor(colors.secondary)
       .text(`Method: ${order.paymentMethod || 'Cash on Delivery'}`, rightMargin - 200, billingStartY + 20, { width: 200, align: 'left' })
       .text(`Status: ${order.paymentStatus || 'Pending'}`, rightMargin - 200, billingStartY + 35, { width: 200, align: 'left' });

    // Add separator line
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(leftMargin, billingStartY + 110)
       .lineTo(rightMargin, billingStartY + 110)
       .stroke();

    // Order items table
    const tableTop = billingStartY + 130;
    const tableHeaders = ['Item', 'Price', 'Quantity', 'Discount', 'Total'];
    const colWidths = [0.40, 0.15, 0.15, 0.15, 0.15]; // Proportions of contentWidth
    
    // Calculate column positions
    const colPositions = [];
    let currentPosition = leftMargin;
    
    colWidths.forEach(width => {
      colPositions.push(currentPosition);
      currentPosition += width * contentWidth;
    });
    
    // Add table header
    doc.fillColor(colors.light)
       .rect(leftMargin, tableTop, contentWidth, 30)
       .fill();
    
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.dark);
    
    tableHeaders.forEach((header, i) => {
      const align = i === 0 ? 'left' : 'right';
      const x = colPositions[i];
      const width = colWidths[i] * contentWidth;
      
      doc.text(header, x + 5, tableTop + 10, { width: width - 10, align });
    });
    
    // Add table rows
    let y = tableTop + 30;
    
    // Only include active items or show status for cancelled/returned items
    order.items.forEach((item, index) => {
      // Alternate row background for better readability
      if (index % 2 === 1) {
        doc.fillColor('#F9FAFB')
           .rect(leftMargin, y, contentWidth, 30)
           .fill();
      }
      
      doc.fillColor(colors.dark)
         .font('Helvetica')
         .fontSize(9);
      
      // Item name with status if cancelled or returned
      let itemTitle = item.title || 'Unknown Product';
      if (item.status === 'Cancelled') {
        itemTitle += ' (Cancelled)';
      } else if (item.status === 'Returned') {
        itemTitle += ' (Returned)';
      }
      
      doc.text(itemTitle, colPositions[0] + 5, y + 10, { 
        width: colWidths[0] * contentWidth - 10, 
        align: 'left' 
      });
      
      // Price
      doc.text(`₹${item.price.toFixed(2)}`, colPositions[1] + 5, y + 10, { 
        width: colWidths[1] * contentWidth - 10, 
        align: 'right' 
      });
      
      // Quantity
      doc.text(item.quantity.toString(), colPositions[2] + 5, y + 10, { 
        width: colWidths[2] * contentWidth - 10, 
        align: 'right' 
      });
      
      // Discount
      const itemDiscount = item.offerDiscount || 0;
      doc.text(`₹${itemDiscount.toFixed(2)}`, colPositions[3] + 5, y + 10, { 
        width: colWidths[3] * contentWidth - 10, 
        align: 'right' 
      });
      
      // Total - only count active items for total
      const itemTotal = item.status === 'Active' ? (item.price * item.quantity) - itemDiscount : 0;
      doc.text(`₹${itemTotal.toFixed(2)}`, colPositions[4] + 5, y + 10, { 
        width: colWidths[4] * contentWidth - 10, 
        align: 'right' 
      });
      
      y += 30;
    });
    
    // Add table border
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .rect(leftMargin, tableTop, contentWidth, y - tableTop)
       .stroke();
    
    // Add horizontal lines for each row
    let lineY = tableTop + 30;
    for (let i = 0; i < order.items.length; i++) {
      doc.moveTo(leftMargin, lineY)
         .lineTo(rightMargin - 50, lineY)
         .stroke();
      lineY += 30;
    }
    
    // Add vertical lines for columns
    colPositions.forEach((x, i) => {
      if (i === 0) return; // Skip first column
      doc.moveTo(x, tableTop)
         .lineTo(x, y)
         .stroke();
    });
    
    // Add order summary
    const summaryStartY = y + 20;
    const summaryWidth = 200;
    const summaryX = rightMargin - summaryWidth;
    
    // Subtotal
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.secondary)
       .text('Subtotal:', summaryX, summaryStartY, { width: 100, align: 'left' })
       .fillColor(colors.dark)
       .text(`₹${order.subtotal.toFixed(2)}`, summaryX + 100, summaryStartY, { width: 100, align: 'right' });
    
    // Tax
    doc.fillColor(colors.secondary)
       .text('Tax (8%):', summaryX, summaryStartY + 20, { width: 100, align: 'left' })
       .fillColor(colors.dark)
       .text(`₹${order.tax.toFixed(2)}`, summaryX + 100, summaryStartY + 20, { width: 100, align: 'right' });
    
    // Offer discount
    if (order.discount && order.discount > 0) {
      doc.fillColor(colors.secondary)
         .text('Offer Discount:', summaryX, summaryStartY + 40, { width: 100, align: 'left' })
         .fillColor(colors.success)
         .text(`-₹${order.discount.toFixed(2)}`, summaryX + 100, summaryStartY + 40, { width: 100, align: 'right' });
    }
    
    // Coupon discount
    if (order.couponDiscount && order.couponDiscount > 0) {
      const yPos = order.discount && order.discount > 0 ? summaryStartY + 60 : summaryStartY + 40;
      doc.fillColor(colors.secondary)
         .text(`Coupon Discount${order.couponCode ? ` (${order.couponCode})` : ''}:`, summaryX, yPos, { width: 100, align: 'left' })
         .fillColor(colors.success)
         .text(`-₹${order.couponDiscount.toFixed(2)}`, summaryX + 100, yPos, { width: 100, align: 'right' });
    }
    
    // Total
    const totalY = order.couponDiscount && order.couponDiscount > 0 ? 
                  (order.discount && order.discount > 0 ? summaryStartY + 90 : summaryStartY + 70) : 
                  (order.discount && order.discount > 0 ? summaryStartY + 70 : summaryStartY + 50);
    
    // Add separator line before total
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(summaryX, totalY - 10)
       .lineTo(rightMargin, totalY - 10)
       .stroke();
    
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(colors.primary)
       .text('Total:', summaryX, totalY, { width: 100, align: 'left' })
       .text(`₹${order.total.toFixed(2)}`, summaryX + 100, totalY, { width: 100, align: 'right' });
    
    // Add footer
    const footerY = Math.max(y + 200, totalY + 100);
    
    // Add separator line
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(leftMargin, footerY - 30)
       .lineTo(rightMargin, footerY - 30)
       .stroke();
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.secondary)
       .text('Thank you for shopping with Chapterless!', leftMargin, footerY, { align: 'center', width: contentWidth })
       .text('This is a computer-generated invoice and does not require a signature.', leftMargin, footerY + 15, { align: 'center', width: contentWidth });
    
    // Add page numbers
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor(colors.secondary)
         .text(`Page ${i + 1} of ${pageCount}`, leftMargin, doc.page.height - 50, { align: 'center', width: contentWidth });
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Internal server error');
  }
};

/**
 * Cancel an entire order
 */
const cancelOrder = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;
    const { reason } = req.body;

    // Validate cancellation reason
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be cancelled
    const allowedStatuses = ['Placed', 'Processing'];
    if (!allowedStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.orderStatus} status`
      });
    }

    // Update order status
    order.orderStatus = 'Cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    
    // Update all items to Cancelled status
    order.items.forEach(item => {
      if (item.status === 'Active') {
        item.status = 'Cancelled';
        item.cancelledAt = new Date();
        item.cancellationReason = reason;
      }
    });
    
    await order.save();

    // Restore product stock for each item
    for (const item of order.items) {
      if (item.status === 'Cancelled') {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }
    }

    // If payment was made, initiate refund process
    if (order.paymentStatus === 'Paid') {
      order.paymentStatus = 'Refund Initiated';
      await order.save();
      
      // Here you would integrate with your payment gateway to process the refund
      // This is a placeholder for the actual refund logic
      console.log(`Refund initiated for order ${order.orderNumber}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Cancel a specific product from an order
 */
const cancelOrderItem = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;
    const productId = req.params.productId;
    const { reason } = req.body;

    // Validate cancellation reason
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be cancelled
    const allowedStatuses = ['Placed', 'Processing'];
    if (!allowedStatuses.includes(order.orderStatus) && 
        !order.orderStatus.includes('Partially')) {
      return res.status(400).json({
        success: false,
        message: `Items in this order cannot be cancelled in ${order.orderStatus} status`
      });
    }

    // Find the specific product in the order
    const orderItem = order.items.find(item => item.product.toString() === productId);
    
    if (!orderItem) {
      return res.status(404).json({ success: false, message: 'Product not found in this order' });
    }
    
    if (orderItem.status !== 'Active') {
      return res.status(400).json({ 
        success: false, 
        message: `This item is already ${orderItem.status.toLowerCase()}` 
      });
    }

    // Calculate refund amount for this item
    const itemTotal = orderItem.price * orderItem.quantity;
    
    // Update the item status
    orderItem.status = 'Cancelled';
    orderItem.cancelledAt = new Date();
    orderItem.cancellationReason = reason;
    
    // Check if there are any active items left
    const hasActiveItems = order.items.some(item => item.status === 'Active');
    
    // Check if there are any returned items
    const hasReturnedItems = order.items.some(item => item.status === 'Returned');
    
    // Update order status based on item statuses
    if (!hasActiveItems) {
      // If all items are cancelled/returned, mark the whole order as cancelled or returned
      if (hasReturnedItems) {
        order.orderStatus = 'Returned';
      } else {
        order.orderStatus = 'Cancelled';
      }
    } else if (hasReturnedItems) {
      // If some items are active and some are returned (and now some are cancelled)
      order.orderStatus = 'Partially Returned';
    } else {
      // If some items are active and some are cancelled
      order.orderStatus = 'Partially Cancelled';
    }
    
    order.cancelledAt = new Date();
    await order.save();

    // Restore product stock
    await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: orderItem.quantity } }
    );

    // Handle refund if payment was made
    if (order.paymentStatus === 'Paid') {
      if (!hasActiveItems) {
        order.paymentStatus = 'Refund Initiated';
      } else {
        order.paymentStatus = 'Partially Refunded';
      }
      await order.save();
      
      // Placeholder for actual refund logic
      console.log(`Partial refund of ₹${itemTotal} initiated for item in order ${order.orderNumber}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Item cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order item:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Initiate return for an entire order
 */
const returnOrder = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;
    const { reason } = req.body;

    // Validate return reason
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Return reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be returned
    if (order.orderStatus !== 'Delivered' && 
        !order.orderStatus.includes('Partially')) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be returned in ${order.orderStatus} status`
      });
    }

    // Check if return is within allowed time period (e.g., 7 days)
    const deliveredDate = order.deliveredAt || order.updatedAt;
    const returnPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    if (Date.now() - deliveredDate > returnPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Return period has expired'
      });
    }

    // CHANGE: Update order status to Return Requested instead of Returned
    order.orderStatus = 'Return Requested';
    order.returnReason = reason;
    order.returnRequestedAt = new Date(); // Add a new field to track when return was requested
    
    // Update all active items to Return Requested status
    order.items.forEach(item => {
      if (item.status === 'Active') {
        item.status = 'Return Requested';
        item.returnReason = reason;
        item.returnRequestedAt = new Date();
      }
    });
    
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return request submitted successfully. Our team will review your request.'
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Return a specific item from an order
 */
const returnOrderItem = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;
    const productId = req.params.productId;
    const { reason } = req.body;

    // Validate return reason
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Return reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be returned
    if (order.orderStatus !== 'Delivered' && 
        !order.orderStatus.includes('Partially')) {
      return res.status(400).json({
        success: false,
        message: `Items in this order cannot be returned in ${order.orderStatus} status`
      });
    }

    // Check if return is within allowed time period (e.g., 7 days)
    const deliveredDate = order.deliveredAt || order.updatedAt;
    const returnPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    if (Date.now() - deliveredDate > returnPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Return period has expired'
      });
    }

    // Find the specific product in the order
    const orderItem = order.items.find(item => item.product.toString() === productId);
    
    if (!orderItem) {
      return res.status(404).json({ success: false, message: 'Product not found in this order' });
    }
    
    if (orderItem.status !== 'Active') {
      return res.status(400).json({ 
        success: false, 
        message: `This item is already ${orderItem.status.toLowerCase()}` 
      });
    }

    // CHANGE: Instead of marking as Returned, mark as "Return Requested"
    // We'll add a new status to track return requests
    orderItem.status = 'Return Requested';
    orderItem.returnReason = reason;
    orderItem.returnRequestedAt = new Date();
    
    // Check if there are any active items left
    const hasActiveItems = order.items.some(item => item.status === 'Active');
    const hasReturnRequestedItems = order.items.some(item => item.status === 'Return Requested');
    const hasCancelledItems = order.items.some(item => item.status === 'Cancelled');
    const hasReturnedItems = order.items.some(item => item.status === 'Returned');
    
    // Update order status based on item statuses
    if (!hasActiveItems && hasReturnRequestedItems) {
      // If all items are in return requested state
      order.orderStatus = 'Return Requested';
    } else if (hasReturnRequestedItems) {
      // If some items are active and some are return requested
      order.orderStatus = 'Partially Return Requested';
    }
    
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return request submitted successfully. Our team will review your request.'
    });
  } catch (error) {
    console.error('Error processing item return request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Track order status
 */
const trackOrder = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    }).lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Create tracking information
    const trackingInfo = {
      orderNumber: order.orderNumber,
      currentStatus: order.orderStatus,
      estimatedDelivery: null,
      timeline: []
    };

    // Add timeline events
    if (order.createdAt) {
      trackingInfo.timeline.push({
        status: 'Order Placed',
        date: order.createdAt,
        description: 'Your order has been received'
      });
    }

    if (['Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Partially Cancelled', 'Partially Returned'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Processing',
        date: order.processingAt || new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000),
        description: 'Your order is being processed'
      });
    }

    if (['Shipped', 'Out for Delivery', 'Delivered', 'Partially Returned'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Shipped',
        date: order.shippedAt || new Date(order.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        description: 'Your order has been shipped'
      });
    }

    if (['Out for Delivery', 'Delivered', 'Partially Returned'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Out for Delivery',
        date: order.outForDeliveryAt || new Date(order.createdAt.getTime() + 4 * 24 * 60 * 60 * 1000),
        description: 'Your order is out for delivery'
      });
    }

    if (['Delivered', 'Partially Returned'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Delivered',
        date: order.deliveredAt || new Date(order.createdAt.getTime() + 5 * 24 * 60 * 60 * 1000),
        description: 'Your order has been delivered'
      });
    }

    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Partially Cancelled') {
      trackingInfo.timeline.push({
        status: order.orderStatus,
        date: order.cancelledAt || order.updatedAt,
        description: `Order ${order.orderStatus.toLowerCase()}: ${order.cancellationReason || 'Customer request'}`
      });
    }

    if (order.orderStatus === 'Returned' || order.orderStatus === 'Partially Returned') {
      trackingInfo.timeline.push({
        status: order.orderStatus,
        date: order.returnedAt || order.updatedAt,
        description: `Return ${order.orderStatus === 'Returned' ? 'processed' : 'requested'}: ${order.returnReason || 'Customer request'}`
      });
    }

    // Calculate estimated delivery date if not delivered yet
    if (!['Delivered', 'Cancelled', 'Returned', 'Partially Returned'].includes(order.orderStatus)) {
      trackingInfo.estimatedDelivery = new Date(order.createdAt.getTime() + 5 * 24 * 60 * 60 * 1000);
    }

    // Format dates for display
    trackingInfo.timeline.forEach(event => {
      event.formattedDate = new Date(event.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      event.formattedTime = new Date(event.date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    if (trackingInfo.estimatedDelivery) {
      trackingInfo.formattedEstimatedDelivery = new Date(trackingInfo.estimatedDelivery).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    return res.status(200).json({
      success: true,
      tracking: trackingInfo
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reorder (create a new order with the same items)
 */
const reorder = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;

    // Find the original order
    const originalOrder = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    }).lean();

    if (!originalOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if cart exists, create if not
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
      await cart.save();
    } else {
      // Clear existing cart items
      cart.items = [];
      await cart.save();
    }

    // Add items from the original order to cart
    for (const item of originalOrder.items) {
      // Only add active items or items from fully cancelled/returned orders
      const shouldAddItem = item.status === 'Active' || !originalOrder.items.some(i => i.status === 'Active');
      
      if (shouldAddItem) {
        const product = await Product.findById(item.product).lean();
        
        if (!product || !product.isListed || product.isDeleted) {
          continue; // Skip unavailable products
        }

        // Check stock availability
        const quantityToAdd = Math.min(item.quantity, product.stock);
        
        if (quantityToAdd > 0) {
          // Add item to cart
          cart.items.push({
            product: product._id,
            quantity: quantityToAdd,
            priceAtAddition: product.price
          });
        }
      }
    }
    
    // Save the updated cart
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Items added to cart successfully',
      redirectUrl: '/cart'
    });
  } catch (error) {
    console.error('Error reordering:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getOrders,
  getOrderDetails,
  getOrderSuccess,
  getPaymentFailure,
  downloadInvoice,
  cancelOrder,
  cancelOrderItem,
  returnOrder,
  returnOrderItem,
  trackOrder,
  reorder
};