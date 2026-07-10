const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  photo: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: 'Admin'
  },

  resetOtp: {
    type: String,
    default: undefined
  },
  resetOtpExpire: {
    type: Date,
    default: undefined
  },
  lastOtpSentAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Pre-save hashing for passwords
AdminSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
AdminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema, 'admin');