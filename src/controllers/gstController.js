const Gst = require('../models/Gst');

// Create a new GST category setting
exports.createGst = async (req, res, next) => {
  try {
    const { percentage, productCategoryName, gstStatus } = req.body;

    if (percentage === undefined || !productCategoryName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide both percentage and product category name.' 
      });
    }

    // Check if product category already has an assigned configuration rule
    const existingGst = await Gst.findOne({ 
      productCategoryName: productCategoryName.trim() 
    });
    
    if (existingGst) {
      return res.status(400).json({ 
        success: false, 
        message: 'A GST configuration already exists for this product category.' 
      });
    }

    const newGst = await Gst.create({
      percentage,
      productCategoryName,
      gstStatus
    });

    return res.status(201).json({
      success: true,
      message: 'GST setting created successfully',
      data: newGst
    });
  } catch (err) {
    next(err);
  }
};

// Get all GST configurations
exports.getAllGst = async (req, res, next) => {
  try {
    const gstList = await Gst.find({}).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: gstList.length,
      data: gstList
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing GST configuration
exports.updateGst = async (req, res, next) => {
  try {
    // 1. Data fields safely arrive here in req.body
    const { percentage, productCategoryName, gstStatus } = req.body;

    // 2. Document target lookup utilizes path variables from req.params
    let gstRecord = await Gst.findById(req.params.id);
    if (!gstRecord) {
      return res.status(404).json({
        success: false,
        message: 'GST record not found'
      });
    }

    if (percentage !== undefined) gstRecord.percentage = percentage;
    if (productCategoryName) gstRecord.productCategoryName = productCategoryName;
    if (gstStatus) gstRecord.gstStatus = gstStatus;

    await gstRecord.save();
    return res.status(200).json({ success: true, data: gstRecord });
  } catch (err) {
    next(err);
  }
};

// Delete a GST configuration rule
exports.deleteGst = async (req, res, next) => {
  try {
    // This looks at the URL path parameter: /delete-gst/:id
    const gstRecord = await Gst.findById(req.params.id);
    if (!gstRecord) {
      return res.status(404).json({
        success: false,
        message: 'GST record not found'
      });
    }

    await gstRecord.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'GST setting removed permanently from database'
    });
  } catch (err) {
    next(err);
  }
};