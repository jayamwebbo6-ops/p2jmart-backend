const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { saveBase64Image, getImageUrl, deleteImageFile } = require('../utils/imageHelper');

// Google Auth Login / Sign Up
exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    // Verify Google ID Token using Google API (industry standard self-contained verification)
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const googleRes = await fetch(verifyUrl);
    const tokenInfo = await googleRes.json();

    if (tokenInfo.error || !tokenInfo.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    // Validate Audience matches our Google Client ID
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (tokenInfo.aud !== clientId) {
      return res.status(400).json({
        success: false,
        message: 'Audience verification failed'
      });
    }

    const { sub: googleId, name, email, picture: photo } = tokenInfo;

    // Check if user already exists
    let user = await User.findOne({ googleId });
    if (!user) {
      // Check if email exists (bind Google identity to existing account if email matches)
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.googleId = googleId;
        user.photo = photo || user.photo;
        await user.save();
      } else {
        user = await User.create({
          googleId,
          name,
          email: email.toLowerCase(),
          photo: photo || ''
        });
      }
    }

    // Generate user JWT token
    const token = jwt.sign(
      { id: user._id, role: 'User' },
      process.env.JWT_SECRET || 'jwt_secret_p2jmart',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        photo: getImageUrl(user.photo),
        phone: user.phone || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

// Fetch User Profile
exports.getProfile = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        photo: getImageUrl(req.user.photo),
        phone: req.user.phone || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

// Update User Profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, photo } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    
    // Save image if new photo uploaded as base64
    if (photo !== undefined) {
      // If a new photo base64 is sent, delete the old file first
      if (photo && photo.startsWith('data:image')) {
        if (user.photo && !user.photo.startsWith('http')) {
          deleteImageFile(user.photo);
        }
        user.photo = saveBase64Image(photo, 'user', 'user');
      } else if (!photo) {
        // If photo is set to null/empty string, delete old file
        if (user.photo && !user.photo.startsWith('http')) {
          deleteImageFile(user.photo);
        }
        user.photo = '';
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        photo: getImageUrl(user.photo),
        phone: user.phone || ''
      }
    });
  } catch (err) {
    next(err);
  }
};
