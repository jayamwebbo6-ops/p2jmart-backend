const HomeCMS = require('../models/HomeCMS');
const { saveBase64Image, deleteImageFile, getImageUrl } = require('../utils/imageHelper');

const CONFIG_KEY = 'home_cms_config';

// Helper to strip BASE_URL from image path when saving
const getRelativeImagePath = (urlOrPath) => {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('data:image')) {
    return urlOrPath;
  }
  const uploadsIndex = urlOrPath.indexOf('uploads/');
  if (uploadsIndex !== -1) {
    return urlOrPath.substring(uploadsIndex);
  }
  return urlOrPath;
};

// 1. Get Home CMS Config
exports.getHomeCMS = async (req, res) => {
  try {
    let config = await HomeCMS.findOne({ key: CONFIG_KEY });
    if (!config) {
      // Create a default initial document matching original mock values
      config = await HomeCMS.create({
        key: CONFIG_KEY,
        heroSlider: [
          { title: "Boat Headphone", description: "Taking your Viewing Experience to Next Level", btnLabel: "Shop Now", btnLink: "/category/headphones", image: "" },
          { title: "SNAP ART Spotify Frame", description: "Personalized scannable frame tokens with live musical elements", btnLabel: "Customize Now", btnLink: "/product/custom-spotify-frame", image: "" }
        ],
        offerBanners: [
          { tagline: "iPhone Collection", title: "25% OFF", btnLink: "/category/iphone-cases", image: "" },
          { tagline: "MAC Computer", title: "25% OFF", btnLink: "/category/macbook-stands", image: "" }
        ],
        categoryGrid: [],
        categorySections: [],
        featuredProducts: [],
        trendingProducts: [],
        exclusiveProducts: []
      });
    }

    // Map response to include full image URLs
    const formattedHero = (config.heroSlider || []).map(slide => ({
      ...slide.toObject ? slide.toObject() : slide,
      image: getImageUrl(slide.image)
    }));

    const formattedOffers = (config.offerBanners || []).map(banner => ({
      ...banner.toObject ? banner.toObject() : banner,
      image: getImageUrl(banner.image)
    }));

    const formattedCategoryGrid = (config.categoryGrid || []).map(card => ({
      ...card.toObject ? card.toObject() : card,
      image: getImageUrl(card.image)
    }));

    const formattedCategorySections = (config.categorySections || []).map(section => ({
      ...section.toObject ? section.toObject() : section,
      bannerImage: getImageUrl(section.bannerImage)
    }));

    res.status(200).json({
      success: true,
      data: {
        heroSlider: formattedHero,
        offerBanners: formattedOffers,
        categoryGrid: formattedCategoryGrid,
        categorySections: formattedCategorySections,
        featuredProducts: config.featuredProducts || [],
        trendingProducts: config.trendingProducts || [],
        exclusiveProducts: config.exclusiveProducts || []
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Error fetching Home CMS configuration'
    });
  }
};

// 2. Update Home CMS Config
exports.updateHomeCMS = async (req, res) => {
  try {
    const { heroSlider, offerBanners, categoryGrid, categorySections, featuredProducts, trendingProducts, exclusiveProducts } = req.body;

    let config = await HomeCMS.findOne({ key: CONFIG_KEY });
    if (!config) {
      config = new HomeCMS({ key: CONFIG_KEY });
    }

    // Keep copies of old images to delete later if they are replaced or removed
    const oldHeroImages = (config.heroSlider || []).map(s => s.image).filter(Boolean);
    const oldOfferImages = (config.offerBanners || []).map(b => b.image).filter(Boolean);
    const oldCategoryGridImages = (config.categoryGrid || []).map(c => c.image).filter(Boolean);
    const oldCategorySectionImages = (config.categorySections || []).map(s => s.bannerImage).filter(Boolean);

    // Process Hero Slider images
    const processedHero = [];
    if (Array.isArray(heroSlider)) {
      for (let i = 0; i < heroSlider.length; i++) {
        const slide = heroSlider[i];
        let savedPath = '';
        if (slide.image) {
          const cleanImage = getRelativeImagePath(slide.image);
          if (cleanImage.startsWith('data:image')) {
            savedPath = saveBase64Image(cleanImage, 'homes', `hero-slide-${i}`);
          } else {
            savedPath = cleanImage;
          }
        }
        processedHero.push({
          title: slide.title || '',
          description: slide.description || '',
          btnLabel: slide.btnLabel || '',
          btnLink: slide.btnLink || '',
          image: savedPath
        });
      }
    }

    // Process Offer Banners images
    const processedOffers = [];
    if (Array.isArray(offerBanners)) {
      for (let i = 0; i < offerBanners.length; i++) {
        const banner = offerBanners[i];
        let savedPath = '';
        if (banner.image) {
          const cleanImage = getRelativeImagePath(banner.image);
          if (cleanImage.startsWith('data:image')) {
            savedPath = saveBase64Image(cleanImage, 'homes', `offer-banner-${i}`);
          } else {
            savedPath = cleanImage;
          }
        }
        processedOffers.push({
          tagline: banner.tagline || '',
          title: banner.title || '',
          btnLink: banner.btnLink || '',
          image: savedPath
        });
      }
    }

    // Process Category Grid images
    const processedCategoryGrid = [];
    if (Array.isArray(categoryGrid)) {
      for (let i = 0; i < categoryGrid.length; i++) {
        const card = categoryGrid[i];
        let savedPath = '';
        if (card.image) {
          const cleanImage = getRelativeImagePath(card.image);
          if (cleanImage.startsWith('data:image')) {
            savedPath = saveBase64Image(cleanImage, 'homes', `category-grid-${i}`);
          } else {
            savedPath = cleanImage;
          }
        }
        processedCategoryGrid.push({
          title: card.title || '',
          description: card.description || '',
          buttonText: card.buttonText || 'View Collection',
          targetUrl: card.targetUrl || '',
          image: savedPath
        });
      }
    }

    // Process Category Sections banner images
    const processedCategorySections = [];
    if (Array.isArray(categorySections)) {
      for (let i = 0; i < categorySections.length; i++) {
        const section = categorySections[i];
        let savedBannerPath = '';
        if (section.bannerImage) {
          const cleanImage = getRelativeImagePath(section.bannerImage);
          if (cleanImage.startsWith('data:image')) {
            savedBannerPath = saveBase64Image(cleanImage, 'homes', `cat-section-banner-${i}`);
          } else {
            savedBannerPath = cleanImage;
          }
        }
        processedCategorySections.push({
          categoryId: section.categoryId || '',
          title: section.title || '',
          bannerImage: savedBannerPath,
          bannerLink: section.bannerLink || '',
          productIds: Array.isArray(section.productIds) ? section.productIds : []
        });
      }
    }

    config.heroSlider = processedHero;
    config.offerBanners = processedOffers;
    config.categoryGrid = processedCategoryGrid;
    config.categorySections = processedCategorySections;
    config.featuredProducts = Array.isArray(featuredProducts) ? featuredProducts : [];
    config.trendingProducts = Array.isArray(trendingProducts) ? trendingProducts : [];
    config.exclusiveProducts = Array.isArray(exclusiveProducts) ? exclusiveProducts : [];
    await config.save();

    // Clean up replaced images from server storage
    const newHeroImages = processedHero.map(s => s.image).filter(Boolean);
    const newOfferImages = processedOffers.map(b => b.image).filter(Boolean);
    const newCategoryGridImages = processedCategoryGrid.map(c => c.image).filter(Boolean);
    const newCategorySectionImages = processedCategorySections.map(s => s.bannerImage).filter(Boolean);

    oldHeroImages.forEach(oldImg => {
      if (!newHeroImages.includes(oldImg)) {
        deleteImageFile(oldImg);
      }
    });

    oldOfferImages.forEach(oldImg => {
      if (!newOfferImages.includes(oldImg)) {
        deleteImageFile(oldImg);
      }
    });

    oldCategoryGridImages.forEach(oldImg => {
      if (!newCategoryGridImages.includes(oldImg)) {
        deleteImageFile(oldImg);
      }
    });

    oldCategorySectionImages.forEach(oldImg => {
      if (!newCategorySectionImages.includes(oldImg)) {
        deleteImageFile(oldImg);
      }
    });

    // Return updated formatting
    const formattedHero = config.heroSlider.map(slide => ({
      ...slide.toObject ? slide.toObject() : slide,
      image: getImageUrl(slide.image)
    }));

    const formattedOffers = config.offerBanners.map(banner => ({
      ...banner.toObject ? banner.toObject() : banner,
      image: getImageUrl(banner.image)
    }));

    const formattedCategoryGrid = config.categoryGrid.map(card => ({
      ...card.toObject ? card.toObject() : card,
      image: getImageUrl(card.image)
    }));

    const formattedCategorySections = config.categorySections.map(section => ({
      ...section.toObject ? section.toObject() : section,
      bannerImage: getImageUrl(section.bannerImage)
    }));

    res.status(200).json({
      success: true,
      message: 'Home CMS configuration updated successfully',
      data: {
        heroSlider: formattedHero,
        offerBanners: formattedOffers,
        categoryGrid: formattedCategoryGrid,
        categorySections: formattedCategorySections,
        featuredProducts: config.featuredProducts || [],
        trendingProducts: config.trendingProducts || [],
        exclusiveProducts: config.exclusiveProducts || []
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Error updating Home CMS configuration'
    });
  }
};
