const mongoose = require('mongoose');

const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const { saveBase64Image, deleteImageFile, getImageUrl, getValidProductImage } = require('../utils/imageHelper');
const logger = require('../utils/logger');

// Helper to extract relative path from absolute URLs before saving to DB
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

// Helper to format product data for response with full image URLs
const formatProductResponse = (prod) => {
  if (!prod) return null;
  const isLean = !prod.toObject;
  const prodObj = isLean ? prod : prod.toObject();

  const formattedVariants = (prodObj.variants || []).map(v => ({
    ...v,
    image: getImageUrl(v.image),
    images: (v.images || []).map(img => getImageUrl(img))
  }));

  let derivedPrice = 0;
  let derivedOriginalPrice = null;
  let derivedDiscount = 0;

  if (formattedVariants.length > 0) {
    const firstVar = formattedVariants[0];
    derivedPrice = Number(firstVar.price) || 0;
    derivedOriginalPrice = firstVar.originalPrice ? Number(firstVar.originalPrice) : null;
    if (derivedOriginalPrice && derivedPrice && derivedOriginalPrice > derivedPrice) {
      derivedDiscount = Math.round(((derivedOriginalPrice - derivedPrice) / derivedOriginalPrice) * 100);
    }
  }

  const resolvedImage = getValidProductImage(prodObj.image, prodObj);

  return {
    ...prodObj,
    id: prodObj._id.toString(),
    _id: prodObj._id.toString(),
    collection: prodObj.collectionName || 'None',
    image: getImageUrl(resolvedImage),
    variants: formattedVariants,
    price: derivedPrice,
    originalPrice: derivedOriginalPrice,
    discount: derivedDiscount,
    isActive: prodObj.isActive !== false,
    category: prodObj.category && prodObj.category._id 
      ? { id: prodObj.category._id.toString(), name: prodObj.category.name } 
      : prodObj.category,
    subcategory: prodObj.subcategory && prodObj.subcategory._id 
      ? { id: prodObj.subcategory._id.toString(), name: prodObj.subcategory.name, slug: prodObj.subcategory.slug } 
      : prodObj.subcategory
  };
};

exports.formatProductResponse = formatProductResponse;

// 1. Get all products (with optional filtering and populating)
exports.getProducts = async (req, res) => {
  try {
    const { categoryId, subcategoryId, customizeProduct, includeInactive } = req.query;
    const filter = {};
    if (categoryId) filter.category = categoryId;
    if (subcategoryId) {
      if (mongoose.Types.ObjectId.isValid(subcategoryId)) {
        filter.subcategory = subcategoryId;
      } else {
        const subcat = await Subcategory.findOne({ slug: subcategoryId }).lean();
        if (subcat) {
          filter.subcategory = subcat._id;
        } else {
          return res.status(200).json({
            success: true,
            data: []
          });
        }
      }
    }
    if (customizeProduct) filter.customizeProduct = customizeProduct;

    if (includeInactive !== 'true') {
      filter.isActive = { $ne: false };
    }

    const products = await Product.find(filter)
      .populate('category', 'name')
      .populate('subcategory', 'name slug')
      .lean();

    const formattedProducts = products.map(prod => formatProductResponse(prod));

    res.status(200).json({
      success: true,
      data: formattedProducts
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 2. Get single product by ID or Slug
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    let query;
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = { slug: id };
    }
    const product = await Product.findOne(query)
      .populate('category')
      .populate('subcategory')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: formatProductResponse(product)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 3. Create Product
exports.createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      brand,
      collection,
      customizeProduct,
      customizationType,
      warranty,
      returnPolicy,
      deliveryMode,
      price,
      originalPrice,
      discount,
      rating,
      reviews,
      selectedAttributes,
      variants,
      image,
      metaTitle,
      keywords,
      seoDescription,
      detailedDescription,
      categoryId,
      subcategoryId,
      freeShipping
    } = req.body;

    const processedVariants = (variants || []).map((v, idx) => {
      const savedVarImages = [];
      if (v.images && v.images.length > 0) {
        v.images.forEach((img, imgIdx) => {
          if (img) {
            const cleanImg = getRelativeImagePath(img);
            if (cleanImg.startsWith('data:image')) {
              const savedPath = saveBase64Image(cleanImg, 'products', `variant-${idx}-img-${imgIdx}`);
              savedVarImages.push(savedPath);
            } else {
              savedVarImages.push(cleanImg);
            }
          }
        });
      }

      let savedVarImage = '';
      if (v.image) {
        const cleanVarImg = getRelativeImagePath(v.image);
        if (cleanVarImg.startsWith('data:image')) {
          savedVarImage = saveBase64Image(cleanVarImg, 'products', `variant-${idx}`);
        } else {
          savedVarImage = cleanVarImg;
        }
      } else if (savedVarImages.length > 0) {
        savedVarImage = savedVarImages[0];
      }

      return {
        id: v.id || `var-${Date.now()}-${idx}`,
        attributes: v.attributes || {},
        price: Number(v.price) || 0,
        originalPrice: v.originalPrice ? Number(v.originalPrice) : null,
        stock: Number(v.stock) || 0,
        weight: Number(v.weight) || 0,
        image: savedVarImage,
        images: savedVarImages
      };
    });

    let priceNum = Number(price) || 0;
    let originalPriceNum = originalPrice ? Number(originalPrice) : null;
    let discountNum = Number(discount) || 0;

    if (processedVariants.length > 0) {
      const firstVar = processedVariants[0];
      priceNum = Number(firstVar.price) || 0;
      originalPriceNum = firstVar.originalPrice ? Number(firstVar.originalPrice) : null;
      if (originalPriceNum && priceNum && originalPriceNum > priceNum) {
        discountNum = Math.round(((originalPriceNum - priceNum) / originalPriceNum) * 100);
      } else {
        discountNum = 0;
      }
    }

    if (!title || !priceNum || !categoryId || !subcategoryId) {
      return res.status(400).json({
        success: false,
        message: 'Title, Category, Subcategory, and at least one Variant (with Price) are required'
      });
    }

    let savedMainImage = '';
    if (image) {
      const cleanImg = getRelativeImagePath(image);
      if (cleanImg.startsWith('data:image')) {
        savedMainImage = saveBase64Image(cleanImg, 'products', 'product');
      } else {
        savedMainImage = cleanImg;
      }
    } else if (processedVariants.length > 0) {
      savedMainImage = processedVariants[0].image || (processedVariants[0].images && processedVariants[0].images.length > 0 ? processedVariants[0].images[0] : '');
    }

    const product = await Product.create({
      title,
      description,
      brand,
      collectionName: collection || 'None',
      customizeProduct: customizeProduct || 'No',
      customizationType: customizationType || 'Text',
      warranty,
      returnPolicy: returnPolicy || 'Select Return Days',
      deliveryMode,
      rating: Number(rating) || 5,
      reviews: Number(reviews) || 0,
      selectedAttributes: selectedAttributes || {},
      variants: processedVariants,
      image: savedMainImage,
      metaTitle,
      keywords,
      seoDescription,
      detailedDescription,
      category: categoryId,
      subcategory: subcategoryId,
      freeShipping: freeShipping || 'No',
      reviewList: []
    });

    logger.product.info('New product created', {
      productId: product._id,
      title: product.title,
      categoryId,
      subcategoryId,
      variantCount: processedVariants.length,
      price: priceNum
    });

    res.status(201).json({
      success: true,
      data: formatProductResponse(product)
    });
  } catch (err) {
    logger.product.error('Failed to create product', { title: req.body?.title, error: err.message });
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 4. Update Product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      brand,
      collection,
      customizeProduct,
      customizationType,
      warranty,
      returnPolicy,
      deliveryMode,
      variants,
      image,
      metaTitle,
      keywords,
      seoDescription,
      detailedDescription,
      categoryId,
      subcategoryId,
      freeShipping,
      rating,
      reviews
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (image !== undefined) {
      if (!image) {
        if (product.image) deleteImageFile(getRelativeImagePath(product.image));
        product.image = '';
      } else {
        const cleanImg = getRelativeImagePath(image);
        if (cleanImg.startsWith('data:image')) {
          if (product.image) deleteImageFile(getRelativeImagePath(product.image));
          product.image = saveBase64Image(cleanImg, 'products', 'product');
        } else {
          product.image = cleanImg;
        }
      }
    }

    const oldVariants = product.variants || [];

    const processedVariants = (variants || []).map((v, idx) => {
      const oldVar = oldVariants.find(ov => ov.id === v.id) || {};
      const savedVarImages = [];
      const incomingImages = v.images || [];
      const oldVarImages = oldVar.images || [];

      incomingImages.forEach((img, imgIdx) => {
        if (img) {
          const cleanImg = getRelativeImagePath(img);
          if (cleanImg.startsWith('data:image')) {
            const savedPath = saveBase64Image(cleanImg, 'products', `variant-${idx}-img-${imgIdx}`);
            savedVarImages.push(savedPath);
          } else {
            savedVarImages.push(cleanImg);
          }
        }
      });

      oldVarImages.forEach(oldImg => {
        if (oldImg) {
          const cleanOldImg = getRelativeImagePath(oldImg);
          const cleanSavedVarImages = savedVarImages.map(url => getRelativeImagePath(url));
          if (!cleanSavedVarImages.includes(cleanOldImg)) {
            deleteImageFile(cleanOldImg);
          }
        }
      });

      let savedVarImage = '';
      if (v.image) {
        const cleanVarImg = getRelativeImagePath(v.image);
        if (cleanVarImg.startsWith('data:image')) {
          if (oldVar.image) deleteImageFile(getRelativeImagePath(oldVar.image));
          savedVarImage = saveBase64Image(cleanVarImg, 'products', `variant-${idx}`);
        } else {
          savedVarImage = cleanVarImg;
        }
      } else if (savedVarImages.length > 0) {
        savedVarImage = savedVarImages[0];
      }

      if (oldVar.image) {
        const cleanOldVarImg = getRelativeImagePath(oldVar.image);
        const cleanSavedVarImages = savedVarImages.map(url => getRelativeImagePath(url));
        if (cleanOldVarImg !== savedVarImage && !cleanSavedVarImages.includes(cleanOldVarImg)) {
          deleteImageFile(cleanOldVarImg);
        }
      }

      return {
        id: v.id || `var-${Date.now()}-${idx}`,
        attributes: v.attributes || {},
        price: Number(v.price) || 0,
        originalPrice: v.originalPrice ? Number(v.originalPrice) : null,
        stock: Number(v.stock) || 0,
        weight: Number(v.weight) || 0,
        image: savedVarImage,
        images: savedVarImages
      };
    });

    oldVariants.forEach(oldV => {
      const exists = (variants || []).some(v => v.id === oldV.id);
      if (!exists) {
        if (oldV.image) deleteImageFile(getRelativeImagePath(oldV.image));
        (oldV.images || []).forEach(img => {
          if (img) deleteImageFile(getRelativeImagePath(img));
        });
      }
    });

    product.title = title || product.title;
    product.description = description !== undefined ? description : product.description;
    product.brand = brand !== undefined ? brand : product.brand;
    product.collectionName = collection || product.collectionName;
    product.customizeProduct = customizeProduct || product.customizeProduct;
    product.customizationType = customizationType || product.customizationType;
    product.warranty = warranty !== undefined ? warranty : product.warranty;
    product.returnPolicy = returnPolicy || product.returnPolicy;
    product.deliveryMode = deliveryMode !== undefined ? deliveryMode : product.deliveryMode;
    product.freeShipping = freeShipping || product.freeShipping;
    product.variants = processedVariants;

    if (!product.image && processedVariants.length > 0) {
      product.image = processedVariants[0].image || (processedVariants[0].images && processedVariants[0].images.length > 0 ? processedVariants[0].images[0] : '');
    }
    product.metaTitle = metaTitle !== undefined ? metaTitle : product.metaTitle;
    product.keywords = keywords !== undefined ? keywords : product.keywords;
    product.seoDescription = seoDescription !== undefined ? seoDescription : product.seoDescription;
    product.detailedDescription = detailedDescription !== undefined ? detailedDescription : product.detailedDescription;
    product.category = categoryId || product.category;
    product.subcategory = subcategoryId || product.subcategory;

    await product.save();

    res.status(200).json({
      success: true,
      data: formatProductResponse(product)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 5. Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.image) deleteImageFile(getRelativeImagePath(product.image));

    (product.variants || []).forEach(v => {
      if (v.image) deleteImageFile(getRelativeImagePath(v.image));
      (v.images || []).forEach(img => {
        if (img) deleteImageFile(getRelativeImagePath(img));
      });
    });

    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Product and all associated images deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// 6. Toggle Product Active/Inactive Status
exports.toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: product.isActive }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

