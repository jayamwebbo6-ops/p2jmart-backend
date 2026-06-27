const express = require("express");
const router = express.Router();

const wishlistController = require("../controllers/wishlistController");
const { protectUser } = require('../middleware/userAuth');


router.get("/", protectUser, wishlistController.getWishlist);

router.post("/", protectUser, wishlistController.addToWishlist);

router.delete(
  "/:productId",
  protectUser,
  wishlistController.removeFromWishlist
);

router.delete(
  "/",
  protectUser,
  wishlistController.clearWishlist
);

module.exports = router;