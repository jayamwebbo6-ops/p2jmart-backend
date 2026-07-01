const mongoose = require('mongoose');

const StockReservationSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variantId: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    title: String
  }],
  status: {
    type: String,
    enum: ['paid', 'unpaid'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  processed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('StockReservation', StockReservationSchema);
