const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");

const getCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.render("cart", { user: null });
    }

    let cart = await Cart.findOne({ user: req.session.user_id }).populate(
      "items.product"
    );
    if (!cart) {
      cart = new Cart({ user: req.session.user_id, items: [], totalAmount: 0 });
      await cart.save();
    }

    res.render("cart", {
      cart: cart.items,
      totalAmount: cart.totalAmount,
      user: req.session.user_id,
    });
  } catch (error) {
    console.log("Error in rendering cart:", error);
    res.status(500).send("Server Error");
  }
};

const addToCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, redirect: "/login" });
    }

    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);
    if (!product || !product.isListed) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (product.stock < quantity) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient stock" });
    }

    let cart = await Cart.findOne({ user: req.session.user_id });
    if (!cart) {
      cart = new Cart({ user: req.session.user_id, items: [], totalAmount: 0 });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );
    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += parseInt(quantity);
    } else {
      cart.items.push({
        product: productId,
        quantity: parseInt(quantity),
        priceAtAddition: product.salePrice,
      });
    }

    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + item.quantity * item.priceAtAddition;
    }, 0);

    await cart.save();

    const count = cart.items.reduce((total, item) => total + item.quantity, 0);
    res.json({ success: true, message: "Added to cart", count });
  } catch (error) {
    console.log("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    if (!req.session.user_id) {
      return res.status(401).json({ success: false, redirect: "/login" });
    }

    const productId = req.body.productId;
    let cart = await Cart.findOne({ user: req.session.user_id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );
    cart.totalAmount = cart.items.reduce((total, item) => {
      return total + item.quantity * item.priceAtAddition;
    }, 0);

    await cart.save();

    const count = cart.items.reduce((total, item) => total + item.quantity, 0);
    res.json({ success: true, message: "Removed from cart", count });
  } catch (error) {
    console.log("Error removing from cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getCart, addToCart, removeFromCart };
