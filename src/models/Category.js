const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  supportedAttributes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attribute'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Category', CategorySchema);
