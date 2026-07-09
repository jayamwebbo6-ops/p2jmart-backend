
const express = require('express');
const router = express.Router();

const reviewController = require('../controllers/UserProductReviewController');

const { protectUser } = require('../middleware/userAuth');


router.post('/add', protectUser, reviewController.addProductReview);
router.put('/edit', protectUser, reviewController.editProductReview);
router.delete('/delete', protectUser, reviewController.deleteProductReview);

router.get('/:productId', reviewController.getProductReviews);

module.exports = router;