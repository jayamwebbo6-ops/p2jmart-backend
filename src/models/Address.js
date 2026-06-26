const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fullName: {
      type: String,
      required: [true, 'Please provide full name'],
      trim: true
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please provide phone number'],
      trim: true
    },
    streetAddress: {
      type: String,
      required: [true, 'Please provide street address'],
      trim: true
    },
    apartment: {
      type: String,
      default: '',
      trim: true
    },
    city: {
      type: String,
      required: [true, 'Please provide city'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'Please provide state'],
      trim: true
    },
    stateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipping',
      required: [true, 'Please select a valid shipping state']
    },
    pincode: {
      type: String,
      required: [true, 'Please provide PIN code'],
      trim: true
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Address', AddressSchema);
