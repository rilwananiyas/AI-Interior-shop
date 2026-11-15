
import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/MySavedDesigns.css";

function MySavedDesigns() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchSavedDesigns();
  }, []);

  const fetchSavedDesigns = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/saved-designs");

      // Supports common response formats.
      const savedItems =
        response.data?.designs ||
        response.data?.savedDesigns ||
        response.data?.data ||
        [];

      setDesigns(Array.isArray(savedItems) ? savedItems : []);
    } catch (err) {
      console.error("Fetch saved designs error:", err);
      setError(
        err.response?.data?.message ||
        "Unable to load your saved designs. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (designId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this saved design?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(designId);
      setError("");

      await api.delete(`/saved-designs/${designId}`);

      setDesigns((previousDesigns) =>
        previousDesigns.filter((design) => design._id !== designId)
      );
    } catch (err) {
      console.error("Delete saved design error:", err);
      setError(
        err.response?.data?.message ||
        "Unable to delete this design. Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="saved-designs-page">
        <p className="saved-designs-status">Loading your saved designs...</p>
      </div>
    );
  }

  return (
    <main className="saved-designs-page">
      <div className="saved-designs-header">
        <h1>My Saved Designs</h1>
        <p>Your favourite AI-generated room designs in one place.</p>
      </div>

      {error && (
        <p className="saved-designs-error" role="alert">
          {error}
        </p>
      )}

      {designs.length === 0 ? (
        <div className="saved-designs-empty">
          <h2>No saved designs yet</h2>
          <p>
            Redesign a room and select "Save Design" to keep it here.
          </p>
        </div>
      ) : (
        <div className="saved-designs-grid">
          {designs.map((design) => (
            <article className="saved-design-card" key={design._id}>
              <div className="saved-design-images">
                <div className="saved-design-image">
                  <span>Original</span>
                  <img
                    src={design.originalImageUrl}
                    alt="Original room"
                  />
                </div>

                <div className="saved-design-image">
                  <span>AI Redesigned</span>
                  <img
                    src={design.redesignedImageUrl}
                    alt="AI redesigned room"
                  />
                </div>
              </div>

              <div className="saved-design-info">
                <h2>{design.style} Style</h2>

                <p>
                  Saved on:{" "}
                  {design.createdAt
                    ? new Date(design.createdAt).toLocaleDateString()
                    : "Date unavailable"}
                </p>

                <a
                  href={design.redesignedImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="saved-design-view-link"
                >
                  View Full Image
                </a>

                <button
                  type="button"
                  className="saved-design-delete"
                  onClick={() => handleDelete(design._id)}
                  disabled={deletingId === design._id}
                >
                  {deletingId === design._id
                    ? "Deleting..."
                    : "Delete Design"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default MySavedDesigns;
