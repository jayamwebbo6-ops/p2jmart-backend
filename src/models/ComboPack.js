const mongoose = require('mongoose');

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
  returnPolicy: {
    type: String,
    default: 'No Return Policy'
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
    type: Array,
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ComboPack', ComboPackSchema);
