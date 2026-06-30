const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const { protectAdmin } = require('../middleware/auth');
const { validateAdminProfile } = require('../middleware/validator');

router.get('/get-email', adminController.getAdminEmailPublic);

router.post('/forgot-password', adminController.forgotPassword);
router.post('/reset-password', adminController.resetPassword);

router.post('/login', adminController.login);
router.get('/profile', protectAdmin, adminController.getProfile);
router.put('/profile', protectAdmin, validateAdminProfile, adminController.updateProfile);

module.exports = router;