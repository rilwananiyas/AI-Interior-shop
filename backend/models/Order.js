
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    // Customer who placed the order
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Shop owner responsible for this order
    // Nullable so existing orders can remain in the database.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Furniture purchased
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) =>
          Array.isArray(items) && items.length > 0,
        message: "An order must contain at least one item.",
      },
    },

    // Customer shipping information
    shippingAddress: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      city: {
        type: String,
        required: true,
        trim: true,
      },
      postalCode: {
        type: String,
        default: "",
        trim: true,
      },
    },

    // Total amount for this order
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Order progress
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Rejected",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
      index: true,
    },

    // Only set when an actual estimated date is available
    estimatedDeliveryDate: {
      type: Date,
      default: null,
    },

    // Actual delivery date
    deliveredAt: {
      type: Date,
      default: null,
    },

    // Payment details
    paymentMethod: {
      type: String,
      enum: ["Cash on Delivery"],
      default: "Cash on Delivery",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

// Helpful indexes for customer and shop order lists
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ owner: 1, createdAt: -1 });

module.exports =
  mongoose.models.Order ||
  mongoose.model("Order", orderSchema);
