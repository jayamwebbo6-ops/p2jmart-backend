const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
    default: 1,
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CartItem', CartItemSchema);
