const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { saveBase64Image, getImageUrl, deleteImageFile } = require('../utils/imageHelper');
const { sendEmail } = require('../utils/emailHelper'); // Helper that uses Nodemailer underneath
const Order = require('../models/Order'); // Ensure your Order model path is correct


// Helper to generate JWT token (Re-usable)
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId, role: 'User' },
    process.env.JWT_SECRET || 'jwt_secret_p2jmart',
    { expiresIn: '7d' }
  );
};

// 1. Send / Resend OTP
exports.sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const lowerEmail = email.toLowerCase();

    // Generate a 6-digit cryptographic-style numeric OTP string
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 Minutes Expiry

    // Find user or create a temporary skeleton if they are logging in for the first time
    let user = await User.findOne({ email: lowerEmail });
    if (!user) {
      user = new User({ email: lowerEmail });
    }

    // Assign the OTP parameters
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    user.isVerified = false; // Reset verification status until OTP is matched
    await user.save();

    // Send the email via Nodemailer utility
    const emailSubject = 'Your Login OTP - P2J Mart';
    const emailText = `Your temporary login code is ${otp}. It will expire in 5 minutes.`;
    
    await sendEmail(lowerEmail, emailSubject, emailText);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully'
    });
  } catch (err) {
    next(err);
  }
};

// 2. Verify OTP and Authenticate User
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.otp) {
      return res.status(400).json({ success: false, message: 'No active OTP request found for this email' });
    }

    // Check if OTP is expired
    if (new Date() > user.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Validate OTP match
    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    // Clear OTP fields upon successful verification
    user.otp = null;
    user.otpExpiresAt = null;
    user.isVerified = true;
    await user.save();

    // Generate auth token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully via OTP',
      token,
      data: {
        id: user._id,
        name: user.name || '',
        email: user.email,
        photo: getImageUrl(user.photo),
        phone: user.phone || ''
      }
    });
  } catch (err) {
    next(err);
  }
};

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

    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    const googleRes = await fetch(verifyUrl);
    const tokenInfo = await googleRes.json();

    if (tokenInfo.error || !tokenInfo.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (tokenInfo.aud !== clientId) {
      return res.status(400).json({
        success: false,
        message: 'Audience verification failed'
      });
    }

    const { sub: googleId, name, email, picture: photo } = tokenInfo;

    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.googleId = googleId;
        user.photo = photo || user.photo;
        // Mark as verified since Google confirms they own this mailbox
        user.isVerified = true; 
        await user.save();
      } else {
        user = await User.create({
          googleId,
          name,
          email: email.toLowerCase(),
          photo: photo || '',
          isVerified: true
        });
      }
    }

    const token = generateToken(user._id);

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
    
    if (photo !== undefined) {
      if (photo && photo.startsWith('data:image')) {
        if (user.photo && !user.photo.startsWith('http')) {
          deleteImageFile(user.photo);
        }
        user.photo = saveBase64Image(photo, 'user', 'user');
      } else if (!photo) {
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





// 1. Fetch all users along with calculated sales statistics
exports.adminGetAllUsers = async (req, res, next) => {
  try {
    const userStats = await User.aggregate([
      {
        // 1. Join with your orders collection
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'user',
          as: 'orderHistory'
        }
      },
      {
        // 2. NEW: Join with your addresses collection using userId
        $lookup: {
          from: 'addresses', 
          localField: '_id',
          foreignField: 'userId',
          as: 'addressList'
        }
      },
      {
        $project: {
          id: '$_id',
          _id: 1,
          name: { $ifNull: ['$name', 'New Member'] },
          email: 1,
          phone: { $ifNull: ['$phone', 'N/A'] },
          status: { $ifNull: ['$status', 'Active'] },
          joinedDate: { $ifNull: ['$createdAt', new Date()] },
          orders: { $size: '$orderHistory' },
          totalSpent: { $sum: '$orderHistory.total' },
          lastOrder: { $max: '$orderHistory.placedDate' },
          
          // 3. Extract and format the default address or first address found
          address: {
            $let: {
              vars: {
                // Prioritize default address, otherwise take the first address available
                chosenAddress: {
                  $ifNull: [
                    { $arrayElemAt: [{ $filter: { input: "$addressList", as: "addr", cond: { $eq: ["$$addr.isDefault", true] } } }, 0] },
                    { $arrayElemAt: ["$addressList", 0] }
                  ]
                }
              },
              in: {
                $cond: {
                  if: { $ifNull: ["$$chosenAddress", false] },
                  then: {
                    $concat: [
                      "$$chosenAddress.streetAddress", ", ",
                      { $cond: [{ $eq: ["$$chosenAddress.apartment", ""] }, "", { $concat: ["$$chosenAddress.apartment", ", "] }] },
                      "$$chosenAddress.city", ", ",
                      "$$chosenAddress.state", " - ",
                      "$$chosenAddress.pincode"
                    ]
                  },
                  else: "No address specified."
                }
              }
            }
          }
        }
      },
      {
        $sort: { joinedDate: -1 }
      }
    ]);

    const finalizedUsers = userStats.map(user => ({
      ...user,
      photo: getImageUrl(user.photo)
    }));

    return res.status(200).json({
      success: true,
      data: finalizedUsers
    });
  } catch (err) {
    next(err);
  }
};

// 2. Update Customer Account Status
exports.adminUpdateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status type assignment' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Customer account not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Status parameters adjusted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// 3. Delete Customer Account Permanently
exports.adminDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User reference not discovered.' });
    }

    // Erase physical disk avatar photos if configured locally
    if (user.photo && !user.photo.startsWith('http')) {
      deleteImageFile(user.photo);
    }

    await User.findByIdAndDelete(id);

    // Optional option: cascade delete user profile orders if business design dictates it
    // await Order.deleteMany({ user: id });

    return res.status(200).json({
      success: true,
      message: 'Customer entry scrubbed successfully.'
    });
  } catch (err) {
    next(err);
  }
};
