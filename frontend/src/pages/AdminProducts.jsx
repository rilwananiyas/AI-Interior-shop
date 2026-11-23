import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

const API_URL = "/api/products";
const MY_PRODUCTS_URL = `${API_URL}/my-products`;

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: "Sofas",
  image: "",
  stock: "1",

  // Existing attributes
  material: "",
  color: "",
  style: "",
  suitableRooms: [],

  // New AI attributes
  durability: "",
  size: "",
  spaceSaving: false,
  features: [],
};

const roomOptions = [
  "Bedroom",
  "Living Room",
  "Dining Room",
  "Office",
];

const FEATURE_OPTIONS = [
  "foldable",
  "extendable",
  "adjustable",
  "cushioned",
  "reclining",
  "easy to clean",
  "water-resistant",
  "with storage",
];

function AdminProducts() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ ...emptyForm });
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);

      const token = localStorage.getItem("token");

      const response = await axios.get(MY_PRODUCTS_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setProducts(response.data.products || []);
      setError("");
    } catch (err) {
      console.error("Load owner products error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to load your products."
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    let user = null;

    try {
      user = JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      user = null;
    }

    if (!localStorage.getItem("token")) {
      navigate("/login", { replace: true });
      return;
    }

    if (
      user?.role !== "owner" ||
      user?.ownerStatus !== "approved"
    ) {
      navigate("/", { replace: true });
      return;
    }

    loadProducts();
  }, [navigate, loadProducts]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleRoomChange = (room, checked) => {
    setFormData((previous) => ({
      ...previous,
      suitableRooms: checked
        ? [...previous.suitableRooms, room]
        : previous.suitableRooms.filter(
            (selectedRoom) => selectedRoom !== room
          ),
    }));
  };

  const handleFeatureToggle = (feature) => {
    setFormData((previous) => {
      const alreadySelected = previous.features.includes(feature);

      return {
        ...previous,
        features: alreadySelected
          ? previous.features.filter((item) => item !== feature)
          : [...previous.features, feature],
      };
    });
  };

  const handleEdit = (product) => {
    setEditingId(product._id);

    setFormData({
      name: product.name || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      category: product.category || "Sofas",
      image: product.image || "",
      stock: String(product.stock ?? 0),

      // Existing attributes
      material: product.material || "",
      color: product.color || "",
      style: product.style || "",
      suitableRooms: Array.isArray(product.suitableRooms)
        ? product.suitableRooms
        : [],

      // New AI attributes
      durability: product.durability || "",
      size: product.size || "",
      spaceSaving: product.spaceSaving === true,
      features: Array.isArray(product.features)
        ? product.features
        : [],
    });

    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (loading) return;

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in again.");
      return;
    }

    const price = Number(formData.price);
    const stock = Number(formData.stock);

    if (
      !formData.name.trim() ||
      !formData.description.trim() ||
      formData.price.trim() === ""
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a whole number of zero or more.");
      return;
    }

    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      price,
      category: formData.category,
      image: formData.image.trim(),
      stock,

      // Existing attributes
      material: formData.material.trim(),
      color: formData.color.trim(),
      style: formData.style.trim(),
      suitableRooms: formData.suitableRooms,

      // New AI attributes
      durability: formData.durability,
      size: formData.size,
      spaceSaving: formData.spaceSaving,
      features: formData.features,
    };

    try {
      setLoading(true);

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };

      if (editingId) {
        await axios.put(
          `${API_URL}/${editingId}`,
          productData,
          config
        );

        setMessage("Product updated successfully!");
      } else {
        await axios.post(API_URL, productData, config);
        setMessage("Product added successfully!");
      }

      setFormData({ ...emptyForm });
      setEditingId(null);

      await loadProducts();
    } catch (err) {
      console.error("Save product error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to save the product."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in again.");
      return;
    }

    setMessage("");
    setError("");

    try {
      await axios.delete(`${API_URL}/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (editingId === productId) {
        setEditingId(null);
        setFormData({ ...emptyForm });
      }

      setMessage("Product deleted successfully!");
      await loadProducts();
    } catch (err) {
      console.error("Delete product error:", err);
      setError(
        err.response?.data?.message ||
          "Unable to delete this product."
      );
    }
  };

  return (
    <main className="admin-page">
      <nav className="navbar">
        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/products">Furniture</Link>
          <Link to="/cart">Cart</Link>
        </div>
      </nav>

      <section className="admin-card">
        <p className="eyebrow">SHOP OWNER DASHBOARD</p>

        <h1>
          {editingId ? "Edit Furniture Product" : "My Shop Products"}
        </h1>

        <p>
          Add detailed furniture information to help customers
          and the AI assistant find suitable products.
        </p>

        {message && (
          <div className="success-message" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="name">Product Name *</label>
          <input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <label htmlFor="description">Description *</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            required
          />

          <label htmlFor="price">Price (LKR) *</label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={formData.price}
            onChange={handleChange}
            required
          />

          <label htmlFor="category">Category *</label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="Sofas">Sofas</option>
            <option value="Chairs">Chairs</option>
            <option value="Tables">Tables</option>
            <option value="Beds">Beds</option>
            <option value="Storage">Storage</option>
            <option value="Lighting">Lighting</option>
            <option value="Decor">Decor</option>
          </select>

          {/* Existing Material field */}
          <label htmlFor="material">Material</label>
          <select
            id="material"
            name="material"
            value={formData.material}
            onChange={handleChange}
          >
            <option value="">Select material</option>
            <option value="Wood">Wood</option>
            <option value="Metal">Metal</option>
            <option value="Glass">Glass</option>
            <option value="Fabric">Fabric</option>
            <option value="Leather">Leather</option>
            <option value="Plastic">Plastic</option>
            <option value="Rattan">Rattan</option>
            <option value="Engineered Wood">Engineered Wood</option>
          </select>

          {/* Existing Colour field */}
          <label htmlFor="color">Colour</label>
          <select
            id="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
          >
            <option value="">Select colour</option>
            <option value="Black">Black</option>
            <option value="White">White</option>
            <option value="Brown">Brown</option>
            <option value="Grey">Grey</option>
            <option value="Beige">Beige</option>
            <option value="Blue">Blue</option>
            <option value="Green">Green</option>
            <option value="Natural Wood">Natural Wood</option>
          </select>

          {/* Existing Style field */}
          <label htmlFor="style">Furniture Style</label>
          <select
            id="style"
            name="style"
            value={formData.style}
            onChange={handleChange}
          >
            <option value="">Select style</option>
            <option value="Modern">Modern</option>
            <option value="Minimalist">Minimalist</option>
            <option value="Classic">Classic</option>
            <option value="Scandinavian">Scandinavian</option>
            <option value="Industrial">Industrial</option>
            <option value="Traditional">Traditional</option>
            <option value="Contemporary">Contemporary</option>
          </select>

          {/* Existing Suitable Rooms field */}
          <label>Suitable Rooms</label>
          <div>
            {roomOptions.map((room) => (
              <label
                key={room}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  margin: "8px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.suitableRooms.includes(room)}
                  onChange={(event) =>
                    handleRoomChange(room, event.target.checked)
                  }
                />
                {room}
              </label>
            ))}
          </div>

          {/* New AI Recommendation Attributes */}
          <hr />
          <h3>AI Recommendation Attributes</h3>
          <p>
            These details help the AI assistant recommend furniture
            based on customer requirements.
          </p>

          <label htmlFor="durability">Durability</label>
          <select
            id="durability"
            name="durability"
            value={formData.durability}
            onChange={handleChange}
          >
            <option value="">Not specified</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>

          <label htmlFor="size">Furniture Size</label>
          <select
            id="size"
            name="size"
            value={formData.size}
            onChange={handleChange}
          >
            <option value="">Not specified</option>
            <option value="Compact">Compact</option>
            <option value="Medium">Medium</option>
            <option value="Large">Large</option>
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              margin: "12px 0",
            }}
          >
            <input
              type="checkbox"
              name="spaceSaving"
              checked={formData.spaceSaving}
              onChange={handleChange}
            />
            Space-saving furniture
          </label>

          <p><strong>Furniture Features</strong></p>
          <div className="feature-options">
            {FEATURE_OPTIONS.map((feature) => (
              <label
                key={feature}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  margin: "8px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.features.includes(feature)}
                  onChange={() => handleFeatureToggle(feature)}
                />
                {feature.charAt(0).toUpperCase() + feature.slice(1)}
              </label>
            ))}
          </div>

          <hr />

          <label htmlFor="image">Image URL (optional)</label>
          <input
            id="image"
            name="image"
            type="url"
            value={formData.image}
            onChange={handleChange}
            placeholder="https://example.com/furniture.jpg"
          />

          <label htmlFor="stock">Stock Quantity *</label>
          <input
            id="stock"
            name="stock"
            type="number"
            min="0"
            step="1"
            value={formData.stock}
            onChange={handleChange}
            required
          />

          <button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : editingId
                ? "Update Product"
                : "Add Product"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={loading}
            >
              Cancel Editing
            </button>
          )}
        </form>
      </section>

      <section className="admin-card">
        <h2>My Listed Products ({products.length})</h2>

        {loadingProducts ? (
          <p>Loading your products...</p>
        ) : products.length === 0 ? (
          <p>You have not added any products yet.</p>
        ) : (
          <div className="admin-product-list">
            {products.map((product) => (
              <article
                className="admin-product-item"
                key={product._id}
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="admin-product-image"
                  />
                ) : (
                  <div className="admin-product-image product-placeholder">
                    No Image
                  </div>
                )}

                <div className="admin-product-info">
                  <h3>{product.name}</h3>
                  <p>Category: {product.category}</p>
                  <p>
                    Price: LKR {Number(product.price).toLocaleString("en-LK")}
                  </p>
                  <p>Stock: {product.stock}</p>

                  {/* Existing attributes displayed */}
                  {product.material && <p>Material: {product.material}</p>}
                  {product.color && <p>Colour: {product.color}</p>}
                  {product.style && <p>Style: {product.style}</p>}
                  {product.suitableRooms?.length > 0 && (
                    <p>Suitable rooms: {product.suitableRooms.join(", ")}</p>
                  )}

                  {/* New AI attributes displayed */}
                  {product.durability && (
                    <p>Durability: {product.durability}</p>
                  )}
                  {product.size && <p>Size: {product.size}</p>}
                  {product.spaceSaving && <p>Space-saving: Yes</p>}
                  {product.features?.length > 0 && (
                    <p>Features: {product.features.join(", ")}</p>
                  )}

                  <div className="admin-product-actions">
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(product._id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminProducts;
