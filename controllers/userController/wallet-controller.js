const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");
const { calculateDiscount, getUnifiedPriceBreakdown } = require("../../utils/offer-helper");
const { HttpStatus } = require("../../helpers/status-code");
const { calculateRefundAmount, validateRefundForPaymentMethod } = require("../../helpers/money-calculator");


const getWallet = async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.redirect('/login');
    }

    // Get wallet with transactions
    const wallet = await Wallet.findOne({ userId });

    // Format transactions for display with proper sorting
    const formattedWallet = {
      balance: wallet ? wallet.balance : 0,
      transactions: wallet && wallet.transactions ?
        wallet.transactions
          .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
          .map(transaction => ({
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
    console.error('❌ Error in getWallet:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { message: 'Internal server error' });
  }
};

// Helper function to safely perform calculations avoiding NaN
const safeCalculation = (value) => {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};



/**
 * Calculate proportional tax refund for partial returns
 * @param {Object} item - Item being returned
 * @param {Object} order - Complete order object
 * @returns {number} Proportional tax amount to refund
 */
const calculateProportionalTaxRefund = (item, order) => {
  try {
    // **OPTIMIZED: Early validation**
    if (!order?.tax || order.tax <= 0 || !item || !order.items?.length) {
      return 0;
    }

    // **OPTIMIZED: Cache item price breakdown**
    const itemPriceBreakdown = getUnifiedPriceBreakdown(item, order);
    if (!itemPriceBreakdown?.finalPrice) {
      return 0;
    }

    const itemFinalPrice = itemPriceBreakdown.finalPrice;

    // **OPTIMIZED: Single pass calculation of total order value**
    let totalOrderFinalPrice = 0;
    for (const orderItem of order.items) {
      const itemBreakdown = getUnifiedPriceBreakdown(orderItem, order);
      totalOrderFinalPrice += itemBreakdown?.finalPrice || 0;
    }

    // **OPTIMIZED: Direct calculation without intermediate variables**
    if (totalOrderFinalPrice <= 0) {
      return 0;
    }

    const proportionalTax = (itemFinalPrice / totalOrderFinalPrice) * order.tax;
    return Number(proportionalTax.toFixed(2));

  } catch (error) {
    console.error('Error calculating proportional tax:', error.message);
    return 0;
  }
};

/**
 * **BULLETPROOF CANCEL REFUND PROCESSOR**
 * Single unified function for all cancellation refunds
 * Prevents double refunding with validation checks
 */
const processCancelRefund = async (userId, order, productId = null) => {
  try {
    // **STEP 1: VALIDATION**
    if (!userId || !order) {
      console.error('Invalid userId or order for cancel refund');
      return false;
    }

    // **STEP 2: PREVENT DOUBLE REFUNDING**
    // Check if this refund was already processed
    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      let existingRefund;

      if (productId) {
        // For individual items, check for specific item refund
        existingRefund = existingWallet.transactions.find(transaction =>
          transaction.orderId?.toString() === order._id.toString() &&
          transaction.type === 'credit' &&
          transaction.reason.includes('cancelled item') &&
          transaction.reason.includes(productId)
        );
      } else {
        // For full order, check for order-level refund OR calculate remaining amount
        existingRefund = existingWallet.transactions.find(transaction =>
          transaction.orderId?.toString() === order._id.toString() &&
          transaction.type === 'credit' &&
          (transaction.reason.includes('cancelled items in order') ||
           transaction.reason.includes('remaining') ||
           transaction.reason.includes('order #'))
        );

        // **SPECIAL CASE: Calculate remaining refund amount**
        if (!existingRefund) {
          // Check how much has already been refunded for individual items
          const individualRefunds = existingWallet.transactions.filter(transaction =>
            transaction.orderId?.toString() === order._id.toString() &&
            transaction.type === 'credit' &&
            transaction.reason.includes('cancelled item')
          );

          if (individualRefunds.length > 0) {
            const totalIndividualRefunds = individualRefunds.reduce((sum, refund) => sum + refund.amount, 0);
            const remainingRefund = order.total - totalIndividualRefunds;

            console.log(`💰 REMAINING REFUND CALCULATION:`);
            console.log(`   Order Total: ₹${order.total}`);
            console.log(`   Individual Refunds: ₹${totalIndividualRefunds}`);
            console.log(`   Remaining: ₹${remainingRefund}`);

            if (remainingRefund > 0.01) {
              // Process the remaining refund
              const wallet = existingWallet;
              wallet.balance += remainingRefund;
              wallet.transactions.push({
                type: 'credit',
                amount: remainingRefund,
                orderId: order._id,
                reason: `Refund for remaining amount in cancelled order`,
                date: new Date()
              });

              await wallet.save();
              console.log(`✅ Remaining refund processed: ₹${remainingRefund}`);
              return true;
            } else {
              console.log(`✅ No remaining refund needed - order fully refunded`);
              return true;
            }
          }
        }
      }

      if (existingRefund) {
        console.log(`Refund already processed: ${existingRefund.reason}`);
        return true; // Already processed, return success
      }
    }

    // **STEP 3: CALCULATE REFUND USING UNIFIED SYSTEM**
    console.log(`🧮 CALCULATING REFUND:`);
    console.log(`   Order ID: ${order._id}`);
    console.log(`   Product ID: ${productId || 'ALL ITEMS'}`);
    console.log(`   Order Total: ₹${order.total}`);

    let refundResult;

    if (productId) {
      // Individual item cancellation
      console.log(`   Type: Individual Item Cancellation`);
      refundResult = calculateRefundAmount('INDIVIDUAL_ITEM', order, productId);
    } else {
      // Full order or remaining items cancellation
      console.log(`   Type: Full/Remaining Order Cancellation`);
      refundResult = calculateRefundAmount('REMAINING_ORDER', order);
    }

    console.log(`🧮 REFUND CALCULATION RESULT:`);
    console.log(`   Success: ${refundResult.success}`);
    console.log(`   Amount: ₹${refundResult.amount}`);
    console.log(`   Reason: ${refundResult.reason}`);

    if (!refundResult.success) {
      console.log(`❌ Refund calculation failed: ${refundResult.reason}`);
      return true; // No refund needed, but not an error
    }

    // **STEP 4: VALIDATE FOR PAYMENT METHOD**
    const validation = validateRefundForPaymentMethod(order, refundResult.amount);
    if (!validation.shouldRefund) {
      console.log(`Cancel refund skipped: ${validation.reason}`);
      return true; // Success but no refund needed
    }

    const finalRefundAmount = validation.refundAmount;

    if (finalRefundAmount <= 0) {
      console.log('No refund amount calculated');
      return true; // No refund needed
    }

    // **STEP 5: PROCESS WALLET REFUND**
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({
        userId: userId,
        balance: 0,
        transactions: []
      });
    }

    // Add refund to wallet
    const oldBalance = wallet.balance;
    wallet.balance += finalRefundAmount;

    const newTransaction = {
      type: 'credit',
      amount: finalRefundAmount,
      orderId: order._id,
      reason: refundResult.reason,
      date: new Date()
    };

    wallet.transactions.push(newTransaction);

    console.log(`💳 WALLET UPDATE:`);
    console.log(`   Old Balance: ₹${oldBalance}`);
    console.log(`   Refund Amount: ₹${finalRefundAmount}`);
    console.log(`   New Balance: ₹${wallet.balance}`);
    console.log(`   Transaction: ${newTransaction.reason}`);
    console.log(`   Transactions Count: ${wallet.transactions.length}`);

    await wallet.save();

    console.log(`✅ Cancel refund processed and saved: ₹${finalRefundAmount} for ${refundResult.reason}`);
    return true;

  } catch (error) {
    console.error('Error processing cancel refund:', error);
    return false;
  }
};

/**
 * **BULLETPROOF RETURN REFUND PROCESSOR**
 * Single unified function for all return refunds
 * Prevents double refunding with validation checks
 */
const processReturnRefund = async (userId, order, productId = null) => {
  try {
    // **STEP 1: VALIDATION**
    if (!userId || !order) {
      console.error('Invalid userId or order for return refund');
      return false;
    }

    // **STEP 2: PREVENT DOUBLE REFUNDING**
    // Check if this refund was already processed
    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      const existingRefund = existingWallet.transactions.find(transaction =>
        transaction.orderId?.toString() === order._id.toString() &&
        transaction.type === 'credit' &&
        transaction.reason.includes('return') &&
        (productId ? transaction.reason.includes(productId) : transaction.reason.includes('order'))
      );

      if (existingRefund) {
        console.log('Return refund already processed for this order/item');
        return true; // Already processed, return success
      }
    }

    // **STEP 3: CALCULATE REFUND USING UNIFIED SYSTEM**
    let refundResult;

    if (productId) {
      // Individual item return
      refundResult = calculateRefundAmount('INDIVIDUAL_ITEM', order, productId);

      // Additional validation for returns - item must be in 'Returned' status
      const item = order.items.find(i => i.product.toString() === productId.toString());
      if (!item || item.status !== 'Returned') {
        console.log('Item not found or not in returned status');
        return false;
      }
    } else {
      // Full order return - only process returned items
      const returnedItems = order.items.filter(item => item.status === 'Returned');
      if (returnedItems.length === 0) {
        console.log('No returned items found for refund');
        return true; // No items to refund, but not an error
      }

      refundResult = calculateRefundAmount('REMAINING_ORDER', order);
    }

    if (!refundResult.success) {
      console.log(`Return refund calculation failed: ${refundResult.reason}`);
      return true; // No refund needed, but not an error
    }

    // **STEP 4: VALIDATE FOR PAYMENT METHOD**
    const validation = validateRefundForPaymentMethod(order, refundResult.amount);
    if (!validation.shouldRefund) {
      console.log(`Return refund skipped: ${validation.reason}`);
      return true; // Success but no refund needed
    }

    const finalRefundAmount = validation.refundAmount;

    if (finalRefundAmount <= 0) {
      console.log('No return refund amount calculated');
      return true; // No refund needed
    }

    // **STEP 5: PROCESS WALLET REFUND**
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({
        userId: userId,
        balance: 0,
        transactions: []
      });
    }

    // Add refund to wallet
    const oldBalance = wallet.balance;
    wallet.balance += finalRefundAmount;

    const newTransaction = {
      type: 'credit',
      amount: finalRefundAmount,
      orderId: order._id,
      reason: refundResult.reason.replace('cancelled', 'returned'), // Ensure correct terminology
      date: new Date()
    };

    wallet.transactions.push(newTransaction);

    console.log(`💳 RETURN WALLET UPDATE:`);
    console.log(`   Old Balance: ₹${oldBalance}`);
    console.log(`   Refund Amount: ₹${finalRefundAmount}`);
    console.log(`   New Balance: ₹${wallet.balance}`);
    console.log(`   Transaction: ${newTransaction.reason}`);
    console.log(`   Transactions Count: ${wallet.transactions.length}`);

    await wallet.save();

    console.log(`✅ Return refund processed and saved: ₹${finalRefundAmount} for ${refundResult.reason}`);
    return true;

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