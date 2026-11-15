
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/user");

// CUSTOMER: Place an order.
// Products from different shops are split into separate orders.
const createOrder = async (req, res) => {
  const reservedProducts = [];
  const createdOrderIds = [];

  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty.",
      });
    }

    if (
      !shippingAddress ||
      !shippingAddress.fullName?.trim() ||
      !shippingAddress.phone?.trim() ||
      !shippingAddress.address?.trim() ||
      !shippingAddress.city?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required delivery details.",
      });
    }

    if (
      paymentMethod &&
      paymentMethod !== "Cash on Delivery"
    ) {
      return res.status(400).json({
        success: false,
        message: "Only Cash on Delivery is supported.",
      });
    }

    // Combine duplicate cart entries for the same product.
    const quantities = new Map();

    for (const item of items) {
      if (
        !item.product ||
        !mongoose.isValidObjectId(item.product) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity in your cart.",
        });
      }

      const id = String(item.product);
      quantities.set(
        id,
        (quantities.get(id) || 0) + Number(item.quantity)
      );
    }

    const groupedOrders = new Map();

    // Verify products, owners, and stock using database values.
    for (const [productId, quantity] of quantities) {
      const product = await Product.findById(productId);

      if (!product || !product.isActive) {
        throw new Error(
          "A selected product is unavailable. Please review your cart."
        );
      }

      if (!product.owner) {
        throw new Error(
          `${product.name} is not assigned to a shop owner and cannot be ordered yet.`
        );
      }

      const ownerId = String(product.owner);
      let group = groupedOrders.get(ownerId);

      if (!group) {
        const owner = await User.findById(ownerId);

        if (
          !owner ||
          !owner.isActive ||
          owner.role !== "owner" ||
          owner.ownerStatus !== "approved"
        ) {
          throw new Error(
            `The shop for "${product.name}" is not currently available.`
          );
        }

        group = {
          owner: owner._id,
          items: [],
          totalAmount: 0,
        };

        groupedOrders.set(ownerId, group);
      }

      if (product.stock < quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock}.`
        );
      }

      const itemTotal = product.price * quantity;

      group.items.push({
        product: product._id,
        name: product.name,
        image: product.image || "",
        price: product.price,
        quantity,
      });

      group.totalAmount += itemTotal;
    }

    // Reserve stock atomically to prevent overselling.
    for (const group of groupedOrders.values()) {
      for (const item of group.items) {
        const updatedProduct = await Product.findOneAndUpdate(
          {
            _id: item.product,
            isActive: true,
            owner: group.owner,
            stock: { $gte: item.quantity },
          },
          {
            $inc: { stock: -item.quantity },
          },
          { new: true }
        );

        if (!updatedProduct) {
          throw new Error(
            `Stock changed for "${item.name}". Please review your cart and try again.`
          );
        }

        reservedProducts.push({
          product: item.product,
          quantity: item.quantity,
        });
      }
    }

    // Create one independently managed order per shop.
    const createdOrders = [];

    for (const group of groupedOrders.values()) {
      const order = await Order.create({
        user: req.user._id,
        owner: group.owner,
        items: group.items,
        shippingAddress: {
          fullName: shippingAddress.fullName.trim(),
          phone: shippingAddress.phone.trim(),
          address: shippingAddress.address.trim(),
          city: shippingAddress.city.trim(),
          postalCode: shippingAddress.postalCode?.trim() || "",
        },
        totalAmount: group.totalAmount,
        paymentMethod: "Cash on Delivery",
        status: "Pending",
      });

      createdOrders.push(order);
      createdOrderIds.push(order._id);
    }

    return res.status(201).json({
      success: true,
      message:
        "Order placed successfully. Waiting for shop confirmation.",
      order: createdOrders[0],
      orders: createdOrders,
    });
  } catch (error) {
    console.error("Create order error:", error.message);

    // If a later step fails, remove partial orders and release stock.
    try {
      if (createdOrderIds.length) {
        await Order.deleteMany({
          _id: { $in: createdOrderIds },
          user: req.user._id,
        });
      }

      for (const reserved of reservedProducts.reverse()) {
        await Product.updateOne(
          { _id: reserved.product },
          { $inc: { stock: reserved.quantity } }
        );
      }
    } catch (rollbackError) {
      console.error(
        "Order rollback error:",
        rollbackError.message
      );
    }

    const clientError = [
      "A selected product is unavailable. Please review your cart.",
      "not assigned to a shop owner",
      "not currently available.",
      "Insufficient stock",
      "Stock changed",
    ].some((message) => error.message.includes(message));

    return res.status(clientError ? 400 : 500).json({
      success: false,
      message: clientError
        ? error.message
        : "Unable to place the order. Please try again.",
    });
  }
};

// CUSTOMER: View only their own orders.
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("owner", "name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get customer orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your orders.",
    });
  }
};

// OWNER: View only orders assigned to their shop.
const getOwnerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ owner: req.user._id })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get owner orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve shop orders.",
    });
  }
};

// OWNER: Confirm or reject their own pending orders.
const updateOwnerOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Confirmed", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Confirmed or Rejected.",
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        owner: req.user._id,
        status: "Pending",
      },
      { $set: { status } },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Pending order not found for your shop. It may already have been processed.",
      });
    }

    // Release reserved stock when an owner rejects an order.
    if (status === "Rejected") {
      try {
        for (const item of order.items) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity } }
          );
        }
      } catch (stockError) {
        console.error(
          "Rejected order stock restoration error:",
          stockError.message
        );

        return res.status(500).json({
          success: false,
          message:
            "Order was rejected, but stock restoration needs checking.",
        });
      }
    }

    return res.json({
      success: true,
      message: `Order ${status.toLowerCase()} successfully.`,
      order,
    });
  } catch (error) {
    console.error("Update order status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update order status.",
    });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOwnerOrders,
  updateOwnerOrderStatus,
};
