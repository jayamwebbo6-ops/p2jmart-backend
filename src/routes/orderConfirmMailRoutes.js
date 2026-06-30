const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderConfirmationMailController');
const { protect } = require('../middleware/auth'); 

router.post('/confirm-email', protect, orderController.sendOrderConfirmation);

module.exports = router;