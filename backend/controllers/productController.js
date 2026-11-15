
const Product = require("../models/Product");

// GET ALL ACTIVE PRODUCTS FOR THE CUSTOMER SHOP
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate("owner", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

// GET PRODUCTS BELONGING TO THE LOGGED-IN OWNER
const getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({
      owner: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get owner products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your products",
    });
  }
};

// GET ONE ACTIVE PRODUCT
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      isActive: true,
    }).populate("owner", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    console.error("Get product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

// CREATE PRODUCT
const createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      material,
      color,
      style,
      suitableRooms,
      durability,
      size,
      spaceSaving,
      features,
      image,
      stock,
    } = req.body;

    const product = await Product.create({
      name,
      description,
      price,
      category,
      material,
      color,
      style,
      suitableRooms,
      durability,
      size,
      spaceSaving,
      features,
      image,
      stock,
      owner: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

// UPDATE ONLY THE OWNER'S OWN PRODUCT
const updateProduct = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "description",
      "price",
      "category",
      "material",
      "color",
      "style",
      "suitableRooms",
      "durability",
      "size",
      "spaceSaving",
      "features",
      "image",
      "stock",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one field to update.",
      });
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.user._id,
      },
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found or you do not own this product.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    if (
      error.name === "CastError" ||
      error.name === "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.name === "CastError"
            ? "Invalid product ID"
            : error.message,
      });
    }

    console.error("Update product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

// DELETE ONLY THE OWNER'S OWN PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found or you do not own this product.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    console.error("Delete product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
};

module.exports = {
  getProducts,
  getMyProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
