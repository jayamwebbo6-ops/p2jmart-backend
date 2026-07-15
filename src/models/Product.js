const mongoose = require('mongoose');


const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  orderItemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  description: {
    type: String,
    required: true
  }
}, { timestamps: true });


const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },

  rating: { type: Number, default: 5 },
  reviews: { type: Number, default: 0 }, 
  reviewList: [reviewSchema],

  description: {
    type: String,
    default: ''
  },
  brand: {
    type: String,
    default: ''
  },
  collectionName: {
    type: String,
    default: 'None'
  },
  customizeProduct: {
    type: String,
    default: 'No'
  },
  customizationType: {
    type: String,
    default: 'Text'
  },
  warranty: {
    type: String,
    default: ''
  },
  returnPolicy: {
    type: String,
    default: 'Select Return Days'
  },
  deliveryMode: {
    type: String,
    default: ''
  },
  freeShipping: {
    type: String,
    enum: ['Yes', 'No'],
    default: 'No'
  },
  selectedAttributes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  variants: [{
    id: String,
    attributes: mongoose.Schema.Types.Mixed,
    price: Number,
    originalPrice: Number,
    stock: Number,
    weight: {
      type: Number,
      default: 0
    },
    image: String,
    images: [String]
  }],
  image: {
    type: String,
    default: ''
  },
  metaTitle: {
    type: String,
    default: ''
  },
  keywords: {
    type: String,
    default: ''
  },
  seoDescription: {
    type: String,
    default: ''
  },
  detailedDescription: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subcategory',
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

ProductSchema.pre('save', async function () {
  if (this.isModified('title') || !this.slug) {
    this.slug = slugify(this.title);
  }
});

module.exports = mongoose.model('Product', ProductSchema);
