
const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  applyOwner,
  getOwnerApplications,
  reviewOwnerApplication,
} = require("../controllers/authController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// Customer registration and login
router.post("/register", registerUser);
router.post("/login", loginUser);

// Shop-owner application
router.post("/apply-owner", protect, applyOwner);

// Admin: view pending shop-owner applications
router.get(
  "/admin/owner-applications",
  protect,
  adminOnly,
  getOwnerApplications
);

// Admin: approve or reject an application
router.patch(
  "/admin/owner-applications/:id/review",
  protect,
  adminOnly,
  reviewOwnerApplication
);

module.exports = router;
