
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* REGISTER CUSTOMER */
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please provide name, email and password",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Please provide a valid email",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "customer",
      ownerStatus: "not-applicable",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerStatus: user.ownerStatus,
        profileImage: user.profileImage || "",
      },
    });
  } catch (error) {
    console.error("Register error:", error.message);

    return res.status(500).json({
      message: "Server error during registration",
    });
  }
};

/* LOGIN CUSTOMER, OWNER OR ADMIN */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Please provide email and password",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerStatus: user.ownerStatus,
        isActive: user.isActive,
        profileImage: user.profileImage || "",
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Server error during login",
    });
  }
};

/* APPLY TO BECOME A STORE OWNER */
const applyOwner = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.isActive) {
      return res.status(404).json({
        message: "User not found or inactive",
      });
    }

    if (user.role === "admin" || user.role === "owner") {
      return res.status(400).json({
        message: "This account cannot submit a store-owner application",
      });
    }

    if (user.ownerStatus === "pending") {
      return res.status(409).json({
        message: "Your application is already pending",
      });
    }

    if (user.ownerStatus === "approved") {
      return res.status(409).json({
        message: "Your application has already been approved",
      });
    }

    user.ownerStatus = "pending";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Store owner application submitted successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerStatus: user.ownerStatus,
        profileImage: user.profileImage || "",
      },
    });
  } catch (error) {
    console.error("Apply owner error:", error.message);

    return res.status(500).json({
      message: "Server error while submitting application",
    });
  }
};

/* ADMIN: GET PENDING STORE-OWNER APPLICATIONS */
const getOwnerApplications = async (req, res) => {
  try {
    const applications = await User.find({
      ownerStatus: "pending",
      role: "customer",
    })
      .select("name email ownerStatus createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error("Get owner applications error:", error.message);

    return res.status(500).json({
      message: "Server error while fetching owner applications",
    });
  }
};

/* ADMIN: APPROVE OR REJECT AN APPLICATION */
const reviewOwnerApplication = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be approved or rejected",
      });
    }

    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const applicant = await User.findById(id);

    if (!applicant) {
      return res.status(404).json({
        message: "Applicant not found",
      });
    }

    if (
      applicant.role !== "customer" ||
      applicant.ownerStatus !== "pending"
    ) {
      return res.status(409).json({
        message: "This application is no longer pending",
      });
    }

    applicant.ownerStatus = status;

    if (status === "approved") {
      applicant.role = "owner";
    }

    await applicant.save();

    return res.status(200).json({
      success: true,
      message:
        status === "approved"
          ? "Store owner approved successfully"
          : "Store owner application rejected",
      application: {
        id: applicant._id,
        name: applicant.name,
        email: applicant.email,
        role: applicant.role,
        ownerStatus: applicant.ownerStatus,
      },
    });
  } catch (error) {
    console.error("Review owner application error:", error.message);

    return res.status(500).json({
      message: "Server error while reviewing owner application",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  applyOwner,
  getOwnerApplications,
  reviewOwnerApplication,
};
