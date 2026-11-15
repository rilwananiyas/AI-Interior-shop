
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    category: {
      type: String,
      required: [true, "Product category is required"],
      enum: [
        "Sofas",
        "Chairs",
        "Tables",
        "Beds",
        "Storage",
        "Lighting",
        "Decor",
      ],
    },

    // Upholstery or main furniture material.
    material: {
      type: String,
      trim: true,
      default: "",
    },

    // Material used for the furniture frame.
    frameMaterial: {
      type: String,
      trim: true,
      default: "",
    },

    color: {
      type: String,
      trim: true,
      default: "",
    },

    style: {
      type: String,
      trim: true,
      default: "",
    },

    suitableRooms: {
      type: [String],
      enum: [
        "Bedroom",
        "Living Room",
        "Dining Room",
        "Office",
      ],
      default: [],
    },

    // Structured furniture attributes.
    durability: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "",
    },

    size: {
      type: String,
      enum: ["Compact", "Medium", "Large"],
      default: "",
    },

    spaceSaving: {
      type: Boolean,
      default: false,
    },

    features: {
      type: [String],
      default: [],
    },

    image: {
      type: String,
      default: "",
      trim: true,
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
