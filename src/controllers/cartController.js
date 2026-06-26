const CartItem = require('../models/CartItem');

const normalizeCartItem = (item) => ({
  ...item,
  id: item._id
});

exports.getCart = async (req, res, next) => {
  try {
    const items = await CartItem.find({ user: req.user._id }).lean();
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
    const { productId, title, price, quantity = 1, image = '', selectedOptions = {}, isComboProduct = false, includedProducts = [] } = req.body;

    if (!productId || !title || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'productId, title and price are required to add an item to cart'
      });
    }

    let cartItem = await CartItem.findOne({ user: req.user._id, productId });
    if (cartItem) {
      cartItem.quantity += quantity;
      cartItem.selectedOptions = selectedOptions;
      cartItem.image = image;
      cartItem.isComboProduct = isComboProduct;
      cartItem.includedProducts = includedProducts;
      await cartItem.save();
    } else {
      cartItem = await CartItem.create({
        user: req.user._id,
        productId,
        title,
        price,
        quantity,
        image,
        selectedOptions,
        isComboProduct,
        includedProducts
      });
    }

    const items = await CartItem.find({ user: req.user._id }).lean();
    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: items.map(normalizeCartItem)
    });
  } catch (err) {
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

    Object.assign(cartItem, payload);
    await cartItem.save();

    const items = await CartItem.find({ user: req.user._id }).lean();
    return res.status(200).json({
      success: true,
      message: 'Cart item updated',
      data: items
    });
  } catch (err) {
    next(err);
  }
};

exports.removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    await CartItem.deleteOne({ _id: id, user: req.user._id });

    const items = await CartItem.find({ user: req.user._id }).lean();
    return res.status(200).json({
      success: true,
      message: 'Cart item removed',
      data: items
    });
  } catch (err) {
    next(err);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    await CartItem.deleteMany({ user: req.user._id });
    return res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: []
    });
  } catch (err) {
    next(err);
  }
};
