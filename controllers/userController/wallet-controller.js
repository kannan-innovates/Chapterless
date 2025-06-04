const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const { calculateDiscount, getUnifiedPriceBreakdown } = require("../../utils/offer-helper");
const { HttpStatus } = require("../../helpers/status-code");

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
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { message: 'Internal server error' });
  }
};

// Helper function to safely perform calculations avoiding NaN
const safeCalculation = (value) => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};

// Helper function to calculate refund amount for a single item using unified pricing
const calculateItemRefundAmount = (item, order) => {
  try {
    if (!item) {
      console.log('No item provided for refund calculation');
      return 0;
    }

    console.log('Calculating refund for item using unified pricing:', {
      itemId: item._id,
      title: item.title,
      price: item.price,
      discountedPrice: item.discountedPrice,
      quantity: item.quantity,
      paymentMethod: order.paymentMethod
    });

    // **FIX: Use unified price calculation for consistency**
    const priceBreakdown = getUnifiedPriceBreakdown(item, order);

    // **CRITICAL FIX: For refunds, use the finalPrice (what customer actually paid) NOT finalTotal (which adds tax)**
    // The finalPrice already includes all discounts and is what's displayed to the customer
    const refundAmount = priceBreakdown.finalPrice;

    console.log('Unified refund calculation:', {
      originalPrice: priceBreakdown.originalPrice,
      discountedPrice: priceBreakdown.discountedPrice,
      offerDiscount: priceBreakdown.offerDiscount,
      couponDiscount: priceBreakdown.couponDiscount,
      finalPrice: priceBreakdown.finalPrice,
      taxAmount: priceBreakdown.taxAmount,
      finalTotal: priceBreakdown.finalTotal,
      refundAmount: refundAmount,
      note: 'Using finalPrice (not finalTotal) for accurate refund'
    });

    return Number(refundAmount.toFixed(2));
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
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      tax: order.tax
    });

    if (!userId || !order) {
      console.error('Missing required parameters in processCancelRefund');
      return false;
    }

    // **FIX: Handle COD cancellations based on delivery status**
    if (order.paymentMethod === 'COD') {
      // For COD cancellations, check if order was delivered (cash was collected)
      const wasDeliveredAndPaid = order.paymentStatus === 'Paid' ||
                                  order.orderStatus === 'Delivered' ||
                                  order.deliveredAt ||
                                  order.items.some(item =>
                                    item.status === 'Delivered' ||
                                    item.status === 'Returned' ||
                                    (item.status === 'Active' && order.orderStatus === 'Delivered')
                                  );

      if (!wasDeliveredAndPaid) {
        console.log('COD order cancellation before delivery - no wallet refund needed (no payment made yet)');
        return true; // Return success but don't process wallet refund
      } else {
        console.log('COD order cancellation after delivery - customer paid cash, wallet refund needed');
        // Continue with refund processing since customer paid cash upon delivery
      }
    }

    // **FIX: Enhanced payment validation for all payment methods including COD post-delivery**
    const isPaymentValid = order.paymentStatus === 'Paid' ||
                          order.paymentStatus === 'Partially Refunded' ||
                          // For COD: if delivered, consider it paid (cash was collected)
                          (order.paymentMethod === 'COD' && (
                            order.paymentStatus === 'Paid' ||
                            order.orderStatus === 'Delivered' ||
                            order.deliveredAt ||
                            order.items.some(item =>
                              item.status === 'Delivered' ||
                              item.status === 'Returned' ||
                              (item.status === 'Active' && order.orderStatus === 'Delivered')
                            )
                          ));

    if (!isPaymentValid) {
      console.log('Order payment status does not allow refunds, skipping refund:', {
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        deliveredAt: order.deliveredAt
      });
      return true; // Return true as this is not an error condition
    }

    // Get existing wallet to check for previous refunds
    const existingWallet = await Wallet.findOne({ userId });
    const previouslyRefundedItems = new Set();

    if (existingWallet && existingWallet.transactions) {
      existingWallet.transactions.forEach(txn => {
        if (txn.orderId && txn.orderId.toString() === order._id.toString() && txn.refundedItems) {
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
      let wallet = existingWallet;

      // If no existing wallet, create a new one with proper userId
      if (!wallet) {
        // Validate userId before creating wallet
        if (!userId) {
          console.error('Cannot create wallet: userId is null or undefined');
          return false;
        }

        // Check if there's a corrupted wallet with null userId that needs cleanup
        try {
          const corruptedWallet = await Wallet.findOne({
            $or: [
              { userId: null },
              { userId: { $exists: false } },
              { user: { $exists: true } } // Check for old 'user' field
            ]
          });

          if (corruptedWallet) {
            console.log('Found corrupted wallet, cleaning up:', corruptedWallet._id);
            await Wallet.deleteOne({ _id: corruptedWallet._id });
          }
        } catch (cleanupError) {
          console.error('Error during wallet cleanup:', cleanupError);
        }

        wallet = new Wallet({
          userId: userId,
          balance: 0,
          transactions: []
        });
      }

      console.log('Processing refund:', {
        walletExists: !!existingWallet,
        userId: userId,
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

      console.log('About to save wallet with transaction:', {
        walletId: wallet._id,
        userId: wallet.userId,
        oldBalance: wallet.balance - refundAmount,
        newBalance: wallet.balance,
        refundAmount,
        transactionCount: wallet.transactions.length
      });

      // Ensure userId is set before saving
      if (!wallet.userId) {
        wallet.userId = userId;
      }

      try {
        await wallet.save();
      } catch (saveError) {
        if (saveError.code === 11000) {
          console.error('Duplicate key error when saving wallet. Attempting to find existing wallet...');

          // Try to find existing wallet and update it instead
          const existingWalletRetry = await Wallet.findOne({ userId: userId });
          if (existingWalletRetry) {
            console.log('Found existing wallet, updating it instead');
            existingWalletRetry.balance = Number(existingWalletRetry.balance) + refundAmount;
            existingWalletRetry.transactions.push({
              type: 'credit',
              amount: refundAmount,
              orderId: order._id,
              reason: refundReason,
              refundedItems: refundedItemsForThisTransaction,
              date: new Date()
            });
            await existingWalletRetry.save();
            wallet = existingWalletRetry;
          } else {
            throw saveError; // Re-throw if we can't find existing wallet
          }
        } else {
          throw saveError; // Re-throw non-duplicate key errors
        }
      }
      console.log('Refund processed successfully and saved to database:', {
        newBalance: wallet.balance,
        refundAmount,
        walletId: wallet._id
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
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus
    });

    if (!userId || !order) {
      console.error('Missing required parameters in processReturnRefund');
      return false;
    }

    // **FIX: For COD orders, only process wallet refunds if order was delivered (cash was paid)**
    if (order.paymentMethod === 'COD') {
      // For COD returns, check if payment was made (order was delivered and cash collected)
      // Check multiple indicators that the order was delivered and cash was collected
      const wasDeliveredAndPaid = order.paymentStatus === 'Paid' ||
                                  order.orderStatus === 'Delivered' ||
                                  order.deliveredAt ||
                                  // Check if any items were delivered (for partial deliveries)
                                  order.items.some(item =>
                                    item.status === 'Delivered' ||
                                    item.status === 'Returned' ||
                                    // For items that are still "Active" but order is delivered
                                    (item.status === 'Active' && order.orderStatus === 'Delivered')
                                  );

      if (!wasDeliveredAndPaid) {
        console.log('COD order not delivered/paid yet - no wallet refund needed (no cash payment made)');
        return true; // Return success but don't process wallet refund
      } else {
        console.log('COD order was delivered and paid - customer paid cash, wallet refund needed for return');
        // Continue with refund processing since customer paid cash upon delivery
      }
    }

    // **FIX: Improved payment validation logic for all payment methods**
    const isPaymentValid = order.paymentStatus === 'Paid' ||
                          order.paymentStatus === 'Partially Refunded' ||
                          // For COD: if delivered, consider it paid (cash was collected)
                          (order.paymentMethod === 'COD' && (
                            order.paymentStatus === 'Paid' ||
                            order.orderStatus === 'Delivered' ||
                            order.deliveredAt ||
                            order.items.some(item =>
                              item.status === 'Delivered' ||
                              item.status === 'Returned' ||
                              (item.status === 'Active' && order.orderStatus === 'Delivered')
                            )
                          ));

    if (!isPaymentValid) {
      console.log('Order payment status does not allow refunds, skipping refund:', {
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        orderStatus: order.orderStatus,
        deliveredAt: order.deliveredAt
      });
      return true; // Return true as this is not an error condition
    }

    let refundAmount = 0;
    let refundReason = '';
    let refundedItemsForThisTransaction = [];

    // Validate userId
    if (!userId) {
      console.error('Invalid userId provided to processCancelRefund');
      return false;
    }

    // Get existing wallet to check for previous refunds
    const existingWallet = await Wallet.findOne({ userId: userId });
    const previouslyRefundedItems = new Set();
    if (existingWallet && existingWallet.transactions) {
      existingWallet.transactions.forEach(txn => {
        if (txn.orderId && txn.orderId.toString() === order._id.toString() && txn.refundedItems) {
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

      console.log('Return refund analysis:', {
        totalItems: order.items.length,
        returnedItems: returnedItems.length,
        itemStatuses: order.items.map(item => ({ id: item._id, status: item.status, title: item.title })),
        previouslyRefundedItems: Array.from(previouslyRefundedItems)
      });

      if (returnedItems.length === 0) {
        console.warn(`No new items to refund in order ${order._id}`);
        return true;
      }

      refundAmount = returnedItems.reduce((total, item) => {
        const itemRefund = calculateItemRefundAmount(item, order);
        console.log(`Item refund calculation for ${item.title}:`, itemRefund);
        return total + itemRefund;
      }, 0);

      refundReason = returnedItems.length === 1
        ? `Refund for returned item: ${returnedItems[0].title} from order #${order.orderNumber}`
        : `Refund for returned items in order #${order.orderNumber}`;
      refundedItemsForThisTransaction = returnedItems.map(item => item.product);
    }

    console.log('Refund calculation complete:', {
      refundAmount,
      refundReason,
      itemsToRefund: refundedItemsForThisTransaction.length
    });

    // Process wallet update if there's an amount to refund
    if (refundAmount > 0) {
      let wallet = existingWallet;

      // If no existing wallet, create a new one with proper userId
      if (!wallet) {
        // Validate userId before creating wallet
        if (!userId) {
          console.error('Cannot create wallet: userId is null or undefined');
          return false;
        }

        // Check if there's a corrupted wallet with null userId that needs cleanup
        try {
          const corruptedWallet = await Wallet.findOne({
            $or: [
              { userId: null },
              { userId: { $exists: false } },
              { user: { $exists: true } } // Check for old 'user' field
            ]
          });

          if (corruptedWallet) {
            console.log('Found corrupted wallet, cleaning up:', corruptedWallet._id);
            await Wallet.deleteOne({ _id: corruptedWallet._id });
          }
        } catch (cleanupError) {
          console.error('Error during wallet cleanup:', cleanupError);
        }

        wallet = new Wallet({
          userId: userId,
          balance: 0,
          transactions: []
        });
      }

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

      console.log('About to save return refund wallet with transaction:', {
        walletId: wallet._id,
        userId: wallet.userId,
        oldBalance: wallet.balance - refundAmount,
        newBalance: wallet.balance,
        refundAmount,
        transactionCount: wallet.transactions.length
      });

      // Ensure userId is set before saving
      if (!wallet.userId) {
        wallet.userId = userId;
      }

      try {
        await wallet.save();
      } catch (saveError) {
        if (saveError.code === 11000) {
          console.error('Duplicate key error when saving wallet. Attempting to find existing wallet...');

          // Try to find existing wallet and update it instead
          const existingWalletRetry = await Wallet.findOne({ userId: userId });
          if (existingWalletRetry) {
            console.log('Found existing wallet, updating it instead');
            existingWalletRetry.balance = Number(existingWalletRetry.balance) + refundAmount;
            existingWalletRetry.transactions.push({
              type: 'credit',
              amount: refundAmount,
              orderId: order._id,
              reason: refundReason,
              refundedItems: refundedItemsForThisTransaction,
              date: new Date()
            });
            await existingWalletRetry.save();
            wallet = existingWalletRetry;
          } else {
            throw saveError; // Re-throw if we can't find existing wallet
          }
        } else {
          throw saveError; // Re-throw non-duplicate key errors
        }
      }
      console.log('Return refund processed successfully and saved to database:', {
        newBalance: wallet.balance,
        refundAmount,
        walletId: wallet._id
      });
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