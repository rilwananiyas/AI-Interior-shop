
const mongoose = require("mongoose");

const roomAnalysisSchema = new mongoose.Schema(
  {
    // User who uploaded the room image.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Original uploaded image information.
    imageName: {
      type: String,
      required: true,
      trim: true,
    },

    imageMimeType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "image/webp"],
    },

    // Original room image stored in Cloudinary.
    originalImageUrl: {
      type: String,
      required: true,
    },

    originalImagePublicId: {
      type: String,
      required: true,
    },

    // AI-redesigned room image stored in Cloudinary.
    redesignedImageUrl: {
      type: String,
      default: "",
    },

    redesignedImagePublicId: {
      type: String,
      default: "",
    },

    // Customer-selected interior design style.
    selectedDesignStyle: {
      type: String,
      enum: [
        "Modern",
        "Minimalist",
        "Scandinavian",
        "Industrial",
        "Bohemian",
        "Traditional",
        "Contemporary",
        "Japandi",
      ],
      default: null,
    },

    // Room type detected by AI.
    roomType: {
      type: String,
      default: "Unknown",
      trim: true,
    },

    // AI-detected room characteristics.
    roomDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    // AI-generated interior design analysis.
    designAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    // AI-suggested room improvements.
    improvements: {
      type: [String],
      default: [],
    },

    // Products recommended from the store database.
    recommendedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // Original AI response for debugging and reference.
    rawAIResponse: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Efficiently retrieve a user's room analysis history.
roomAnalysisSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("RoomAnalysis", roomAnalysisSchema);
