const cron = require('node-cron');
const Order = require('../models/Order');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');

const processExpiredReservations = async () => {
  try {
    const now = new Date();
    // Find unprocessed reservations that have expired
    const expiredReservations = await StockReservation.find({
      expiresAt: { $lte: now },
      processed: false
    });

    if (expiredReservations.length === 0) return;

    console.log(`[Inventory Cron] Found ${expiredReservations.length} expired stock reservations to process.`);

    for (const reservation of expiredReservations) {
      try {
        const order = await Order.findById(reservation.orderId);

        // Case A: Order is paid -> Stock deduction remains permanent
        if (order && order.paymentStatus === 'paid') {
          reservation.processed = true;
          reservation.status = 'paid';
          await reservation.save();
          console.log(`[Inventory Cron] Reservation for Order ${order.orderId} processed. Payment is SUCCESS: stock reduced permanently.`);
          continue;
        }

        // Case B: Order is unpaid / cancelled or deleted -> Restock!
        console.log(`[Inventory Cron] Order ${order ? order.orderId : reservation.orderId} is unpaid or cancelled. Restocking items...`);

        for (const item of reservation.items) {
          const product = await Product.findById(item.productId);
          if (!product) {
            console.error(`[Inventory Cron] Product not found for restocking: ${item.productId}`);
            continue;
          }

          const variant = product.variants.find(v => v.id === item.variantId);
          if (!variant) {
            console.error(`[Inventory Cron] Variant ${item.variantId} not found on Product ${product.title} for restocking`);
            continue;
          }

          variant.stock += item.quantity;
          product.markModified('variants');
          await product.save();
          console.log(`[Inventory Cron] Restocked ${item.quantity} units of '${product.title}' (Variant: ${item.variantId})`);
        }

        // Update the order status to 'Cancelled' if it is unpaid and not already cancelled
        if (order && order.status !== 'Cancelled') {
          order.status = 'Cancelled';
          order.statusColor = 'text-red-600 bg-red-50';
          order.statusDate = new Date();
          await order.save();
          console.log(`[Inventory Cron] Order ${order.orderId} status set to Cancelled due to payment expiration.`);
        }

        reservation.processed = true;
        reservation.status = 'unpaid';
        await reservation.save();
      } catch (err) {
        console.error(`[Inventory Cron] Error processing reservation ${reservation._id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Inventory Cron] Error in cron execution:', err);
  }
};

const startStockReservationCron = () => {
  // Run immediately on server start to clean up any pending expired orders
  processExpiredReservations();

  // Schedule to run every minute
  cron.schedule('* * * * *', () => {
    processExpiredReservations();
  });

  console.log('[Inventory Cron] Real-time Stock Reservation Cron Job initialized with node-cron.');
};

module.exports = { startStockReservationCron };
