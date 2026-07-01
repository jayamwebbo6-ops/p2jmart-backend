const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// 🔒 Aligned perfectly with your middleware exports file!
const { protectAdmin } = require('../middleware/auth'); 


// Product endpoints
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', protectAdmin, productController.createProduct);
router.put('/:id', protectAdmin, productController.updateProduct);
router.patch('/:id/toggle-status', protectAdmin, productController.toggleProductStatus);
router.delete('/:id', protectAdmin, productController.deleteProduct);



module.exports = router;