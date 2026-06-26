const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { protectUser } = require('../middleware/userAuth');

router.get('/', protectUser, cartController.getCart);
router.post('/', protectUser, cartController.addToCart);
router.put('/:id', protectUser, cartController.updateCartItem);
router.delete('/:id', protectUser, cartController.removeCartItem);
router.delete('/', protectUser, cartController.clearCart);

module.exports = router;
