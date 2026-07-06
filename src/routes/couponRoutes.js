const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { protectAdmin } = require('../middleware/auth');
const { protectUser } = require('../middleware/userAuth');

router.post('/create', protectAdmin, couponController.createCoupon);
router.get('/getAll', couponController.getAllCoupons);
router.put('/toggle-status/:id', protectAdmin, couponController.toggleCouponStatus);
router.delete('/delete/:id', protectAdmin, couponController.deleteCoupon);
router.put('/update/:id', protectAdmin, couponController.updateCoupon);
router.post('/apply', protectUser, couponController.applyCoupon);
router.get('/get-eligible', protectUser, couponController.getEligibleCoupons);

module.exports = router;
