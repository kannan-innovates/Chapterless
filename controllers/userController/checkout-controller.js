const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const { getActiveOfferForProduct, calculateDiscount } = require("../../utils/offer-helper");

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
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });

    let cartItems = [];
    let subtotal = 0;
    let tax = 0;
    let totalAmount = 0;
    let cartCount = 0;
    let offerDiscount = 0;
    let couponDiscount = 0;
    let appliedCoupon = null;

    if (cart && cart.items.length > 0) {
      // Filter valid items
      cartItems = cart.items.filter((item) => item.product && item.product.isListed && !item.product.isDeleted);

      if (cartItems.length !== cart.items.length) {
        cart.items = cartItems;
        await cart.save();
      }

      // Process each item for offers
      for (const item of cartItems) {
        // Get active offer for this product
        const offer = await getActiveOfferForProduct(item.product._id, item.product.category);

        if (offer) {
          // Calculate discount
          const { discountAmount, finalPrice } = calculateDiscount(offer, item.priceAtAddition);

          // Store original and discounted prices
          item.originalPrice = item.priceAtAddition;
          item.discountedPrice = finalPrice;
          item.offerDiscount = discountAmount * item.quantity;
          item.offerTitle = offer.title;

          // Add to total offer discount
          offerDiscount += discountAmount * item.quantity;
        } else {
          item.originalPrice = item.priceAtAddition;
          item.discountedPrice = item.priceAtAddition;
          item.offerDiscount = 0;
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

            // Calculate coupon discount
            if (coupon.discountType === "percentage") {
              couponDiscount = (subtotal * coupon.discountValue) / 100;
              if (coupon.maxDiscountValue && couponDiscount > coupon.maxDiscountValue) {
                couponDiscount = coupon.maxDiscountValue;
              }
            } else {
              couponDiscount = coupon.discountValue;
            }

            // Ensure discount doesn't exceed subtotal
            couponDiscount = Math.min(couponDiscount, subtotal);
          } else {
            // Remove coupon if minimum order amount not met
            delete req.session.appliedCoupon;
          }
        } else {
          // Remove invalid coupon
          delete req.session.appliedCoupon;
        }
      }

      tax = (subtotal - couponDiscount) * 0.08;
      totalAmount = subtotal - couponDiscount + tax;
      cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
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
      availableCoupons,
      user: userId ? { id: userId } : null,
      isAuthenticated: true,
      currentStep: req.query.step ? parseInt(req.query.step) : 1,
      selectedAddressId: req.query.address || "",
      paymentMethod: req.query.paymentMethod || "",
      shippingCost: 0,
    });
  } catch (error) {
    console.log("Error in rendering checkout page:", error);
    res.status(500).render("error", { message: "Internal server error" });
  }
};

// Helper function to get available coupons for a user
async function getAvailableCouponsForUser(userId, orderAmount) {
  try {
    const currentDate = new Date();

    // Get all active coupons
    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: currentDate },
      expiryDate: { $gte: currentDate },
      minOrderAmount: { $lte: orderAmount },
    }).lean();

    // Filter based on usage limits
    return coupons
      .filter((coupon) => {
        // Check global usage limit
        if (coupon.usageLimitGlobal && coupon.usedCount >= coupon.usageLimitGlobal) {
          return false;
        }

        // Check per-user usage limit
        const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString());
        if (userUsage && userUsage.count >= coupon.usageLimitPerUser) {
          return false;
        }

        return true;
      })
      .map((coupon) => {
        // Format coupon for display
        return {
          _id: coupon._id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          maxDiscountValue: coupon.maxDiscountValue,
          minOrderAmount: coupon.minOrderAmount,
          discountDisplay:
            coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`,
        };
      });
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

    let subtotal = 0;

    // Process each item for offers
    for (const item of cartItems) {
      const offer = await getActiveOfferForProduct(item.product._id, item.product.category);

      if (offer) {
        const { finalPrice } = calculateDiscount(offer, item.priceAtAddition);
        subtotal += item.quantity * finalPrice;
      } else {
        subtotal += item.quantity * item.priceAtAddition;
      }
    }

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
      return res
        .status(400)
        .json({ success: false, message: "You have already used this coupon the maximum number of times" });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
        discount = coupon.maxDiscountValue;
      }
    } else {
      discount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed subtotal
    discount = Math.min(discount, subtotal);

    // Store coupon in session
    req.session.appliedCoupon = coupon._id;

    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      discount,
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

      subtotal += item.quantity * itemPrice;

      orderItems.push({
        product: item.product._id,
        title: item.product.title,
        image: item.product.mainImage,
        price: item.priceAtAddition,
        discountedPrice: itemPrice,
        quantity: item.quantity,
        offerDiscount: itemDiscount,
        offerTitle: offerTitle,
      });
    }

    // Check for applied coupon
    if (req.session.appliedCoupon) {
      const coupon = await Coupon.findById(req.session.appliedCoupon);
      if (coupon && coupon.isActive && new Date() <= coupon.expiryDate) {
        // Verify minimum order amount
        if (subtotal >= coupon.minOrderAmount) {
          appliedCoupon = coupon;

          // Calculate coupon discount
          if (coupon.discountType === "percentage") {
            couponDiscount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountValue && couponDiscount > coupon.maxDiscountValue) {
              couponDiscount = coupon.maxDiscountValue;
            }
          } else {
            couponDiscount = coupon.discountValue;
          }

          // Ensure discount doesn't exceed subtotal
          couponDiscount = Math.min(couponDiscount, subtotal);

          // Update coupon usage
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

module.exports = { getCheckout, placeOrder, applyCoupon, removeCoupon, addAddress };