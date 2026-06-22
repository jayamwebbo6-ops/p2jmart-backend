const Attribute = require('../models/Attribute');

// Get all attributes
exports.getAttributes = async (req, res) => {
  try {
    const attributes = await Attribute.find();
    res.status(200).json({
      success: true,
      data: attributes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// Create a new attribute
exports.createAttribute = async (req, res) => {
  try {
    const { name, terms } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Attribute name is required'
      });
    }

    const lowercaseName = name.trim().toLowerCase();
    const existing = await Attribute.findOne({ name: lowercaseName });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Attribute "${lowercaseName}" already exists`
      });
    }

    const attribute = await Attribute.create({
      name: lowercaseName,
      terms: terms || []
    });

    res.status(201).json({
      success: true,
      data: attribute
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// Update an attribute (name and/or terms)
exports.updateAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, terms } = req.body;

    const attribute = await Attribute.findById(id);
    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: 'Attribute not found'
      });
    }

    if (name) {
      const lowercaseName = name.trim().toLowerCase();
      if (lowercaseName !== attribute.name) {
        const existing = await Attribute.findOne({ name: lowercaseName });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `Attribute "${lowercaseName}" already exists`
          });
        }
        attribute.name = lowercaseName;
      }
    }

    if (terms) {
      attribute.terms = terms;
    }

    await attribute.save();

    res.status(200).json({
      success: true,
      data: attribute
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

// Delete an attribute
exports.deleteAttribute = async (req, res) => {
  try {
    const { id } = req.params;
    const attribute = await Attribute.findByIdAndDelete(id);
    if (!attribute) {
      return res.status(404).json({
        success: false,
        message: 'Attribute not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Attribute deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};
