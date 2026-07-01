
const express = require('express');
const router = express.Router();

const reviewController = require('../controllers/UserProductReviewController'); 

const { protectUser } = require('../middleware/userAuth'); 



router.get('/:productId', protectUser, reviewController.getProductReviews);
router.post('/add', protectUser, reviewController.addProductReview);
router.put('/edit', protectUser, reviewController.editProductReview);
router.delete('/delete', protectUser, reviewController.deleteProductReview);

module.exports = router;