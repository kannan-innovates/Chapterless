const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema"); // Added Cart import
const Offer = require("../../models/offerSchema"); // Added Offer import
const PDFDocument = require('pdfkit');
const path = require('path');
const { getActiveOfferForProduct, calculateDiscount, getItemPriceDetails } = require("../../utils/offer-helper");
const { processCancelRefund, processReturnRefund } = require("./wallet-controller");

const { HttpStatus } = require("../../helpers/status-code");

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
    let currentFilter = req.query.filter || 'All';
    if (!validFilters.includes(currentFilter)) {
      currentFilter = 'All';
    }
    const query = { user: userId, isDeleted: false };
    if (currentFilter !== 'All') {
      query.orderStatus = currentFilter;
    }

    // Handle sort
    const validSorts = {
      'createdAt-desc': { createdAt: -1 },
      'createdAt-asc': { createdAt: 1 },
      'total-desc': { total: -1 },
      'total-asc': { total: 1 }
    };

    const sortDisplayMap = {
      'createdAt-desc': 'Newest First',
      'createdAt-asc': 'Oldest First',
      'total-desc': 'Price: High to Low',
      'total-asc': 'Price: Low to High'
    };

    let currentSort = req.query.sort || 'createdAt-desc';
    if (!validSorts[currentSort]) {
      currentSort = 'createdAt-desc';
    }
    const sortCriteria = validSorts[currentSort];
    const sortDisplay = sortDisplayMap[currentSort];

    // Filter display text
    const filterDisplayMap = {
      'All': 'All Orders',
      'Delivered': 'Delivered Orders',
      'Processing': 'Processing Orders',
      'Shipped': 'Shipped Orders',
      'Placed': 'Placed Orders',
      'Cancelled': 'Cancelled Orders',
      'Returned': 'Returned Orders',
      'Partially Cancelled': 'Partially Cancelled Orders',
      'Partially Returned': 'Partially Returned Orders'
    };

    // Fetch orders with filter and sort
    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit)
      .lean();

    // Format order data and calculate offers
    for (const order of orders) {
      // Format date
      order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Calculate estimated delivery date
      if (!['Delivered', 'Cancelled', 'Returned'].includes(order.orderStatus)) {
        const deliveryDate = new Date(order.createdAt);
        deliveryDate.setDate(deliveryDate.getDate() + 5); // Assuming 5 days delivery time
        order.estimatedDeliveryDate = deliveryDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } else if (order.orderStatus === 'Delivered') {
        order.estimatedDeliveryDate = new Date(order.deliveredAt || order.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      // Format order totals
      order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`;
      order.formattedTax = `₹${order.tax.toFixed(2)}`;
      order.formattedTotal = `₹${order.total.toFixed(2)}`;
      order.formattedDiscount = order.discount ? `₹${order.discount.toFixed(2)}` : '₹0.00';
      order.formattedCouponDiscount = order.couponDiscount ? `₹${order.couponDiscount.toFixed(2)}` : '₹0.00';

      // Format items with price breakdowns
      for (const item of order.items) {
        const priceBreakdown = item.priceBreakdown || {};

        // Format all price values
        item.formattedOriginalPrice = `₹${priceBreakdown.originalPrice?.toFixed(2) || item.price.toFixed(2)}`;
        item.formattedSubtotal = `₹${priceBreakdown.subtotal?.toFixed(2) || (item.price * item.quantity).toFixed(2)}`;
        item.formattedOfferDiscount = priceBreakdown.offerDiscount ? `₹${priceBreakdown.offerDiscount.toFixed(2)}` : '₹0.00';
        item.formattedPriceAfterOffer = `₹${priceBreakdown.priceAfterOffer?.toFixed(2) || item.discountedPrice.toFixed(2)}`;
        item.formattedCouponDiscount = priceBreakdown.couponDiscount ? `₹${priceBreakdown.couponDiscount.toFixed(2)}` : '₹0.00';
        item.formattedFinalPrice = `₹${priceBreakdown.finalPrice?.toFixed(2) || item.discountedPrice.toFixed(2)}`;

        // Store discount percentages and proportions
        item.offerTitle = priceBreakdown.offerTitle || null;
        item.couponProportion = priceBreakdown.couponProportion || 0;

        // Calculate effective discount percentage
        const totalDiscount = (priceBreakdown.offerDiscount || 0) + (priceBreakdown.couponDiscount || 0);
        const originalTotal = priceBreakdown.subtotal || (item.price * item.quantity);
        item.effectiveDiscountPercentage = originalTotal > 0 ?
          ((totalDiscount / originalTotal) * 100).toFixed(1) : '0';

        // Add flags for cancellation and return - simplified
        item.canBeCancelled = (
          item.status === 'Active' &&
          ['Placed', 'Processing'].includes(order.orderStatus)
        );

        // Check if item can be returned - enhanced logic
        if ((order.orderStatus === 'Delivered' ||
             order.orderStatus === 'Partially Cancelled' ||
             order.orderStatus === 'Partially Returned') &&
            item.status === 'Active') {

          const deliveredDate = order.deliveredAt;
          if (deliveredDate) {
            const returnPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            const timeRemaining = returnPeriod - (Date.now() - deliveredDate.getTime());
            item.canBeReturned = timeRemaining > 0;
          } else {
            item.canBeReturned = false;
          }
        } else {
          item.canBeReturned = false;
        }
      }
    }

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

    res.render('order', {
      title: 'My Orders',
      orders,
      user,
      pagination,
      currentFilter,
      currentSort,
      sortDisplay,
      filterDisplay: filterDisplayMap[currentFilter],
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    // Redirect to home page with error message
    req.session.errorMessage = 'Something went wrong while fetching your orders. Please try again.';
    return res.redirect('/');
  }
};

/**
 * Get details of a specific order
 */
const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user_id;

    if (!userId) {
      return res.redirect('/login');
    }

    // Fetch user data
    const user = await User.findById(userId, 'fullName email profileImage').lean();
    if (!user) {
      return res.redirect('/login');
    }

    const order = await Order.findById(orderId).populate('items.product');

    if (!order || order.user.toString() !== userId.toString()) {
      return res.status(HttpStatus.NOT_FOUND).render('error', { message: 'Order not found' });
    }

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculate total item value for coupon proportion
    const totalItemsValue = order.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    // Process each item for offers and format prices
    for (const item of order.items) {
      // Get active offer for this product
      const offer = await getActiveOfferForProduct(
        item.product._id || item.product,
        null,
        item.price
      );

      // Calculate discount if offer exists
      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(offer, item.price);

      // Calculate coupon proportion and discount
      if (order.couponDiscount && order.couponDiscount > 0) {
        const itemValue = item.price * item.quantity;
        item.couponProportion = itemValue / totalItemsValue;
        item.couponDiscount = (order.couponDiscount * item.couponProportion);
      }

      // Update item with offer information
      item.originalPrice = item.price;
      item.discountedPrice = finalPrice;
      item.offerDiscount = discountAmount;
      item.offerTitle = offer ? offer.title : null;
      item.discountPercentage = discountPercentage;

      // Calculate final price after all discounts
      const itemSubtotal = item.price * item.quantity;
      const itemOfferDiscount = (discountAmount || 0) * item.quantity;
      const itemCouponDiscount = item.couponDiscount || 0;
      item.finalPrice = (itemSubtotal - itemOfferDiscount - itemCouponDiscount) / item.quantity;

      // Format prices for display
      item.formattedPrice = `₹${item.price.toFixed(2)}`;
      item.formattedDiscountedPrice = `₹${item.discountedPrice.toFixed(2)}`;
      item.formattedFinalPrice = `₹${item.finalPrice.toFixed(2)}`;
      item.formattedOfferDiscount = `₹${(item.offerDiscount || 0).toFixed(2)}`;
      item.formattedCouponDiscount = `₹${(item.couponDiscount || 0).toFixed(2)}`;

      // Check if item can be cancelled - simplified
      item.canBeCancelled = (
        item.status === 'Active' &&
        ['Placed', 'Processing'].includes(order.orderStatus)
      );

      // Check if item can be returned - enhanced logic
      if ((order.orderStatus === 'Delivered' ||
           order.orderStatus === 'Partially Cancelled' ||
           order.orderStatus === 'Partially Returned') &&
          item.status === 'Active') {

        const deliveredDate = order.deliveredAt;
        if (deliveredDate) {
          const returnPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          const timeRemaining = returnPeriod - (Date.now() - deliveredDate.getTime());

          item.canBeReturned = timeRemaining > 0;

          if (item.canBeReturned) {
            const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
            item.returnTimeRemaining = daysRemaining;
            item.returnDeadline = new Date(deliveredDate.getTime() + returnPeriod).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          } else {
            const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (24 * 60 * 60 * 1000));
            item.returnExpiredDays = daysSinceDelivery - 7;
          }
        } else {
          item.canBeReturned = false;
          item.returnNotEligibleReason = 'Order not yet delivered';
        }
      } else {
        item.canBeReturned = false;
        if (item.status !== 'Active') {
          item.returnNotEligibleReason = `Item is ${item.status.toLowerCase()}`;
        } else if (order.orderStatus !== 'Delivered') {
          item.returnNotEligibleReason = 'Order must be delivered first';
        }
      }
    }

    // Format order totals
    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`;
    order.formattedTax = `₹${order.tax.toFixed(2)}`;
    order.formattedTotal = `₹${order.total.toFixed(2)}`;
    order.formattedDiscount = order.discount ? `₹${order.discount.toFixed(2)}` : '₹0.00';
    order.formattedCouponDiscount = order.couponDiscount ? `₹${order.couponDiscount.toFixed(2)}` : '₹0.00';

    // Generate timeline
    const timeline = [
      {
        status: 'Order Placed',
        timestamp: new Date(order.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        completed: true,
        active: false
      },
      {
        status: 'Processing',
        timestamp: order.processedAt ? new Date(order.processedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        completed: order.orderStatus === 'Processing' || order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered',
        active: order.orderStatus === 'Processing'
      },
      {
        status: 'Shipped',
        timestamp: order.shippedAt ? new Date(order.shippedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        completed: order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered',
        active: order.orderStatus === 'Shipped'
      },
      {
        status: 'Delivered',
        timestamp: order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        completed: order.orderStatus === 'Delivered',
        active: order.orderStatus === 'Delivered'
      }
    ];

    // Add cancelled status if order is cancelled
    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Partially Cancelled') {
      timeline.push({
        status: order.orderStatus,
        timestamp: order.cancelledAt ? new Date(order.cancelledAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        cancelled: true,
        active: true
      });
    }

    // Add return status if order is returned or return requested
    if (order.orderStatus === 'Return Requested' || order.orderStatus === 'Returned' ||
        order.orderStatus === 'Partially Return Requested' || order.orderStatus === 'Partially Returned') {
      timeline.push({
        status: order.orderStatus,
        timestamp: order.returnRequestedAt ? new Date(order.returnRequestedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        return_requested: order.orderStatus.includes('Return Requested'),
        returned: order.orderStatus.includes('Returned'),
        active: true
      });
    }

    res.render('order-details', {
      order,
      timeline,
      title: `Order #${order.orderNumber}`,
      user: {
        id: userId,
        fullName: user.fullName || 'User',
        email: user.email || '',
        profileImage: user.profileImage || '/api/placeholder/120/120'
      },
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { message: 'Error fetching order details' });
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
      return res.status(HttpStatus.NOT_FOUND).render('error', {
        message: 'Order not found or you do not have access to this order',
        isAuthenticated: true
      });
    }

    // Fetch user data
    const user = await User.findById(userId, 'fullName email profileImage').lean();
    if (!user) {
      return res.redirect('/login');
    }

    // Calculate total offer discount from items
    const totalOfferDiscount = order.items.reduce((sum, item) => {
      return sum + (item.priceBreakdown?.offerDiscount || 0);
    }, 0);

    // Calculate total coupon discount from items
    const totalCouponDiscount = order.items.reduce((sum, item) => {
      return sum + (item.priceBreakdown?.couponDiscount || 0);
    }, 0);

    res.render('order-success', {
      orderNumber: order.orderNumber,
      orderId: order._id,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      offerDiscount: totalOfferDiscount,
      couponDiscount: totalCouponDiscount,
      couponCode: order.couponCode,
      tax: order.tax,
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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', {
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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', {
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
      return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
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
      return res.status(HttpStatus.NOT_FOUND).send('Order not found or you do not have access to this order');
    }

    // Fetch user data
    const user = await User.findById(userId, 'fullName email').lean();
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).send('User not found');
    }

    // Calculate offers and format order data
    let totalBeforeDiscount = 0;
    let totalDiscount = 0;
    let totalAfterDiscount = 0;

    // Format order data
    order.formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Process each item for offers
    for (const item of order.items) {
      // Get active offer for this product
      const offer = await getActiveOfferForProduct(
        item.product.toString(),
        null,
        item.price
      );

      // Calculate discount if offer exists
      const { discountPercentage, discountAmount, finalPrice } = calculateDiscount(offer, item.price);

      const itemOriginalTotal = item.price * item.quantity;
      const itemDiscountTotal = discountAmount * item.quantity;
      const itemFinalTotal = finalPrice * item.quantity;

      totalBeforeDiscount += itemOriginalTotal;
      totalDiscount += itemDiscountTotal;
      totalAfterDiscount += itemFinalTotal;

      // Update item with offer information
      item.discountedPrice = finalPrice;
      item.offerDiscount = discountAmount;
      item.offerTitle = offer ? offer.title : null;
      item.discountPercentage = discountPercentage;
      item.finalTotal = itemFinalTotal;
    }

    // Update order totals
    order.subtotal = totalBeforeDiscount;
    order.discount = totalDiscount;
    order.total = totalAfterDiscount + (order.tax || 0) - (order.couponDiscount || 0);

    order.formattedSubtotal = `₹${order.subtotal.toFixed(2)}`;
    order.formattedTotal = `₹${order.total.toFixed(2)}`;
    order.formattedTax = `₹${(order.tax || 0).toFixed(2)}`;
    order.formattedDiscount = `₹${order.discount.toFixed(2)}`;
    order.formattedCouponDiscount = `₹${(order.couponDiscount || 0).toFixed(2)}`;

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
      primary: '#2563EB',      // Professional Blue
      secondary: '#6B7280',    // Gray
      dark: '#111827',         // Dark gray
      light: '#F8FAFC',        // Light gray
      success: '#059669',      // Green
      danger: '#DC2626',       // Red
      border: '#E5E7EB',       // Border gray
      accent: '#7C3AED'        // Purple accent
    };

    // Document dimensions
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 100;
    const leftMargin = 50;
    const rightMargin = pageWidth - 50;

    // Add professional header with logo and company info
    try {
      doc.image(path.join(__dirname, '../../public/assets/harryPotter.jpeg'), leftMargin, 50, { width: 50 });
    } catch (error) {
      console.log('Logo image not found, continuing without logo');
    }

    // Company name with professional styling
    doc.font('Helvetica-Bold')
       .fontSize(28)
       .fillColor(colors.primary)
       .text('CHAPTERLESS', leftMargin + 70, 50);

    // Tagline with elegant typography
    doc.font('Helvetica-Oblique')
       .fontSize(11)
       .fillColor(colors.secondary)
       .text('Where Stories Find Lost Souls', leftMargin + 70, 82);

    // Add company contact information
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor(colors.secondary)
       .text('Email: support@chapterless.com | Phone: +91 1234567890', leftMargin + 70, 98)
       .text('Website: www.chapterless.com', leftMargin + 70, 110);

    // Add professional accent line
    doc.strokeColor(colors.primary)
       .lineWidth(2)
       .moveTo(leftMargin + 70, 125)
       .lineTo(leftMargin + 250, 125)
       .stroke();

    // Add professional invoice title and details in a box
    const invoiceBoxX = rightMargin - 180;
    const invoiceBoxY = 50;
    const invoiceBoxWidth = 170;
    const invoiceBoxHeight = 100;

    // Invoice box background
    doc.fillColor(colors.light)
       .rect(invoiceBoxX, invoiceBoxY, invoiceBoxWidth, invoiceBoxHeight)
       .fill();

    // Invoice box border
    doc.strokeColor(colors.primary)
       .lineWidth(2)
       .rect(invoiceBoxX, invoiceBoxY, invoiceBoxWidth, invoiceBoxHeight)
       .stroke();

    // Invoice title
    doc.font('Helvetica-Bold')
       .fontSize(26)
       .fillColor(colors.primary)
       .text('INVOICE', invoiceBoxX + 10, invoiceBoxY + 15, { align: 'center', width: invoiceBoxWidth - 20 });

    // Invoice details - vertical layout (line by line)
    const detailsStartY = invoiceBoxY + 40;
    const lineHeight = 18;

    // Invoice Number
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.secondary)
       .text('Invoice Number: ', invoiceBoxX + 10, detailsStartY, { continued: true })
       .font('Helvetica-Bold')
       .fillColor(colors.dark)
       .text(`#${order.orderNumber}`);

    // Date
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor(colors.secondary)
       .text('Date: ', invoiceBoxX + 10, detailsStartY + lineHeight, { continued: true })
       .font('Helvetica-Bold')
       .fillColor(colors.dark)
       .text(`${order.formattedDate}`);

    // Status
    const orderStatusColor = order.orderStatus === 'Delivered' ? colors.success :
                            order.orderStatus === 'Returned' ? colors.danger :
                            order.orderStatus === 'Cancelled' ? colors.danger : colors.primary;

    doc.font('Helvetica')
       .fontSize(9)
       .fillColor(colors.secondary)
       .text('Status: ', invoiceBoxX + 10, detailsStartY + (lineHeight * 2), { continued: true })
       .font('Helvetica-Bold')
       .fillColor(orderStatusColor)
       .text(`${order.orderStatus}`);

    // Add separator line
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(leftMargin, 160)
       .lineTo(rightMargin, 160)
       .stroke();

    // Add billing and shipping info
    const billingStartY = 180;

    // Billing info with professional styling
    const billingBoxWidth = 250;
    const billingBoxHeight = 120;

    // Billing box background
    doc.fillColor('#FAFBFC')
       .rect(leftMargin, billingStartY, billingBoxWidth, billingBoxHeight)
       .fill();

    // Billing box border
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .rect(leftMargin, billingStartY, billingBoxWidth, billingBoxHeight)
       .stroke();

    // Billing header
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(colors.primary)
       .text('BILL TO', leftMargin + 10, billingStartY + 10);

    // Billing details
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .fillColor(colors.dark)
       .text(order.shippingAddress.fullName || user.fullName || 'N/A', leftMargin + 10, billingStartY + 30);

    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.dark)
       .text(order.shippingAddress.street || '', leftMargin + 10, billingStartY + 45)
       .text(`${order.shippingAddress.district || ''}, ${order.shippingAddress.state || ''} - ${order.shippingAddress.pincode || ''}`, leftMargin + 10, billingStartY + 60)
       .text(`Phone: ${order.shippingAddress.phone || 'N/A'}`, leftMargin + 10, billingStartY + 75)
       .text(`Email: ${user.email || 'N/A'}`, leftMargin + 10, billingStartY + 90);

    // Payment info with professional styling
    const paymentBoxX = rightMargin - 200;
    const paymentBoxWidth = 190;
    const paymentBoxHeight = 80;

    // Payment box background
    doc.fillColor('#F0F9FF')
       .rect(paymentBoxX, billingStartY, paymentBoxWidth, paymentBoxHeight)
       .fill();

    // Payment box border
    doc.strokeColor(colors.primary)
       .lineWidth(1)
       .rect(paymentBoxX, billingStartY, paymentBoxWidth, paymentBoxHeight)
       .stroke();

    // Payment header
    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor(colors.primary)
       .text('PAYMENT DETAILS', paymentBoxX + 10, billingStartY + 10);

    // Payment method
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.secondary)
       .text('Method:', paymentBoxX + 10, billingStartY + 35)
       .font('Helvetica-Bold')
       .fillColor(colors.dark)
       .text(`${order.paymentMethod || 'Cash on Delivery'}`, paymentBoxX + 10, billingStartY + 50);

    // Payment status
    doc.font('Helvetica')
       .fontSize(10)
       .fillColor(colors.secondary)
       .text('Status:', paymentBoxX + 100, billingStartY + 35);

    const paymentStatusColor = order.paymentStatus === 'Paid' ? colors.success :
                              order.paymentStatus === 'Pending' ? '#F59E0B' : colors.danger;

    doc.font('Helvetica-Bold')
       .fillColor(paymentStatusColor)
       .text(`${order.paymentStatus || 'Pending'}`, paymentBoxX + 100, billingStartY + 50);

    // Add separator line
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(leftMargin, billingStartY + 140)
       .lineTo(rightMargin, billingStartY + 140)
       .stroke();

    // Order items table
    const tableTop = billingStartY + 160;
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
       .rect(leftMargin, tableTop, contentWidth, 25)
       .fill();

    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor(colors.dark);

    tableHeaders.forEach((header, i) => {
      const align = i === 0 ? 'left' : 'right';
      const x = colPositions[i];
      const width = colWidths[i] * contentWidth;

      doc.text(header, x + 5, tableTop + 8, { width: width - 10, align });
    });

    // Add table rows
    let y = tableTop + 25;

    order.items.forEach((item, index) => {
      // Alternate row background for better readability
      if (index % 2 === 1) {
        doc.fillColor('#F9FAFB')
           .rect(leftMargin, y, contentWidth, 35)
           .fill();
      }

      doc.fillColor(colors.dark)
         .font('Helvetica')
         .fontSize(10);

      // Item name with status
      let itemTitle = item.title || 'Unknown Product';
      if (item.status !== 'Active') {
        itemTitle += ` (${item.status})`;
      }

      doc.text(itemTitle, colPositions[0] + 5, y + 5, {
        width: colWidths[0] * contentWidth - 10,
        align: 'left'
      });

      // Add offer title if exists
      if (item.offerTitle) {
        doc.fillColor(colors.success)
           .fontSize(8)
           .text(item.offerTitle, colPositions[0] + 5, y + 20, {
             width: colWidths[0] * contentWidth - 10,
             align: 'left'
           });
      }

      // Price
      doc.fillColor(colors.dark)
         .fontSize(10)
         .text(`₹${item.price.toFixed(2)}`, colPositions[1] + 5, y + 12, {
           width: colWidths[1] * contentWidth - 10,
           align: 'right'
         });

      // Quantity
      doc.text(item.quantity.toString(), colPositions[2] + 5, y + 12, {
        width: colWidths[2] * contentWidth - 10,
        align: 'right'
      });

      // Discount
      const itemDiscount = (item.offerDiscount || 0) * item.quantity;
      doc.fillColor(colors.success)
         .text(`₹${itemDiscount.toFixed(2)}`, colPositions[3] + 5, y + 12, {
           width: colWidths[3] * contentWidth - 10,
           align: 'right'
         });

      // Total
      doc.fillColor(colors.dark)
         .text(`₹${item.finalTotal.toFixed(2)}`, colPositions[4] + 5, y + 12, {
           width: colWidths[4] * contentWidth - 10,
           align: 'right'
         });

      y += 35;
    });

    // Add table border
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .rect(leftMargin, tableTop, contentWidth, y - tableTop)
       .stroke();

    // Add horizontal lines for each row
    let lineY = tableTop + 25;
    for (let i = 0; i < order.items.length; i++) {
      doc.moveTo(leftMargin, lineY)
         .lineTo(rightMargin - 50, lineY)
         .stroke();
      lineY += 35;
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
    if (order.discount > 0) {
      doc.fillColor(colors.secondary)
         .text('Offer Discount:', summaryX, summaryStartY + 40, { width: 100, align: 'left' })
         .fillColor(colors.success)
         .text(`- ₹${order.discount.toFixed(2)}`, summaryX + 100, summaryStartY + 40, { width: 100, align: 'right' });
    }

    // Coupon discount
    if (order.couponDiscount && order.couponDiscount > 0) {
      const yPos = order.discount > 0 ? summaryStartY + 60 : summaryStartY + 40;
      doc.fillColor(colors.secondary)
         .text(`Coupon Discount${order.couponCode ? ` (${order.couponCode})` : ''}:`, summaryX, yPos, { width: 100, align: 'left' })
         .fillColor(colors.success)
         .text(`- ₹${order.couponDiscount.toFixed(2)}`, summaryX + 100, yPos, { width: 100, align: 'right' });
    }

    // Total
    const totalY = summaryStartY + (order.discount > 0 ? 80 : 60);

    // Add separator line before total
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .moveTo(summaryX, totalY - 10)
       .lineTo(rightMargin, totalY - 10)
       .stroke();

    doc.font('Helvetica-Bold')
       .fontSize(12)
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

    // Professional footer with enhanced styling
    const footerBoxHeight = 60;

    // Footer background
    doc.fillColor(colors.light)
       .rect(leftMargin, footerY - 10, contentWidth, footerBoxHeight)
       .fill();

    // Footer border
    doc.strokeColor(colors.border)
       .lineWidth(1)
       .rect(leftMargin, footerY - 10, contentWidth, footerBoxHeight)
       .stroke();

    // Thank you message
    doc.font('Helvetica-Bold')
       .fontSize(12)
       .fillColor(colors.primary)
       .text('Thank you for choosing Chapterless!', leftMargin, footerY + 5, { align: 'center', width: contentWidth });

    // Footer details
    doc.font('Helvetica')
       .fontSize(9)
       .fillColor(colors.secondary)
       .text('This is a computer-generated invoice and does not require a signature.', leftMargin, footerY + 25, { align: 'center', width: contentWidth })
       .text('For any queries, contact us at support@chapterless.com or +91 9876543210', leftMargin, footerY + 38, { align: 'center', width: contentWidth });

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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal server error');
  }
};

/**
 * Cancel an entire order
 */
const cancelOrder = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;
    const { reason } = req.body;

    // Validate cancellation reason
    if (!reason || reason.trim() === '') {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Cancellation reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be cancelled
    const allowedStatuses = ['Placed', 'Processing'];
    if (!allowedStatuses.includes(order.orderStatus)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
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

    // Restore product stock for each item
    for (const item of order.items) {
      if (item.status === 'Cancelled') {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }
    }

    // **FIX: Enhanced payment status handling for full order cancellation**
    if (order.paymentMethod === 'COD') {
      // For COD orders, handle based on delivery status
      const wasDeliveredAndPaid = order.paymentStatus === 'Paid' ||
                                  order.orderStatus === 'Delivered' ||
                                  order.deliveredAt ||
                                  order.items.some(item =>
                                    item.status === 'Delivered' ||
                                    item.status === 'Returned' ||
                                    (item.status === 'Active' && order.orderStatus === 'Delivered')
                                  );

      if (wasDeliveredAndPaid) {
        // COD order was delivered, customer paid cash - process wallet refund
        const refundSuccess = await processCancelRefund(userId, order);
        if (refundSuccess) {
          order.paymentStatus = 'Refunded';
        } else {
          order.paymentStatus = 'Refund Failed';
        }
      } else {
        // COD order not delivered yet - no payment was made
        order.paymentStatus = 'Failed';
      }
    } else if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded') {
      // For paid orders (Wallet, Razorpay, etc.), process refund to wallet
      const refundSuccess = await processCancelRefund(userId, order);
      if (refundSuccess) {
        order.paymentStatus = 'Refunded';
      } else {
        order.paymentStatus = 'Refund Failed';
      }
    } else {
      // For unpaid online orders, set to 'Failed'
      order.paymentStatus = 'Failed';
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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

    // Find the order item
    const orderItem = order.items.find(item =>
      item.product.toString() === productId && item.status === 'Active'
    );

    if (!orderItem) {
      return res.status(404).json({ success: false, message: 'Item not found or already cancelled' });
    }

    // Check if item can be cancelled based on order status - simplified
    const allowedStatuses = ['Placed', 'Processing'];
    if (!allowedStatuses.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Items cannot be cancelled when order is in ${order.orderStatus} status`
      });
    }

    // Update item status
    orderItem.status = 'Cancelled';
    orderItem.cancelledAt = new Date();
    orderItem.cancellationReason = reason;

    // **FIX: Enhanced order status calculation for mixed item statuses**
    const hasActiveItems = order.items.some(item => item.status === 'Active');
    const hasCancelledItems = order.items.some(item => item.status === 'Cancelled');
    const hasReturnedItems = order.items.some(item => item.status === 'Returned');
    const hasReturnRequestedItems = order.items.some(item => item.status === 'Return Requested');

    if (!hasActiveItems && !hasReturnRequestedItems) {
      // No active or return requested items remain
      if (hasReturnedItems && hasCancelledItems) {
        order.orderStatus = 'Partially Returned'; // Mixed returned and cancelled
      } else if (hasReturnedItems) {
        order.orderStatus = 'Returned'; // All returned
      } else if (hasCancelledItems) {
        order.orderStatus = 'Cancelled'; // All cancelled
      }
    } else if (hasCancelledItems || hasReturnedItems) {
      // Some items cancelled/returned, some still active
      if (hasCancelledItems && hasReturnedItems) {
        order.orderStatus = 'Partially Returned'; // Mixed scenario
      } else if (hasCancelledItems) {
        order.orderStatus = 'Partially Cancelled';
      } else if (hasReturnedItems) {
        order.orderStatus = 'Partially Returned';
      }
    }
    // If only active items remain, keep the current order status

    // Restore product stock
    await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: orderItem.quantity } }
    );

    // Handle refund if payment was made - cancelled items should refund immediately
    console.log('🔄 ATTEMPTING REFUND FOR CANCELLED ITEM:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      itemId: orderItem._id,
      itemTitle: orderItem.title,
      paymentStatus: order.paymentStatus,
      userId: userId
    });

    // **FIX: Enhanced payment status handling for all scenarios**
    if (order.paymentMethod === 'COD') {
      // For COD orders, handle based on delivery status
      const wasDeliveredAndPaid = order.paymentStatus === 'Paid' ||
                                  order.orderStatus === 'Delivered' ||
                                  order.deliveredAt ||
                                  order.items.some(item =>
                                    item.status === 'Delivered' ||
                                    item.status === 'Returned' ||
                                    (item.status === 'Active' && order.orderStatus === 'Delivered')
                                  );

      if (wasDeliveredAndPaid) {
        // COD order was delivered, customer paid cash - process wallet refund
        console.log('💰 Processing COD cancellation refund (post-delivery)...');
        const refundSuccess = await processCancelRefund(userId, order, orderItem._id);
        console.log('💰 COD Refund result:', refundSuccess);

        if (refundSuccess) {
          if (!hasActiveItems) {
            order.paymentStatus = 'Refunded';
            console.log('✅ COD order fully refunded to wallet');
          } else {
            order.paymentStatus = 'Partially Refunded';
            console.log('✅ COD order partially refunded to wallet');
          }
        } else {
          console.error(`❌ Failed to process COD refund for cancelled item ${orderItem._id}`);
          order.paymentStatus = 'Refund Failed';
        }
      } else {
        // COD order not delivered yet - no refund needed
        if (!hasActiveItems) {
          order.paymentStatus = 'Failed'; // All items cancelled, no payment needed
          console.log('✅ COD order fully cancelled before delivery - no refund needed');
        }
        // For partial cancellations before delivery, keep payment status as 'Pending'
      }
    } else if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Partially Refunded') {
      // For paid orders (Wallet, Razorpay, etc.), process refund to wallet
      console.log('💰 Processing online payment cancellation refund...');
      const refundSuccess = await processCancelRefund(userId, order, orderItem._id);
      console.log('💰 Online payment refund result:', refundSuccess);

      if (refundSuccess) {
        if (!hasActiveItems) {
          order.paymentStatus = 'Refunded';
          console.log('✅ Online order fully refunded');
        } else {
          order.paymentStatus = 'Partially Refunded';
          console.log('✅ Online order partially refunded');
        }
      } else {
        console.error(`❌ Failed to process refund for cancelled item ${orderItem._id} in order ${order._id}`);
        order.paymentStatus = 'Refund Failed';
      }
    } else {
      console.log('⚠️ Order payment status does not allow refunds:', order.paymentStatus);
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Item cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order item:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
    }

    const userId = req.session.user_id;
    const orderId = req.params.id;
    const { reason } = req.body;

    // Validate return reason
    if (!reason || reason.trim() === '') {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Return reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be returned
    if (order.orderStatus !== 'Delivered' &&
        order.orderStatus !== 'Partially Cancelled' &&
        order.orderStatus !== 'Partially Returned') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Order cannot be returned in ${order.orderStatus} status. Only delivered orders can be returned.`
      });
    }

    // Check if return is within allowed time period (7 days from delivery)
    const deliveredDate = order.deliveredAt;
    if (!deliveredDate) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Order must be delivered before it can be returned.'
      });
    }

    const returnPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (24 * 60 * 60 * 1000));

    if (Date.now() - deliveredDate.getTime() > returnPeriod) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Return period has expired. Returns are only allowed within 7 days of delivery. Your order was delivered ${daysSinceDelivery} days ago.`
      });
    }

    // Check if there are any active items to return
    const activeItems = order.items.filter(item => item.status === 'Active');
    if (activeItems.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'No active items found to return. All items have already been cancelled or returned.'
      });
    }

    // Update order status to Return Requested
    order.orderStatus = 'Return Requested';
    order.returnReason = reason;
    order.returnRequestedAt = new Date();

    // Update all active items to Return Requested status
    let hasNonActiveItems = false;
    order.items.forEach(item => {
      if (item.status === 'Active') {
        item.status = 'Return Requested';
        item.returnReason = reason;
        item.returnRequestedAt = new Date();
      } else {
        hasNonActiveItems = true;
      }
    });

    // If there are any non-active items, update status to Partially Return Requested
    if (hasNonActiveItems) {
      order.orderStatus = 'Partially Return Requested';
    }

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
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Return reason is required' });
    }

    // Find the order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      isDeleted: false
    });

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Order not found' });
    }

    // Check if order can be returned
    if (order.orderStatus !== 'Delivered' &&
        order.orderStatus !== 'Partially Cancelled' &&
        order.orderStatus !== 'Partially Returned') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Items cannot be returned when order is in ${order.orderStatus} status. Only delivered orders can be returned.`
      });
    }

    // Check if return is within allowed time period (7 days from delivery)
    const deliveredDate = order.deliveredAt;
    if (!deliveredDate) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Order must be delivered before items can be returned.'
      });
    }

    const returnPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (24 * 60 * 60 * 1000));

    if (Date.now() - deliveredDate.getTime() > returnPeriod) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Return period has expired. Returns are only allowed within 7 days of delivery. Your order was delivered ${daysSinceDelivery} days ago.`
      });
    }

    // Find the specific product in the order
    const orderItem = order.items.find(item => item.product.toString() === productId);

    if (!orderItem) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Product not found in this order' });
    }

    if (orderItem.status !== 'Active') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `This item is already ${orderItem.status.toLowerCase()}`
      });
    }

    // Update item status to Return Requested
    orderItem.status = 'Return Requested';
    orderItem.returnReason = reason;
    orderItem.returnRequestedAt = new Date();

    // **FIX: Enhanced return request status calculation**
    const hasActiveItems = order.items.some(item => item.status === 'Active');
    const hasReturnRequestedItems = order.items.some(item => item.status === 'Return Requested');
    const hasCancelledItems = order.items.some(item => item.status === 'Cancelled');
    const hasReturnedItems = order.items.some(item => item.status === 'Returned');

    // Update order status based on comprehensive item status analysis
    if (!hasActiveItems && hasReturnRequestedItems && !hasCancelledItems && !hasReturnedItems) {
      // All items are in return requested state
      order.orderStatus = 'Return Requested';
    } else if (hasReturnRequestedItems && (hasActiveItems || hasCancelledItems || hasReturnedItems)) {
      // Mixed statuses with some return requests
      order.orderStatus = 'Partially Return Requested';
    }
    // If there are still active items without return requests, keep the order as delivered

    await order.save();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'Return request submitted successfully. Our team will review your request.'
    });
  } catch (error) {
    console.error('Error processing item return request:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
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
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Order not found' });
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

    if (['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Processing',
        date: order.processedAt || new Date(order.createdAt.getTime() + 24 * 60 * 60 * 1000),
        description: 'Your order is being processed'
      });
    }

    if (['Shipped', 'Out for Delivery', 'Delivered'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Shipped',
        date: order.shippedAt || new Date(order.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000),
        description: 'Your order has been shipped'
      });
    }

    if (['Out for Delivery', 'Delivered'].includes(order.orderStatus)) {
      trackingInfo.timeline.push({
        status: 'Out for Delivery',
        date: order.outForDeliveryAt || new Date(order.createdAt.getTime() + 4 * 24 * 60 * 60 * 1000),
        description: 'Your order is out for delivery'
      });
    }

    if (order.orderStatus === 'Delivered') {
      trackingInfo.timeline.push({
        status: 'Delivered',
        date: order.deliveredAt || new Date(order.createdAt.getTime() + 5 * 24 * 60 * 60 * 1000),
        description: 'Your order has been delivered'
      });
    }

    if (order.orderStatus === 'Cancelled') {
      trackingInfo.timeline.push({
        status: 'Cancelled',
        date: order.cancelledAt || order.updatedAt,
        description: `Order cancelled: ${order.cancellationReason || 'Customer request'}`
      });
    }

    if (order.orderStatus === 'Returned' || order.orderStatus === 'Return Requested') {
      trackingInfo.timeline.push({
        status: order.orderStatus,
        date: order.returnedAt || order.returnRequestedAt || order.updatedAt,
        description: order.orderStatus === 'Returned' ?
          `Return processed: ${order.returnReason || 'Customer request'}` :
          `Return requested: ${order.returnReason || 'Customer request'}`
      });
    }

    // Calculate estimated delivery date if not delivered yet
    if (!['Delivered', 'Cancelled', 'Returned', 'Return Requested'].includes(order.orderStatus)) {
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

    return res.status(HttpStatus.OK).json({
      success: true,
      tracking: trackingInfo
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
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
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Order not found' });
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
        const product = await Product.findById(item.product)
          .populate('category')
          .lean();

        if (!product || !product.isListed || product.isDeleted) {
          continue; // Skip unavailable products
        }

        // Check stock availability
        const quantityToAdd = Math.min(item.quantity, product.stock);

        if (quantityToAdd > 0) {
          // Calculate current price with offers (similar to cart controller)
          let finalPrice = product.salePrice;

          // Check for active offers
          const currentDate = new Date();
          const activeOffers = await Offer.find({
            isActive: true,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
            $or: [
              { appliesTo: 'all_products' },
              { appliesTo: 'specific_products', applicableProducts: product._id },
              { appliesTo: 'all_categories' },
              { appliesTo: 'specific_categories', applicableCategories: product.category._id }
            ]
          }).sort({ discountValue: -1 });

          // Apply the best offer if available
          if (activeOffers.length > 0) {
            const bestOffer = activeOffers[0];
            if (bestOffer.discountType === 'percentage') {
              const discountAmount = (product.salePrice * bestOffer.discountValue) / 100;
              finalPrice = product.salePrice - discountAmount;
            } else if (bestOffer.discountType === 'fixed') {
              finalPrice = Math.max(0, product.salePrice - bestOffer.discountValue);
            }
          }

          // Add item to cart
          cart.items.push({
            product: product._id,
            quantity: quantityToAdd,
            priceAtAddition: finalPrice
          });
        }
      }
    }

    // Save the updated cart
    await cart.save();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'Items added to cart successfully',
      redirectUrl: '/cart'
    });
  } catch (error) {
    console.error('Error reordering:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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