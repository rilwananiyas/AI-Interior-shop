
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

const API_URL = "http://localhost:5000/api/products";
const MY_PRODUCTS_URL = `${API_URL}/my-products`;

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: "Sofas",
  image: "",
  stock: "1",
};

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
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
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

        setMessage(
          "Product updated! The Furniture page will refresh automatically."
        );
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
          Update a product here to make the latest details available
          on the customer Furniture page.
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

          <label htmlFor="image">Image URL (optional)</label>
          <input
            id="image"
            name="image"
            type="url"
            value={formData.image}
            onChange={handleChange}
            placeholder="https://example.com/sofa.jpg"
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
                    Price: LKR{" "}
                    {Number(product.price).toLocaleString("en-LK")}
                  </p>

                  <p>Stock: {product.stock}</p>

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
