const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");

const getCheckout = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }

    const userId = req.session.user_id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product');



    let cartItems = [];
    let subtotal = 0;
    let tax = 0;
    let totalAmount = 0;
    let cartCount = 0;

    if (cart && cart.items.length > 0) {
      // Filter items, relaxing image requirement
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
      tax = subtotal * 0.08; // 8% tax
      totalAmount = subtotal + tax; // Total includes subtotal and tax
      cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    } else {
      console.log('Cart is empty or not found');
    }

    res.render('checkout', {
      cartItems,
      subtotal,
      tax,
      totalAmount,
      cartCount,
      user: userId ? { id: userId } : null,
      isAuthenticated: true
    });

   
  } catch (error) {
    console.log('Error in rendering checkout page:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

module.exports = { getCheckout };