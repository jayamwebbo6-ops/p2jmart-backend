const HomeCMS = require('../models/HomeCMS');
const { saveBase64Image, deleteImageFile, getImageUrl } = require('../utils/imageHelper');
const redisConfig = require('../config/redis');

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
    // Try to get from Redis cache first
    const cachedData = await redisConfig.getCache(redisConfig.CACHE_KEY);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        return res.status(200).json({
          success: true,
          code: 301, // 301 means retrieved from Redis
          source: 'redis',
          data: parsed
        });
      } catch (parseErr) {
        console.error('Failed to parse cached home CMS data, querying DB:', parseErr.message);
      }
    }

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
        exclusiveProducts: [],

        contactSetting: {
          phones: '+91 925537662, 936675427',
          email: 'p2gmart@gmail.com',
          address: 'Plot No 1, 3rd Street, tambaram, Urapakkam, Chennai - 603 210',
          facebook: '#',
          twitter: '#',
          instagram: '#',
          youtube: '#'
        },

        privacyPolicy: [
          {
            title: "1. Information We Collect",
            points: [
              "Personal Data: Name, email, shipping/billing address, phone number, and payment details.",
              "Automated Data: Cookies, IP address, browser type, and browsing behavior for analytics.",
              "Order Details: Purchase history, preferences, and interactions with customer support."
            ]
          },
          {
            title: "2. How We Use Your Information",
            points: [
              "Process and fulfill your orders.",
              "Improve our website, products, and services.",
              "Send transactional emails (order confirmations, shipping updates).",
              "Provide personalized offers (with your consent).",
              "Comply with legal obligations."
            ]
          },
          {
            title: "3. Data Sharing & Protection",
            points: [
              "We never sell your data to third parties.",
              "Trusted partners (payment processors, shipping carriers) only receive necessary information.",
              "Data is secured via encryption (SSL) and industry-standard safeguards."
            ]
          },
          {
            title: "4. Your Rights",
            points: [
              "Access, correct, or delete your personal data.",
              "Opt out of marketing emails (unsubscribe link in every email).",
              "Disable cookies via browser settings (may affect site functionality)."
            ]
          },
          {
            title: "5. Policy Updates",
            points: [
              "We may update this policy periodically. Changes will be posted here with the effective date.",
              "Last Updated: 17/6/2024",
              "Contact Us: For privacy-related questions, email [privacy@p2j-mart.gmail.com]."
            ]
          }
        ],

        cancellationReturnPolicy: [
          {
            title: "1. Return Conditions",
            points: [
              "Eligibility: We accept returns within 30 days of delivery for standard items.",
              "Condition: The item must be unused, in its original packaging, and in the same condition as when you received it.",
              "Customized Products: Products with custom embroidery, printing, or designs cannot be returned unless there is a manufacturing defect or printing error on our part.",
              "Proof of Purchase: A receipt, order confirmation email, or invoice is required to process any return request."
            ]
          },
          {
            title: "2. Cancellation Terms",
            points: [
              "Standard orders can be cancelled within 24 hours of purchase for a full refund.",
              "Customized or personalized print production batches cannot be cancelled once manufacturing or embroidery setups have begun.",
              "To cancel an order, contact user support immediately with your order reference ID number."
            ]
          },
          {
            title: "3. Refund Execution Methods",
            points: [
              "Once your return package is inspected and approved, a refund will be initialized automatically.",
              "Refund transactions are issued back to the original method of payment (bank gateway, credit card, etc.).",
              "Please allow 5 to 7 business days for the credit adjustments to reflect on your statement."
            ]
          }
        ],

        deliveryPolicy: [
          {
            title: "1. Shipping Options & Costs",
            points: [
              "Standard Shipping: Delivery within standard business days configured at checkout.",
              "Express Shipping: Expedited courier transit options available for urgent distributions.",
              "International Shipping: Shipping fees are auto-calculated at checkout based on package weights and geographic destinations."
            ]
          },
          {
            title: "2. Processing Time",
            points: [
              "Orders are processed within scheduled business days (excluding weekends and official public holidays).",
              "You will receive a automated confirmation message with full carrier tracking numbers once package hands off."
            ]
          },
          {
            title: "3. Undeliverable Orders",
            points: [
              "If packages route back due to incorrect address information, customer support will reach out to schedule secondary shipping arrangements."
            ]
          }
        ],

        termsConditions: [
          {
            title: "1. Information We Collect",
            points: [
              "Personal Data: We collect personally identifiable information, such as your name, shipping address, email address, and phone number, when you voluntarily register or make a purchase.",
              "Payment Data: Financial information related to your payment method (such as credit card details or digital wallet data) is securely processed by our third-party payment gateways.",
              "Automated Data: When you visit our website, our servers automatically log standard tracking data like your IP address, browser type, and operating system details to optimize performance."
            ]
          },
          {
            title: "2. How We Use Your Information",
            points: [
              "Order Fulfillment: To process and deliver your purchases, manage product order confirmations, and track logistical updates efficiently.",
              "Customer Experience: To resolve support requests, troubleshoot service errors, and improve website navigation interfaces based on user behavior metrics.",
              "Communications: To send transactional notifications, operational account updates, or promotional marketing newsletters (which you can opt-out of at any time)."
            ]
          },
          {
            title: "3. Data Sharing & Disclosure",
            points: [
              "Third-Party Service Providers: We share necessary data with trusted third parties who perform operational services on our behalf, including secure payment processors and shipping couriers.",
              "Legal Requirements: We may disclose your information if required to do so by applicable law, governmental mandates, or valid judicial court subpoenas."
            ]
          },
          {
            title: "4. Data Security & Storage",
            points: [
              "Protection Standards: We implement administrative, technical, and physical security measures designed to protect your personal information from unauthorized access, modification, or exposure.",
              "Risk Acknowledgment: While we take proactive industry-standard steps to secure your data, no method of transmission over the internet can guarantee absolute vulnerability protection."
            ]
          },
          {
            title: "5. Contact & Support",
            points: [
              "Email: vivaadhgroup@gmail.com",
              "Phone: 9361726968",
              "Address: 25, Vembuliamman koil street, West K.K. Nagar, Chennai 78"
            ]
          }
        ]
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

   const updatedResponseData = {
  heroSlider: formattedHero,
  offerBanners: formattedOffers,
  categoryGrid: formattedCategoryGrid,
  categorySections: formattedCategorySections,
  featuredProducts: config.featuredProducts || [],
  trendingProducts: config.trendingProducts || [],
  exclusiveProducts: config.exclusiveProducts || [],
  contactSetting: config.contactSetting || {},
  privacyPolicy: config.privacyPolicy || [],
  cancellationReturnPolicy: config.cancellationReturnPolicy || [],
  deliveryPolicy: config.deliveryPolicy || [],
  termsConditions: config.termsConditions || [],
  freeShippingMinAmount: config.freeShippingMinAmount !== undefined ? config.freeShippingMinAmount : 1000,
  flatShippingCost: config.flatShippingCost !== undefined ? config.flatShippingCost : 50
};

// Actively overwrite the stale cache with fresh data for 24 hours
await redisConfig.setCache(redisConfig.CACHE_KEY, JSON.stringify(updatedResponseData), 86400);

res.status(200).json({
  success: true,
  message: 'Home CMS configuration updated successfully',
  data: updatedResponseData
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
    const {
      heroSlider,
      offerBanners,
      categoryGrid,
      categorySections,
      featuredProducts,
      trendingProducts,
      exclusiveProducts,
      contactSetting,
      privacyPolicy,
      cancellationReturnPolicy,
      deliveryPolicy,
      termsConditions,
      freeShippingMinAmount,
      flatShippingCost
    } = req.body;

    let config = await HomeCMS.findOne({ key: CONFIG_KEY });
    if (!config) {
      config = new HomeCMS({ key: CONFIG_KEY });
    }

    // Process Hero Slider images only if provided
    if (heroSlider !== undefined) {
      const oldHeroImages = (config.heroSlider || []).map(s => s.image).filter(Boolean);
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
      config.heroSlider = processedHero;

      // Clean up replaced images from server storage
      const newHeroImages = processedHero.map(s => s.image).filter(Boolean);
      oldHeroImages.forEach(oldImg => {
        if (!newHeroImages.includes(oldImg)) {
          deleteImageFile(oldImg);
        }
      });
    }

    // Process Offer Banners images only if provided
    if (offerBanners !== undefined) {
      const oldOfferImages = (config.offerBanners || []).map(b => b.image).filter(Boolean);
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
      config.offerBanners = processedOffers;

      // Clean up replaced images from server storage
      const newOfferImages = processedOffers.map(b => b.image).filter(Boolean);
      oldOfferImages.forEach(oldImg => {
        if (!newOfferImages.includes(oldImg)) {
          deleteImageFile(oldImg);
        }
      });
    }

    // Process Category Grid images only if provided
    if (categoryGrid !== undefined) {
      const oldCategoryGridImages = (config.categoryGrid || []).map(c => c.image).filter(Boolean);
      const processedCategoryGrid = [];
      if (Array.isArray(categoryGrid)) {
        const limitedCategoryGrid = categoryGrid.slice(0, 3);
        for (let i = 0; i < limitedCategoryGrid.length; i++) {
          const card = limitedCategoryGrid[i];
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
      config.categoryGrid = processedCategoryGrid;

      // Clean up replaced images from server storage
      const newCategoryGridImages = processedCategoryGrid.map(c => c.image).filter(Boolean);
      oldCategoryGridImages.forEach(oldImg => {
        if (!newCategoryGridImages.includes(oldImg)) {
          deleteImageFile(oldImg);
        }
      });
    }

    // Process Category Sections banner images only if provided
    if (categorySections !== undefined) {
      const oldCategorySectionImages = (config.categorySections || []).map(s => s.bannerImage).filter(Boolean);
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
            productIds: Array.isArray(section.productIds) ? section.productIds.slice(0, 4) : []
          });
        }
      }
      config.categorySections = processedCategorySections;

      // Clean up replaced images from server storage
      const newCategorySectionImages = processedCategorySections.map(s => s.bannerImage).filter(Boolean);
      oldCategorySectionImages.forEach(oldImg => {
        if (!newCategorySectionImages.includes(oldImg)) {
          deleteImageFile(oldImg);
        }
      });
    }

    if (featuredProducts !== undefined) {
      config.featuredProducts = Array.isArray(featuredProducts) ? featuredProducts.slice(0, 4) : [];
    }
    if (trendingProducts !== undefined) {
      config.trendingProducts = Array.isArray(trendingProducts) ? trendingProducts.slice(0, 4) : [];
    }
    if (exclusiveProducts !== undefined) {
      config.exclusiveProducts = Array.isArray(exclusiveProducts) ? exclusiveProducts.slice(0, 4) : [];
    }

    // Save dynamic settings and policies if provided
    if (contactSetting !== undefined) {
      config.contactSetting = {
        phones: contactSetting.phones || '',
        email: contactSetting.email || '',
        address: contactSetting.address || '',
        facebook: contactSetting.facebook || '',
        twitter: contactSetting.twitter || '',
        instagram: contactSetting.instagram || '',
        youtube: contactSetting.youtube || ''
      };
    }

    if (privacyPolicy !== undefined) {
      config.privacyPolicy = Array.isArray(privacyPolicy) ? privacyPolicy.map(sec => ({
        title: sec.title || '',
        points: Array.isArray(sec.points) ? sec.points : []
      })) : [];
    }

    if (cancellationReturnPolicy !== undefined) {
      config.cancellationReturnPolicy = Array.isArray(cancellationReturnPolicy) ? cancellationReturnPolicy.map(sec => ({
        title: sec.title || '',
        points: Array.isArray(sec.points) ? sec.points : []
      })) : [];
    }

    if (deliveryPolicy !== undefined) {
      config.deliveryPolicy = Array.isArray(deliveryPolicy) ? deliveryPolicy.map(sec => ({
        title: sec.title || '',
        points: Array.isArray(sec.points) ? sec.points : []
      })) : [];
    }

    if (termsConditions !== undefined) {
      config.termsConditions = Array.isArray(termsConditions) ? termsConditions.map(sec => ({
        title: sec.title || '',
        points: Array.isArray(sec.points) ? sec.points : []
      })) : [];
    }

    if (freeShippingMinAmount !== undefined) {
      config.freeShippingMinAmount = Number(freeShippingMinAmount);
    }
    if (flatShippingCost !== undefined) {
      config.flatShippingCost = Number(flatShippingCost);
    }

    await config.save();

    // Return updated formatting
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

    // Invalidate/delete the home CMS config cache on updates
    await redisConfig.deleteCache(redisConfig.CACHE_KEY);

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
        exclusiveProducts: config.exclusiveProducts || [],
        contactSetting: config.contactSetting || {},
        privacyPolicy: config.privacyPolicy || [],
        cancellationReturnPolicy: config.cancellationReturnPolicy || [],
        deliveryPolicy: config.deliveryPolicy || [],
        termsConditions: config.termsConditions || [],
        freeShippingMinAmount: config.freeShippingMinAmount !== undefined ? config.freeShippingMinAmount : 1000,
        flatShippingCost: config.flatShippingCost !== undefined ? config.flatShippingCost : 50
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Error updating Home CMS configuration'
    });
  }
};
