const Shipping = require('../models/Shipping');

// Create a new shipping rate
exports.createShipping = async (req, res, next) => {
  try {
    const { stateName, baseWeight, baseCost, additionalWeight, additionalCost } = req.body;

    if (!stateName || baseWeight === undefined || baseCost === undefined || additionalWeight === undefined || additionalCost === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: stateName, baseWeight, baseCost, additionalWeight, additionalCost.' 
      });
    }

    // Check if state already exists
    const existingShipping = await Shipping.findOne({ 
      stateName: { $regex: new RegExp(`^${stateName.trim()}$`, 'i') }
    });
    
    if (existingShipping) {
      return res.status(400).json({ 
        success: false, 
        message: 'A shipping cost rule already exists for this state.' 
      });
    }

    const newShipping = await Shipping.create({
      stateName: stateName.trim(),
      baseWeight: Number(baseWeight),
      baseCost: Number(baseCost),
      additionalWeight: Number(additionalWeight),
      additionalCost: Number(additionalCost)
    });

    return res.status(201).json({
      success: true,
      message: 'Shipping rate created successfully',
      data: newShipping
    });
  } catch (err) {
    next(err);
  }
};

// Get all shipping rates
exports.getAllShipping = async (req, res, next) => {
  try {
    const shippingList = await Shipping.find({}).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: shippingList.length,
      data: shippingList
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing shipping rate
exports.updateShipping = async (req, res, next) => {
  try {
    const { stateName, baseWeight, baseCost, additionalWeight, additionalCost } = req.body;

    let shippingRecord = await Shipping.findById(req.params.id);
    if (!shippingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Shipping record not found'
      });
    }

    if (stateName) {
      // Check duplicate state name (excluding self)
      const existingShipping = await Shipping.findOne({
        stateName: { $regex: new RegExp(`^${stateName.trim()}$`, 'i') },
        _id: { $ne: req.params.id }
      });
      if (existingShipping) {
        return res.status(400).json({
          success: false,
          message: 'A shipping cost rule already exists for this state.'
        });
      }
      shippingRecord.stateName = stateName.trim();
    }

    if (baseWeight !== undefined) shippingRecord.baseWeight = Number(baseWeight);
    if (baseCost !== undefined) shippingRecord.baseCost = Number(baseCost);
    if (additionalWeight !== undefined) shippingRecord.additionalWeight = Number(additionalWeight);
    if (additionalCost !== undefined) shippingRecord.additionalCost = Number(additionalCost);

    await shippingRecord.save();
    return res.status(200).json({ 
      success: true, 
      message: 'Shipping rate updated successfully',
      data: shippingRecord 
    });
  } catch (err) {
    next(err);
  }
};

// Delete a shipping rate
exports.deleteShipping = async (req, res, next) => {
  try {
    const shippingRecord = await Shipping.findById(req.params.id);
    if (!shippingRecord) {
      return res.status(404).json({
        success: false,
        message: 'Shipping record not found'
      });
    }

    await shippingRecord.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Shipping record removed permanently from database'
    });
  } catch (err) {
    next(err);
  }
};
