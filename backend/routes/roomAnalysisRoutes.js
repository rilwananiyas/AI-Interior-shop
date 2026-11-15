
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { uploadRoomImage } = require("../middleware/uploadMiddleware");

const cloudinary = require("../config/cloudinary");
const RoomAnalysis = require("../models/RoomAnalysis");

const {
  analyzeRoomImage,
} = require("../services/roomVisionService");

const {
  findMatchingProducts,
} = require("../services/productMatchingService");

// Furniture categories suitable for each room.
const ROOM_CATEGORIES = {
  Bedroom: ["Beds", "Storage", "Lighting", "Decor"],
  "Living Room": ["Sofas", "Tables", "Storage", "Lighting", "Decor"],
  "Dining Room": ["Tables", "Chairs", "Lighting", "Decor"],
  Office: ["Chairs", "Tables", "Storage", "Lighting"],
};

// Upload image buffer directly to Cloudinary.
const uploadToCloudinary = (buffer, mimetype) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "ai-interior-shop/room-originals",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

// POST /api/room-analysis
router.post(
  "/",
  protect,

  // Handle uploaded image errors.
  (req, res, next) => {
    uploadRoomImage(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      next();
    });
  },

  async (req, res) => {
    let uploadedImage = null;
    let savedAnalysis = null;

    try {
      // 1. Check uploaded image.
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a room image.",
        });
      }

      // 2. Analyze room using Qwen2.5-VL.
      const analysis = await analyzeRoomImage(
        req.file.buffer,
        req.file.mimetype
      );

      // 3. Get room categories.
      const categories =
        ROOM_CATEGORIES[analysis.roomType] || [];

      // 4. Extract AI design analysis.
      const designAnalysis = analysis.designAnalysis || {};

      // 5. Find matching furniture products.
      let products = [];

      if (categories.length > 0) {
        products = await findMatchingProducts({
          categories,
          room: analysis.roomType,
          designAnalysis,
        });
      }

      // 6. Upload original room image to Cloudinary.
      uploadedImage = await uploadToCloudinary(
        req.file.buffer,
        req.file.mimetype
      );

      // 7. Save room analysis and Cloudinary details in MongoDB.
      savedAnalysis = await RoomAnalysis.create({
        user: req.user._id,

        imageName: req.file.originalname,
        imageMimeType: req.file.mimetype,

        originalImageUrl: uploadedImage.secure_url,
        originalImagePublicId: uploadedImage.public_id,

        roomType: analysis.roomType,
        roomDetails: analysis.roomDetails,

        designAnalysis,

        improvements: analysis.improvements,

        recommendedProducts: products.map(
          (product) => product._id
        ),

        rawAIResponse: analysis.rawAIResponse,
      });

      // 8. Retrieve saved analysis with product details.
      const result = await RoomAnalysis.findById(
        savedAnalysis._id
      ).populate("recommendedProducts");

      // 9. Return complete response to frontend.
      return res.status(201).json({
        success: true,
        message: "Room analysis completed successfully.",
        analysis: result,
        products,
      });

    } catch (error) {
      console.error("Room analysis error:", error);

      // Remove uploaded image if MongoDB saving failed.
      if (uploadedImage && !savedAnalysis) {
        try {
          await cloudinary.uploader.destroy(
            uploadedImage.public_id,
            { resource_type: "image" }
          );
        } catch (cleanupError) {
          console.error(
            "Cloudinary cleanup error:",
            cleanupError.message
          );
        }
      }

      return res.status(500).json({
        success: false,
        message:
          "Room analysis failed. Please check the AI service and try again.",
        error: error.message,
      });
    }
  }
);

module.exports = router;
