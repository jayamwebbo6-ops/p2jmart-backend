const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // Rewired: Removed required: true to allow both Google and OTP logins
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    default: '' 
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  photo: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  // New Fields for Email OTP Authentication
  otp: {
    type: String, 
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', UserSchema, 'users');