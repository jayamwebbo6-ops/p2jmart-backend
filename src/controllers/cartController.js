const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const StockReservation = require('../models/StockReservation');
const { getValidProductImage, getImageUrl, saveBase64Image, getRelativeImagePath } = require('../utils/imageHelper');
const logger = require('../utils/logger');

// Helper function to get available stock for a product variant
const getAvailableStock = async (productId, variantId) => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      logger.cart.warn('Product not found for stock check', { productId });
      return 0;
    }
    if (product.isActive === false) {
      logger.cart.warn('Product is inactive for stock check', { productId });
      return 0;
    }

    let variant = null;

    // If variantId is provided and non-empty, try to find it
    if (variantId && variantId.trim()) {
      variant = product.variants?.find(v => {
        // Try multiple matching strategies for flexibility
        const vId = String(v.id || v._id || '');
        const reqId = String(variantId);
        return vId === reqId;
      });
    }

    // If no variant found or variantId was empty, use the first variant
    if (!variant && product.variants && product.variants.length > 0) {
      variant = product.variants[0];
    }

    // If still no variant, return 0
    if (!variant) {
      logger.cart.warn('No variant found for product', { productId, variantId, variantCount: product.variants?.length });
      return 0;
    }

    // Get total stock from variant (this is the simple approach - no reservation deduction)
    const totalStock = Math.max(0, Number(variant.stock) || 0);

    logger.cart.info('Stock check result', {
      productId,
      variantId: String(variant.id || variant._id),
      totalStock
    });

    return totalStock;
  } catch (err) {
    logger.cart.error('Error getting available stock', { productId, variantId, error: err.message });
    return 0;
  }
};


// Helper function to resolve stock for either a standard product or combo product
const resolveAvailableStock = async (productId, isComboProduct, includedProducts = [], variantId = '') => {
  const Product = require('../models/Product');
  
  if (isComboProduct) {
    const ComboPack = require('../models/ComboPack');
    const mongoose = require('mongoose');
    
    try {
      const combo = mongoose.isValidObjectId(productId) 
        ? await ComboPack.findById(productId).lean() 
        : null;
        
      let minStock = Infinity;
      if (combo && combo.selectedVariants && combo.selectedVariants.length > 0) {
        for (const sv of combo.selectedVariants) {
          const prod = await Product.findById(sv.productId).lean();
          if (!prod || prod.isActive === false) {
            minStock = 0;
            break;
          }
          const variant = prod.variants?.find(v => String(v.id || v._id) === String(sv.variantId));
          if (!variant) {
            minStock = 0;
            break;
          }
          const variantStock = Math.max(0, Number(variant.stock) || 0);
          if (variantStock < minStock) {
            minStock = variantStock;
          }
        }
      } else {
        const included = includedProducts || [];
        for (const subItem of included) {
          const subId = subItem.productId || subItem.id || subItem._id;
          const prod = await Product.findById(subId).lean();
          if (!prod || prod.isActive === false) {
            minStock = 0;
            break;
          }
          const vId = subItem.variantId || '';
          const variant = vId && prod.variants && prod.variants.length > 0
            ? prod.variants.find(v => String(v.id || v._id) === String(vId))
            : (prod.variants && prod.variants.length > 0 ? prod.variants[0] : null);
          if (!variant) {
            minStock = 0;
            break;
          }
          const variantStock = Math.max(0, Number(variant.stock) || 0);
          if (variantStock < minStock) {
            minStock = variantStock;
          }
        }
      }
      return minStock === Infinity ? 0 : minStock;
    } catch (err) {
      logger.cart.error('Error resolving combo available stock', { productId, error: err.message });
      return 0;
    }
  } else {
    return await getAvailableStock(productId, variantId);
  }
};

const asyncNormalizeCartItem = async (item) => {
  const ComboPack = require('../models/ComboPack');
  const Product = require('../models/Product');
  const mongoose = require('mongoose');

  let product = null;
  if (!item.isComboProduct && mongoose.isValidObjectId(item.productId)) {
    product = await Product.findById(item.productId).lean();
  }

  let availableStock = 0;
  let resolvedWeight = item.weight || 0;
  let isActiveProduct = true;

  if (item.isComboProduct) {
    const combo = mongoose.isValidObjectId(item.productId)
      ? await ComboPack.findById(item.productId).lean()
      : null;

    if (!combo) {
      // It's a customized combo pack or combo not found
      let minStock = Infinity;
      let allComponentsActive = true;
      let calculatedWeight = 0;

      const included = item.includedProducts || [];
      if (included.length === 0) {
        isActiveProduct = false;
        availableStock = 0;
      } else {
        for (const subItem of included) {
          const subId = subItem.productId || subItem.id || subItem._id;
          const prod = await Product.findById(subId).lean();
          if (!prod || prod.isActive === false) {
            allComponentsActive = false;
            minStock = 0;
            break;
          }
          const vId = subItem.variantId || '';
          const variant = vId && prod.variants && prod.variants.length > 0
            ? prod.variants.find(v => String(v.id || v._id) === String(vId))
            : (prod.variants && prod.variants.length > 0 ? prod.variants[0] : null);
          if (!variant) {
            allComponentsActive = false;
            minStock = 0;
            break;
          }
          const variantStock = Math.max(0, Number(variant.stock) || 0);
          if (variantStock < minStock) {
            minStock = variantStock;
          }
          calculatedWeight += Number(variant.weight ?? prod.weight ?? 0);
        }

        isActiveProduct = allComponentsActive;
        availableStock = minStock === Infinity ? 0 : minStock;
        if (calculatedWeight > 0) {
          resolvedWeight = calculatedWeight;
        }
      }
    } else if (combo.status === false) {
      isActiveProduct = false;
      availableStock = 0;
    } else {
      let minStock = Infinity;
      let allComponentsActive = true;
      let calculatedWeight = 0;

      if (combo.selectedVariants && combo.selectedVariants.length > 0) {
        for (const sv of combo.selectedVariants) {
          const prod = await Product.findById(sv.productId).lean();
          if (!prod || prod.isActive === false) {
            allComponentsActive = false;
            minStock = 0;
            break;
          }
          const variant = prod.variants.find(v => String(v.id || v._id) === String(sv.variantId));
          if (!variant) {
            allComponentsActive = false;
            minStock = 0;
            break;
          }
          const variantStock = Math.max(0, Number(variant.stock) || 0);
          if (variantStock < minStock) {
            minStock = variantStock;
          }
          calculatedWeight += Number(variant.weight ?? prod.weight ?? 0);
        }
      } else {
        const included = item.includedProducts || [];
        for (const subItem of included) {
          const subId = subItem.productId || subItem.id || subItem._id;
          const prod = await Product.findById(subId).lean();
          if (!prod || prod.isActive === false) {
            allComponentsActive = false;
            minStock = 0;
            break;
          }
          const variant = prod.variants && prod.variants.length > 0 ? prod.variants[0] : null;
          if (!variant) {
            allComponentsActive = false;
            minStock = 0;
            break;
          }
          const variantStock = Math.max(0, Number(variant.stock) || 0);
          if (variantStock < minStock) {
            minStock = variantStock;
          }
          calculatedWeight += Number(variant.weight ?? prod.weight ?? 0);
        }
      }

      isActiveProduct = allComponentsActive;
      availableStock = minStock === Infinity ? 0 : minStock;
      if (calculatedWeight > 0) {
        resolvedWeight = calculatedWeight;
      }
    }
  } else {
    if (product) {
      isActiveProduct = product.isActive !== false;
      if (product.variants && product.variants.length > 0) {
        const variantId = item.selectedOptions?.variantId || '';
        const variant = variantId
          ? product.variants.find(v => String(v.id || v._id) === String(variantId))
          : product.variants[0];

        if (variant) {
          availableStock = variant.stock || 0;
          resolvedWeight = variant.weight ?? product.weight ?? 0;
        } else {
          resolvedWeight = product.weight ?? 0;
        }
      } else {
        resolvedWeight = product.weight ?? 0;
      }
    } else {
      isActiveProduct = false;
      availableStock = 0;
    }
  }

  const resolvedPath = getValidProductImage(item.image, !item.isComboProduct ? product : null);

  const normalized = {
    ...item,
    id: item._id,
    productId: product ? (product._id || product.id) : item.productId,
    image: getImageUrl(resolvedPath),
    freeShipping: (!item.isComboProduct && product) ? (product.freeShipping || 'No') : 'No',
    weight: resolvedWeight,
    availableStock: availableStock,
    isActiveProduct: isActiveProduct
  };

  if (normalized.selectedOptions && normalized.selectedOptions.customImage) {
    normalized.selectedOptions = {
      ...normalized.selectedOptions,
      customImage: getImageUrl(normalized.selectedOptions.customImage)
    };
  }

  return normalized;
};

exports.getCart = async (req, res, next) => {
  try {
    const items = await CartItem.find({ user: req.user._id }).lean();
    return res.status(200).json({
      success: true,
      data: await Promise.all(items.map(asyncNormalizeCartItem))
    });
  } catch (err) {
    next(err);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const { productId, title, price, quantity = 1, image = '', selectedOptions = {}, isComboProduct = false, includedProducts = [], weight = 0, category = 'Catalog', variantId = '' } = req.body;

    if (!productId || !title || price === undefined) {
      logger.cart.warn('Add to cart validation failed – missing required fields', { userId: req.user?._id, productId, title });
      return res.status(400).json({
        success: false,
        message: 'productId, title and price are required to add an item to cart'
      });
    }

    // Check stock availability (resolving for combo component-based or standard products)
    const availableStock = await resolveAvailableStock(productId, isComboProduct, includedProducts, variantId);

    // Get existing cart item if any
    let cartItem = await CartItem.findOne({ user: req.user._id, productId });
    const currentCartQuantity = cartItem?.quantity || 0;
    const totalQuantityAfterAdd = currentCartQuantity + quantity;

    if (totalQuantityAfterAdd > availableStock) {
      logger.cart.warn('Stock limit exceeded on addToCart', {
        userId: req.user?._id,
        productId,
        requestedQty: quantity,
        currentCartQty: currentCartQuantity,
        availableStock
      });
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${availableStock}, Requested: ${totalQuantityAfterAdd}`,
        availableStock
      });
    }

    const processedSelectedOptions = { ...selectedOptions };
    if (processedSelectedOptions.customImage) {
      processedSelectedOptions.customImage = saveBase64Image(processedSelectedOptions.customImage, 'customization', 'custom-img');
    }

    if (cartItem) {
      cartItem.quantity += quantity;
      cartItem.selectedOptions = processedSelectedOptions;
      cartItem.image = getRelativeImagePath(image);
      cartItem.isComboProduct = isComboProduct;
      cartItem.includedProducts = includedProducts;
      cartItem.weight = weight;
      cartItem.category = category;
      await cartItem.save();
    } else {
      cartItem = await CartItem.create({
        user: req.user._id,
        productId,
        title,
        price,
        quantity,
        image: getRelativeImagePath(image),
        selectedOptions: processedSelectedOptions,
        isComboProduct,
        includedProducts,
        weight,
        category
      });
    }

    const items = await CartItem.find({ user: req.user._id }).lean();
    logger.cart.info(`Item ${cartItem._id ? 'updated' : 'added'} in cart`, { userId: req.user._id, productId, title, quantity, price, isComboProduct });
    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: await Promise.all(items.map(asyncNormalizeCartItem))
    });
  } catch (err) {
    logger.cart.error('Unexpected error in addToCart', { userId: req.user?._id, error: err.message });
    next(err);
  }
};

exports.updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const cartItem = await CartItem.findOne({ _id: id, user: req.user._id });
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // If quantity is being updated, validate stock
    if (payload.quantity !== undefined && payload.quantity !== cartItem.quantity) {
      const variantId = payload.variantId || cartItem.selectedOptions?.variantId || '';
      const availableStock = await resolveAvailableStock(
        cartItem.productId,
        cartItem.isComboProduct,
        cartItem.includedProducts,
        variantId
      );

      if (payload.quantity > availableStock) {
        logger.cart.warn('Stock limit exceeded on updateCartItem', {
          userId: req.user?._id,
          cartItemId: id,
          productId: cartItem.productId,
          requestedQty: payload.quantity,
          availableStock
        });
        return res.status(400).json({
          success: false,
          message: `Insufficient stock. Available: ${availableStock}, Requested: ${payload.quantity}`,
          availableStock
        });
      }
    }

    if (payload.selectedOptions && payload.selectedOptions.customImage) {
      payload.selectedOptions.customImage = saveBase64Image(payload.selectedOptions.customImage, 'customization', 'custom-img');
    }

    if (payload.image) {
      payload.image = getRelativeImagePath(payload.image);
    }

    Object.assign(cartItem, payload);
    await cartItem.save();

    const items = await CartItem.find({ user: req.user._id }).lean();
    logger.cart.info('Cart item updated', { userId: req.user._id, cartItemId: id, newQuantity: payload.quantity });
    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: await Promise.all(items.map(asyncNormalizeCartItem))
    });
  } catch (err) {
    logger.cart.error('Failed to update cart item', { userId: req.user?._id, error: err.message });
    next(err);
  }
};

exports.removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await CartItem.deleteOne({ _id: id, user: req.user._id });
    logger.cart.info('Cart item removed', { userId: req.user._id, cartItemId: id });

    const items = await CartItem.find({ user: req.user._id }).lean();
    return res.status(200).json({
      success: true,
      message: 'Cart item removed',
      data: await Promise.all(items.map(asyncNormalizeCartItem))
    });
  } catch (err) {
    logger.cart.error('Failed to remove cart item', { userId: req.user?._id, error: err.message });
    next(err);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    await CartItem.deleteMany({ user: req.user._id });
    logger.cart.info('Cart cleared', { userId: req.user._id });
    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: []
    });
  } catch (err) {
    logger.cart.error('Failed to clear cart', { userId: req.user?._id, error: err.message });
    next(err);
  }
};

