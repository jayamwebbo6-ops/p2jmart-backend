const mongoose = require('mongoose');

const HeroSlideSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  btnLabel: { type: String, default: '' },
  btnLink: { type: String, default: '' },
  image: { type: String, default: '' }
});

const OfferBannerSchema = new mongoose.Schema({
  tagline: { type: String, default: '' },
  title: { type: String, default: '' },
  btnLink: { type: String, default: '' },
  image: { type: String, default: '' }
});

const CategoryGridCardSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  buttonText: { type: String, default: 'View Collection' },
  targetUrl: { type: String, default: '' },
  image: { type: String, default: '' }
});

const CategorySectionSchema = new mongoose.Schema({
  categoryId: { type: String, default: '' },
  title: { type: String, default: '' },
  bannerImage: { type: String, default: '' },
  bannerLink: { type: String, default: '' },
  productIds: [{ type: String }]
});

const HomeCMSSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'home_cms_config'
  },
  heroSlider: [HeroSlideSchema],
  offerBanners: [OfferBannerSchema],
  categoryGrid: [CategoryGridCardSchema],
  categorySections: [CategorySectionSchema],
  featuredProducts: [{ type: String }],
  trendingProducts: [{ type: String }],
  exclusiveProducts: [{ type: String }]
}, {
  timestamps: true
});

module.exports = mongoose.model('HomeCMS', HomeCMSSchema);
