const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");

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

module.exports = { getCheckout };