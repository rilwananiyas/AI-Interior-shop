
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";

const API_URL = "/api/products";

function ProductDetails() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(`${API_URL}/${id}`);
        const fetchedProduct = response.data.product;

        if (!fetchedProduct) {
          setError("Product not found.");
          return;
        }

        setProduct(fetchedProduct);
        setQuantity(1);
      } catch (err) {
        console.error("Failed to load product:", err);
        setError("Unable to load this furniture product.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (!product || product.stock < 1) {
      setMessage("Sorry, this product is out of stock.");
      return;
    }

    try {
      const savedCart = JSON.parse(
        localStorage.getItem("cart") || "[]"
      );

      const cart = Array.isArray(savedCart) ? savedCart : [];
      const existingItem = cart.find(
        (item) => item._id === product._id
      );

      if (
        existingItem &&
        Number(existingItem.quantity || 1) + quantity >
          Number(product.stock)
      ) {
        setMessage("You cannot add more than the available stock.");
        return;
      }

      let updatedCart;

      if (existingItem) {
        updatedCart = cart.map((item) =>
          item._id === product._id
            ? {
                ...item,
                quantity: Number(item.quantity || 1) + quantity,
              }
            : item
        );
      } else {
        updatedCart = [
          ...cart,
          {
            _id: product._id,
            name: product.name,
            price: Number(product.price),
            image: product.image || "",
            stock: Number(product.stock),
            quantity,
          },
        ];
      }

      localStorage.setItem("cart", JSON.stringify(updatedCart));
      window.dispatchEvent(new Event("cart-change"));
      setMessage("Furniture added to your cart!");
    } catch (err) {
      console.error("Unable to update cart:", err);
      setMessage("Unable to add this item. Please try again.");
    }
  };

  if (loading) {
    return <main className="products-page">Loading product...</main>;
  }

  if (error || !product) {
    return (
      <main className="products-page">
        <h2>{error || "Product not found."}</h2>
        <Link to="/products">Back to Furniture</Link>
      </main>
    );
  }

  return (
    <main className="products-page">
      <nav className="navbar">
        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/products">Furniture</Link>
          <Link to="/cart">Shopping Cart</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </nav>

      <section className="product-details">
        <Link to="/products" className="back-link">
          ← Back to Furniture
        </Link>

        <div className="product-details-layout">
          <div className="product-details-image">
            {product.image ? (
              <img src={product.image} alt={product.name} />
            ) : (
              <div className="product-placeholder">Furniture</div>
            )}
          </div>

          <div className="product-details-info">
            <p className="product-category">{product.category}</p>
            <h1>{product.name}</h1>
            <p>{product.description}</p>

            <h2 className="product-price">
              LKR {Number(product.price).toLocaleString("en-LK")}
            </h2>

            <p>
              {product.stock > 0
                ? `In stock: ${product.stock}`
                : "Currently out of stock"}
            </p>

            {product.stock > 0 && (
              <div className="quantity-selector">
                <label htmlFor="product-quantity">Quantity:</label>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) => Math.max(1, current - 1))
                  }
                  disabled={quantity <= 1}
                >
                  −
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      Math.min(Number(product.stock), current + 1)
                    )
                  }
                  disabled={quantity >= Number(product.stock)}
                >
                  +
                </button>
              </div>
            )}

            <button
              type="button"
              className="primary-button add-to-cart-button"
              onClick={handleAddToCart}
              disabled={Number(product.stock) < 1}
            >
              {Number(product.stock) > 0
                ? "Add to Cart"
                : "Out of Stock"}
            </button>

            {message && <p role="status">{message}</p>}

            <p>
              <Link to="/cart">View Shopping Cart →</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProductDetails;
