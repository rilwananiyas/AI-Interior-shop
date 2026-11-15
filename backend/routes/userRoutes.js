
const express = require("express");
const router = express.Router();

const {
  getMyProfile,
  updateMyProfile,
  uploadMyProfileImage,
} = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");

const {
  uploadProfileImage,
} = require("../middleware/uploadMiddleware");

// Retrieve profile
router.get("/profile", protect, getMyProfile);

// Update name or image using an internet URL
router.patch("/profile", protect, updateMyProfile);

// Upload profile picture from PC
router.post(
  "/profile/image",
  protect,
  uploadProfileImage,
  uploadMyProfileImage
);

module.exports = router;
