const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protectUser } = require('../middleware/userAuth');
const { validateUserProfile } = require('../middleware/validator');

// Google Authentication
router.post('/google-login', userController.googleLogin);

// Email OTP Authentication (New Endpoints)
router.post('/send-otp', userController.sendOTP);
router.post('/verify-otp', userController.verifyOTP);

// Profile Management
router.get('/profile', protectUser, userController.getProfile);
router.put('/profile', protectUser, validateUserProfile, userController.updateProfile);

module.exports = router;