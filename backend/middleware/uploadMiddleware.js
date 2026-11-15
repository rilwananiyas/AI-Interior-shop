
const multer = require("multer");

// Keep uploaded images temporarily in memory.
const storage = multer.memoryStorage();

// Accept only supported image formats.
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only JPG, PNG, and WEBP images are allowed."),
      false
    );
  }
};

// Configure Multer.
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maximum 5 MB
  },
});

// Export separate upload middleware.
module.exports = {
  uploadRoomImage: upload.single("roomImage"),
  uploadProfileImage: upload.single("profileImage"),
};
