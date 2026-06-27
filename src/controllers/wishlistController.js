const Wishlist = require("../models/Wishlist");
const { formatProductResponse } = require("./productController");

// Get Wishlist
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      user: req.user.id,
    }).populate("products");

    if (!wishlist) {
      return res.status(200).json([]);
    }

    const formatted = wishlist.products
      .map(p => formatProductResponse(p))
      .filter(Boolean);

    res.status(200).json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add Product
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    let wishlist = await Wishlist.findOne({
      user: req.user.id,
    });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.user.id,
        products: [],
      });
    }

    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    await wishlist.populate("products");

    const formatted = wishlist.products
      .map(p => formatProductResponse(p))
      .filter(Boolean);

    res.status(200).json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove Product
exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({
      user: req.user.id,
    });

    if (!wishlist) {
      return res.status(404).json({
        message: "Wishlist not found",
      });
    }

    wishlist.products = wishlist.products.filter(
      (item) => item.toString() !== productId
    );

    await wishlist.save();

    await wishlist.populate("products");

    const formatted = wishlist.products
      .map(p => formatProductResponse(p))
      .filter(Boolean);

    res.status(200).json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Clear Wishlist
exports.clearWishlist = async (req, res) => {
  try {
    await Wishlist.findOneAndUpdate(
      { user: req.user.id },
      { products: [] }
    );

    res.status(200).json({
      message: "Wishlist cleared",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};