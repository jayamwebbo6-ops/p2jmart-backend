const mongoose = require('mongoose');
const logger = require('../utils/logger');

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
          type: mongoose.Schema.Types.Mixed,
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
        },
        returnPolicy: {
          type: String,
          default: 'No Return Policy'
        },
        returnStatus: {
          type: String,
          enum: ['None', 'Return Requested', 'Return Approved', 'Return Rejected', 'Returned & Refunded'],
          default: 'None'
        },
        returnReason: {
          type: String,
          default: ''
        },
        returnPhoto: {
          type: String,
          default: ''
        },
        returnRequestDate: {
          type: Date
        },
        parcelReceived: {
          type: Boolean,
          default: false
        },
        refundStatus: {
          type: String,
          enum: ['None', 'Pending', 'Refunded'],
          default: 'None'
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
      default: 'pending'
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
    couponCode: {
      type: String,
      default: null
    },
    couponDiscount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    status: {
      type: String,
     enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancellation Requested', 'Cancelled', 'Cancellation Rejected'],
      default: 'Processing'
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    statusColor: {
      type: String,
      default: 'text-yellow-600 bg-yellow-50'
    },
    statusDate: {
      type: Date,
      default: Date.now
    },
    reservationExpiresAt: {
      type: Date
    },
    gatewayPendingSince: {
      type: Date
    },
    gatewayPendingExpiry: {
      type: Date
    },
    mockStatus: {
      type: String,
      enum: ['Success', 'Failure', 'Aborted', 'Pending', null]
    },
    auditLog: [
      {
        action: { type: String, required: true },
        status: { type: String },
        paymentStatus: { type: String },
        details: { type: mongoose.Schema.Types.Mixed },
        timestamp: { type: Date, default: Date.now }
      }
    ],
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
    },
    deliveredAt: {
      type: Date
    }, ccavenueTrackingId: {
      type: String,
      default: ""
    },

    bankRefNo: {
      type: String,
      default: ""
    },
    

    paymentResponse: {
      type: Object,
      default: {}
    },

    transactionDate: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

OrderSchema.methods.addAuditLog = async function (action, details = {}) {
  this.auditLog.push({
    action,
    status: this.status,
    paymentStatus: this.paymentStatus,
    details,
    timestamp: new Date()
  });
  logger.order.info(`Order ${this.orderId} Audit: ${action}`, {
    status: this.status,
    paymentStatus: this.paymentStatus,
    details
  });
  return this.save();
};

module.exports = mongoose.model('Order', OrderSchema);