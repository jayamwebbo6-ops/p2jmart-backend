const express = require('express');
const router = express.Router();
const salesReportController = require('../controllers/salesReportController');
const { protectAdmin } = require('../middleware/auth');

router.get('/admin/summary', protectAdmin, salesReportController.getSalesReport);

router.get('/admin/product-wise', protectAdmin, salesReportController.getProductWiseSalesReport);

module.exports = router;