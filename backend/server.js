
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const aiRoutes = require("./routes/aiRoutes");
const roomAnalysisRoutes = require("./routes/roomAnalysisRoutes");
const roomRedesignRoutes = require("./routes/roomRedesignRoutes");
const savedDesignRoutes = require("./routes/savedDesignRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Interior Shopping API is running!",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/ai", aiRoutes);

// Room analysis and AI redesign
app.use("/api/room-analysis", roomAnalysisRoutes);
app.use("/api/room-redesign", roomRedesignRoutes);

// Saved designs
app.use("/api/saved-designs", savedDesignRoutes);

// Start server after connecting to MongoDB
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
