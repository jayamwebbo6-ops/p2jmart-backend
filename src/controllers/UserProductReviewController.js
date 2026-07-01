const mongoose = require('mongoose'); // 🟢 Added mongoose import for ObjectId conversion

const Product = require('../models/Product');
const Order = require('../models/Order');



// 7. Add Product Review
exports.addProductReview = async (req, res) => {
  try {
    const { productId, rating, description } = req.body;
    
    // 1. Safety Guard: Extract and verify User ID context
    const rawUserId = req.user?._id || req.user?.id || req.userId;
    if (!rawUserId) {
      return res.status(401).json({ 
        success: false, 
        message: "User context not identified. Please log in again." 
      });
    }

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is missing from request payload." });
    }

    const userObjectId = new mongoose.Types.ObjectId(rawUserId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // 2. Scan for matching delivered orders containing this product
    const deliveredOrders = await Order.find({
      user: userObjectId,
      status: { $regex: /^delivered$/i } // Matches "Delivered" case-insensitively
    });

    const hasPurchasedAndDelivered = deliveredOrders.some(order => 
      order.items && order.items.some(item => 
        item.productId && item.productId.toString() === productObjectId.toString()
      )
    );

    if (!hasPurchasedAndDelivered) {
      return res.status(400).json({
        success: false,
        message: "You can only review items you purchased that have been delivered."
      });
    }

    // 3. Fetch Product document
    const product = await Product.findById(productObjectId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    if (!product.reviewList) {
      product.reviewList = [];
    }

    // 4. Look for an existing review by this user
    const existingReviewIndex = product.reviewList.findIndex(
      (rev) => rev.user && rev.user.toString() === userObjectId.toString()
    );

    let serverMessage = "Review posted successfully!";

    if (existingReviewIndex !== -1) {
      // Review exists -> Handle Editing Logic
      const existingReview = product.reviewList[existingReviewIndex];
      const reviewDate = new Date(existingReview.createdAt || new Date());
      const daysSinceReview = (new Date() - reviewDate) / (1000 * 60 * 60 * 24);

      // Enforce the 30-day cutoff
      if (daysSinceReview > 30) {
        return res.status(400).json({ 
          success: false, 
          message: "Reviews can only be edited within 30 days of posting." 
        });
      }

      // Update existing review properties
      product.reviewList[existingReviewIndex].rating = Number(rating);
      product.reviewList[existingReviewIndex].description = description;
      product.reviewList[existingReviewIndex].name = req.user?.name || existingReview.name || "Anonymous";
      
      serverMessage = "Review updated successfully!";
    } else {
      // No review exists -> Add a new one
      const reviewPayload = {
        user: userObjectId,
        name: req.user?.name || "Anonymous",
        rating: Number(rating),
        description: description
      };
      product.reviewList.push(reviewPayload);
    }
    
    // 5. Recalculate summary metrics safely
    product.reviews = product.reviewList.length; 
    product.rating = product.reviewList.reduce((acc, item) => item.rating + acc, 0) / product.reviewList.length;

    await product.save();

    return res.status(200).json({
      success: true,
      message: serverMessage
    });

  } catch (error) {
    console.error("Backend Review Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};


// 8. Edit Existing Product Review
exports.editProductReview = async (req, res) => {
  try {
    const { productId, rating, description } = req.body;
    
    // Safety Guard: Extract and verify User ID context
    const rawUserId = req.user?._id || req.user?.id || req.userId;
    if (!rawUserId) {
      return res.status(401).json({ 
        success: false, 
        message: "User context not identified. Please log in again." 
      });
    }

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is missing from request payload." });
    }

    const userObjectId = new mongoose.Types.ObjectId(rawUserId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Fetch Product document
    const product = await Product.findById(productObjectId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    if (!product.reviewList || product.reviewList.length === 0) {
      return res.status(400).json({ success: false, message: "No reviews found for this product." });
    }

    // Look for the user's specific review
    const reviewIndex = product.reviewList.findIndex(
      (rev) => rev.user && rev.user.toString() === userObjectId.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({ success: false, message: "Your review was not found on this product." });
    }

    const existingReview = product.reviewList[reviewIndex];
    const reviewDate = new Date(existingReview.createdAt || new Date());
    const daysSinceReview = (new Date() - reviewDate) / (1000 * 60 * 60 * 24);

    // Strict 30-day time lock verification
    if (daysSinceReview > 30) {
      return res.status(400).json({ 
        success: false, 
        message: "This review was posted over 30 days ago and can no longer be edited." 
      });
    }

    // Update fields
    product.reviewList[reviewIndex].rating = Number(rating);
    product.reviewList[reviewIndex].description = description;
    product.reviewList[reviewIndex].name = req.user?.name || existingReview.name || "Anonymous";

    // Recalculate average summary metrics metrics
    product.reviews = product.reviewList.length;
    product.rating = product.reviewList.reduce((acc, item) => item.rating + acc, 0) / product.reviewList.length;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully!"
    });

  } catch (error) {
    console.error("Backend Edit Review Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};


// 9. Delete Product Review
exports.deleteProductReview = async (req, res) => {
  try {
    const { productId } = req.body; // or req.params.productId depending on routing style
    
    // Safety Guard: Extract and verify User ID context
    const rawUserId = req.user?._id || req.user?.id || req.userId;
    if (!rawUserId) {
      return res.status(401).json({ 
        success: false, 
        message: "User context not identified. Please log in again." 
      });
    }

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is missing from request payload." });
    }

    const userObjectId = new mongoose.Types.ObjectId(rawUserId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Fetch Product document
    const product = await Product.findById(productObjectId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    if (!product.reviewList || product.reviewList.length === 0) {
      return res.status(400).json({ success: false, message: "No reviews exist on this item." });
    }

    // Check if the user actually has a review to pull
    const initialLength = product.reviewList.length;
    product.reviewList = product.reviewList.filter(
      (rev) => rev.user && rev.user.toString() !== userObjectId.toString()
    );

    if (product.reviewList.length === initialLength) {
      return res.status(404).json({ success: false, message: "No active review found under your user account for this product." });
    }

    // Recalculate summary metrics or gracefully default to zero if empty
    product.reviews = product.reviewList.length;
    if (product.reviewList.length > 0) {
      product.rating = product.reviewList.reduce((acc, item) => item.rating + acc, 0) / product.reviewList.length;
    } else {
      product.rating = 0; // Fallback default when no reviews are left
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Review removed successfully."
    });

  } catch (error) {
    console.error("Backend Delete Review Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};



// 10. Get Product Reviews (+ flag current user's own review)
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "A valid Product ID is required." });
    }

    const product = await Product.findById(productId).select('reviewList reviews rating');
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const reviewList = product.reviewList || [];
    const rawUserId = req.user?._id || req.user?.id || req.userId;

    const myReview = rawUserId
      ? reviewList.find(rev => rev.user && rev.user.toString() === rawUserId.toString())
      : null;

    return res.status(200).json({
      success: true,
      data: {
        reviews: reviewList,
        myReview: myReview || null
      }
    });
  } catch (error) {
    console.error("Backend Get Reviews Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};