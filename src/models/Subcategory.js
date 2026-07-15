const mongoose = require('mongoose');

const SubcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: ''
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  slug: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  }
}, {
  timestamps: true
});

const slugify = require('../utils/slugify');

SubcategorySchema.pre('save', async function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name);
  }
});

// Avoid duplicate subcategory names within the same category
SubcategorySchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Subcategory', SubcategorySchema);
