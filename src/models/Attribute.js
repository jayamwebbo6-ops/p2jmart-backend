const mongoose = require('mongoose');

const AttributeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  terms: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Attribute', AttributeSchema);
