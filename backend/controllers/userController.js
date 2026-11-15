
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");

// Upload a local image buffer to Cloudinary.
const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ai-interior-shop/profile-images",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

// Upload an image from a public HTTPS URL to Cloudinary.
const uploadUrlToCloudinary = async (imageUrl) => {
  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error("Please provide a valid image URL.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname.endsWith(".local")
  ) {
    throw new Error("Please provide a valid public HTTPS image URL.");
  }

  return cloudinary.uploader.upload(imageUrl, {
    folder: "ai-interior-shop/profile-images",
    resource_type: "image",
  });
};

// Delete an old Cloudinary image after a successful replacement.
const deleteOldProfileImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    console.error("Old profile image deletion error:", error.message);
  }
};

// GET: Retrieve the logged-in user's profile.
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while retrieving profile",
    });
  }
};

// PATCH: Update the logged-in user's name or profile image URL.
const updateMyProfile = async (req, res) => {
  try {
    const { name, profileImage } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name must be a non-empty string",
        });
      }

      updates.name = name.trim();
    }

    let uploadedImage = null;
    let user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (profileImage !== undefined) {
      if (typeof profileImage !== "string") {
        return res.status(400).json({
          success: false,
          message: "Profile image must be a string",
        });
      }

      const imageUrl = profileImage.trim();

      if (imageUrl) {
        try {
          uploadedImage = await uploadUrlToCloudinary(imageUrl);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message || "Unable to upload image URL",
          });
        }

        updates.profileImage = uploadedImage.secure_url;
        updates.profileImagePublicId = uploadedImage.public_id;
      } else {
        updates.profileImage = "";
        updates.profileImagePublicId = "";
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a name or profile image to update",
      });
    }

    const oldPublicId = user.profileImagePublicId;

    Object.assign(user, updates);
    await user.save();

    // Delete the old image only after the new data is saved.
    if (
      profileImage !== undefined &&
      oldPublicId &&
      oldPublicId !== user.profileImagePublicId
    ) {
      await deleteOldProfileImage(oldPublicId);
    }

    user = await User.findById(user._id).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
  }
};

// POST: Upload a profile picture selected from the user's PC.
const uploadMyProfileImage = async (req, res) => {
  let uploadedImage = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    uploadedImage = await uploadBufferToCloudinary(req.file.buffer);

    const oldPublicId = user.profileImagePublicId;

    user.profileImage = uploadedImage.secure_url;
    user.profileImagePublicId = uploadedImage.public_id;

    await user.save();

    await deleteOldProfileImage(oldPublicId);

    const updatedUser = await User.findById(user._id).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile image upload error:", error.message);

    // Clean up a newly uploaded image if saving the user failed.
    if (uploadedImage?.public_id) {
      await deleteOldProfileImage(uploadedImage.public_id);
    }

    return res.status(500).json({
      success: false,
      message: "Unable to upload profile picture",
    });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyProfileImage,
};
