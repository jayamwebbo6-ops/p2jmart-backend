const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { saveBase64Image, getImageUrl, deleteImageFile } = require('../utils/imageHelper');

// Admin Login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password'
      });
    }

    // Try to find the admin by email or username
    const admin = await Admin.findOne({
      $or: [
        { email: username.toLowerCase() },
        { username: username }
      ]
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || 'jwt_secret_p2jmart',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      data: {
        username: admin.username,
        email: admin.email,
        photo: getImageUrl(admin.photo),
        role: admin.role
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get profile
exports.getProfile = async (req, res, next) => {
  try {
    let admin = await Admin.findOne();
    if (!admin) {
      // Seed default admin if none exists
      admin = await Admin.create({
        username: 'admin',
        email: 'admin@p2jmart.com',
        password: 'admin@123',
        photo: '',
        role: 'Administrator'
      });
    }
    
    // Return admin without password
    const adminData = {
      username: admin.username,
      email: admin.email,
      photo: getImageUrl(admin.photo),
      role: admin.role
    };
    
    return res.status(200).json({
      success: true,
      data: adminData
    });
  } catch (err) {
    next(err);
  }
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { username, email, photo, currentPassword, newPassword } = req.body;
    
    let admin = await Admin.findOne();
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found'
      });
    }
    
    // If updating password
    if (currentPassword && newPassword) {
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Incorrect current password'
        });
      }
      admin.password = newPassword;
    }
    
    // Update other fields
    if (username) admin.username = username;
    if (email) admin.email = email;
    if (photo !== undefined) {
      if (photo && photo.startsWith('data:image')) {
        if (admin.photo && !admin.photo.startsWith('http')) {
          deleteImageFile(admin.photo);
        }
        admin.photo = saveBase64Image(photo, 'avathar', 'avatar');
      } else if (!photo) {
        if (admin.photo && !admin.photo.startsWith('http')) {
          deleteImageFile(admin.photo);
        }
        admin.photo = '';
      }
    }
    
    await admin.save();
    
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        username: admin.username,
        email: admin.email,
        photo: getImageUrl(admin.photo),
        role: admin.role
      }
    });
  } catch (err) {
    next(err);
  }
};
