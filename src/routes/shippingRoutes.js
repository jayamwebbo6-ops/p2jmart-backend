const express = require('express');
const router = express.Router();
const shippingController = require('../controllers/shippingController');
const { protectAdmin } = require('../middleware/auth');

// Logging middleware for debugging
router.use((req, res, next) => {
  console.log(`[SHIPPING ROUTE] ${req.method} ${req.originalUrl}`);
  next();
});

router.post('/create-shipping', protectAdmin, shippingController.createShipping);
router.put('/update-shipping/:id', protectAdmin, shippingController.updateShipping);
router.delete('/delete-shipping/:id', protectAdmin, shippingController.deleteShipping);
router.get('/getAll-shipping', shippingController.getAllShipping);

module.exports = router;
