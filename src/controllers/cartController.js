const CartItem = require('../models/CartItem');
const { getValidProductImage, getImageUrl, saveBase64Image, getRelativeImagePath } = require('../utils/imageHelper');
const logger = require('../utils/logger');

const normalizeCartItem = (item) => {
  const product = item.productId;
  // Get valid relative path or URL, checking if file exists on disk and falling back to variant if not
  const resolvedPath = getValidProductImage(item.image, product);

  const normalized = {
    ...item,
    id: item._id,
    productId: product ? (product._id || product.id) : item.productId,
    image: getImageUrl(resolvedPath),
    freeShipping: product ? (product.freeShipping || 'No') : 'No'
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
    const items = await CartItem.find({ user: req.user._id }).populate('productId').lean();
    return res.status(200).json({
      success: true,
      data: items.map(normalizeCartItem)
    });
  } catch (err) {
    next(err);
  }
};

exports.addToCart = async (req, res, next) => {
  try {
    const { productId, title, price, quantity = 1, image = '', selectedOptions = {}, isComboProduct = false, includedProducts = [], weight = 0, category = 'Catalog' } = req.body;

    if (!productId || !title || price === undefined) {
      logger.cart.warn('Add to cart validation failed – missing required fields', { userId: req.user?._id, productId, title });
      return res.status(400).json({
        success: false,
        message: 'productId, title and price are required to add an item to cart'
      });
    }

    const processedSelectedOptions = { ...selectedOptions };
    if (processedSelectedOptions.customImage) {
      processedSelectedOptions.customImage = saveBase64Image(processedSelectedOptions.customImage, 'customization', 'custom-img');
    }

    let cartItem = await CartItem.findOne({ user: req.user._id, productId });
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

    const items = await CartItem.find({ user: req.user._id }).populate('productId').lean();
    logger.cart.info(`Item ${cartItem._id ? 'updated' : 'added'} in cart`, { userId: req.user._id, productId, title, quantity, price, isComboProduct });
    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: items.map(normalizeCartItem)
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

    if (payload.selectedOptions && payload.selectedOptions.customImage) {
      payload.selectedOptions.customImage = saveBase64Image(payload.selectedOptions.customImage, 'customization', 'custom-img');
    }

    if (payload.image) {
      payload.image = getRelativeImagePath(payload.image);
    }

    const cartItem = await CartItem.findOne({ _id: id, user: req.user._id });
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    Object.assign(cartItem, payload);
    await cartItem.save();

    const items = await CartItem.find({ user: req.user._id }).populate('productId').lean();
    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: items.map(normalizeCartItem)
    });
  } catch (err) {
    next(err);
  }
};

exports.removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await CartItem.deleteOne({ _id: id, user: req.user._id });
    logger.cart.info('Cart item removed', { userId: req.user._id, cartItemId: id });

    const items = await CartItem.find({ user: req.user._id }).populate('productId').lean();
    return res.status(200).json({
      success: true,
      message: 'Cart item removed',
      data: items.map(normalizeCartItem)
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
