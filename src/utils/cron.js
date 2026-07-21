const cron = require('node-cron');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');
const ComboPack = require('../models/ComboPack');
const User = require('../models/User');
const logger = require('./logger');
const ccavenueApi = require('./ccavenueApi');
const { getOrderConfirmationTemplate } = require('./emailTemplate');
const { sendEmail } = require('./emailHelper');
const mongoose = require('mongoose');

// Helper to find matching variant based on selectedOptions
const findMatchingVariant = (product, selectedOptions = {}) => {
  if (!product.variants || product.variants.length === 0) return null;

  if (Object.keys(selectedOptions).length === 0) {
    return product.variants[0];
  }

  const normStr = (s) => String(s || '').split('|')[0].trim().toLowerCase();

  for (const variant of product.variants) {
    const attrs = variant.attributes || {};
    let match = true;

    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'color' || key === 'size') {
        const selectedVal = selectedOptions[key];
        if (selectedVal && selectedVal !== 'Default' && selectedVal !== 'default' && normStr(selectedVal) !== normStr(val)) {
          match = false;
          break;
        }
      }
    }

    if (match) return variant;
  }

  return product.variants[0];
};

// Helper to atomically deduct stock for a specific variant in a product
const attemptAtomicDeduction = async (productId, variant, quantity) => {
  const db = mongoose.connection.db;
  const collection = db.collection('products');

  const variantIdStr = variant._id ? String(variant._id) : '';
  const variantIdObj = variant._id && mongoose.Types.ObjectId.isValid(variant._id) ? new mongoose.Types.ObjectId(variant._id) : null;
  const variantId = variant.id || '';

  const query = {
    _id: new mongoose.Types.ObjectId(productId),
    variants: {
      $elemMatch: {
        stock: { $gte: quantity },
        $or: [
          ...(variantIdStr ? [{ _id: variantIdStr }] : []),
          ...(variantIdObj ? [{ _id: variantIdObj }] : []),
          ...(variantId ? [{ id: variantId }] : [])
        ]
      }
    }
  };

  const update = {
    $inc: { "variants.$[elem].stock": -quantity }
  };

  const arrayFilters = [
    {
      $or: [
        ...(variantIdStr ? [{ "elem._id": variantIdStr }] : []),
        ...(variantIdObj ? [{ "elem._id": variantIdObj }] : []),
        ...(variantId ? [{ "elem.id": variantId }] : [])
      ]
    }
  ];

  const result = await collection.findOneAndUpdate(
    query,
    update,
    {
      arrayFilters,
      returnDocument: 'after'
    }
  );

  if (!result) return null;
  return result.value !== undefined ? result.value : result;
};

// Helper to increment stock for a specific variant in a product (handles mixed string/ObjectId types)
const incrementVariantStock = async (productId, variant, quantity) => {
  const db = mongoose.connection.db;
  const collection = db.collection('products');

  let variantIdStr = '';
  let variantIdObj = null;
  let variantId = '';

  if (variant && typeof variant === 'object') {
    variantIdStr = variant._id ? String(variant._id) : '';
    variantIdObj = variant._id && mongoose.Types.ObjectId.isValid(variant._id) ? new mongoose.Types.ObjectId(variant._id) : null;
    variantId = variant.id || '';
  } else if (variant) {
    variantIdStr = String(variant);
    variantIdObj = mongoose.Types.ObjectId.isValid(variant) ? new mongoose.Types.ObjectId(variant) : null;
    variantId = String(variant);
  }

  const arrayFilters = [
    {
      $or: [
        ...(variantIdStr ? [{ "elem._id": variantIdStr }] : []),
        ...(variantIdObj ? [{ "elem._id": variantIdObj }] : []),
        ...(variantId ? [{ "elem.id": variantId }] : [])
      ]
    }
  ];

  await collection.updateOne(
    { _id: new mongoose.Types.ObjectId(productId) },
    { $inc: { "variants.$[elem].stock": quantity } },
    { arrayFilters }
  );
};

// Helper to check and deduct stock for all items in an order
const attemptRededuction = async (order) => {
  const successfullyDeducted = [];

  try {
    for (const item of order.items) {
      const quantity = Number(item.quantity) || 1;

      if (item.isComboProduct) {
        let combo = await ComboPack.findById(item.productId);
        if (!combo || combo.status === false) {
          throw new Error(`Combo pack ${item.title} is unavailable.`);
        }

        if (combo.selectedVariants && combo.selectedVariants.length > 0) {
          for (const sv of combo.selectedVariants) {
            const prod = await Product.findById(sv.productId);
            if (!prod || prod.isActive === false) throw new Error(`Product ${sv.productId} unavailable`);

            const variant = prod.variants.find(v => v.id === sv.variantId || v._id?.toString() === sv.variantId);
            if (!variant || variant.stock < quantity) {
              throw new Error(`Insufficient stock for ${prod.title}`);
            }

            const updated = await attemptAtomicDeduction(prod._id, variant, quantity);
            if (!updated) throw new Error(`Concurrent stock check failed for ${prod.title}`);

            successfullyDeducted.push({ productId: prod._id, variant, quantity });
          }
        } else {
          const included = item.includedProducts || [];
          for (const subItem of included) {
            const subId = subItem.productId || subItem.id || subItem._id;
            const prod = await Product.findById(subId);
            if (!prod || prod.isActive === false) throw new Error(`Product ${subId} unavailable`);

            const variant = prod.variants && prod.variants.length > 0 ? prod.variants[0] : null;
            if (!variant || variant.stock < quantity) {
              throw new Error(`Insufficient stock for ${prod.title}`);
            }

            const updated = await attemptAtomicDeduction(prod._id, variant, quantity);
            if (!updated) throw new Error(`Concurrent stock check failed for ${prod.title}`);

            successfullyDeducted.push({ productId: prod._id, variant, quantity });
          }
        }
      } else {
        const prod = await Product.findById(item.productId);
        if (!prod || prod.isActive === false) {
          throw new Error(`Product ${item.title} is unavailable.`);
        }

        const variant = findMatchingVariant(prod, item.selectedOptions);
        if (!variant || variant.stock < quantity) {
          throw new Error(`Insufficient stock for ${prod.title}`);
        }

        const updated = await attemptAtomicDeduction(prod._id, variant, quantity);
        if (!updated) throw new Error(`Concurrent stock check failed for ${prod.title}`);

        successfullyDeducted.push({ productId: prod._id, variant, quantity });
      }
    }

    return true;
  } catch (error) {
    logger.stock.warn(`Rededuction failed for order ${order.orderId}, rolling back. Reason: ${error.message}`);
    for (const roll of successfullyDeducted) {
      try {
        await incrementVariantStock(roll.productId, roll.variant, roll.quantity);
      } catch (rollErr) {
        logger.stock.error(`Failed to rollback rededuction item`, { productId: roll.productId, error: rollErr.message });
      }
    }
    return false;
  }
};

// Helper to restock items
const restockReservationItems = async (items) => {
  for (const item of items) {
    try {
      const product = await Product.findById(item.productId);
      if (!product) {
        logger.stock.error(`Product not found for restocking`, { productId: item.productId });
        continue;
      }

      const variant = product.variants.find(v => v.id === item.variantId || v._id?.toString() === item.variantId);
      if (!variant) {
        logger.stock.error(`Variant not found for restocking`, { variantId: item.variantId, product: product.title });
        continue;
      }

      variant.stock += item.quantity;
      product.markModified('variants');
      await product.save();
      logger.stock.info(`Restocked product variant`, { product: product.title, variantId: item.variantId, quantity: item.quantity, newStock: variant.stock });
    } catch (itemErr) {
      logger.stock.error(`Error restocking item`, { itemId: item.productId, error: itemErr.message });
    }
  }
};

// 1. Reservation Expiry (15 Minutes) Cron Job
const processExpiredReservations = async () => {
  try {
    const now = new Date();
    const expiredReservations = await StockReservation.find({
      expiresAt: { $lte: now },
      processed: false
    });

    if (expiredReservations.length === 0) return;

    logger.stock.info(`Found ${expiredReservations.length} expired stock reservations to process.`);

    for (const reservation of expiredReservations) {
      try {
        const order = await Order.findById(reservation.orderId);

        if (!order) {
          reservation.processed = true;
          reservation.status = 'unpaid';
          await reservation.save();
          logger.stock.warn(`Order not found for reservation, marking reservation as processed`, { orderId: reservation.orderId });
          continue;
        }

        // Double check status - if order already paid, mark reservation paid
        if (order.paymentStatus === 'Paid' || order.paymentStatus === 'paid') {
          reservation.processed = true;
          reservation.status = 'paid';
          await reservation.save();
          logger.stock.info(`Order ${order.orderId} is paid. Keeping stock reserved.`, { orderId: order.orderId });
          continue;
        }

        // Before cancelling, call the CCAvenue Order Status API
        let apiResponse;
        try {
          apiResponse = await ccavenueApi.checkOrderStatus(order.orderId);
        } catch (apiErr) {
          logger.stock.error(`Failed to query CCAvenue status for order ${order.orderId}. Will retry next minute.`, { error: apiErr.message });
          continue;
        }

        const gatewayStatus = apiResponse.order_status;

        // Case A: Payment Success
        if (gatewayStatus === 'Success') {
          order.paymentStatus = 'Paid';
          order.status = 'Processing';
          order.statusColor = 'text-yellow-600 bg-yellow-50';
          order.statusDate = new Date();
          order.ccavenueTrackingId = apiResponse.tracking_id || '';
          order.bankRefNo = apiResponse.bank_ref_no || '';
          order.paymentResponse = apiResponse;
          order.transactionDate = new Date();
          await order.addAuditLog('Delayed Payment Success Checked via Expiry Cron', { apiResponse });

          reservation.processed = true;
          reservation.status = 'paid';
          await reservation.save();

          // Send confirmation email
          try {
            const user = await User.findById(order.user);
            if (user && user.email) {
              const subject = `p2jmart Order Invoice - ${order.orderId}`;
              const htmlBody = getOrderConfirmationTemplate(user, order);
              sendEmail({
                to: user.email,
                subject: subject,
                html: htmlBody
              }).catch(e => logger.order.error('Email confirmation error:', e));
            }
          } catch (mailErr) {
            logger.order.error('Failed to send invoice email', { error: mailErr.message });
          }

          logger.stock.info(`Order ${order.orderId} paid successfully. Stock reserved permanently.`, { orderId: order.orderId });
          continue;
        }

        // Case B: Payment Failed / Aborted
        if (gatewayStatus === 'Failure' || gatewayStatus === 'Aborted') {
          // Release reserved stock
          await restockReservationItems(reservation.items);

          order.paymentStatus = 'Failed';
          order.status = 'Cancelled';
          order.statusColor = 'text-red-600 bg-red-50';
          order.statusDate = new Date();
          order.paymentResponse = apiResponse;
          await order.addAuditLog('Payment Failed Checked via Expiry Cron - Restocked items', { apiResponse });

          reservation.processed = true;
          reservation.status = 'unpaid';
          await reservation.save();

          logger.stock.warn(`Order ${order.orderId} cancelled due to failed/aborted payment.`, { orderId: order.orderId });
          continue;
        }

        // Case C: Payment Still Pending
        if (gatewayStatus === 'Pending' || !gatewayStatus) {
          // Release reserved stock
          await restockReservationItems(reservation.items);

          order.paymentStatus = 'Awaiting Gateway Confirmation';
          order.status = 'Awaiting Gateway Confirmation';
          order.statusColor = 'text-blue-600 bg-blue-50';
          order.statusDate = new Date();
          order.gatewayPendingSince = new Date();
          order.gatewayPendingExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          order.paymentResponse = apiResponse;
          await order.addAuditLog('Payment Still Pending - Released Stock - Awaiting Gateway Confirmation', { apiResponse });

          reservation.processed = true;
          reservation.status = 'unpaid';
          await reservation.save();

          logger.stock.warn(`Order ${order.orderId} payment is still pending. Released stock and awaiting confirmation.`, { orderId: order.orderId });
        }
      } catch (err) {
        logger.stock.error(`Error processing reservation`, { reservationId: reservation._id, error: err.message });
      }
    }
  } catch (err) {
    logger.stock.error('Critical error in stock reservation cron', { error: err.message });
  }
};

// Helper for handling delayed payment confirmation
const handleDelayedPaymentConfirmation = async (order, apiResponse) => {
  const success = await attemptRededuction(order);

  if (success) {
    // Stock is available
    order.paymentStatus = 'Paid';
    order.status = 'Processing';
    order.statusColor = 'text-yellow-600 bg-yellow-50';
    order.statusDate = new Date();
    order.ccavenueTrackingId = apiResponse.tracking_id || '';
    order.bankRefNo = apiResponse.bank_ref_no || '';
    order.paymentResponse = apiResponse;
    order.transactionDate = new Date();
    await order.addAuditLog('Delayed Payment Success Confirmed - Stock Allocated', { apiResponse });

    // Notify customer that order is confirmed
    try {
      const user = await User.findById(order.user);
      if (user && user.email) {
        const subject = `p2jmart Order Confirmed! - ${order.orderId}`;
        const htmlBody = getOrderConfirmationTemplate(user, order);
        sendEmail({
          to: user.email,
          subject: subject,
          html: htmlBody
        }).catch(e => logger.order.error('Email confirmation error:', e));
      }
    } catch (mailErr) {
      logger.order.error('Failed to send invoice email', { error: mailErr.message });
    }

    logger.stock.info(`Delayed payment confirmed and stock allocated for Order ${order.orderId}`);
  } else {
    // Stock not available
    order.paymentStatus = 'Paid - Refund Required';
    order.status = 'Refund Pending';
    order.statusColor = 'text-orange-600 bg-orange-50';
    order.statusDate = new Date();
    order.paymentResponse = apiResponse;
    await order.addAuditLog('Delayed Payment Received - Stock Unavailable - Refund Required', { apiResponse });

    // Notify customer that payment was received but stock is unavailable
    try {
      const user = await User.findById(order.user);
      if (user && user.email) {
        const subject = `p2jmart Order Payment Received (Refund Pending) - ${order.orderId}`;
        const htmlBody = `<p>Dear ${user.name},</p>
          <p>We received your delayed payment of ₹${order.total.toFixed(2)} for Order <strong>${order.orderId}</strong>.</p>
          <p>Unfortunately, the items in your order became out of stock before payment was confirmed. We are unable to fulfill this order, and a refund has been initiated.</p>
          <p>We apologize for the inconvenience.</p>`;
        sendEmail({
          to: user.email,
          subject: subject,
          html: htmlBody
        }).catch(e => logger.order.error('Email refund notice error:', e));
      }
    } catch (mailErr) {
      logger.order.error('Failed to send refund email notice', { error: mailErr.message });
    }

    logger.stock.error(`Delayed payment confirmed but stock unavailable for Order ${order.orderId}. Refund required.`);
  }
};

// 2. Delayed Gateway Confirmation Job (runs every 30 minutes)
const processDelayedGatewayConfirmations = async () => {
  try {
    const now = new Date();
    const pendingOrders = await Order.find({
      paymentStatus: 'Awaiting Gateway Confirmation',
      gatewayPendingExpiry: { $gt: now }
    });

    if (pendingOrders.length === 0) return;

    logger.order.info(`Found ${pendingOrders.length} pending orders awaiting gateway confirmation.`);

    for (const order of pendingOrders) {
      try {
        let apiResponse;
        try {
          apiResponse = await ccavenueApi.checkOrderStatus(order.orderId);
        } catch (apiErr) {
          logger.order.error(`Failed to query CCAvenue status for delayed order ${order.orderId}`, { error: apiErr.message });
          continue;
        }

        const gatewayStatus = apiResponse.order_status;

        // Case A: Payment Becomes Success
        if (gatewayStatus === 'Success') {
          await handleDelayedPaymentConfirmation(order, apiResponse);
        }
        // Case B: Payment Failed / Aborted
        else if (gatewayStatus === 'Failure' || gatewayStatus === 'Aborted') {
          order.paymentStatus = 'Failed';
          order.status = 'Cancelled';
          order.statusColor = 'text-red-600 bg-red-50';
          order.statusDate = new Date();
          order.paymentResponse = apiResponse;
          await order.addAuditLog('Delayed Payment Failed permanently', { apiResponse });
          logger.order.warn(`Delayed order ${order.orderId} marked failed based on gateway response.`);
        }
        // Case C: Still Pending
        else {
          logger.order.info(`Delayed order ${order.orderId} is still Pending.`);
        }
      } catch (err) {
        logger.order.error(`Error processing delayed confirmation for Order ${order.orderId}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.order.error('Critical error in delayed gateway confirmation cron', { error: err.message });
  }
};

// 3. Automatic Pending Expiry (7 Days) (runs daily / hourly check)
const processDailyGatewayExpiry = async () => {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      paymentStatus: 'Awaiting Gateway Confirmation',
      gatewayPendingExpiry: { $lte: now }
    });

    if (expiredOrders.length === 0) return;

    logger.order.info(`Found ${expiredOrders.length} orders awaiting gateway confirmation that have exceeded 7 days.`);

    for (const order of expiredOrders) {
      try {
        let apiResponse;
        try {
          apiResponse = await ccavenueApi.checkOrderStatus(order.orderId);
        } catch (apiErr) {
          logger.order.error(`Failed final 7-day query for order ${order.orderId}`, { error: apiErr.message });
          continue;
        }

        const gatewayStatus = apiResponse.order_status;

        // Final Check
        if (gatewayStatus === 'Success') {
          await handleDelayedPaymentConfirmation(order, apiResponse);
        } else if (gatewayStatus === 'Failure' || gatewayStatus === 'Aborted') {
          order.paymentStatus = 'Failed';
          order.status = 'Cancelled';
          order.statusColor = 'text-red-600 bg-red-50';
          order.statusDate = new Date();
          order.paymentResponse = apiResponse;
          await order.addAuditLog('7-Day Expiry - Final check failed permanently', { apiResponse });
          logger.order.warn(`7-Day expired order ${order.orderId} cancelled after failed final check.`);
        } else {
          // Still Pending -> Gateway Expired
          order.paymentStatus = 'Gateway Expired';
          order.status = 'Cancelled';
          order.statusColor = 'text-red-600 bg-red-50';
          order.statusDate = new Date();
          order.paymentResponse = apiResponse;
          await order.addAuditLog('7-Day Expiry - Gateway Timeout - Cancelled permanently', {
            reason: 'No status change from gateway after 7 days',
            apiResponse
          });
          logger.order.warn(`7-Day expired order ${order.orderId} cancelled permanently due to gateway timeout.`);
        }
      } catch (err) {
        logger.order.error(`Error processing 7-day expiry for Order ${order.orderId}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.order.error('Critical error in daily gateway expiry cron', { error: err.message });
  }
};

const startStockReservationCron = () => {
  try {
    // Run immediately on server start to clean up any pending expired orders
    processExpiredReservations();
    processDelayedGatewayConfirmations();
    processDailyGatewayExpiry();

    // Schedule Stock Reservation Expiry Cron (every minute)
    cron.schedule('* * * * *', () => {
      processExpiredReservations();
    });

    // Schedule Delayed Confirmation Cron (every 30 minutes)
    cron.schedule('*/30 * * * *', () => {
      processDelayedGatewayConfirmations();
    });

    // Schedule Daily Gateway Expiry Cron (every hour at minute 0)
    cron.schedule('0 * * * *', () => {
      processDailyGatewayExpiry();
    });

    logger.stock.info('All Payment & Stock Cron Jobs initialised successfully.');
    return true;
  } catch (err) {
    logger.stock.error('Failed to initialise cron jobs', { error: err.message });
    throw err;
  }
};

module.exports = {
  startStockReservationCron,
  processExpiredReservations,
  processDelayedGatewayConfirmations,
  processDailyGatewayExpiry
};
