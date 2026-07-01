const mongoose = require('mongoose');

const comboReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    default: 'Anonymous'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true 
});

const ComboPackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  offerPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  status: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    default: 'Garden Products'
  },
  subcategory: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  selectedItemIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  }],
  selectedVariants: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    variantId: String
  }],
  rating: {
    type: Number,
    default: 5.0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  reviews: {
    type: [comboReviewSchema], 
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ComboPack', ComboPackSchema);