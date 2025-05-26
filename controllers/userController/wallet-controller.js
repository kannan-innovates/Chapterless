const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const { calculateDiscount } = require("../../utils/offer-helper");

const getWallet = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect('/login');
    }

    // Get wallet with transactions
    const wallet = await Wallet.findOne({ userId }).sort({ 'transactions.date': -1 });
    
    // Format transactions for display
    const formattedWallet = {
      balance: wallet ? wallet.balance : 0,
      transactions: wallet ? wallet.transactions.map(transaction => ({
        type: transaction.type,
        amount: transaction.amount.toFixed(2),
        reason: transaction.reason,
        date: new Date(transaction.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        orderId: transaction.orderId
      })) : []
    };
    
    res.render('wallet', {
      wallet: formattedWallet
    });
  } catch (error) {
    console.error('Error in getWallet:', error);
    res.status(500).render('error', { message: 'Internal server error' });
  }
};

// Helper function to safely perform calculations avoiding NaN
const safeCalculation = (value) => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

// Helper function to calculate refund amount for a single item
const calculateItemRefundAmount = (item, order) => {
  try {
    if (!item) {
      console.log('No item provided for refund calculation');
      return 0;
    }

    console.log('Calculating refund for item:', {
      itemId: item._id,
      title: item.title,
      priceBreakdown: item.priceBreakdown,
      price: item.price,
      discountedPrice: item.discountedPrice,
      quantity: item.quantity
    });

    const quantity = Number(item.quantity || 1);

    // Case 1: Use priceBreakdown if available
    if (item.priceBreakdown) {
      // Get the final price after all discounts
      const finalPricePerUnit = Number(item.priceBreakdown.finalPrice || 0);
      const baseAmount = finalPricePerUnit * quantity;
      
      // Calculate tax proportion for this item
      let taxAmount = 0;
      if (order.tax && order.totalAmount) {
        // Calculate tax rate based on total order
        const taxRate = order.tax / (order.totalAmount - order.tax);
        taxAmount = baseAmount * taxRate;
      }

      const totalRefund = baseAmount + taxAmount;

      console.log('Calculated refund from priceBreakdown:', {
        finalPricePerUnit,
        quantity,
        baseAmount,
        taxAmount,
        totalRefund
      });

      return Number(totalRefund.toFixed(2));
    }
    
    // Case 2: Use discountedPrice as fallback
    else if (typeof item.discountedPrice === 'number') {
      const baseAmount = item.discountedPrice * quantity;
      let taxAmount = 0;
      
      if (order.tax && order.totalAmount) {
        const taxRate = order.tax / (order.totalAmount - order.tax);
        taxAmount = baseAmount * taxRate;
      }
      
      const totalRefund = baseAmount + taxAmount;

      console.log('Using discountedPrice for refund:', {
        discountedPrice: item.discountedPrice,
        quantity,
        baseAmount,
        taxAmount,
        totalRefund
      });

      return Number(totalRefund.toFixed(2));
    }
    
    // Case 3: Use original price as last resort
    else if (typeof item.price === 'number') {
      const baseAmount = item.price * quantity;
      let taxAmount = 0;
      
      if (order.tax && order.totalAmount) {
        const taxRate = order.tax / (order.totalAmount - order.tax);
        taxAmount = baseAmount * taxRate;
      }
      
      const totalRefund = baseAmount + taxAmount;

      console.log('Using original price for refund:', {
        price: item.price,
        quantity,
        baseAmount,
        taxAmount,
        totalRefund
      });

      return Number(totalRefund.toFixed(2));
    }

    console.log('No valid price found for refund calculation');
    return 0;
  } catch (error) {
    console.error('Error in calculateItemRefundAmount:', error);
    return 0;
  }
};

// Process refund for cancelled orders/items
const processCancelRefund = async (userId, order, itemId = null) => {
  try {
    console.log('Starting cancel refund process:', {
      userId,
      orderId: order._id,
      itemId,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      tax: order.tax
    });

    if (!userId || !order) {
      console.error('Missing required parameters in processCancelRefund');
      return false;
    }

    // Get existing wallet to check for previous refunds
    const existingWallet = await Wallet.findOne({ userId });
    const previouslyRefundedItems = new Set();
    
    if (existingWallet && existingWallet.transactions) {
      existingWallet.transactions.forEach(txn => {
        if (txn.orderId.toString() === order._id.toString() && txn.refundedItems) {
          txn.refundedItems.forEach(refItemId => previouslyRefundedItems.add(refItemId.toString()));
        }
      });
    }

    let refundAmount = 0;
    let refundReason = '';
    let refundedItemsForThisTransaction = [];

    if (itemId) {
      // Single item cancellation
      const item = order.items.find(i => i._id.toString() === itemId.toString());
      if (!item) {
        console.error(`Item ${itemId} not found in order ${order._id}`);
        return false;
      }

      // Check if item was already refunded
      if (previouslyRefundedItems.has(item.product.toString())) {
        console.warn(`Item ${item.title} already refunded for order ${order._id}`);
        return true;
      }

      refundAmount = calculateItemRefundAmount(item, order);
      refundReason = `Refund for cancelled item: ${item.title} from order #${order.orderNumber}`;
      refundedItemsForThisTransaction = [item.product];
    } else {
      // Full/partial order cancellation
      const cancelledItems = order.items.filter(item => 
        item.status === 'Cancelled' && !previouslyRefundedItems.has(item.product.toString())
      );

      if (cancelledItems.length === 0) {
        console.warn(`No new items to refund in order ${order._id}`);
        return true;
      }

      refundAmount = cancelledItems.reduce((total, item) => {
        return total + calculateItemRefundAmount(item, order);
      }, 0);

      refundReason = cancelledItems.length === 1
        ? `Refund for cancelled item: ${cancelledItems[0].title} from order #${order.orderNumber}`
        : `Refund for cancelled items in order #${order.orderNumber}`;

      refundedItemsForThisTransaction = cancelledItems.map(item => item.product);
    }

    // Process wallet update if there's an amount to refund
    if (refundAmount > 0) {
      let wallet = existingWallet || new Wallet({ userId, balance: 0, transactions: [] });
      
      console.log('Processing refund:', {
        currentBalance: wallet.balance,
        refundAmount,
        reason: refundReason,
        items: refundedItemsForThisTransaction
      });

      // Ensure refundAmount is a valid number
      refundAmount = Number(refundAmount.toFixed(2));
      
      if (isNaN(refundAmount)) {
        console.error('Invalid refund amount calculated');
        return false;
      }

      wallet.balance = Number(wallet.balance) + refundAmount;
      
      wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        orderId: order._id,
        reason: refundReason,
        refundedItems: refundedItemsForThisTransaction,
        date: new Date()
      });

      await wallet.save();
      console.log('Refund processed successfully:', {
        newBalance: wallet.balance,
        refundAmount
      });
      return true;
    }

    return refundedItemsForThisTransaction.length === 0;
  } catch (error) {
    console.error('Error processing cancel refund:', error);
    return false;
  }
};

// Process refund for returned orders/items
const processReturnRefund = async (userId, order, itemId = null) => {
  try {
    console.log('Starting return refund process:', {
      userId,
      orderId: order._id,
      itemId,
      orderStatus: order.orderStatus
    });

    if (!userId || !order) {
      console.error('Missing required parameters in processReturnRefund');
      return false;
    }

    let refundAmount = 0;
    let refundReason = '';
    let refundedItemsForThisTransaction = [];

    // Get existing wallet to check for previous refunds
    const existingWallet = await Wallet.findOne({ userId });
    const previouslyRefundedItems = new Set();
    if (existingWallet && existingWallet.transactions) {
      existingWallet.transactions.forEach(txn => {
        if (txn.orderId.toString() === order._id.toString() && txn.refundedItems) {
          txn.refundedItems.forEach(refItemId => previouslyRefundedItems.add(refItemId.toString()));
        }
      });
    }

    if (itemId) {
      // Single item return
      const item = order.items.find(i => i._id.toString() === itemId.toString());
      if (!item) {
        console.error(`Item ${itemId} not found in order ${order._id}`);
        return false;
      }
      // Check if item was already refunded
      if (previouslyRefundedItems.has(item.product.toString())) {
        console.warn(`Item ${item.title} already refunded for order ${order._id}`);
        return true;
      }
      // Only refund if item.status is 'Returned'
      if (item.status !== 'Returned') {
        console.warn(`Item ${item.title} is not marked as Returned`);
        return false;
      }
      refundAmount = calculateItemRefundAmount(item, order);
      refundReason = `Refund for returned item: ${item.title} from order #${order.orderNumber}`;
      refundedItemsForThisTransaction = [item.product];
    } else {
      // Full/partial order return
      const returnedItems = order.items.filter(item =>
        item.status === 'Returned' && !previouslyRefundedItems.has(item.product.toString())
      );
      if (returnedItems.length === 0) {
        console.warn(`No new items to refund in order ${order._id}`);
        return true;
      }
      refundAmount = returnedItems.reduce((total, item) => {
        return total + calculateItemRefundAmount(item, order);
      }, 0);
      refundReason = returnedItems.length === 1
        ? `Refund for returned item: ${returnedItems[0].title} from order #${order.orderNumber}`
        : `Refund for returned items in order #${order.orderNumber}`;
      refundedItemsForThisTransaction = returnedItems.map(item => item.product);
    }

    // Process wallet update if there's an amount to refund
    if (refundAmount > 0) {
      let wallet = existingWallet || new Wallet({ userId, balance: 0, transactions: [] });
      refundAmount = Number(refundAmount.toFixed(2));
      wallet.balance = Number(wallet.balance) + refundAmount;
      wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        orderId: order._id,
        reason: refundReason,
        refundedItems: refundedItemsForThisTransaction,
        date: new Date()
      });
      await wallet.save();
      return true;
    }
    return refundedItemsForThisTransaction.length === 0;
  } catch (error) {
    console.error('Error processing return refund:', error);
    return false;
  }
};

module.exports = {
  getWallet,
  processCancelRefund,
  processReturnRefund
};