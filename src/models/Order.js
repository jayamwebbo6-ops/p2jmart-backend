const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        title: {
          type: String,
          required: true
        },
        price: {
          type: Number,
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        image: {
          type: String,
          default: ''
        },
        selectedOptions: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        },
        isComboProduct: {
          type: Boolean,
          default: false
        },
        includedProducts: {
          type: [mongoose.Schema.Types.Mixed],
          default: []
        },
        weight: {
          type: Number,
          default: 0
        }
      }
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      streetAddress: { type: String, required: true },
      apartment: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true }
    },
    paymentMethod: {
      type: String,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid'],
      default: 'paid'
    },
    subtotal: {
      type: Number,
      required: true
    },
    gst: {
      type: Number,
      default: 0
    },
    shippingFee: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing'
    },
    statusColor: {
      type: String,
      default: 'text-yellow-600 bg-yellow-50'
    },
    statusDate: {
      type: Date,
      default: Date.now
    },
    trackingId: {
      type: String,
      default: ''
    },
    trackingLink: {
      type: String,
      default: ''
    },
    placedDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Order', OrderSchema);
