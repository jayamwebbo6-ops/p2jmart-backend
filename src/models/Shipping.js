const mongoose = require('mongoose');

const ShippingSchema = new mongoose.Schema(
  {
    stateName: {
      type: String,
      required: [true, 'Please provide the state name'],
      trim: true,
      unique: true, 
    },
    baseWeight: {
      type: Number,
      required: [true, 'Please provide the base weight in grams'],
      min: [0, 'Base weight cannot be negative']
    },
    baseCost: {
      type: Number,
      required: [true, 'Please provide the base shipping cost'],
      min: [0, 'Base cost cannot be negative']
    },
    additionalWeight: {
      type: Number,
      required: [true, 'Please provide the additional weight unit in grams'],
      min: [0, 'Additional weight unit cannot be negative']
    },
    additionalCost: {
      type: Number,
      required: [true, 'Please provide the additional cost per unit'],
      min: [0, 'Additional cost cannot be negative']
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Shipping', ShippingSchema);
