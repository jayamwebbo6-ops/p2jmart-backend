const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protectUser } = require('../middleware/userAuth');

// User Payment Routes
router.post('/create', protectUser, paymentController.createPayment);
router.get('/status/:orderId', protectUser, paymentController.getPaymentStatus);

// Development Mock Simulation Routes
router.get('/simulate-response', paymentController.simulateResponse);

// CCAvenue Redirect Target Route (Public Callback - POST)
router.post('/response', paymentController.paymentResponse);

module.exports = router;
