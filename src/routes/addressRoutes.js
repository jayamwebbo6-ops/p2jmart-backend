const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const { protectUser } = require('../middleware/userAuth');

// All address routes require user authentication
router.use(protectUser);

router.post('/create-address', addressController.createAddress);
router.get('/get-my-addresses', addressController.getMyAddresses);
router.put('/update-address/:id', addressController.updateAddress);
router.delete('/delete-address/:id', addressController.deleteAddress);
router.put('/set-default/:id', addressController.setDefaultAddress);

module.exports = router;
