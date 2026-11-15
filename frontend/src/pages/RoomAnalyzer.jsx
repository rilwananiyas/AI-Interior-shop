
import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/RoomAnalyzer.css";

const DESIGN_STYLES = [
  "Modern",
  "Minimalist",
  "Scandinavian",
  "Industrial",
  "Bohemian",
  "Traditional",
  "Contemporary",
  "Japandi",
];

function RoomAnalyzer() {
  // ================================
  // STATE MANAGEMENT
  // ================================

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);

  // Room redesign states
  const [selectedStyle, setSelectedStyle] = useState("Modern");
  const [redesignLoading, setRedesignLoading] = useState(false);
  const [redesignError, setRedesignError] = useState("");
  const [redesignResult, setRedesignResult] = useState(null);

  // Saved design states
  const [saveLoading, setSaveLoading] = useState(false);
  const [isDesignSaved, setIsDesignSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  // ================================
  // RELEASE PREVIOUS PREVIEW URL
  // ================================

  useEffect(() => {
    if (!preview) return;

    return () => {
      URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // ================================
  // RESET SAVE DESIGN STATUS
  // ================================

  const resetSaveStatus = () => {
    setIsDesignSaved(false);
    setSaveMessage("");
    setSaveError("");
  };

  // ================================
  // HANDLE IMAGE SELECTION
  // ================================

  const handleImageChange = (event) => {
    const selectedFile = event.target.files?.[0];

    setError("");
    setResult(null);

    setRedesignResult(null);
    setRedesignError("");
    setSelectedStyle("Modern");

    resetSaveStatus();

    if (!selectedFile) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setImage(null);
      setPreview("");

      setError(
        "Please select a JPG, PNG, or WEBP image."
      );

      event.target.value = "";
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setImage(null);
      setPreview("");

      setError(
        "Image size must not exceed 5 MB."
      );

      event.target.value = "";
      return;
    }

    setImage(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  // ================================
  // ANALYZE ROOM IMAGE
  // ================================

  const handleAnalyze = async () => {
    if (!image) {
      setError("Please upload a room image first.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      setResult(null);
      setRedesignResult(null);
      setRedesignError("");

      resetSaveStatus();

      const formData = new FormData();

      formData.append("roomImage", image);

      const response = await api.post(
        "/room-analysis",
        formData,
        {
          timeout: 960000,
        }
      );

      if (
        response.data?.success &&
        response.data?.analysis
      ) {
        setResult(response.data);

        setSelectedStyle(
          response.data.analysis.selectedDesignStyle ||
          "Modern"
        );
      } else {
        setError(
          response.data?.message ||
          "Room analysis failed."
        );
      }
    } catch (err) {
      console.error("Room analysis error:", err);

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Unable to analyze your room. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // REDESIGN ROOM
  // ================================

  const handleRedesign = async () => {
    const analysisId = result?.analysis?._id;

    if (!analysisId) {
      setRedesignError(
        "Room analysis ID is missing. Please analyze your room again."
      );
      return;
    }

    try {
      setRedesignLoading(true);
      setRedesignError("");
      setRedesignResult(null);

      resetSaveStatus();

      const response = await api.post(
        `/room-redesign/${analysisId}`,
        {
          style: selectedStyle,
        },
        {
          timeout: 600000,
        }
      );

      if (
        response.data?.success &&
        response.data?.data?.redesignedImageUrl
      ) {
        setRedesignResult(response.data.data);
      } else {
        setRedesignError(
          response.data?.message ||
          "Room redesign failed."
        );
      }
    } catch (err) {
      console.error("Room redesign error:", err);

      setRedesignError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Unable to redesign your room. Please try again."
      );
    } finally {
      setRedesignLoading(false);
    }
  };

  // ================================
  // SAVE REDESIGNED ROOM
  // ================================

  const handleSaveDesign = async () => {
    const analysisId = result?.analysis?._id;

    if (!analysisId || !redesignResult?.redesignedImageUrl) {
      setSaveError(
        "Please redesign your room before saving."
      );
      return;
    }

    if (isDesignSaved || saveLoading) {
      return;
    }

    try {
      setSaveLoading(true);
      setSaveError("");
      setSaveMessage("");

      const response = await api.post(
        "/saved-designs",
        {
          analysisId,
        }
      );

      if (response.data?.success) {
        setIsDesignSaved(true);

        setSaveMessage(
          response.data.message ||
          "Design saved successfully!"
        );
      } else {
        setSaveError(
          response.data?.message ||
          "Unable to save your design."
        );
      }
    } catch (err) {
      console.error("Save design error:", err);

      setSaveError(
        err.response?.data?.message ||
        err.message ||
        "Failed to save your design. Please try again."
      );
    } finally {
      setSaveLoading(false);
    }
  };

  // ================================
  // GET PRODUCT IMAGE
  // ================================

  const getProductImage = (product) => {
    const imageValue =
      product.image ||
      product.imageUrl ||
      product.images?.[0];

    if (typeof imageValue === "string") {
      return imageValue;
    }

    if (
      imageValue &&
      typeof imageValue === "object"
    ) {
      return (
        imageValue.url ||
        imageValue.imageUrl ||
        imageValue.secure_url ||
        ""
      );
    }

    return "";
  };

  // ================================
  // ANALYSIS DATA
  // ================================

  const analysis = result?.analysis;

  const roomDetails =
    analysis?.roomDetails || {};

  const designAnalysis =
    analysis?.designAnalysis || {};

  const products = Array.isArray(result?.products)
    ? result.products
    : [];

  const analysisId = analysis?._id;

  // ================================
  // COMPONENT UI
  // ================================

  return (
    <main className="room-analyzer-page">

      {/* PAGE HEADER */}

      <header className="room-analyzer-header">

        <span className="room-eyebrow">
          AI POWERED INTERIOR DESIGN
        </span>

        <h1>AI Room Analyzer</h1>

        <p>
          Upload a photo of your room. Let AI understand
          your space and discover furniture that matches
          your room.
        </p>

      </header>

      {/* IMAGE UPLOAD SECTION */}

      <section className="room-upload-section">

        <div className="room-upload-card">

          <h2>Upload Your Room Photo</h2>

          <p className="upload-description">
            Choose a clear photo of your bedroom,
            living room, dining room, or office.
          </p>

          <label
            htmlFor="roomImage"
            className="room-upload-area"
          >

            {preview ? (

              <img
                src={preview}
                alt="Selected room preview"
                className="room-preview"
              />

            ) : (

              <div className="room-upload-placeholder">

                <span className="upload-icon">
                  ↑
                </span>

                <strong>
                  Click to upload your room photo
                </strong>

                <span>
                  JPG, PNG or WEBP (Maximum 5 MB)
                </span>

              </div>

            )}

          </label>

          <input
            id="roomImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            hidden
          />

          {image && (
            <p className="selected-file">
              Selected: {image.name}
            </p>
          )}

          {error && (
            <div
              className="room-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            className="analyze-room-button"
            onClick={handleAnalyze}
            disabled={!image || loading || redesignLoading}
          >
            {loading
              ? "Analyzing Your Room..."
              : "Analyze My Room"}
          </button>

          {loading && (

            <div className="room-loading">

              <span className="loading-spinner"></span>

              <p className="room-loading-message">
                AI is examining your room. This may
                take a few minutes on your computer.
                Please wait.
              </p>

            </div>

          )}

        </div>

      </section>

      {/* AI ANALYSIS RESULTS */}

      {analysis && (

        <section className="room-results-section">

          <div className="room-results-heading">

            <span className="room-eyebrow">
              YOUR AI REPORT
            </span>

            <h2>Room Analysis Results</h2>

            <p>
              Here is what our AI discovered about your room.
            </p>

          </div>

          {/* DETECTED ROOM TYPE */}

          <div className="room-type-card">

            <span>Detected Room Type</span>

            <h2>
              {analysis.roomType || "Unknown"}
            </h2>

          </div>

          {/* ROOM DETAILS */}

          <div className="room-details-card">

            <h3>Room Details</h3>

            <div className="room-details-grid">

              <div className="detail-item">
                <strong>Walls</strong>
                <p>
                  {roomDetails.walls || "Not identified"}
                </p>
              </div>

              <div className="detail-item">
                <strong>Floor</strong>
                <p>
                  {roomDetails.floor || "Not identified"}
                </p>
              </div>

              <div className="detail-item">
                <strong>Windows</strong>
                <p>
                  {roomDetails.windows || "Not identified"}
                </p>
              </div>

              <div className="detail-item">
                <strong>Lighting</strong>
                <p>
                  {roomDetails.lighting || "Not identified"}
                </p>
              </div>

              <div className="detail-item">
                <strong>Layout</strong>
                <p>
                  {roomDetails.layout || "Not identified"}
                </p>
              </div>

              <div className="detail-item">
                <strong>Available Space</strong>
                <p>
                  {roomDetails.availableSpace || "Not identified"}
                </p>
              </div>

            </div>

            <div className="room-furniture-list">

              <strong>Visible Furniture</strong>

              {Array.isArray(roomDetails.visibleFurniture) &&
              roomDetails.visibleFurniture.length > 0 ? (

                <ul>
                  {roomDetails.visibleFurniture.map(
                    (item, index) => (
                      <li key={index}>{item}</li>
                    )
                  )}
                </ul>

              ) : (

                <p>No furniture identified.</p>

              )}

            </div>

          </div>

          {/* AI DESIGN ANALYSIS */}

          <div className="room-design-analysis-card">

            <h3>AI Design Analysis</h3>

            <div className="room-details-grid">

              <div className="detail-item">

                <strong>Detected Interior Style</strong>

                <p>
                  {designAnalysis.detectedStyle || "Unknown"}
                </p>

              </div>

              <div className="detail-item">

                <strong>Space Condition</strong>

                <p>
                  {designAnalysis.spaceCondition || "Unknown"}
                </p>

              </div>

              <div className="detail-item">

                <strong>Room Colour Palette</strong>

                {Array.isArray(
                  designAnalysis.roomColorPalette
                ) &&
                designAnalysis.roomColorPalette.length > 0 ? (

                  <ul>
                    {designAnalysis.roomColorPalette.map(
                      (color, index) => (
                        <li key={index}>{color}</li>
                      )
                    )}
                  </ul>

                ) : (

                  <p>Not identified</p>

                )}

              </div>

              <div className="detail-item">

                <strong>Suggested Furniture Materials</strong>

                {Array.isArray(
                  designAnalysis.suggestedFurnitureMaterials
                ) &&
                designAnalysis.suggestedFurnitureMaterials.length > 0 ? (

                  <ul>
                    {designAnalysis.suggestedFurnitureMaterials.map(
                      (material, index) => (
                        <li key={index}>{material}</li>
                      )
                    )}
                  </ul>

                ) : (

                  <p>Not identified</p>

                )}

              </div>

            </div>

            <div className="room-furniture-list">

              <strong>Design Recommendations</strong>

              {Array.isArray(
                designAnalysis.designSuggestions
              ) &&
              designAnalysis.designSuggestions.length > 0 ? (

                <ul>
                  {designAnalysis.designSuggestions.map(
                    (suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    )
                  )}
                </ul>

              ) : (

                <p>
                  No additional design recommendations.
                </p>

              )}

            </div>

          </div>

          {/* IMPROVEMENT SUGGESTIONS */}

          <div className="room-improvements-card">

            <h3>AI Improvement Suggestions</h3>

            {Array.isArray(analysis.improvements) &&
            analysis.improvements.length > 0 ? (

              <ol>
                {analysis.improvements.map(
                  (suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  )
                )}
              </ol>

            ) : (

              <p>No improvement suggestions available.</p>

            )}

          </div>

          {/* RECOMMENDED PRODUCTS */}

          <div className="recommended-products-section">

            <h2>Recommended Furniture</h2>

            <p>
              Furniture selected from your shop's
              available products based on your room analysis.
            </p>

            {products.length > 0 ? (

              <div className="room-products-grid">

                {products.map((product) => {

                  const productImage =
                    getProductImage(product);

                  return (

                    <article
                      className="room-product-card"
                      key={product._id}
                    >

                      {productImage ? (

                        <img
                          src={productImage}
                          alt={product.name || "Furniture"}
                          className="room-product-image"
                        />

                      ) : (

                        <div className="product-image-placeholder">
                          No image available
                        </div>

                      )}

                      <div className="room-product-info">

                        <h3>
                          {product.name || "Unnamed Product"}
                        </h3>

                        <p className="product-category">
                          {product.category || "Furniture"}
                        </p>

                        <p className="product-price">
                          LKR{" "}
                          {Number(
                            product.price || 0
                          ).toLocaleString()}
                        </p>

                        {product.description && (

                          <p className="product-description">
                            {product.description}
                          </p>

                        )}

                      </div>

                    </article>

                  );

                })}

              </div>

            ) : (

              <div className="no-room-products">
                No matching furniture products were found.
                You can still view your room analysis above.
              </div>

            )}

          </div>

          {/* ================================
              AI ROOM REDESIGN
          ================================= */}

          <section className="room-redesign-section">

            <div className="room-redesign-heading">

              <span className="room-eyebrow">
                AI POWERED ROOM TRANSFORMATION
              </span>

              <h2>Redesign Your Room</h2>

              <p>
                Choose your favourite interior design style
                and let AI transform your existing room.
              </p>

            </div>

            {/* DESIGN STYLE SELECTOR */}

            <div className="room-style-selector">

              <label htmlFor="designStyle">
                Select Interior Design Style
              </label>

              <select
                id="designStyle"
                value={selectedStyle}
                onChange={(event) => {
                  setSelectedStyle(event.target.value);
                  setRedesignResult(null);
                  setRedesignError("");
                  resetSaveStatus();
                }}
                disabled={redesignLoading || saveLoading}
              >

                {DESIGN_STYLES.map((style) => (

                  <option
                    key={style}
                    value={style}
                  >
                    {style}
                  </option>

                ))}

              </select>

              <p>
                Selected style:{" "}
                <strong>{selectedStyle}</strong>
              </p>

            </div>

            {/* REDESIGN BUTTON */}

            <button
              type="button"
              className="redesign-room-button"
              onClick={handleRedesign}
              disabled={
                !analysisId ||
                redesignLoading ||
                loading ||
                saveLoading
              }
            >

              {redesignLoading
                ? "Redesigning Your Room..."
                : "Redesign My Room"}

            </button>

            {/* REDESIGN LOADING */}

            {redesignLoading && (

              <div className="room-redesign-loading">

                <span className="loading-spinner"></span>

                <p>
                  AI is redesigning your room using the{" "}
                  <strong>{selectedStyle}</strong> style.
                </p>

                <p>
                  This may take a few minutes.
                  Please keep this page open.
                </p>

              </div>

            )}

            {/* REDESIGN ERROR */}

            {redesignError && (

              <div
                className="room-error"
                role="alert"
              >
                {redesignError}
              </div>

            )}

            {/* REDESIGN RESULTS */}

            {redesignResult && (

              <div className="room-redesign-results">

                <h3>Your Redesigned Room</h3>

                <p>
                  Design style:{" "}
                  <strong>{redesignResult.style}</strong>
                </p>

                <div className="room-comparison-grid">

                  {/* ORIGINAL ROOM */}

                  <div className="room-comparison-card">

                    <h4>Original Room</h4>

                    <img
                      src={redesignResult.originalImageUrl}
                      alt="Original room"
                    />

                  </div>

                  {/* REDESIGNED ROOM */}

                  <div className="room-comparison-card">

                    <h4>AI Redesigned Room</h4>

                    <img
                      src={redesignResult.redesignedImageUrl}
                      alt={`${redesignResult.style} redesigned room`}
                    />

                  </div>

                </div>

                {/* VIEW FULL IMAGE */}

                <a
                  href={redesignResult.redesignedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="room-download-link"
                >
                  View Full Redesigned Image
                </a>

                {/* SAVE DESIGN */}

                <div className="save-design-container">

                  <button
                    type="button"
                    className="save-design-button"
                    onClick={handleSaveDesign}
                    disabled={
                      saveLoading ||
                      isDesignSaved ||
                      redesignLoading
                    }
                  >
                    {saveLoading
                      ? "Saving Design..."
                      : isDesignSaved
                      ? "✓ Design Saved"
                      : "♡ Save Design"}
                  </button>

                  {saveMessage && (
                    <p
                      className="save-design-success"
                      role="status"
                    >
                      {saveMessage}
                    </p>
                  )}

                  {saveError && (
                    <p
                      className="room-error"
                      role="alert"
                    >
                      {saveError}
                    </p>
                  )}

                </div>

              </div>

            )}

          </section>

          {/* AUTOMATIC ROOM ANALYSIS SAVED MESSAGE */}

          <div className="room-saved-message">
            Your room analysis was saved successfully.
          </div>

        </section>

      )}

    </main>
  );
}

export default RoomAnalyzer;
