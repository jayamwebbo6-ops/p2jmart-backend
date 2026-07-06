const Coupon = require('../models/Coupon');

// Create a new Coupon
exports.createCoupon = async (req, res, next) => {
  try {
    const { 
      code, 
      status, 
      discountType, 
      discountValue, 
      maxDiscountAmount, 
      minOrderAmount, 
      validityFrom, 
      validityTo,
      title,
      applicableForActiveUsersOnly,
      isSingleUse
    } = req.body;

    if (!code || !discountValue || !validityFrom || !validityTo) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: code, discountValue, validityFrom, validityTo.' 
      });
    }

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: 'A coupon with this code already exists.'
      });
    }

    const formattedTitle = title || (discountType === 'Percentage (%)' 
      ? `${discountValue}% Off on your order` 
      : `Flat ₹${discountValue} Off on your order`);

    const newCoupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      status: status || 'Active',
      discountType,
      discountValue,
      maxDiscountAmount: maxDiscountAmount || 0,
      minOrderAmount: minOrderAmount || 0,
      validityFrom,
      validityTo,
      title: formattedTitle,
      applicableForActiveUsersOnly: applicableForActiveUsersOnly !== undefined ? applicableForActiveUsersOnly : true,
      isSingleUse: isSingleUse !== undefined ? isSingleUse : true
    });

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      data: newCoupon
    });
  } catch (err) {
    next(err);
  }
};

// Get all Coupons
exports.getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: coupons.length,
      data: coupons
    });
  } catch (err) {
    next(err);
  }
};

// Toggle Coupon status (Active / Inactive)
exports.toggleCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.'
      });
    }

    coupon.status = coupon.status === 'Active' ? 'Inactive' : 'Active';
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon status toggled to ${coupon.status}`,
      data: coupon
    });
  } catch (err) {
    next(err);
  }
};


exports.getAvailableCoupons = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const coupons = await Coupon.find({ status: 'Active' }).sort({ createdAt: -1 });

    const availableCoupons = coupons.filter(coupon => {
      const validFrom = new Date(coupon.validityFrom);
      validFrom.setHours(0, 0, 0, 0);

      const validTo = new Date(coupon.validityTo);
      validTo.setHours(23, 59, 59, 999);

      return today >= validFrom && today <= validTo;
    });

    return res.status(200).json({
      success: true,
      count: availableCoupons.length,
      data: availableCoupons
    });
  } catch (err) {
    next(err);
  }
};

// Delete a Coupon
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.'
      });
    }

    await coupon.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Coupon removed permanently from database'
    });
  } catch (err) {
    next(err);
  }
};

// Apply a Coupon (User / Checkout validation)
exports.applyCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a coupon code.'
      });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code.'
      });
    }

    if (coupon.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'This coupon is currently inactive.'
      });
    }

    // Check validity dates
    const currentDateStr = new Date().toISOString().split('T')[0];
    if (currentDateStr < coupon.validityFrom) {
      return res.status(400).json({
        success: false,
        message: `This coupon is not active yet. Valid from ${coupon.validityFrom}`
      });
    }
    if (currentDateStr > coupon.validityTo) {
      return res.status(400).json({
        success: false,
        message: 'This coupon has expired.'
      });
    }

    // Validate min order amount
    if (subtotal < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} is required to use this coupon.`
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === 'Percentage (%)') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount > 0 && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    return res.status(200).json({
      success: true,
      message: 'Coupon applied successfully.',
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Math.round(discountAmount),
        finalAmount: Math.round(subtotal - discountAmount)
      }
    });
  } catch (err) {
    next(err);
  }
};
