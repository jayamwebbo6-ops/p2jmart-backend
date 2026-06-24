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

const HomeCMSSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'home_cms_config'
  },
  heroSlider: [HeroSlideSchema],
  offerBanners: [OfferBannerSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('HomeCMS', HomeCMSSchema);
