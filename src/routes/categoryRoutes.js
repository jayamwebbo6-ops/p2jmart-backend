const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protectAdmin } = require('../middleware/auth');

// Category endpoints
router.get('/', categoryController.getCategories);
router.post('/', protectAdmin, categoryController.createCategory);
router.put('/:id', protectAdmin, categoryController.updateCategory);
router.delete('/:id', protectAdmin, categoryController.deleteCategory);

// Subcategory endpoints
router.post('/sub', protectAdmin, categoryController.createSubcategory);
router.put('/sub/:id', protectAdmin, categoryController.updateSubcategory);
router.delete('/sub/:id', protectAdmin, categoryController.deleteSubcategory);

module.exports = router;
