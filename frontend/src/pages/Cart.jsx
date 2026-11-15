
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Cart.css";

function Cart() {
  const [cart, setCart] = useState([]);

  // Load cart items from localStorage
  useEffect(() => {
    try {
      const savedCart = JSON.parse(
        localStorage.getItem("cart") || "[]"
      );

      setCart(Array.isArray(savedCart) ? savedCart : []);
    } catch (error) {
      console.error("Unable to load cart:", error);
      setCart([]);
    }
  }, []);

  // Save cart changes
  const saveCart = (updatedCart) => {
    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));

    window.dispatchEvent(new Event("cart-change"));
  };

  // Update product quantity within available stock
  const updateQuantity = (id, change) => {
    const updatedCart = cart.map((item) => {
      if (item._id !== id) {
        return item;
      }

      const stock = Math.max(0, Number(item.stock) || 1);
      const currentQuantity = Number(item.quantity) || 1;

      const newQuantity = Math.max(
        1,
        Math.min(stock, currentQuantity + change)
      );

      return {
        ...item,
        quantity: newQuantity,
      };
    });

    saveCart(updatedCart);
  };

  // Remove a product from the cart
  const removeItem = (id) => {
    saveCart(cart.filter((item) => item._id !== id));
  };

  // Calculate total quantity
  const totalItems = cart.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1),
    0
  );

  // Calculate subtotal
  const total = cart.reduce(
    (sum, item) =>
      sum +
      (Number(item.price) || 0) *
        (Number(item.quantity) || 1),
    0
  );

  // Format prices in Sri Lankan Rupees
  const formatPrice = (price) =>
    `LKR ${Number(price || 0).toLocaleString("en-LK")}`;

  return (
    <main className="cart-page">
      {/* Navigation */}
      <nav className="navbar">
        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/products">Furniture</Link>
          <Link to="/cart" aria-current="page">
            Cart ({totalItems})
          </Link>
        </div>
      </nav>

      {/* Page heading */}
      <section className="products-header">
        <p className="eyebrow">YOUR HOME, YOUR STYLE</p>

        <h1>Shopping Cart</h1>

        <p>
          Review your selected furniture and prepare for checkout.
        </p>
      </section>

      {/* Cart content */}
      <section className="cart-content">
        {cart.length === 0 ? (
          /* Empty cart */
          <div className="empty-products">
            <h2>Your cart is empty</h2>

            <p>
              Your next favourite piece of furniture is waiting.
              Explore our collection and find something you love.
            </p>

            <Link to="/products" className="primary-button">
              Explore Furniture
            </Link>
          </div>
        ) : (
          <>
            {/* Product list */}
            <div className="cart-items">
              {cart.map((item) => {
                const quantity = Number(item.quantity) || 1;
                const stock = Number(item.stock) || 1;
                const price = Number(item.price) || 0;

                return (
                  <article className="cart-item" key={item._id}>
                    {/* Product image */}
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name || "Furniture product"}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="product-placeholder">
                        Furniture
                      </div>
                    )}

                    {/* Product details */}
                    <div className="cart-item-info">
                      <h2>{item.name || "Furniture"}</h2>

                      <p>{formatPrice(price)} each</p>

                      {/* Quantity selector */}
                      <div
                        className="cart-quantity"
                        aria-label={`Quantity for ${item.name}`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item._id, -1)
                          }
                          disabled={quantity <= 1}
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          −
                        </button>

                        <span aria-live="polite">{quantity}</span>

                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item._id, 1)
                          }
                          disabled={quantity >= stock}
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          +
                        </button>
                      </div>

                      {/* Remove product */}
                      <button
                        type="button"
                        className="remove-cart-item"
                        onClick={() => removeItem(item._id)}
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        Remove item
                      </button>
                    </div>

                    {/* Product subtotal */}
                    <p className="cart-item-subtotal">
                      {formatPrice(price * quantity)}
                    </p>
                  </article>
                );
              })}
            </div>

            {/* Order summary */}
            <aside className="cart-summary">
              <h2>Order Summary</h2>

              <p>
                <span>Total items</span>
                <strong>{totalItems}</strong>
              </p>

              <p>
                <span>Subtotal</span>
                <strong>{formatPrice(total)}</strong>
              </p>

              <p>
                Delivery fees are not included and will be handled
                during checkout.
              </p>

              <div className="cart-summary-actions">
                <Link
                  to="/products"
                  className="secondary-button"
                >
                  Continue Shopping
                </Link>

                <Link
                  to="/checkout"
                  className="primary-button"
                >
                  Proceed to Checkout
                </Link>
              </div>
            </aside>
          </>
        )}
      </section>
    </main>
  );
}

export default Cart;
