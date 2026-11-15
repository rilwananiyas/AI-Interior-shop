
const express = require("express");
const mongoose = require("mongoose");

const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/user");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

// --------------------------------------------------
// OWNER ACCESS
// --------------------------------------------------

const ownerOnly = (req, res, next) => {
  if (
    req.user.role !== "owner" ||
    req.user.ownerStatus !== "approved"
  ) {
    return res.status(403).json({
      message: "Only approved shop owners can access this resource.",
    });
  }

  next();
};

// --------------------------------------------------
// ORDER STATUSES
// --------------------------------------------------

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Rejected",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

// Allowed status transitions
const ALLOWED_TRANSITIONS = {
  Pending: ["Confirmed", "Rejected", "Cancelled"],
  Confirmed: ["Processing"],
  Rejected: [],
  Processing: ["Shipped"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

// --------------------------------------------------
// RESTORE PRODUCT STOCK
// Used when an order is rejected or cancelled.
// --------------------------------------------------

const restoreStock = async (order) => {
  for (const item of order.items) {
    if (!item.product || !item.quantity) {
      continue;
    }

    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity } }
    );
  }
};

// --------------------------------------------------
// CUSTOMER: CREATE ORDER
// POST /api/orders
// --------------------------------------------------

router.post("/", protect, async (req, res) => {
  const createdOrders = [];
  const reservedItems = [];

  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    // Validate order items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Your order must contain at least one item.",
      });
    }

    // Validate shipping information
    if (
      !shippingAddress ||
      !shippingAddress.fullName?.trim() ||
      !shippingAddress.phone?.trim() ||
      !shippingAddress.address?.trim() ||
      !shippingAddress.city?.trim()
    ) {
      return res.status(400).json({
        message:
          "Full name, phone, address, and city are required.",
      });
    }

    // This project currently supports Cash on Delivery only.
    if (
      paymentMethod &&
      paymentMethod !== "Cash on Delivery"
    ) {
      return res.status(400).json({
        message: "Only Cash on Delivery is currently supported.",
      });
    }

    // Combine duplicate products into a single order item.
    const combinedItems = new Map();

    for (const item of items) {
      const productId = String(item.product || item.productId || "");
      const quantity = Number(item.quantity);

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          message: "One of the products has an invalid ID.",
        });
      }

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message: "Product quantities must be positive whole numbers.",
        });
      }

      const existing = combinedItems.get(productId);

      if (existing) {
        existing.quantity += quantity;

        if (!Number.isSafeInteger(existing.quantity)) {
          return res.status(400).json({
            message: "The requested product quantity is too large.",
          });
        }
      } else {
        combinedItems.set(productId, {
          productId,
          quantity,
        });
      }
    }

    // Load products and validate stock, activity, and ownership.
    const validatedItems = [];

    for (const requestedItem of combinedItems.values()) {
      const product = await Product.findById(
        requestedItem.productId
      );

      if (!product) {
        throw new Error(
          `Product ${requestedItem.productId} was not found.`
        );
      }

      if (product.isActive === false) {
        throw new Error(
          `${product.name || "A product"} is no longer available.`
        );
      }

      if (
        !Number.isFinite(Number(product.price)) ||
        Number(product.price) < 0
      ) {
        throw new Error(
          `${product.name || "A product"} has an invalid price.`
        );
      }

      if (
        !Number.isSafeInteger(Number(product.stock)) ||
        Number(product.stock) < requestedItem.quantity
      ) {
        throw new Error(
          `Insufficient stock for ${product.name || "a product"}.`
        );
      }

      let ownerId = null;

      if (product.owner) {
        ownerId = String(product.owner);

        const productOwner = await User.findById(product.owner);

        if (
          !productOwner ||
          productOwner.role !== "owner" ||
          productOwner.ownerStatus !== "approved"
        ) {
          throw new Error(
            `${product.name || "A product"} does not belong to an approved shop.`
          );
        }
      }

      validatedItems.push({
        productId: String(product._id),
        product,
        ownerId,
        quantity: requestedItem.quantity,
        price: Number(product.price),
      });
    }

    // Reserve stock. The stock condition prevents two orders
    // from reserving the same remaining units.
    for (const item of validatedItems) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          stock: { $gte: item.quantity },
          isActive: { $ne: false },
        },
        {
          $inc: { stock: -item.quantity },
        },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedProduct) {
        throw new Error(
          `Stock changed while placing your order for ${item.product.name}. Please try again.`
        );
      }

      reservedItems.push({
        productId: item.productId,
        quantity: item.quantity,
      });

      // Use the latest product details returned by the database.
      item.product = updatedProduct;
      item.price = Number(updatedProduct.price);
    }

    // Split the order by shop owner so each shop can manage
    // only its own products and order.
    const ordersByOwner = new Map();

    for (const item of validatedItems) {
      const ownerKey = item.ownerId || "admin-products";

      if (!ordersByOwner.has(ownerKey)) {
        ordersByOwner.set(ownerKey, []);
      }

      ordersByOwner.get(ownerKey).push(item);
    }

    const createdOrderDocuments = [];

    for (const [ownerKey, shopItems] of ordersByOwner.entries()) {
      const orderItems = shopItems.map((item) => ({
        product: item.product._id,
        name: item.product.name,
        image: item.product.image || "",
        price: item.price,
        quantity: item.quantity,
      }));

      const totalAmount = orderItems.reduce(
        (total, item) =>
          total + item.price * item.quantity,
        0
      );

      const orderData = {
        user: req.user._id,
        owner:
          ownerKey === "admin-products"
            ? null
            : ownerKey,
        items: orderItems,
        shippingAddress: {
          fullName: shippingAddress.fullName.trim(),
          phone: shippingAddress.phone.trim(),
          address: shippingAddress.address.trim(),
          city: shippingAddress.city.trim(),
          postalCode: shippingAddress.postalCode
            ? String(shippingAddress.postalCode).trim()
            : "",
        },
        totalAmount,
        paymentMethod: "Cash on Delivery",
        status: "Pending",
      };

      const order = await Order.create(orderData);

      createdOrders.push(order._id);
      createdOrderDocuments.push(order);
    }

    return res.status(201).json({
      message: "Order placed successfully.",
      orders: createdOrderDocuments,
    });
  } catch (error) {
    console.error("Create order error:", error);

    // Best-effort rollback if an order failed partway through.
    if (createdOrders.length > 0) {
      try {
        await Order.deleteMany({
          _id: { $in: createdOrders },
          user: req.user._id,
        });
      } catch (rollbackError) {
        console.error(
          "Order rollback error:",
          rollbackError
        );
      }
    }

    for (const item of reservedItems.reverse()) {
      try {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      } catch (stockError) {
        console.error(
          "Stock rollback error:",
          stockError
        );
      }
    }

    return res.status(400).json({
      message:
        error.message || "Unable to place your order.",
    });
  }
});

// --------------------------------------------------
// CUSTOMER: VIEW OWN ORDERS
// GET /api/orders/my-orders
// --------------------------------------------------

router.get("/my-orders", protect, async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    })
      .populate("owner", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Load customer orders error:", error);

    return res.status(500).json({
      message: "Unable to load your orders.",
    });
  }
});

// --------------------------------------------------
// OWNER: VIEW ORDERS FOR THEIR SHOP
// GET /api/orders/owner/orders
// --------------------------------------------------

router.get(
  "/owner/orders",
  protect,
  ownerOnly,
  async (req, res) => {
    try {
      const orders = await Order.find({
        owner: req.user._id,
      })
        .populate("user", "name email")
        .sort({ createdAt: -1 });

      return res.status(200).json(orders);
    } catch (error) {
      console.error("Load owner orders error:", error);

      return res.status(500).json({
        message: "Unable to load your shop orders.",
      });
    }
  }
);

// --------------------------------------------------
// OWNER: CONFIRM OR REJECT A PENDING ORDER
// PATCH /api/orders/owner/orders/:id/status
// --------------------------------------------------

router.patch(
  "/owner/orders/:id/status",
  protect,
  ownerOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      if (!["Confirmed", "Rejected"].includes(status)) {
        return res.status(400).json({
          message: "Owners can only confirm or reject orders here.",
        });
      }

      const order = await Order.findOne({
        _id: id,
        owner: req.user._id,
      });

      if (!order) {
        return res.status(404).json({
          message: "Order not found in your shop.",
        });
      }

      if (order.status !== "Pending") {
        return res.status(400).json({
          message: "Only pending orders can be confirmed or rejected.",
        });
      }

      if (
        !(ALLOWED_TRANSITIONS[order.status] || []).includes(status)
      ) {
        return res.status(400).json({
          message: `Cannot change order status to ${status}.`,
        });
      }

      order.status = status;

      await order.save();

      // Return stock only after the rejection has been saved.
      if (status === "Rejected") {
        try {
          await restoreStock(order);
        } catch (stockError) {
          console.error(
            "Restore stock after rejection error:",
            stockError
          );

          return res.status(500).json({
            message:
              "The order was rejected, but stock restoration failed. Please check product stock.",
            order,
          });
        }
      }

      return res.status(200).json({
        message: `Order ${status.toLowerCase()} successfully.`,
        order,
      });
    } catch (error) {
      console.error("Owner order status error:", error);

      return res.status(500).json({
        message: "Unable to update this order.",
      });
    }
  }
);

// --------------------------------------------------
// OWNER: UPDATE DELIVERY PROGRESS
// PATCH /api/orders/owner/orders/:id/progress
// --------------------------------------------------

router.patch(
  "/owner/orders/:id/progress",
  protect,
  ownerOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      const allowedOwnerStatuses = [
        "Processing",
        "Shipped",
        "Delivered",
      ];

      if (!allowedOwnerStatuses.includes(status)) {
        return res.status(400).json({
          message: "Invalid delivery status.",
        });
      }

      // An owner can update only orders assigned to that owner.
      const order = await Order.findOne({
        _id: id,
        owner: req.user._id,
      });

      if (!order) {
        return res.status(404).json({
          message: "Order not found in your shop.",
        });
      }

      const allowedNextStatuses =
        ALLOWED_TRANSITIONS[order.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        return res.status(400).json({
          message:
            `Cannot change order status from ${order.status} to ${status}.`,
        });
      }

      order.status = status;

      // Store the actual time only when delivery is completed.
      if (status === "Delivered") {
        order.deliveredAt = new Date();
      }

      await order.save();

      return res.status(200).json({
        message: `Order status updated to ${status}.`,
        order,
      });
    } catch (error) {
      console.error("Owner delivery progress error:", error);

      return res.status(500).json({
        message: "Unable to update delivery progress.",
      });
    }
  }
);

// --------------------------------------------------
// CUSTOMER: CANCEL THEIR OWN PENDING ORDER
// PATCH /api/orders/:id/cancel
// --------------------------------------------------

router.patch("/:id/cancel", protect, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid order ID.",
      });
    }

    const order = await Order.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found.",
      });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        message: "Only pending orders can be cancelled.",
      });
    }

    if (
      !(ALLOWED_TRANSITIONS[order.status] || []).includes(
        "Cancelled"
      )
    ) {
      return res.status(400).json({
        message: "This order cannot be cancelled.",
      });
    }

    order.status = "Cancelled";

    await order.save();

    try {
      await restoreStock(order);
    } catch (stockError) {
      console.error(
        "Restore stock after cancellation error:",
        stockError
      );

      return res.status(500).json({
        message:
          "The order was cancelled, but stock restoration failed. Please check product stock.",
        order,
      });
    }

    return res.status(200).json({
      message: "Order cancelled successfully.",
      order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    return res.status(500).json({
      message: "Unable to cancel this order.",
    });
  }
});

// --------------------------------------------------
// ADMIN: VIEW ALL ORDERS
// GET /api/orders/admin/all
// --------------------------------------------------

router.get(
  "/admin/all",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const orders = await Order.find()
        .populate("user", "name email")
        .populate("owner", "name email")
        .sort({ createdAt: -1 });

      return res.status(200).json(orders);
    } catch (error) {
      console.error("Load all orders error:", error);

      return res.status(500).json({
        message: "Unable to load orders.",
      });
    }
  }
);

// --------------------------------------------------
// ADMIN: UPDATE ORDER STATUS
// PATCH /api/orders/admin/:id/status
// --------------------------------------------------

router.patch(
  "/admin/:id/status",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid order ID.",
        });
      }

      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid order status.",
        });
      }

      const order = await Order.findById(id);

      if (!order) {
        return res.status(404).json({
          message: "Order not found.",
        });
      }

      const allowedNextStatuses =
        ALLOWED_TRANSITIONS[order.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        return res.status(400).json({
          message:
            `Cannot change order status from ${order.status} to ${status}.`,
        });
      }

      order.status = status;

      if (status === "Delivered") {
        order.deliveredAt = new Date();
      }

      await order.save();

      // Restore stock when an administrator rejects or cancels
      // an order that has not progressed beyond Pending.
      if (["Rejected", "Cancelled"].includes(status)) {
        try {
          await restoreStock(order);
        } catch (stockError) {
          console.error(
            "Restore stock after admin update error:",
            stockError
          );

          return res.status(500).json({
            message:
              "The order status was updated, but stock restoration failed. Please check product stock.",
            order,
          });
        }
      }

      return res.status(200).json({
        message: `Order status updated to ${status}.`,
        order,
      });
    } catch (error) {
      console.error("Admin order status error:", error);

      return res.status(500).json({
        message: "Unable to update order status.",
      });
    }
  }
);

module.exports = router;
