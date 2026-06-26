const Address = require('../models/Address');

// Create a new address for the logged-in user
exports.createAddress = async (req, res, next) => {
  try {
    const { fullName, phoneNumber, streetAddress, apartment, city, state, stateId, pincode, isDefault } = req.body;
    const userId = req.user._id;

    if (!fullName || !phoneNumber || !streetAddress || !city || !state || !stateId || !pincode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: fullName, phoneNumber, streetAddress, city, state, stateId, pincode.'
      });
    }

    // Check if this is the user's first address. If so, force it to be default.
    const addressCount = await Address.countDocuments({ userId });
    const finalIsDefault = addressCount === 0 ? true : !!isDefault;

    // If setting as default, update other addresses of this user to be non-default
    if (finalIsDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const newAddress = await Address.create({
      userId,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      streetAddress: streetAddress.trim(),
      apartment: apartment ? apartment.trim() : '',
      city: city.trim(),
      state: state.trim(),
      stateId,
      pincode: pincode.trim(),
      isDefault: finalIsDefault
    });

    return res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data: newAddress
    });
  } catch (err) {
    next(err);
  }
};

// Get all addresses of the logged-in user
exports.getMyAddresses = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses
    });
  } catch (err) {
    next(err);
  }
};

// Update an address
exports.updateAddress = async (req, res, next) => {
  try {
    const { fullName, phoneNumber, streetAddress, apartment, city, state, stateId, pincode, isDefault } = req.body;
    const userId = req.user._id;

    let addressRecord = await Address.findById(req.params.id);
    if (!addressRecord) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Authorization check
    if (addressRecord.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this address'
      });
    }

    // If changing isDefault to true, unset other addresses
    if (isDefault && !addressRecord.isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
      addressRecord.isDefault = true;
    } else if (isDefault !== undefined) {
      addressRecord.isDefault = isDefault;
    }

    if (fullName) addressRecord.fullName = fullName.trim();
    if (phoneNumber) addressRecord.phoneNumber = phoneNumber.trim();
    if (streetAddress) addressRecord.streetAddress = streetAddress.trim();
    if (apartment !== undefined) addressRecord.apartment = apartment.trim();
    if (city) addressRecord.city = city.trim();
    if (state) addressRecord.state = state.trim();
    if (stateId) addressRecord.stateId = stateId;
    if (pincode) addressRecord.pincode = pincode.trim();

    await addressRecord.save();
    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: addressRecord
    });
  } catch (err) {
    next(err);
  }
};

// Delete an address
exports.deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const addressRecord = await Address.findById(req.params.id);

    if (!addressRecord) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Authorization check
    if (addressRecord.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this address'
      });
    }

    const wasDefault = addressRecord.isDefault;
    await addressRecord.deleteOne();

    // If the deleted address was default, set another address as default
    if (wasDefault) {
      const remainingAddress = await Address.findOne({ userId });
      if (remainingAddress) {
        remainingAddress.isDefault = true;
        await remainingAddress.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

// Set an address as default
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const addressRecord = await Address.findById(req.params.id);

    if (!addressRecord) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    // Authorization check
    if (addressRecord.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this address'
      });
    }

    // Set all other user addresses to non-default
    await Address.updateMany({ userId }, { isDefault: false });

    addressRecord.isDefault = true;
    await addressRecord.save();

    return res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      data: addressRecord
    });
  } catch (err) {
    next(err);
  }
};
