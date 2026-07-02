const mongoose = require('mongoose'); // 🟢 Added mongoose import for ObjectId conversion

const Product = require('../models/Product');
const Order = require('../models/Order');
const Combo = require('../models/ComboPack'); 



// exports.addProductReview = async (req, res) => {
//   try {
//     const { productId, rating, description } = req.body;
    
//     // 1. Safety Guard: Extract and verify User ID context
//     const rawUserId = req.user?._id || req.user?.id || req.userId;
//     if (!rawUserId) {
//       return res.status(401).json({ 
//         success: false, 
//         message: "User context not identified. Please log in again." 
//       });
//     }

//     if (!productId) {
//       return res.status(400).json({ success: false, message: "Product ID is missing from request payload." });
//     }

//     const userObjectId = new mongoose.Types.ObjectId(rawUserId);
//     const productObjectId = new mongoose.Types.ObjectId(productId);

//     // 2. Scan for matching delivered orders containing this product
//     const deliveredOrders = await Order.find({
//       user: userObjectId,
//       status: { $regex: /^delivered$/i } // Matches "Delivered" case-insensitively
//     });

//     const hasPurchasedAndDelivered = deliveredOrders.some(order => 
//       order.items && order.items.some(item => 
//         item.productId && item.productId.toString() === productObjectId.toString()
//       )
//     );

//     if (!hasPurchasedAndDelivered) {
//       return res.status(400).json({
//         success: false,
//         message: "You can only review items you purchased that have been delivered."
//       });
//     }

//     // 3. Fetch Product document
//     const product = await Product.findById(productObjectId);
//     if (!product) {
//       return res.status(404).json({ success: false, message: "Product not found." });
//     }

//     if (!product.reviewList) {
//       product.reviewList = [];
//     }

//     // 4. Look for an existing review by this user
//     const existingReviewIndex = product.reviewList.findIndex(
//       (rev) => rev.user && rev.user.toString() === userObjectId.toString()
//     );

//     let serverMessage = "Review posted successfully!";

//     if (existingReviewIndex !== -1) {
//       // Review exists -> Handle Editing Logic
//       const existingReview = product.reviewList[existingReviewIndex];
//       const reviewDate = new Date(existingReview.createdAt || new Date());
//       const daysSinceReview = (new Date() - reviewDate) / (1000 * 60 * 60 * 24);

//       // Enforce the 30-day cutoff
//       if (daysSinceReview > 30) {
//         return res.status(400).json({ 
//           success: false, 
//           message: "Reviews can only be edited within 30 days of posting." 
//         });
//       }

//       // Update existing review properties
//       product.reviewList[existingReviewIndex].rating = Number(rating);
//       product.reviewList[existingReviewIndex].description = description;
//       product.reviewList[existingReviewIndex].name = req.user?.name || existingReview.name || "Anonymous";
      
//       serverMessage = "Review updated successfully!";
//     } else {
//       // No review exists -> Add a new one
//       const reviewPayload = {
//         user: userObjectId,
//         name: req.user?.name || "Anonymous",
//         rating: Number(rating),
//         description: description
//       };
//       product.reviewList.push(reviewPayload);
//     }
    
//     // 5. Recalculate summary metrics safely
//     product.reviews = product.reviewList.length; 
//     product.rating = product.reviewList.reduce((acc, item) => item.rating + acc, 0) / product.reviewList.length;

//     await product.save();

//     return res.status(200).json({
//       success: true,
//       message: serverMessage
//     });

//   } catch (error) {
//     console.error("Backend Review Error:", error);
//     return res.status(500).json({ success: false, message: error.message || "Internal server error" });
//   }
// };




exports.addProductReview = async (req, res) => {
  try {
    const { productId, orderId, orderItemId, rating, description, isCombo } = req.body;

    const rawUserId = req.user?._id || req.user?.id || req.userId;
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "User context not identified. Please log in again."
      });
    }

    if (!productId || !orderId || !orderItemId || !rating || !description) {
      return res.status(400).json({
        success: false,
        message: "productId, orderId, orderItemId, rating and description are required."
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(rawUserId);
    const targetObjectId = new mongoose.Types.ObjectId(productId);
    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const orderItemObjectId = new mongoose.Types.ObjectId(orderItemId);

    // 1) Verify order belongs to this user and is delivered
    const order = await Order.findOne({
      _id: orderObjectId,
      user: userObjectId,
      status: { $regex: /^delivered$/i },
      "items._id": orderItemObjectId
    });

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "You can only review items from your delivered orders."
      });
    }

    const orderedItem = order.items.id(orderItemObjectId);
    if (!orderedItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found."
      });
    }

    // 2) Decide Product vs Combo from payload
    let targetDoc = null;
    let comboMode = Boolean(isCombo);

    if (comboMode) {
      targetDoc = await Combo.findById(targetObjectId);
    } else {
      targetDoc = await Product.findById(targetObjectId);
    }

    // fallback safety if payload flag is wrong
    if (!targetDoc) {
      targetDoc = await Product.findById(targetObjectId);
      comboMode = false;
    }
    if (!targetDoc) {
      targetDoc = await Combo.findById(targetObjectId);
      comboMode = true;
    }

    if (!targetDoc) {
      return res.status(404).json({
        success: false,
        message: "Product or Combo Pack not found."
      });
    }

    const reviewField = comboMode ? "reviews" : "reviewList";
    if (!targetDoc[reviewField]) targetDoc[reviewField] = [];

    // 3) IMPORTANT: find review by user + orderItemId
    const existingReviewIndex = targetDoc[reviewField].findIndex(
      (rev) =>
        rev.user &&
        rev.user.toString() === userObjectId.toString() &&
        rev.orderItemId &&
        rev.orderItemId.toString() === orderItemObjectId.toString()
    );

    let serverMessage = "Review posted successfully!";
    let savedReview = null;

    if (existingReviewIndex !== -1) {
      const existingReview = targetDoc[reviewField][existingReviewIndex];
      const daysSinceReview =
        (new Date() - new Date(existingReview.createdAt || new Date())) /
        (1000 * 60 * 60 * 24);

      if (daysSinceReview > 30) {
        return res.status(400).json({
          success: false,
          message: "Reviews can only be edited within 30 days of posting."
        });
      }

      targetDoc[reviewField][existingReviewIndex].rating = Number(rating);
      targetDoc[reviewField][existingReviewIndex].description = description;
      targetDoc[reviewField][existingReviewIndex].name =
        req.user?.name || existingReview.name || "Anonymous";

      savedReview = targetDoc[reviewField][existingReviewIndex];
      serverMessage = "Review updated successfully!";
    } else {
      console.log("REQ BODY REVIEW ADD:", req.body);
      console.log("REVIEW PAYLOAD:")
      const reviewPayload = {
        user: userObjectId,
        name: req.user?.name || "Anonymous",
        orderId: orderObjectId,
        orderItemId: orderItemObjectId,
        rating: Number(rating),
        description
      };
      console.log("REVIEW PAYLOAD after:")

      targetDoc[reviewField].push(reviewPayload);
      savedReview = targetDoc[reviewField][targetDoc[reviewField].length - 1];
    }

    // 4) recalc rating + count
    const totalReviewsCount = targetDoc[reviewField].length;

    targetDoc.rating =
      totalReviewsCount > 0
        ? targetDoc[reviewField].reduce((acc, item) => item.rating + acc, 0) / totalReviewsCount
        : 0;

    if (comboMode) {
      targetDoc.reviewCount = totalReviewsCount;
    } else {
      targetDoc.reviews = totalReviewsCount;
    }

    await targetDoc.save();

    return res.status(200).json({
      success: true,
      message: serverMessage,
      data: savedReview
    });
  } catch (error) {
    console.error("Backend Combo/Product Review Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};

// 8. Edit Existing Product Review
exports.editProductReview = async (req, res) => {
  try {
    const { productId, orderId, orderItemId, rating, description, isCombo } = req.body;

    const rawUserId = req.user?._id || req.user?.id || req.userId;
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "User context not identified. Please log in again."
      });
    }

    if (!productId || !orderId || !orderItemId) {
      return res.status(400).json({
        success: false,
        message: "productId, orderId and orderItemId are required."
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(rawUserId);
    const targetObjectId = new mongoose.Types.ObjectId(productId);
    const orderItemObjectId = new mongoose.Types.ObjectId(orderItemId);

    let targetDoc = null;
    let comboMode = Boolean(isCombo);

    if (comboMode) {
      targetDoc = await Combo.findById(targetObjectId);
    } else {
      targetDoc = await Product.findById(targetObjectId);
    }

    if (!targetDoc) {
      targetDoc = await Product.findById(targetObjectId);
      comboMode = false;
    }
    if (!targetDoc) {
      targetDoc = await Combo.findById(targetObjectId);
      comboMode = true;
    }

    if (!targetDoc) {
      return res.status(404).json({
        success: false,
        message: "Product or Combo Pack not found."
      });
    }

    const reviewField = comboMode ? "reviews" : "reviewList";
    const reviewIndex = targetDoc[reviewField].findIndex(
      (rev) =>
        rev.user &&
        rev.user.toString() === userObjectId.toString() &&
        rev.orderItemId &&
        rev.orderItemId.toString() === orderItemObjectId.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Your review was not found for this order item."
      });
    }

    const existingReview = targetDoc[reviewField][reviewIndex];
    const daysSinceReview =
      (new Date() - new Date(existingReview.createdAt || new Date())) /
      (1000 * 60 * 60 * 24);

    if (daysSinceReview > 30) {
      return res.status(400).json({
        success: false,
        message: "This review was posted over 30 days ago and can no longer be edited."
      });
    }

    targetDoc[reviewField][reviewIndex].rating = Number(rating);
    targetDoc[reviewField][reviewIndex].description = description;
    targetDoc[reviewField][reviewIndex].name =
      req.user?.name || existingReview.name || "Anonymous";

    const totalReviewsCount = targetDoc[reviewField].length;
    targetDoc.rating =
      totalReviewsCount > 0
        ? targetDoc[reviewField].reduce((acc, item) => item.rating + acc, 0) / totalReviewsCount
        : 0;

    if (comboMode) {
      targetDoc.reviewCount = totalReviewsCount;
    } else {
      targetDoc.reviews = totalReviewsCount;
    }

    await targetDoc.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully!",
      data: targetDoc[reviewField][reviewIndex]
    });
  } catch (error) {
    console.error("Backend Edit Review Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};


exports.deleteProductReview = async (req, res) => {
  try {
    const { productId, orderId, orderItemId, isCombo } = req.body;

    const rawUserId = req.user?._id || req.user?.id || req.userId;
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "User context not identified. Please log in again."
      });
    }

    if (!productId || !orderItemId) {
      return res.status(400).json({
        success: false,
        message: "productId and orderItemId are required."
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(rawUserId);
    const targetObjectId = new mongoose.Types.ObjectId(productId);
    const orderItemObjectId = new mongoose.Types.ObjectId(orderItemId);

    let targetDoc = null;
    let comboMode = Boolean(isCombo);

    if (comboMode) {
      targetDoc = await Combo.findById(targetObjectId);
    } else {
      targetDoc = await Product.findById(targetObjectId);
    }

    if (!targetDoc) {
      targetDoc = await Product.findById(targetObjectId);
      comboMode = false;
    }
    if (!targetDoc) {
      targetDoc = await Combo.findById(targetObjectId);
      comboMode = true;
    }

    if (!targetDoc) {
      return res.status(404).json({
        success: false,
        message: "Product or Combo Pack not found."
      });
    }

    const reviewField = comboMode ? "reviews" : "reviewList";
    if (!targetDoc[reviewField] || targetDoc[reviewField].length === 0) {
      return res.status(400).json({
        success: false,
        message: "No reviews exist on this item."
      });
    }

    const reviewIndex = targetDoc[reviewField].findIndex(
      (rev) =>
        rev.user &&
        rev.user.toString() === userObjectId.toString() &&
        rev.orderItemId &&
        rev.orderItemId.toString() === orderItemObjectId.toString()
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "No active review found for this order item."
      });
    }

    const existingReview = targetDoc[reviewField][reviewIndex];
    const daysSinceReview =
      (new Date() - new Date(existingReview.createdAt || new Date())) /
      (1000 * 60 * 60 * 24);

    if (daysSinceReview > 30) {
      return res.status(400).json({
        success: false,
        message: "Reviews can only be deleted within 30 days of posting."
      });
    }

    targetDoc[reviewField].splice(reviewIndex, 1);

    const totalReviewsCount = targetDoc[reviewField].length;
    targetDoc.rating =
      totalReviewsCount > 0
        ? targetDoc[reviewField].reduce((acc, item) => item.rating + acc, 0) / totalReviewsCount
        : 0;

    if (comboMode) {
      targetDoc.reviewCount = totalReviewsCount;
    } else {
      targetDoc.reviews = totalReviewsCount;
    }

    await targetDoc.save();

    return res.status(200).json({
      success: true,
      message: "Review removed successfully."
    });
  } catch (error) {
    console.error("Backend Delete Review Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};



// 10. Get Product Reviews (+ flag current user's own review)
// 

exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { orderId, orderItemId, isCombo } = req.query;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "A valid ID is required."
      });
    }

    const targetObjectId = new mongoose.Types.ObjectId(productId);

    let targetDoc = null;
    let comboMode = isCombo === "true";

    if (comboMode) {
      targetDoc = await Combo.findById(targetObjectId);
    } else {
      targetDoc = await Product.findById(targetObjectId);
    }

    if (!targetDoc) {
      targetDoc = await Product.findById(targetObjectId);
      comboMode = false;
    }
    if (!targetDoc) {
      targetDoc = await Combo.findById(targetObjectId);
      comboMode = true;
    }

    if (!targetDoc) {
      return res.status(404).json({
        success: false,
        message: "Product or Combo Pack not found."
      });
    }

    const reviewList = comboMode ? (targetDoc.reviews || []) : (targetDoc.reviewList || []);
    const rawUserId = req.user?._id || req.user?.id || req.userId;

    let myReview = null;

    if (rawUserId && orderItemId) {
      myReview =
        reviewList.find(
          (rev) =>
            rev.user &&
            rev.user.toString() === rawUserId.toString() &&
            rev.orderItemId &&
            rev.orderItemId.toString() === orderItemId.toString()
        ) || null;
    }

    return res.status(200).json({
      success: true,
      data: {
        reviews: Array.isArray(reviewList) ? reviewList : [],
        myReview,
        isCombo: comboMode
      }
    });
  } catch (error) {
    console.error("Backend Get Reviews Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};