
const express = require("express");
const mongoose = require("mongoose");

const RoomAnalysis = require("../models/RoomAnalysis");
const SavedDesign = require("../models/SavedDesign");

const { protect } = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");

const {
  ALLOWED_STYLES,
  generateRedesignedImage,
  uploadRedesignedImage,
} = require("../services/roomRedesignService");

const router = express.Router();

// POST /api/room-redesign/:analysisId
router.post("/:analysisId", protect, async (req, res) => {
  let uploadedImagePublicId = null;

  try {
    const { analysisId } = req.params;
    const { style } = req.body;

    // Validate analysis ID.
    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room analysis ID.",
      });
    }

    // Validate selected design style.
    if (!ALLOWED_STYLES.includes(style)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid design style.",
      });
    }

    // Find the analysis belonging to the logged-in user.
    const analysis = await RoomAnalysis.findOne({
      _id: analysisId,
      user: req.user._id,
    });

    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: "Room analysis not found.",
      });
    }

    if (!analysis.originalImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Original room image is missing.",
      });
    }

    // Generate redesigned image.
    const redesignedBuffer = await generateRedesignedImage({
      imageUrl: analysis.originalImageUrl,
      style,
      roomType: analysis.roomType,
      designAnalysis: analysis.designAnalysis,
    });

    // Upload redesigned image to Cloudinary.
    const uploadedImage = await uploadRedesignedImage(
      redesignedBuffer,
      analysis._id.toString()
    );

    uploadedImagePublicId = uploadedImage.public_id;

    // Keep previous image information for cleanup.
    const previousImagePublicId =
      analysis.redesignedImagePublicId;

    // Save redesigned image details.
    analysis.redesignedImageUrl = uploadedImage.secure_url;
    analysis.redesignedImagePublicId = uploadedImage.public_id;
    analysis.selectedDesignStyle = style;

    await analysis.save();

    // Remove previous image only if it is not bookmarked.
    if (previousImagePublicId) {
      try {
        const isImageSaved = await SavedDesign.exists({
          user: req.user._id,
          redesignedImagePublicId: previousImagePublicId,
        });

        if (!isImageSaved) {
          await cloudinary.uploader.destroy(
            previousImagePublicId
          );

          console.log(
            "Previous redesigned image removed from Cloudinary."
          );
        } else {
          console.log(
            "Previous redesigned image preserved because it is saved."
          );
        }
      } catch (cleanupError) {
        console.error(
          "Previous redesign cleanup failed:",
          cleanupError.message
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Room redesigned successfully.",
      data: {
        analysisId: analysis._id,
        style,
        originalImageUrl: analysis.originalImageUrl,
        redesignedImageUrl: analysis.redesignedImageUrl,
      },
    });
  } catch (error) {
    console.error("Room redesign error:", error);

    // Remove newly uploaded image if processing or saving failed.
    if (uploadedImagePublicId) {
      try {
        await cloudinary.uploader.destroy(
          uploadedImagePublicId
        );
      } catch (cleanupError) {
        console.error(
          "Failed to clean up uploaded image:",
          cleanupError.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Room redesign failed.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
});

module.exports = router;
