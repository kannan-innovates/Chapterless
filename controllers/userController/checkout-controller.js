const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { 
  getActiveOfferForProduct, 
  calculateDiscount,
  calculateProportionalCouponDiscount,
  getItemPriceDetails,
  calculateFinalItemPrice 
} = require("../../utils/offer-helper");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Generate unique order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `ORD-${timestamp}-${random}`;
};

const getCheckout = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect("/login");
    }

    const userId = req.session.user_id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    
    // Check if cart exists and has items
    if (!cart || !cart.items || cart.items.length === 0) {
      req.session.errorMessage = "Your cart is empty. Please add items before checkout.";
      return res.redirect("/cart");
    }

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });

    // Filter valid items first
    const cartItems = cart.items.filter((item) => 
      item.product && 
      item.product.isListed && 
      !item.product.isDeleted && 
      item.product.stock >= item.quantity
    );

    // If no valid items after filtering, redirect to cart
    if (cartItems.length === 0) {
      req.session.errorMessage = "No valid items in cart. Some items may be unavailable or out of stock.";
      return res.redirect("/cart");
    }

    // Update cart if invalid items were removed
    if (cartItems.length !== cart.items.length) {
      cart.items = cartItems;
      await cart.save();
      req.session.errorMessage = "Some items were removed from your cart as they are no longer available.";
      return res.redirect("/cart");
    }

    let subtotal = 0;
    let tax = 0;
    let totalAmount = 0;
    let cartCount = 0;
    let offerDiscount = 0;
    let couponDiscount = 0;
    let appliedCoupon = null;
    let itemDetails = {};

    // Process each item for offers
    for (const item of cartItems) {
      // Get active offer for this product
      const offer = await getActiveOfferForProduct(
        item.product._id, 
        item.product.category,
        item.priceAtAddition
      );

      if (offer) {
        // Calculate discount
        const { discountAmount, discountPercentage, finalPrice } = calculateDiscount(offer, item.priceAtAddition);

        // Store original and discounted prices
        item.originalPrice = item.priceAtAddition;
        item.discountedPrice = finalPrice;
        item.offerDiscount = discountAmount * item.quantity;
        item.offerTitle = offer.title;
        item.discountPercentage = discountPercentage;

        // Add to total offer discount
        offerDiscount += discountAmount * item.quantity;
      } else {
        item.originalPrice = item.priceAtAddition;
        item.discountedPrice = item.priceAtAddition;
        item.offerDiscount = 0;
        item.offerTitle = null;
        item.discountPercentage = 0;
      }
    }

    // Calculate subtotal after offers
    subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.discountedPrice, 0);

    // Check for applied coupon in session
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findById(req.session.appliedCoupon);
      
      if (coupon && coupon.isActive && new Date() <= coupon.expiryDate) {
        // Verify minimum order amount
        if (subtotal >= coupon.minOrderAmount) {
          appliedCoupon = coupon;

          // Calculate proportional coupon discount
          const couponResult = calculateProportionalCouponDiscount(coupon, cartItems);
          couponDiscount = couponResult.totalDiscount;

          // Store item-level details
          cartItems.forEach(item => {
            const itemCouponInfo = couponResult.itemDiscounts[item.product._id.toString()];
            
            // Add coupon discount info directly to cart item for display
            item.couponDiscount = itemCouponInfo ? itemCouponInfo.amount : 0;
            item.couponProportion = itemCouponInfo ? itemCouponInfo.proportion : 0;
            
            // Calculate final price (after both offer and coupon)
            const itemTotal = item.discountedPrice * item.quantity;
            const itemCouponDiscount = itemCouponInfo ? itemCouponInfo.amount : 0;
            item.finalPrice = itemTotal - itemCouponDiscount;
            
            // Calculate total discount (offer + coupon)
            item.totalDiscount = item.offerDiscount + itemCouponDiscount;
            
            // Calculate total discount percentage based on original price
            const originalTotal = item.originalPrice * item.quantity;
            item.discountPercentage = originalTotal > 0 
              ? ((item.totalDiscount / originalTotal) * 100).toFixed(1)
              : "0.0";

            // Store detailed price breakdown
            itemDetails[item.product._id.toString()] = {
              originalPrice: item.originalPrice,
              quantity: item.quantity,
              subtotal: originalTotal,
              offerDiscount: item.offerDiscount,
              priceAfterOffer: itemTotal,
              couponDiscount: itemCouponDiscount,
              finalPrice: item.finalPrice,
              couponProportion: itemCouponInfo ? itemCouponInfo.proportion : 0
            };
          });
        } else {
          // Remove coupon if minimum order amount not met
          delete req.session.appliedCoupon;
          appliedCoupon = null;
          req.session.errorMessage = `Minimum order amount of ₹${coupon.minOrderAmount} required for coupon ${coupon.code}`;
        }
      } else {
        // Remove invalid coupon
        delete req.session.appliedCoupon;
        appliedCoupon = null;
        if (coupon) {
          req.session.errorMessage = "The applied coupon has expired or is no longer valid.";
        }
      }
    }

    // Store item details without coupon if no valid coupon
    if (!appliedCoupon) {
      cartItems.forEach(item => {
        const itemTotal = item.discountedPrice * item.quantity;
        item.finalPrice = itemTotal;
        item.totalDiscount = item.offerDiscount;
        item.discountPercentage = item.discountPercentage || 0;

        // Store detailed price breakdown
        itemDetails[item.product._id.toString()] = {
          originalPrice: item.originalPrice,
          quantity: item.quantity,
          subtotal: item.originalPrice * item.quantity,
          offerDiscount: item.offerDiscount,
          priceAfterOffer: itemTotal,
          couponDiscount: 0,
          finalPrice: itemTotal,
          couponProportion: 0
        };
      });
    }

    tax = (subtotal - couponDiscount) * 0.08;
    totalAmount = subtotal - couponDiscount + tax;
    cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    // Check if user has any addresses
    if (addresses.length === 0) {
      req.session.errorMessage = "Please add a delivery address before proceeding to checkout.";
      return res.redirect("/address");
    }

    // Get available coupons for the user
    const availableCoupons = await getAvailableCouponsForUser(userId, subtotal);

    res.render("checkout", {
      cartItems,
      subtotal,
      tax,
      totalAmount,
      cartCount,
      addresses,
      offerDiscount,
      couponDiscount,
      appliedCoupon,
      availableCoupons: availableCoupons || [],  // Ensure availableCoupons is always an array
      itemDetails,
      user: userId ? { id: userId } : null,
      isAuthenticated: true,
      currentStep: req.query.step ? parseInt(req.query.step) : 1,
      selectedAddressId: req.query.address || "",
      paymentMethod: req.query.paymentMethod || "",
      shippingCost: 0,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      errorMessage: req.session.errorMessage,
      successMessage: req.session.successMessage
    });

    // Clear messages after rendering
    delete req.session.errorMessage;
    delete req.session.successMessage;

  } catch (error) {
    console.error("Error in rendering checkout page:", error);
    req.session.errorMessage = "Something went wrong. Please try again.";
    return res.redirect("/cart");
  }
};

// Helper function to get available coupons for a user
async function getAvailableCouponsForUser(userId, orderAmount) {
  try {
    console.log('Fetching coupons for:', { 
      userId, 
      orderAmount
    });

    // Get all active coupons
    const allCoupons = await Coupon.find({
      isActive: true,
      minOrderAmount: { $lte: orderAmount }
    }).lean();

    console.log('All active coupons found:', allCoupons.length);
    
    // Filter based on usage limits
    const availableCoupons = allCoupons
      .filter((coupon) => {
        // Check global usage limit
        if (coupon.usageLimitGlobal && coupon.usedCount >= coupon.usageLimitGlobal) {
          console.log(`Coupon ${coupon.code} excluded: Global limit reached (${coupon.usedCount}/${coupon.usageLimitGlobal})`);
          return false;
        }

        // Check per-user usage limit
        const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString());
        if (userUsage && userUsage.count >= coupon.usageLimitPerUser) {
          console.log(`Coupon ${coupon.code} excluded: User limit reached (${userUsage.count}/${coupon.usageLimitPerUser})`);
          return false;
        }

        return true;
      })
      .map((coupon) => ({
        _id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountValue: coupon.maxDiscountValue,
        minOrderAmount: coupon.minOrderAmount,
        discountDisplay: coupon.discountType === "percentage" 
          ? `${coupon.discountValue}% OFF${coupon.maxDiscountValue ? ` (up to ₹${coupon.maxDiscountValue})` : ''}`
          : `₹${coupon.discountValue} OFF`,
        validUntil: new Date(coupon.expiryDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }));

    console.log('Final available coupons:', availableCoupons.map(c => ({
      code: c.code,
      discount: c.discountDisplay,
      minOrder: c.minOrderAmount
    })));
    
    return availableCoupons;
  } catch (error) {
    console.error("Error fetching available coupons:", error);
    return [];
  }
}

// Apply coupon to cart
const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const userId = req.session.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to apply a coupon" });
    }

    // Find the coupon
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({ success: false, message: "This coupon is inactive" });
    }

    // Check expiry
    const now = new Date();
    if (now < coupon.startDate || now > coupon.expiryDate) {
      return res.status(400).json({ success: false, message: "This coupon has expired or is not yet active" });
    }

    // Get cart total to check minimum order amount
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    // Calculate cart subtotal after offers
    const cartItems = cart.items.filter((item) => item.product && item.product.isListed && !item.product.isDeleted);

    // Process each item for offers first
    for (const item of cartItems) {
      const offer = await getActiveOfferForProduct(item.product._id, item.product.category);

      if (offer) {
        const { finalPrice } = calculateDiscount(offer, item.priceAtAddition);
        item.discountedPrice = finalPrice;
      } else {
        item.discountedPrice = item.priceAtAddition;
      }
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.discountedPrice, 0);

    // Check minimum order amount
    if (subtotal < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`,
      });
    }

    // Check global usage limit
    if (coupon.usageLimitGlobal && coupon.usedCount >= coupon.usageLimitGlobal) {
      return res.status(400).json({ success: false, message: "This coupon has reached its usage limit" });
    }

    // Check per-user usage limit
    const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString());
    if (userUsage && userUsage.count >= coupon.usageLimitPerUser) {
      return res.status(400).json({ 
        success: false, 
        message: "You have already used this coupon the maximum number of times" 
      });
    }

    // Calculate proportional coupon discount
    const couponResult = calculateProportionalCouponDiscount(coupon, cartItems);
    const discount = couponResult.totalDiscount;

    // Store coupon in session
    req.session.appliedCoupon = coupon._id;

    // Calculate item-level details
    const itemDetails = {};
    cartItems.forEach(item => {
      const itemCouponInfo = couponResult.itemDiscounts[item.product._id.toString()];
      const details = getItemPriceDetails(item, itemCouponInfo);
      itemDetails[item.product._id.toString()] = details;
    });

    // Calculate final totals
    const tax = (subtotal - discount) * 0.08;
    const total = subtotal - discount + tax;

    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      discount,
      itemDetails,
      tax,
      total,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Remove applied coupon
const removeCoupon = async (req, res) => {
  try {
    // Remove coupon from session
    delete req.session.appliedCoupon;

    res.status(200).json({
      success: true,
      message: "Coupon removed successfully",
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Add new address
const addAddress = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to add an address" });
    }

    const { fullName, phone, pincode, district, state, street, landmark, isDefault } = req.body;

    // Validate inputs
    if (!fullName || !phone || !pincode || !district || !state || !street) {
      return res.status(400).json({ success: false, message: "All required fields must be filled" });
    }

    // Create new address
    const newAddress = new Address({
      userId,
      fullName,
      phone,
      pincode,
      district,
      state,
      street,
      landmark,
      isDefault: isDefault || false,
    });

    // If this is set as default, unset any existing default
    if (isDefault) {
      await Address.updateMany({ userId }, { $set: { isDefault: false } });
    }

    await newAddress.save();

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      address: newAddress,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Create Razorpay order
const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to place an order" });
    }

    const { addressId } = req.body;

    // Validate inputs
    if (!addressId) {
      return res.status(400).json({ success: false, message: "Address is required" });
    }

    // Fetch address
    const address = await Address.findById(addressId);
    if (!address || address.userId.toString() !== userId.toString()) {
      return res.status(400).json({ success: false, message: "Invalid or unauthorized address" });
    }

    // Fetch cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Filter valid cart items
    const cartItems = cart.items.filter((item) => item.product && item.product.isListed && !item.product.isDeleted);

    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: "No valid items in cart" });
    }

    // Generate order number once and use it consistently
    const orderNumber = generateOrderNumber();
    
    // Initialize arrays and variables for calculations
    const orderItems = [];
    let originalSubtotal = 0;
    let subtotalAfterOffers = 0;
    let totalOfferDiscount = 0;

    // Process each item for offers first
    for (const item of cartItems) {
      const originalItemTotal = item.priceAtAddition * item.quantity;
      originalSubtotal += originalItemTotal;

      // Get active offer for this product
      const offer = await getActiveOfferForProduct(
        item.product._id, 
        item.product.category,
        item.priceAtAddition
      );

      if (offer) {
        // Calculate discount
        const { discountAmount, finalPrice } = calculateDiscount(offer, item.priceAtAddition);
        const itemDiscount = discountAmount * item.quantity;
        const itemTotalAfterOffer = finalPrice * item.quantity;
        
        totalOfferDiscount += itemDiscount;
        subtotalAfterOffers += itemTotalAfterOffer;

        const orderItem = {
          product: item.product._id,
          title: item.product.title,
          image: item.product.mainImage,
          price: item.priceAtAddition,
          discountedPrice: finalPrice,
          quantity: item.quantity,
          offerDiscount: itemDiscount,
          offerTitle: offer.title,
          priceBreakdown: {
            originalPrice: item.priceAtAddition,
            subtotal: originalItemTotal,
            offerDiscount: itemDiscount,
            offerTitle: offer.title,
            priceAfterOffer: itemTotalAfterOffer,
            couponDiscount: 0, // Will be updated if coupon is applied
            couponProportion: 0, // Will be updated if coupon is applied
            finalPrice: itemTotalAfterOffer // Will be updated if coupon is applied
          }
        };

        orderItems.push(orderItem);
      } else {
        subtotalAfterOffers += originalItemTotal;
        const orderItem = {
          product: item.product._id,
          title: item.product.title,
          image: item.product.mainImage,
          price: item.priceAtAddition,
          discountedPrice: item.priceAtAddition,
          quantity: item.quantity,
          offerDiscount: 0,
          offerTitle: null,
          priceBreakdown: {
            originalPrice: item.priceAtAddition,
            subtotal: originalItemTotal,
            offerDiscount: 0,
            offerTitle: null,
            priceAfterOffer: originalItemTotal,
            couponDiscount: 0,
            couponProportion: 0,
            finalPrice: originalItemTotal
          }
        };

        orderItems.push(orderItem);
      }
    }

    // Calculate final amounts exactly as shown in checkout page
    const checkoutSubtotal = originalSubtotal;
    const checkoutOfferDiscount = totalOfferDiscount;
    
    // Check for applied coupon
    let couponDiscount = 0;
    let appliedCouponCode = null;
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findById(req.session.appliedCoupon);
      if (coupon && coupon.isActive && new Date() <= coupon.expiryDate) {
        // Calculate coupon discount on amount after offer discount
        const amountAfterOffers = subtotalAfterOffers;
        if (amountAfterOffers >= coupon.minOrderAmount) {
          // Calculate coupon discount
          const couponResult = calculateProportionalCouponDiscount(coupon, orderItems);
          couponDiscount = couponResult.totalDiscount;
          appliedCouponCode = coupon.code;

          // Update order items with coupon discounts
          orderItems.forEach(item => {
            const itemCouponInfo = couponResult.itemDiscounts[item.product.toString()];
            if (itemCouponInfo) {
              item.couponDiscount = itemCouponInfo.amount;
              item.couponProportion = itemCouponInfo.proportion;
              
              // Update priceBreakdown with coupon info
              item.priceBreakdown.couponDiscount = itemCouponInfo.amount;
              item.priceBreakdown.couponProportion = itemCouponInfo.proportion;
              item.priceBreakdown.finalPrice = item.priceBreakdown.priceAfterOffer - itemCouponInfo.amount;
              
              // Recalculate final price using the helper
              const finalPriceDetails = calculateFinalItemPrice(item, { couponDiscount });
              item.finalPrice = finalPriceDetails.finalPrice / item.quantity;
            }
          });
        }
      }
    }

    // Calculate tax on amount after both offer and coupon discounts
    const amountAfterAllDiscounts = subtotalAfterOffers - couponDiscount;
    const checkoutTax = Math.round(amountAfterAllDiscounts * 0.08 * 100) / 100;
    const checkoutTotal = Math.round((amountAfterAllDiscounts + checkoutTax) * 100) / 100;

    // Log detailed calculations for verification
    console.log('Detailed Payment Calculations:', {
      originalSubtotal: checkoutSubtotal,
      offerDiscount: checkoutOfferDiscount,
      amountAfterOffers: subtotalAfterOffers,
      couponDiscount,
      amountAfterAllDiscounts,
      tax: checkoutTax,
      finalTotal: checkoutTotal,
      orderItems: orderItems.map(item => ({
        title: item.title,
        originalPrice: item.price,
        discountedPrice: item.discountedPrice,
        quantity: item.quantity,
        offerDiscount: item.offerDiscount,
        couponDiscount: item.couponDiscount || 0,
        finalPrice: item.finalPrice
      }))
    });

    // Ensure exact amount by using string operations to avoid floating point issues
    const finalAmount = (checkoutTotal * 100).toFixed(0);

    // Create the display breakdown
    const displayBreakdown = [
      `Subtotal: ₹${checkoutSubtotal.toFixed(2)}`,
      `Offer Discount: -₹${checkoutOfferDiscount.toFixed(2)}`,
      appliedCouponCode ? `Coupon (${appliedCouponCode}): -₹${couponDiscount.toFixed(2)}` : null,
      `Tax (8%): ₹${checkoutTax.toFixed(2)}`,
      `Final Amount: ₹${(parseInt(finalAmount) / 100).toFixed(2)}`
    ].filter(Boolean).join('\n');

    // Store order details in session for later use
    req.session.pendingOrder = {
      orderNumber: orderNumber,
      addressId,
      orderItems,
      subtotal: checkoutSubtotal,
      tax: checkoutTax,
      offerDiscount: checkoutOfferDiscount,
      couponDiscount,
      couponCode: appliedCouponCode,
      total: checkoutTotal,
      paymentMethod: "Razorpay"
    };

    // Create Razorpay order with exact amount
    const razorpayOrder = await razorpay.orders.create({
      amount: parseInt(finalAmount),  // Use the exact amount in paise
      currency: "INR",
      receipt: orderNumber,
      payment_capture: 1,
      notes: {
        subtotal: checkoutSubtotal.toFixed(2),
        offerDiscount: checkoutOfferDiscount.toFixed(2),
        tax: checkoutTax.toFixed(2),
        total: (parseInt(finalAmount) / 100).toFixed(2)
      }
    });

    // Prepare response with exact amounts
    res.status(200).json({
      success: true,
      order: razorpayOrder,
      key: process.env.RAZORPAY_KEY_ID,
      amount: parseInt(finalAmount),  // Use the exact amount in paise
      currency: "INR",
      name: "Chapterless",
      description: `Order Total: ₹${(parseInt(finalAmount) / 100).toFixed(2)}`,
      prefill: {
        name: address.fullName,
        contact: address.phone,
      },
      theme: {
        color: '#198754'
      },
      notes: {
        orderNumber: orderNumber,
        breakdown: displayBreakdown
      }
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Verify Razorpay payment
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    
    const isAuthentic = expectedSignature === razorpay_signature;
    
    if (!isAuthentic) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
    
    // Get pending order from session
    const pendingOrder = req.session.pendingOrder;
    if (!pendingOrder) {
      return res.status(400).json({ success: false, message: "No pending order found" });
    }
    
    const userId = req.session.user_id;
    
    // Validate stock for all products before making any changes
    const stockUpdates = [];
    for (const item of pendingOrder.orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product ${item.title} not found`);
      }

      const newStock = product.stock - item.quantity;
      if (newStock < 0) {
        throw new Error(`Insufficient stock for ${item.title}. Only ${product.stock} items available.`);
      }

      stockUpdates.push({ productId: item.product, originalStock: product.stock, newStock });
    }

    // Update stock for all products
    for (const update of stockUpdates) {
      await Product.findByIdAndUpdate(update.productId, { stock: update.newStock }, { new: true });
    }
    
    // Fetch address
    const address = await Address.findById(pendingOrder.addressId);
    
    // Add priceBreakdown to each order item
    const orderItems = pendingOrder.orderItems.map(item => ({
      ...item,
      priceBreakdown: {
        originalPrice: item.price,
        subtotal: item.price * item.quantity,
        offerDiscount: item.offerDiscount || 0,
        offerTitle: item.offerTitle,
        priceAfterOffer: item.discountedPrice * item.quantity,
        couponDiscount: item.couponDiscount || 0,
        couponProportion: item.couponProportion || 0,
        finalPrice: (item.discountedPrice * item.quantity) - (item.couponDiscount || 0)
      },
      status: "Active"
    }));

    // Create order
    const order = new Order({
      user: userId,
      orderNumber: pendingOrder.orderNumber,
      items: orderItems,
      shippingAddress: {
        userId: address.userId,
        fullName: address.fullName,
        phone: address.phone,
        pincode: address.pincode,
        district: address.district,
        state: address.state,
        street: address.street,
        landmark: address.landmark,
        isDefault: address.isDefault,
      },
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      orderStatus: "Placed",
      subtotal: pendingOrder.subtotal,
      shipping: 0,
      tax: pendingOrder.tax,
      discount: pendingOrder.offerDiscount,
      couponCode: pendingOrder.couponCode,
      couponDiscount: pendingOrder.couponDiscount,
      total: pendingOrder.total,
      createdAt: new Date(),
      updatedAt: new Date(),
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    });

    await order.save();
    
    // Update coupon usage if applicable
    if (pendingOrder.couponCode) {
      const coupon = await Coupon.findOne({ code: pendingOrder.couponCode });
      if (coupon) {
        coupon.usedCount += 1;
        
        // Check if user has used this coupon before
        const userUsageIndex = coupon.usedBy.findIndex((usage) => usage.userId.toString() === userId.toString());
        
        if (userUsageIndex >= 0) {
          coupon.usedBy[userUsageIndex].count += 1;
          coupon.usedBy[userUsageIndex].usedAt = new Date();
        } else {
          coupon.usedBy.push({
            userId,
            usedAt: new Date(),
            count: 1,
          });
        }
        
        await coupon.save();
      }
    }
    
    // Clear cart
    await Cart.findOneAndUpdate({ user: userId }, { items: [] });
    
    // Clear pending order from session
    delete req.session.pendingOrder;
    delete req.session.appliedCoupon;
    
    res.status(200).json({
      success: true,
      message: "Payment successful",
      orderId: order._id,
      orderNumber: order.orderNumber
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Handle payment failure
const handlePaymentFailure = async (req, res) => {
  try {
    // Clear pending order from session
    delete req.session.pendingOrder;
    
    res.status(200).json({
      success: false,
      message: "Payment failed"
    });
  } catch (error) {
    console.error("Error handling payment failure:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      throw new Error("Please log in to place an order");
    }

    const { addressId, paymentMethod } = req.body;

    // Validate inputs
    if (!addressId || !paymentMethod) {
      throw new Error("Address and payment method are required");
    }

    if (paymentMethod !== "COD") {
      throw new Error("Only COD is supported at this time");
    }

    // Fetch address
    const address = await Address.findById(addressId);
    if (!address || address.userId.toString() !== userId.toString()) {
      throw new Error("Invalid or unauthorized address");
    }

    // Fetch cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items.length) {
      throw new Error("Cart is empty");
    }

    // Filter valid cart items
    const cartItems = cart.items.filter((item) => item.product && item.product.isListed && !item.product.isDeleted);

    if (!cartItems.length) {
      throw new Error("No valid items in cart");
    }

    // Process each item for offers
    let subtotal = 0;
    let offerDiscount = 0;
    let couponDiscount = 0;
    let appliedCoupon = null;

    // Prepare order items with offer discounts
    const orderItems = [];
    const itemDetails = {};

    for (const item of cartItems) {
      // Get active offer for this product
      const offer = await getActiveOfferForProduct(item.product._id, item.product.category);
      let itemPrice = item.priceAtAddition;
      let itemDiscount = 0;
      let offerTitle = null;

      if (offer) {
        // Calculate discount
        const { discountAmount, finalPrice } = calculateDiscount(offer, item.priceAtAddition);
        itemPrice = finalPrice;
        itemDiscount = discountAmount * item.quantity;
        offerTitle = offer.title;
        offerDiscount += itemDiscount;
      }

      const orderItem = {
        product: item.product._id,
        title: item.product.title,
        image: item.product.mainImage,
        price: item.priceAtAddition,
        discountedPrice: itemPrice,
        quantity: item.quantity,
        offerDiscount: itemDiscount,
        offerTitle: offerTitle,
        priceBreakdown: {
          originalPrice: item.priceAtAddition,
          subtotal: item.priceAtAddition * item.quantity,
          offerDiscount: itemDiscount,
          offerTitle: offerTitle,
          priceAfterOffer: itemPrice * item.quantity,
          couponDiscount: 0, // Will be updated if coupon is applied
          couponProportion: 0, // Will be updated if coupon is applied
          finalPrice: itemPrice * item.quantity // Will be updated if coupon is applied
        }
      };

      orderItems.push(orderItem);
      subtotal += itemPrice * item.quantity;
    }

    // Check for applied coupon
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findById(req.session.appliedCoupon);
      if (coupon && coupon.isActive && new Date() <= coupon.expiryDate) {
        // Verify minimum order amount
        if (subtotal >= coupon.minOrderAmount) {
          appliedCoupon = coupon;

          // Calculate proportional coupon discount
          const couponResult = calculateProportionalCouponDiscount(coupon, orderItems);
          couponDiscount = couponResult.totalDiscount;

          // Update order items with coupon discounts
          orderItems.forEach(item => {
            const itemCouponInfo = couponResult.itemDiscounts[item.product.toString()];
            if (itemCouponInfo) {
              item.couponDiscount = itemCouponInfo.amount;
              item.couponProportion = itemCouponInfo.proportion;
              
              // Update priceBreakdown with coupon info
              item.priceBreakdown.couponDiscount = itemCouponInfo.amount;
              item.priceBreakdown.couponProportion = itemCouponInfo.proportion;
              item.priceBreakdown.finalPrice = item.priceBreakdown.priceAfterOffer - itemCouponInfo.amount;
              
              // Recalculate final price using the helper
              const finalPriceDetails = calculateFinalItemPrice(item, { couponDiscount });
              item.finalPrice = finalPriceDetails.finalPrice / item.quantity;
            }
          });

          // Update coupon usage
          coupon.usedCount += 1;
          const userUsageIndex = coupon.usedBy.findIndex((usage) => usage.userId.toString() === userId.toString());
          if (userUsageIndex >= 0) {
            coupon.usedBy[userUsageIndex].count += 1;
            coupon.usedBy[userUsageIndex].usedAt = new Date();
          } else {
            coupon.usedBy.push({
              userId,
              usedAt: new Date(),
              count: 1,
            });
          }
          await coupon.save();
        }
      }
      // Clear applied coupon from session
      delete req.session.appliedCoupon;
    }

    const tax = (subtotal - couponDiscount) * 0.08;
    const total = subtotal - couponDiscount + tax;

    // Step 1: Validate stock for all products before making any changes
    const stockUpdates = [];
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product ${item.title} not found`);
      }

      const newStock = product.stock - item.quantity;
      if (newStock < 0) {
        throw new Error(`Insufficient stock for ${item.title}. Only ${product.stock} items available.`);
      }

      stockUpdates.push({ productId: item.product, originalStock: product.stock, newStock });
    }

    // Step 2: Update stock for all products
    for (const update of stockUpdates) {
      await Product.findByIdAndUpdate(update.productId, { stock: update.newStock }, { new: true });
    }

    // Step 3: Create order
    const order = new Order({
      user: userId,
      orderNumber: generateOrderNumber(),
      items: orderItems,
      shippingAddress: {
        userId: address.userId,
        fullName: address.fullName,
        phone: address.phone,
        pincode: address.pincode,
        district: address.district,
        state: address.state,
        street: address.street,
        landmark: address.landmark,
        isDefault: address.isDefault,
      },
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Placed",
      subtotal,
      shipping: 0,
      tax,
      discount: offerDiscount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      couponDiscount,
      total,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await order.save();

    // Step 4: Clear cart
    await Cart.findOneAndUpdate({ user: userId }, { items: [] });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.log("Error placing order:", error.message);

    // Step 5: Rollback stock updates if an error occurs after stock changes
    if (error.stockUpdates) {
      for (const update of error.stockUpdates) {
        await Product.findByIdAndUpdate(update.productId, { stock: update.originalStock }, { new: true });
      }
    }

    res.status(error.message.includes("Insufficient stock") ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to place order",
    });
  }
};

module.exports = { 
  getCheckout, 
  placeOrder, 
  applyCoupon, 
  removeCoupon, 
  addAddress,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handlePaymentFailure
};