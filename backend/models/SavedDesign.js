
const mongoose = require("mongoose");

const savedDesignSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    analysis: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomAnalysis",
      required: true,
    },

    style: {
      type: String,
      required: true,
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
    },

    originalImageUrl: {
      type: String,
      required: true,
    },

    redesignedImageUrl: {
      type: String,
      required: true,
    },

    originalImagePublicId: {
      type: String,
      default: "",
    },

    redesignedImagePublicId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent saving the same generated image twice.
savedDesignSchema.index(
  {
    user: 1,
    analysis: 1,
    redesignedImagePublicId: 1,
  },
  {
    unique: true,
  }
);

savedDesignSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("SavedDesign", savedDesignSchema);
