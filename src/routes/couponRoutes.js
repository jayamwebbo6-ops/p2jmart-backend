const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { protectAdmin } = require('../middleware/auth');

router.post('/create', protectAdmin, couponController.createCoupon);
router.get('/getAll', couponController.getAllCoupons);
router.get('/available', couponController.getAvailableCoupons);

router.put('/toggle-status/:id', protectAdmin, couponController.toggleCouponStatus);
router.delete('/delete/:id', protectAdmin, couponController.deleteCoupon);
router.post('/apply', couponController.applyCoupon);

module.exports = router;
