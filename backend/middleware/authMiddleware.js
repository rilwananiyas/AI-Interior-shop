
const jwt = require("jsonwebtoken");
const User = require("../models/user");

// ============================================
// VERIFY JWT TOKEN
// ============================================

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check whether the Authorization header exists.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please log in.",
      });
    }

    // Extract the JWT token.
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    // Make sure the JWT secret is configured.
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from the environment.");

      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured.",
      });
    }

    // Verify the token.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // Load the latest user details from MongoDB.
    const user = await User.findById(decoded.userId).select("-password");

    if (!user || user.isActive !== true) {
      return res.status(401).json({
        success: false,
        message: "User account not found or inactive.",
      });
    }

    // Attach the authenticated user to the request.
    req.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please log in again.",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

// ============================================
// ALLOW ONLY ADMIN USERS
// ============================================

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin permission required.",
    });
  }

  return next();
};

// ============================================
// ALLOW ONLY APPROVED SHOP OWNERS
// ============================================

const ownerOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (
    req.user.role !== "owner" ||
    req.user.ownerStatus !== "approved"
  ) {
    return res.status(403).json({
      success: false,
      message: "Only approved shop owners can access this resource.",
    });
  }

  return next();
};

// ============================================
// EXPORT MIDDLEWARE
// ============================================

module.exports = {
  protect,
  adminOnly,
  ownerOnly,
};
