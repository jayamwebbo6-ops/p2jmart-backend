const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protectUser } = require('../middleware/userAuth');

const { validateUserProfile } = require('../middleware/validator');

router.post('/google-login', userController.googleLogin);
router.get('/profile', protectUser, userController.getProfile);
router.put('/profile', protectUser, validateUserProfile, userController.updateProfile);

module.exports = router;
