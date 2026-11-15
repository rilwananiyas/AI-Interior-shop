
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function Checkout() {
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const savedCart = JSON.parse(
        localStorage.getItem("cart") || "[]"
      );

      setCart(Array.isArray(savedCart) ? savedCart : []);

      const user = JSON.parse(
        localStorage.getItem("user") || "null"
      );

      if (user) {
        setForm((current) => ({
          ...current,
          fullName: user.name || "",
          email: user.email || "",
        }));
      }
    } catch {
      setCart([]);
      setError("Unable to read your saved cart. Please review your cart.");
    }
  }, []);

  const total = cart.reduce(
    (sum, item) =>
      sum + Number(item.price) * Number(item.quantity || 1),
    0
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (loading) return;

    if (!cart.length) {
      setError("Your cart is empty. Please select some furniture first.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in before placing your order.");
      return;
    }

    const requiredFields = [
      "fullName",
      "email",
      "phone",
      "address",
      "city",
      "postalCode",
    ];

    if (
      requiredFields.some(
        (field) =>
          typeof form[field] !== "string" ||
          !form[field].trim()
      )
    ) {
      setError("Please complete all required delivery details.");
      return;
    }

    const invalidItem = cart.some((item) => {
      const price = Number(item.price);
      const quantity = Number(item.quantity ?? 1);

      return (
        !item._id ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(quantity) ||
        quantity < 1
      );
    });

    if (invalidItem) {
      setError(
        "One or more cart items are missing a valid product ID, name, price, or quantity. Please remove the invalid item and add the product again."
      );
      return;
    }

    setLoading(true);

    try {
      // Send every field expected by the current order route.
      const orderItems = cart.map((item) => ({
        product: item._id,
        name: item.name,
        image: item.image || item.imageUrl || "",
        price: Number(item.price),
        quantity: Number(item.quantity ?? 1),
      }));

      const response = await axios.post(
        "http://localhost:5000/api/orders",
        {
          items: orderItems,
          shippingAddress: {
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            postalCode: form.postalCode.trim(),
          },
          paymentMethod: "Cash on Delivery",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.data?.success || !response.data?.order?._id) {
        setError(
          response.data?.message ||
            "The server did not confirm the order. Please check your orders before trying again."
        );
        return;
      }

      localStorage.removeItem("cart");
      window.dispatchEvent(new Event("cart-change"));

      navigate("/order-success", {
        state: {
          order: response.data.order,
        },
      });
    } catch (err) {
      console.error(
        "Place order error:",
        err.response?.data || err
      );

      setError(
        err.response?.data?.message ||
          "Unable to place your order. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="checkout-page">
        <nav className="navbar">
          <Link to="/" className="brand">
            AI Interior Shop
          </Link>
          <Link to="/products">Furniture</Link>
        </nav>

        <section className="checkout-card">
          <h1>Your cart is empty</h1>
          <p>Add furniture before proceeding to checkout.</p>
          <Link to="/products" className="primary-button">
            Explore Furniture
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <nav className="navbar">
        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">
          <Link to="/products">Furniture</Link>
          <Link to="/cart">Shopping Cart</Link>
        </div>
      </nav>

      <section className="checkout-header">
        <p className="eyebrow">ALMOST YOURS</p>
        <h1>Checkout</h1>
        <p>Enter your delivery information and review your order.</p>
      </section>

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <h2>Delivery Information</h2>

          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            autoComplete="name"
            required
          />

          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />

          <label htmlFor="phone">Phone Number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            autoComplete="tel"
            required
          />

          <label htmlFor="address">Delivery Address</label>
          <textarea
            id="address"
            name="address"
            value={form.address}
            onChange={handleChange}
            autoComplete="street-address"
            rows="3"
            required
          />

          <label htmlFor="city">City</label>
          <input
            id="city"
            name="city"
            value={form.city}
            onChange={handleChange}
            autoComplete="address-level2"
            required
          />

          <label htmlFor="postalCode">Postal Code</label>
          <input
            id="postalCode"
            name="postalCode"
            value={form.postalCode}
            onChange={handleChange}
            autoComplete="postal-code"
            required
          />

          <p className="checkout-note">
            Payment method: Cash on Delivery. Payment is collected
            on delivery; no online payment is processed here.
          </p>

          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? "Placing Order..." : "Place Order"}
          </button>
        </form>

        <aside className="checkout-summary">
          <h2>Order Summary</h2>

          {cart.map((item, index) => (
            <div
              className="checkout-item"
              key={item._id || index}
            >
              <span>
                {item.name} × {item.quantity ?? 1}
              </span>

              <strong>
                LKR{" "}
                {(
                  Number(item.price) *
                  Number(item.quantity ?? 1)
                ).toLocaleString("en-LK")}
              </strong>
            </div>
          ))}

          <hr />

          <p className="checkout-total">
            <span>Subtotal</span>
            <strong>
              LKR {total.toLocaleString("en-LK")}
            </strong>
          </p>

          <p>Delivery fee: To be calculated</p>

          <Link to="/cart" className="secondary-button">
            Edit Cart
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default Checkout;
