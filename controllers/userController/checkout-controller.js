const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");

// Generate unique order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(1000 + Math.random() * 9000).toString();
  return `ORD-${timestamp}-${random}`;
};

const getCheckout = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, updatedAt: -1 });

    let cartItems = [];
    let subtotal = 0;
    let tax = 0;
    let totalAmount = 0;
    let cartCount = 0;

    if (cart && cart.items.length > 0) {
      cartItems = cart.items.filter(item => 
        item.product && 
        item.product.isListed && 
        !item.product.isDeleted
      );

      if (cartItems.length !== cart.items.length) {
        cart.items = cartItems;
        await cart.save();
      }

      subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);
      tax = subtotal * 0.08;
      totalAmount = subtotal + tax;
      cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    res.render('checkout', {
      cartItems,
      subtotal,
      tax,
      totalAmount,
      cartCount,
      addresses,
      user: userId ? { id: userId } : null,
      isAuthenticated: true
    });
  } catch (error) {
    console.log('Error in rendering checkout page:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to place an order' });
    }

    const { addressId, paymentMethod } = req.body;

    // Validate inputs
    if (!addressId || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Address and payment method are required' });
    }

    if (paymentMethod !== 'COD') {
      return res.status(400).json({ success: false, message: 'Only COD is supported at this time' });
    }

    // Fetch address
    const address = await Address.findById(addressId);
    if (!address || address.userId.toString() !== userId) {
      return res.status(400).json({ success: false, message: 'Invalid or unauthorized address' });
    }

    // Fetch cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Filter valid cart items
    const cartItems = cart.items.filter(item => 
      item.product && 
      item.product.isListed && 
      !item.product.isDeleted
    );

    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: 'No valid items in cart' });
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.priceAtAddition), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    // Prepare order items
    const orderItems = cartItems.map(item => ({
      product: item.product._id,
      title: item.product.title,
      image: item.product.mainImage,
      price: item.priceAtAddition,
      quantity: item.quantity
    }));

    // Create order
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
        isDefault: address.isDefault
      },
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      orderStatus: 'Placed',
      subtotal,
      shipping: 0,
      tax,
      total,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await order.save();

    // Clear cart
    await Cart.findOneAndUpdate({ user: userId }, { items: [] });

    res.status(201).json({ 
      success: true, 
      message: 'Order placed successfully', 
      orderId: order._id,
      orderNumber: order.orderNumber 
    });
  } catch (error) {
    console.log('Error placing order:', error);
    res.status(500).json({ success: false, message: 'Failed to place order' });
  }
};

module.exports = { getCheckout, placeOrder };