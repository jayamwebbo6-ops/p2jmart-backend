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


// Admin Customer Management Endpoints
router.get('/admin/get-all-users', userController.adminGetAllUsers);
router.put('/admin/update-status/:id', userController.adminUpdateStatus);
router.delete('/admin/delete/:id', userController.adminDeleteUser);

module.exports = router;