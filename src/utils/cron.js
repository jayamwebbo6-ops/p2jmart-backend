const cron = require('node-cron');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');
const logger = require('./logger');

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

        // Case A: Order is paid -> Stock deduction remains permanent
        if (order && order.paymentStatus === 'paid') {
          reservation.processed = true;
          reservation.status = 'paid';
          await reservation.save();
          logger.stock.info(`Reservation confirmed paid – stock reduced permanently`, { orderId: order.orderId });
          continue;
        }

        // Case B: Order is unpaid / cancelled or deleted -> Restock!
        logger.stock.warn(`Order unpaid/cancelled – restocking items`, { orderId: order ? order.orderId : reservation.orderId });

        for (const item of reservation.items) {
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
        }

        // Update the order status to 'Cancelled' if it is unpaid and not already cancelled
        if (order && order.status !== 'Cancelled') {
          order.status = 'Cancelled';
          order.statusColor = 'text-red-600 bg-red-50';
          order.statusDate = new Date();
          await order.save();
          logger.order.warn(`Order cancelled due to payment expiration`, { orderId: order.orderId });
        }

        reservation.processed = true;
        reservation.status = 'unpaid';
        await reservation.save();
      } catch (err) {
        logger.stock.error(`Error processing reservation`, { reservationId: reservation._id, error: err.message });
      }
    }
  } catch (err) {
    logger.stock.error('Critical error in stock reservation cron', { error: err.message });
  }
};

const startStockReservationCron = () => {
  // Run immediately on server start to clean up any pending expired orders
  processExpiredReservations();

  // Schedule to run every minute
  cron.schedule('* * * * *', () => {
    processExpiredReservations();
  });

  logger.stock.info('Stock Reservation Cron Job initialised – running every minute.');
};

module.exports = { startStockReservationCron };
