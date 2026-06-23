const mongoose = require('mongoose');

const GstSchema = new mongoose.Schema(
  {
    percentage: {
      type: Number,
      required: [true, 'Please provide the tax percentage value'],
      min: [0, 'Tax percentage cannot be negative'],
      max: [100, 'Tax percentage cannot exceed 100%'],
    },
    productCategoryName: {
      type: String,
      required: [true, 'Please assign a target product category mapping string'],
      trim: true,
      unique: true, 
    },
    gstStatus: {
      type: String,
      required: true,
      enum: ['active', 'inactive', 'deprecated'],
      default: 'active',
    }
  },
  {
    timestamps: true,
  }
);


module.exports = mongoose.model('Gst', GstSchema);