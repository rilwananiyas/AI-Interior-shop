
const express = require("express");
const mongoose = require("mongoose");

const SavedDesign = require("../models/SavedDesign");
const RoomAnalysis = require("../models/RoomAnalysis");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// POST: Save a redesigned room
router.post("/", protect, async (req, res) => {
  try {
    const { analysisId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(analysisId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room analysis ID.",
      });
    }

    // Verify that this analysis belongs to the logged-in user.
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

    if (
      !analysis.redesignedImageUrl ||
      !analysis.redesignedImagePublicId ||
      !analysis.selectedDesignStyle
    ) {
      return res.status(400).json({
        success: false,
        message: "Please redesign your room before saving.",
      });
    }

    const existingDesign = await SavedDesign.findOne({
      user: req.user._id,
      analysis: analysis._id,
      redesignedImagePublicId: analysis.redesignedImagePublicId,
    });

    if (existingDesign) {
      return res.status(200).json({
        success: true,
        alreadySaved: true,
        message: "This design is already saved.",
        data: existingDesign,
      });
    }

    const savedDesign = await SavedDesign.create({
      user: req.user._id,
      analysis: analysis._id,
      style: analysis.selectedDesignStyle,
      originalImageUrl: analysis.originalImageUrl,
      redesignedImageUrl: analysis.redesignedImageUrl,
      originalImagePublicId: analysis.originalImagePublicId,
      redesignedImagePublicId: analysis.redesignedImagePublicId,
    });

    return res.status(201).json({
      success: true,
      alreadySaved: false,
      message: "Design saved successfully.",
      data: savedDesign,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        success: true,
        alreadySaved: true,
        message: "This design is already saved.",
      });
    }

    console.error("Save design error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save design.",
    });
  }
});

// GET: Retrieve the logged-in user's saved designs
router.get("/", protect, async (req, res) => {
  try {
    const designs = await SavedDesign.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: designs.length,
      data: designs,
    });
  } catch (error) {
    console.error("Get saved designs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve saved designs.",
    });
  }
});

// DELETE: Delete a saved design owned by the logged-in user
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid saved design ID.",
      });
    }

    const deletedDesign = await SavedDesign.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!deletedDesign) {
      return res.status(404).json({
        success: false,
        message: "Saved design not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Saved design deleted successfully.",
    });
  } catch (error) {
    console.error("Delete saved design error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete saved design.",
    });
  }
});

module.exports = router;
