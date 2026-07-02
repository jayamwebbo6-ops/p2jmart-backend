const ComboPack = require('../models/ComboPack');
const { getValidProductImage } = require('../utils/imageHelper');

// Get all combo packs
exports.getAllCombos = async (req, res, next) => {
  try {
    const combos = await ComboPack.find().populate({
      path: 'selectedItemIds',
      select: 'title price image variants'
    });

    const formattedCombos = combos.map(combo => {
      const comboObj = combo.toObject();
      if (comboObj.selectedItemIds && Array.isArray(comboObj.selectedItemIds)) {
        comboObj.selectedItemIds = comboObj.selectedItemIds.map(item => {
          if (!item) return item;
          const resolvedPath = getValidProductImage(item.image, item);
          return {
            ...item,
            image: resolvedPath
          };
        });
      }
      return comboObj;
    });

    res.status(200).json({
      success: true,
      data: formattedCombos
    });
  } catch (err) {
    next(err);
  }
};
// Create a new combo pack
exports.createCombo = async (req, res, next) => {
  try {
    const { name, offerPrice, totalPrice, status, category, subcategory, description, selectedItemIds, selectedVariants, returnPolicy } = req.body;

    if (!name || !selectedItemIds || selectedItemIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name and at least one product must be selected.'
      });
    }

    const newCombo = new ComboPack({
      name,
      offerPrice: Number(offerPrice) || 0,
      totalPrice: Number(totalPrice) || 0,
      status: status !== false,
      category,
      subcategory,
      description,
      selectedItemIds,
      selectedVariants: selectedVariants || [],
      returnPolicy: returnPolicy || 'No Return Policy'
    });

    const saved = await newCombo.save();

    res.status(201).json({
      success: true,
      message: 'Combo pack created successfully',
      data: saved
    });
  } catch (err) {
    next(err);
  }
};

// Update an existing combo pack
exports.updateCombo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, offerPrice, totalPrice, status, category, subcategory, description, selectedItemIds, selectedVariants, returnPolicy } = req.body;

    const combo = await ComboPack.findById(id);
    if (!combo) {
      return res.status(444).json({
        success: false,
        message: 'Combo pack not found.'
      });
    }

    if (name !== undefined) combo.name = name;
    if (offerPrice !== undefined) combo.offerPrice = Number(offerPrice);
    if (totalPrice !== undefined) combo.totalPrice = Number(totalPrice);
    if (status !== undefined) combo.status = status;
    if (category !== undefined) combo.category = category;
    if (subcategory !== undefined) combo.subcategory = subcategory;
    if (description !== undefined) combo.description = description;
    if (selectedItemIds !== undefined) combo.selectedItemIds = selectedItemIds;
    if (selectedVariants !== undefined) combo.selectedVariants = selectedVariants;
    if (returnPolicy !== undefined) combo.returnPolicy = returnPolicy;

    const saved = await combo.save();

    res.status(200).json({
      success: true,
      message: 'Combo pack updated successfully',
      data: saved
    });
  } catch (err) {
    next(err);
  }
};

// Delete a combo pack
exports.deleteCombo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await ComboPack.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(444).json({
        success: false,
        message: 'Combo pack not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Combo pack deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// Toggle combo status
exports.toggleComboStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const combo = await ComboPack.findById(id);
    if (!combo) {
      return res.status(444).json({
        success: false,
        message: 'Combo pack not found.'
      });
    }

    combo.status = !combo.status;
    const saved = await combo.save();

    res.status(200).json({
      success: true,
      message: `Combo pack is now ${saved.status ? 'active' : 'inactive'}`,
      data: saved
    });
  } catch (err) {
    next(err);
  }
};
