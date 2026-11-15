
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/MyProfile.css";

const MyProfile = () => {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "",
    profileImage: "",
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewImage, setPreviewImage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  // Fetch the current user's profile.
  const fetchProfile = async () => {
    try {
      setLoading(true);

      const response = await api.get("/users/profile");

      if (response.data.success) {
        const user = response.data.user;

        setProfile({
          name: user.name || "",
          email: user.email || "",
          role: user.role || "customer",
          profileImage: user.profileImage || "",
        });
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  };

  // Update local storage and notify other components.
  const updateStoredUser = (updatedUser) => {
    const storedUser = JSON.parse(
      localStorage.getItem("user") || "{}"
    );

    localStorage.setItem(
      "user",
      JSON.stringify({
        ...storedUser,
        ...updatedUser,
      })
    );

    window.dispatchEvent(new Event("auth-change"));
  };

  // Handle name and image URL input changes.
  const handleChange = (e) => {
    const { name, value } = e.target;

    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Select a profile image from the computer.
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    setMessage("");
    setError("");

    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WEBP images are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  // Upload the selected image to Cloudinary.
  const handleImageUpload = async () => {
    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");
      setError("");

      const formData = new FormData();
      formData.append("profileImage", selectedFile);

      const response = await api.post(
        "/users/profile/image",
        formData
      );

      if (response.data.success) {
        const updatedUser = response.data.user;

        setProfile((previous) => ({
          ...previous,
          profileImage: updatedUser.profileImage || "",
        }));

        updateStoredUser(updatedUser);

        setSelectedFile(null);
        setPreviewImage("");

        setMessage("Profile picture uploaded successfully!");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to upload profile picture."
      );
    } finally {
      setUploading(false);
    }
  };

  // Save name and public image URL.
  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!profile.name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    try {
      setSaving(true);

      const response = await api.patch("/users/profile", {
        name: profile.name,
        profileImage: profile.profileImage,
      });

      if (response.data.success) {
        const updatedUser = response.data.user;

        setProfile((previous) => ({
          ...previous,
          name: updatedUser.name,
          profileImage: updatedUser.profileImage || "",
        }));

        updateStoredUser(updatedUser);

        setMessage("Profile updated successfully!");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to update your profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="my-profile-loading">
        Loading profile...
      </div>
    );
  }

  const displayedImage =
    previewImage || profile.profileImage;

  return (
    <main className="my-profile-page">
      <div className="my-profile-container">

        <div className="my-profile-heading">
          <h1>My Profile</h1>
          <p>
            View and manage your personal account information.
          </p>
        </div>

        <form
          className="my-profile-card"
          onSubmit={handleSubmit}
        >

          {/* Profile picture preview */}
          <div className="my-profile-avatar">
            {displayedImage ? (
              <img
                src={displayedImage}
                alt="Profile"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <span>
                {profile.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
            )}
          </div>

          <div className="my-profile-fields">

            {/* Full name */}
            <div className="my-profile-field">
              <label htmlFor="profile-name">
                Full Name
              </label>

              <input
                id="profile-name"
                type="text"
                name="name"
                value={profile.name}
                onChange={handleChange}
                placeholder="Enter your name"
                required
              />
            </div>

            {/* Email */}
            <div className="my-profile-field">
              <label htmlFor="profile-email">
                Email Address
              </label>

              <input
                id="profile-email"
                type="email"
                value={profile.email}
                readOnly
              />

              <small>
                Email cannot be changed here.
              </small>
            </div>

            {/* Role */}
            <div className="my-profile-field">
              <label htmlFor="profile-role">
                Account Role
              </label>

              <input
                id="profile-role"
                type="text"
                value={profile.role}
                readOnly
              />
            </div>

            {/* Upload from computer */}
            <div className="my-profile-field">
              <label htmlFor="profile-file">
                Upload Picture From Computer
              </label>

              <input
                id="profile-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />

              <small>
                JPG, PNG or WEBP. Maximum size: 5 MB.
              </small>

              <button
                type="button"
                className="my-profile-save"
                onClick={handleImageUpload}
                disabled={uploading || !selectedFile}
              >
                {uploading
                  ? "Uploading..."
                  : "Upload Profile Picture"}
              </button>
            </div>

            {/* Upload from public URL */}
            <div className="my-profile-field">
              <label htmlFor="profile-image">
                Profile Image From Internet
              </label>

              <input
                id="profile-image"
                type="url"
                name="profileImage"
                value={profile.profileImage}
                onChange={handleChange}
                placeholder="https://example.com/image.jpg"
              />

              <small>
                Enter a publicly accessible HTTPS image URL.
                Click Save Changes to upload it.
              </small>
            </div>

          </div>

          {message && (
            <p className="my-profile-success">
              {message}
            </p>
          )}

          {error && (
            <p className="my-profile-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="my-profile-save"
            disabled={saving || uploading}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

        </form>
      </div>
    </main>
  );
};

export default MyProfile;
