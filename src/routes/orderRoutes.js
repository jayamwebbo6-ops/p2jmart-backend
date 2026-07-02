const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protectUser } = require('../middleware/userAuth');
const { protectAdmin } = require('../middleware/auth');

// User Order Routes
router.post('/create-order', protectUser, orderController.createOrder);
router.get('/get-my-orders', protectUser, orderController.getMyOrders);
router.get('/get-order/:id', protectUser, orderController.getOrderById);
router.put('/cancel-order/:id', protectUser, orderController.cancelOrder);
router.put('/:id/items/:itemId/return-request', protectUser, orderController.requestItemReturn);

// Admin Order Routes
router.get('/admin/get-all-orders', protectAdmin, orderController.getAdminOrders);
router.get('/admin/return-requests', protectAdmin, orderController.getAdminReturnRequests);
router.put('/admin/update-status/:id', protectAdmin, orderController.updateOrderStatus);
router.put('/:id/items/:itemId/admin/review-return', protectAdmin, orderController.adminReviewReturn);
router.put('/:id/items/:itemId/admin/receive-parcel', protectAdmin, orderController.adminReceiveParcel);
router.put('/:id/items/:itemId/admin/refund-item', protectAdmin, orderController.adminRefundItem);

module.exports = router;
