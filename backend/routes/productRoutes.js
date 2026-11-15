
const express = require("express");
const router = express.Router();

const {
  getProducts,
  getMyProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const { protect } = require("../middleware/authMiddleware");

// APPROVED OWNER AUTHORIZATION
const approvedOwnerOnly = (req, res, next) => {
  if (
    req.user &&
    req.user.role === "owner" &&
    req.user.ownerStatus === "approved"
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Only approved shop owners can manage products.",
  });
};

// PUBLIC: GET ALL ACTIVE PRODUCTS
router.get("/", getProducts);

// OWNER: GET OWN PRODUCTS
// This route must appear before "/:id".
router.get(
  "/my-products",
  protect,
  approvedOwnerOnly,
  getMyProducts
);

// PUBLIC: GET ONE PRODUCT
router.get("/:id", getProductById);

// OWNER: CREATE PRODUCT
router.post("/", protect, approvedOwnerOnly, createProduct);

// OWNER: UPDATE OWN PRODUCT
router.put("/:id", protect, approvedOwnerOnly, updateProduct);

// OWNER: DELETE OWN PRODUCT
router.delete("/:id", protect, approvedOwnerOnly, deleteProduct);

module.exports = router;
