const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const PDFDocument = require('pdfkit');
const path = require('path');

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
    const validFilters = ['All', 'Delivered', 'Processing', 'Cancelled'];
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
      order.items.forEach(item => {
        item.formattedPrice = `₹${item.price.toFixed(2)}`;
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
    order.items.forEach(item => {
      item.formattedPrice = `₹${item.price.toFixed(2)}`;
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
        completed: ['Placed', 'Processing', 'Shipped', 'Delivered', 'Returned'].includes(order.orderStatus)
      },
      {
        status: 'Processing',
        timestamp: order.orderStatus === 'Processing' && order.updatedAt
          ? new Date(order.updatedAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : ['Shipped', 'Delivered', 'Returned'].includes(order.orderStatus)
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
        completed: ['Processing', 'Shipped', 'Delivered', 'Returned'].includes(order.orderStatus),
        active: order.orderStatus === 'Processing'
      },
      {
        status: 'Shipped',
        timestamp: order.orderStatus === 'Shipped' && order.updatedAt
          ? new Date(order.updatedAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : ['Delivered', 'Returned'].includes(order.orderStatus)
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
        completed: ['Shipped', 'Delivered', 'Returned'].includes(order.orderStatus),
        active: order.orderStatus === 'Shipped'
      },
      {
        status: 'Out for Delivery',
        timestamp: order.orderStatus === 'Delivered' && order.deliveredAt
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
        completed: order.orderStatus === 'Delivered' || order.orderStatus === 'Returned',
        active: false
      },
      {
        status: 'Delivered',
        timestamp: order.orderStatus === 'Delivered' && order.deliveredAt
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
        completed: order.orderStatus === 'Delivered' || order.orderStatus === 'Returned',
        active: order.orderStatus === 'Delivered'
      }
    ];

    if (order.orderStatus === 'Returned' && order.returnedAt) {
      timeline.push({
        status: 'Returned',
        timestamp: new Date(order.returnedAt).toLocaleString('en-US', {
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

    if (order.orderStatus === 'Cancelled' && order.cancelledAt) {
      timeline.push({
        status: 'Cancelled',
        timestamp: new Date(order.cancelledAt).toLocaleString('en-US', {
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

const downloadInvoice = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).send('Unauthorized');
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
    order.formattedTotal = `₹${order.total.toFixed(2)}`;
    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`;
    order.formattedTax = `₹${order.tax.toFixed(2)}`;
    order.items.forEach(item => {
      item.formattedPrice = `₹${item.price.toFixed(2)}`;
    });

    // Create PDF with proper margins
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

    // Calculate page dimensions with margins
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const borderX = 50; // Starting x (margin)
    const borderY = 50; // Starting y (margin)
    const borderWidth = pageWidth - 100; // Width minus left and right margins
    const borderHeight = pageHeight - 100; // Height minus top and bottom margins
    
    // Draw invoice-box border
    doc
      .roundedRect(borderX, borderY, borderWidth, borderHeight, 10)
      .lineWidth(1)
      .strokeColor('#ddd')
      .stroke();

    // Content padding inside the border
    const contentX = borderX + 30;
    const contentY = borderY + 30;
    const contentWidth = borderWidth - 60;

    // Add logo
    const logoPath = path.join(__dirname, '../../public/assets/harryPotter.jpeg');
    doc.image(logoPath, contentX, contentY, { width: 55 });

    // Brand and slogan
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#212529').text('Chapterless', contentX + 65, contentY);
    doc.fontSize(12).font('Helvetica').fillColor('#6c757d')
      .text('WHERE STORIES FIND LOST SOULS', contentX + 65, contentY + 30, { uppercase: true });

    // Invoice header (right-aligned)
    const headerX = contentX + contentWidth - 150;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333');
    doc.text(`Invoice #: ${order.orderNumber}`, headerX, contentY, { width: 150, align: 'right' });
    doc.text(`Date: ${order.formattedDate}`, headerX, contentY + 15, { width: 150, align: 'right' });

    // Billing details
    doc.fontSize(14).font('Helvetica-Bold').text('Billing To:', contentX, contentY + 80);
    doc.fontSize(12).font('Helvetica');
    
    // Calculate y position for billing info
    let billingY = contentY + 105;
    
    doc.font('Helvetica-Bold').text(order.shippingAddress.fullName || 'N/A', contentX, billingY);
    billingY += 15;
    
    doc.font('Helvetica');
    doc.text(order.shippingAddress.street || '', contentX, billingY);
    billingY += 15;
    
    if (order.shippingAddress.landmark) {
      doc.text(order.shippingAddress.landmark, contentX, billingY);
      billingY += 15;
    }
    
    doc.text(`${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} ${order.shippingAddress.pinCode || ''}`, contentX, billingY);
    billingY += 15;
    
    doc.text(order.shippingAddress.country || '', contentX, billingY);
    billingY += 15;
    
    doc.text(user.email || '', contentX, billingY);
    billingY += 30; // Extra space before order details

    // Order items table
    doc.fontSize(14).font('Helvetica-Bold').text('Order Details:', contentX, billingY);
    billingY += 25;

    // Table dimensions
    const tableTop = billingY;
    
    // Column widths
    const colBook = contentX;                       // Book column start
    const colBookWidth = contentWidth * 0.45;       // 45% of content width
    
    const colPrice = colBook + colBookWidth;        // Price column start
    const colPriceWidth = contentWidth * 0.15;      // 15% of content width
    
    const colQty = colPrice + colPriceWidth;        // Qty column start
    const colQtyWidth = contentWidth * 0.15;        // 15% of content width
    
    const colSubtotal = colQty + colQtyWidth;       // Subtotal column start
    const colSubtotalWidth = contentWidth * 0.25;   // 25% of content width
    
    const rowHeight = 30;
    const headerHeight = 30;

    // Table header background
    doc.rect(colBook, tableTop, contentWidth, headerHeight)
       .fillColor('#f8f9fa')
       .fill();

    // Table headers
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333');
    doc.text('Book', colBook + 5, tableTop + 10, { width: colBookWidth - 10 });
    doc.text('Price', colPrice + 5, tableTop + 10, { width: colPriceWidth - 10, align: 'center' });
    doc.text('Qty', colQty + 5, tableTop + 10, { width: colQtyWidth - 10, align: 'center' });
    doc.text('Subtotal', colSubtotal + 5, tableTop + 10, { width: colSubtotalWidth - 10, align: 'right' });

    // Table rows
    doc.fontSize(12).font('Helvetica');
    let y = tableTop + headerHeight;
    
    order.items.forEach((item, index) => {
      doc.fillColor('#333');
      doc.text(item.title || 'Unknown Product', colBook + 5, y + 10, { width: colBookWidth - 10 });
      doc.text(item.formattedPrice, colPrice + 5, y + 10, { width: colPriceWidth - 10, align: 'center' });
      doc.text(item.quantity.toString() || '1', colQty + 5, y + 10, { width: colQtyWidth - 10, align: 'center' });
      doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, colSubtotal + 5, y + 10, { width: colSubtotalWidth - 10, align: 'right' });
      y += rowHeight;
    });

    // Summary rows
    const summaryStartY = y;
    const summaryLabelX = colQty - 20;
    const summaryValueX = colSubtotal;
    
    // Subtotal row
    doc.text('Subtotal', summaryLabelX, y + 10, { width: colQtyWidth + 20, align: 'right' });
    doc.text(order.formattedSubtotal, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: 'right' });
    y += rowHeight;
    
    // Tax row
    doc.text('Tax', summaryLabelX, y + 10, { width: colQtyWidth + 20, align: 'right' });
    doc.text(order.formattedTax, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: 'right' });
    y += rowHeight;
    
    // Total row (with larger font)
    doc.font('Helvetica-Bold').fontSize(16);
    doc.text('Total', summaryLabelX, y + 10, { width: colQtyWidth + 20, align: 'right' });
    doc.text(order.formattedTotal, summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: 'right' });
    y += rowHeight;
    
    // Payment method row
    doc.font('Helvetica').fontSize(12);
    doc.text('Payment Method', summaryLabelX, y + 10, { width: colQtyWidth + 20, align: 'right' });
    doc.text(order.paymentMethod || 'Cash on Delivery', summaryValueX + 5, y + 10, { width: colSubtotalWidth - 10, align: 'right' });
    
    // Draw table borders
    const totalTableHeight = y + rowHeight - tableTop;
    
    // Outer border for the entire table
    doc.rect(colBook, tableTop, contentWidth, totalTableHeight)
       .lineWidth(1)
       .strokeColor('#ddd')
       .stroke();

    // Column dividers
    const colDividers = [colPrice, colQty, colSubtotal, colBook + contentWidth];
    colDividers.forEach(x => {
      doc.moveTo(x, tableTop)
         .lineTo(x, tableTop + totalTableHeight)
         .stroke();
    });

    // Row dividers (header and items)
    let rowY = tableTop + headerHeight;
    doc.moveTo(colBook, rowY)
       .lineTo(colBook + contentWidth, rowY)
       .stroke();
    
    order.items.forEach((_, i) => {
      rowY += rowHeight;
      doc.moveTo(colBook, rowY)
         .lineTo(colBook + contentWidth, rowY)
         .stroke();
    });

    // Summary section divider
    doc.moveTo(colBook, summaryStartY)
       .lineTo(colBook + contentWidth, summaryStartY)
       .stroke();

    // Footer
    const footerY = y + rowHeight + 50;
    doc.fontSize(12).fillColor('#666').text(
      'This is a computer-generated invoice and does not require a signature.',
      contentX,
      footerY,
      { align: 'center', width: contentWidth }
    );
    
    doc.text(
      'Thank you for shopping at Chapterless ',
      contentX,
      footerY + 20,
      { align: 'center', width: contentWidth }
    );

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Internal server error');
  }
};

module.exports = { getOrders, getOrderDetails, downloadInvoice };