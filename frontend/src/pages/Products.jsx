import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import "../styles/Products.css";

const REFRESH_INTERVAL = 5000;

function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // Load products from backend
  const loadProducts = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response = await api.get("/products");

      setProducts(response.data.products || []);
      setError("");
    } catch (err) {
      console.error("Load products error:", err);

      setError("Unable to load furniture. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial loading and automatic refresh
  useEffect(() => {
    loadProducts(true);

    const intervalId = setInterval(() => {
      loadProducts(false);
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [loadProducts]);

  // Available categories
  const categories = [
    "All",
    "Sofas",
    "Chairs",
    "Tables",
    "Beds",
    "Storage",
    "Lighting",
    "Decor",
  ];

  // Search and category filtering
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      category === "All" || product.category === category;

    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      !searchText ||
      product.name?.toLowerCase().includes(searchText) ||
      product.description?.toLowerCase().includes(searchText) ||
      product.category?.toLowerCase().includes(searchText);

    return matchesCategory && matchesSearch;
  });

  return (
    <main className="products-page">

      {/* Navigation Bar */}
      <nav className="navbar">
        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/products">Products</Link>
          <Link to="/ai-assistant">AI Assistant</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/my-orders">My Orders</Link>
        </div>
      </nav>

      {/* Page Header */}
      <section className="products-header">
        <p className="eyebrow">FIND YOUR STYLE</p>

        <h1>Our Furniture Collection</h1>

        <p>
          Discover furniture for every room in your home.
        </p>
      </section>

      {/* Search and Category Filter */}
      <section className="products-toolbar">
        <input
          type="search"
          placeholder="Search furniture..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search furniture"
        />

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </section>

      {/* Loading State */}
      {loading ? (
        <p className="products-message">
          Loading furniture...
        </p>

      ) : error ? (

        /* Error State */
        <section className="products-message" role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => loadProducts(true)}
          >
            Try Again
          </button>
        </section>

      ) : filteredProducts.length === 0 ? (

        /* Empty State */
        <p className="products-message">
          No furniture products found.
        </p>

      ) : (

        /* Product Collection */
        <section className="products-grid">
          {filteredProducts.map((product) => (
            <article
              className="product-card"
              key={product._id}
            >
              <Link
                to={`/products/${product._id}`}
                className="product-card-link"
              >
                {/* Product Image */}
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="product-card-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="product-card-placeholder">
                    No image available
                  </div>
                )}

                {/* Product Information */}
                <div className="product-card-content">

                  <p className="product-category">
                    {product.category}
                  </p>

                  <h2>{product.name}</h2>

                  <p className="product-description">
                    {product.description}
                  </p>

                  <p className="product-price">
                    LKR{" "}
                    {Number(product.price).toLocaleString("en-LK")}
                  </p>

                  <p className="product-stock">
                    {product.stock > 0
                      ? "In stock"
                      : "Out of stock"}
                  </p>

                  {/* Seller Information */}
                  <div className="product-shop">
                    <span className="product-shop-label">
                      Sold by
                    </span>

                    <span className="product-shop-name">
                      <span aria-hidden="true">🏪 </span>

                      {typeof product.owner === "object" &&
                      product.owner !== null
                        ? product.owner.name || "AI Interior Shop"
                        : "AI Interior Shop"}
                    </span>
                  </div>

                </div>
              </Link>

              {/* View Product Button */}
              <Link
                to={`/products/${product._id}`}
                className="product-view-button"
              >
                View Product
              </Link>

            </article>
          ))}
        </section>
      )}

    </main>
  );
}

export default Products;
