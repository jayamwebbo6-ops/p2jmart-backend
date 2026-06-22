const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');
const { protectAdmin } = require('../middleware/auth');

// Public route to fetch attributes (e.g. for storefront)
router.get('/', attributeController.getAttributes);

// Protected routes to modify attributes (only admin allowed)
router.post('/', protectAdmin, attributeController.createAttribute);
router.put('/:id', protectAdmin, attributeController.updateAttribute);
router.delete('/:id', protectAdmin, attributeController.deleteAttribute);

module.exports = router;
