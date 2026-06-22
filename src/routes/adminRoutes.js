const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const { protectAdmin } = require('../middleware/auth');

router.post('/login', adminController.login);
router.get('/profile', protectAdmin, adminController.getProfile);
router.put('/profile', protectAdmin, adminController.updateProfile);

module.exports = router;
