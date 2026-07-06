const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please provide a coupon code'],
      unique: true,
      trim: true,
      uppercase: true
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    },
    discountType: {
      type: String,
      enum: ['Fixed Amount (₹)', 'Percentage (%)'],
      default: 'Fixed Amount (₹)'
    },
    discountValue: {
      type: Number,
      required: [true, 'Please provide a discount value']
    },
    maxDiscountAmount: {
      type: Number,
      default: 0
    },
    minOrderAmount: {
      type: Number,
      default: 0
    },
    validityFrom: {
      type: String,
      required: [true, 'Please provide validity start date']
    },
    validityTo: {
      type: String,
      required: [true, 'Please provide validity end date']
    },
    title: {
      type: String,
      default: ''
    },
    applicableForActiveUsersOnly: {
      type: Boolean,
      default: true
    },
    isSingleUse: {
      type: Boolean,
      default: true
    },
    usageLimitPerUser: {
      type: Number,
      default: 1
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Coupon', couponSchema);
