import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "../styles/MyOrders.css";

const API_URL = "/api/orders/my-orders";
const CANCEL_URL = "/api/orders";
const REFRESH_INTERVAL = 15000;

const TABS = [
  { label: "All Orders", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Rejected", value: "rejected" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const TRACKING_STEPS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
];

const normaliseStatus = (status) =>
  String(status || "Pending").trim().toLowerCase();

const formatDate = (date) => {
  if (!date) return null;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatMoney = (amount) =>
  Number(amount || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function DeliveryTracking({ order }) {
  const status = normaliseStatus(order.status);

  const currentStep = TRACKING_STEPS.findIndex(
    (step) => step.toLowerCase() === status
  );

  if (status === "cancelled" || status === "rejected") {
    return (
      <div className="tracking-cancelled">
        <span className="tracking-dot" />
        <div>
          <strong>
            {status === "rejected"
              ? "Order rejected by the shop"
              : "Order cancelled"}
          </strong>
          <p>
            {status === "rejected"
              ? "The shop could not accept this order. Please contact the shop if you need more information."
              : "This order is no longer progressing through delivery."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="delivery-tracking">
      <h3>Delivery progress</h3>

      <div className="tracking-timeline">
        {TRACKING_STEPS.map((step, index) => {
          const completed = currentStep >= index && currentStep !== -1;
          const current = currentStep === index;

          return (
            <div
              className={`tracking-step ${
                completed ? "completed" : ""
              } ${current ? "current" : ""}`}
              key={step}
            >
              <span className="tracking-marker">
                {completed ? "✓" : index + 1}
              </span>

              <span className="tracking-step-label">{step}</span>

              {index < TRACKING_STEPS.length - 1 && (
                <span className="tracking-connector" />
              )}
            </div>
          );
        })}
      </div>

      <div className="delivery-date">
        <span>Estimated delivery</span>
        <strong>
          {formatDate(order.estimatedDeliveryDate) || "Not available yet"}
        </strong>
      </div>

      {status === "delivered" && (
        <p className="delivered-date">
          {order.deliveredAt
            ? `Delivered on ${formatDate(order.deliveredAt)}`
            : "Order marked as delivered"}
        </p>
      )}

      {status === "pending" && (
        <p className="tracking-note">
          Waiting for the shop owner to confirm your order.
        </p>
      )}

      {status === "confirmed" && (
        <p className="tracking-note">
          The shop has confirmed your order.
        </p>
      )}

      {status === "processing" && (
        <p className="tracking-note">Your order is being prepared.</p>
      )}

      {status === "shipped" && (
        <p className="tracking-note">Your order has been shipped.</p>
      )}
    </div>
  );
}

function OrderCard({ order, onCancel, cancelling }) {
  const status = normaliseStatus(order.status);
  const items = Array.isArray(order.items) ? order.items : [];

  const displayStatus =
    status.charAt(0).toUpperCase() + status.slice(1);

  const shopName =
    order.owner && typeof order.owner === "object"
      ? order.owner.name
      : null;

  return (
    <article className="order-card">
      <div className="order-card-header">
        <div className="order-reference">
          <span className="order-label">ORDER ID</span>
          <h2>{order._id || "Order ID unavailable"}</h2>

          <p className="order-date">
            Placed on {formatDate(order.createdAt) || "Date unavailable"}
          </p>

          <p className="order-shop-name">
            Shop: {shopName || "Shop information unavailable"}
          </p>
        </div>

        <span className={`order-status status-${status}`}>
          {displayStatus}
        </span>
      </div>

      <div className="order-items">
        {items.length === 0 ? (
          <p className="tracking-note">
            Item details are unavailable for this order.
          </p>
        ) : (
          items.map((item, index) => (
            <div
              className="order-item"
              key={`${order._id}-${item.product || index}`}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name || "Furniture"}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="order-item-placeholder">
                  <span>Furniture</span>
                </div>
              )}

              <div className="order-item-details">
                <h3>{item.name || "Furniture item"}</h3>
                <p>Quantity: {item.quantity ?? 1}</p>
                <p>LKR {formatMoney(item.price)}</p>
              </div>

              <strong className="item-subtotal">
                LKR{" "}
                {formatMoney(
                  Number(item.price || 0) * Number(item.quantity ?? 1)
                )}
              </strong>
            </div>
          ))
        )}
      </div>

      <DeliveryTracking order={order} />

      {status === "pending" && (
        <div className="order-cancel-section">
          <button
            type="button"
            className="cancel-order-button"
            onClick={() => onCancel(order._id)}
            disabled={!order._id || cancelling}
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </button>

          <p>You can cancel this order before the shop confirms it.</p>
        </div>
      )}

      {status === "cancelled" && (
        <p className="cancelled-order-note">
          This order has been cancelled.
        </p>
      )}

      {status === "rejected" && (
        <p className="cancelled-order-note">
          This shop rejected the order. No further delivery progress is
          expected for this order.
        </p>
      )}

      <div className="order-card-footer">
        <div className="payment-details">
          <span className="order-label">PAYMENT METHOD</span>
          <p>{order.paymentMethod || "Cash on Delivery"}</p>
          <p>Payment status: {order.paymentStatus || "Pending"}</p>
        </div>

        <div className="order-total">
          <span className="order-label">ORDER TOTAL</span>
          <strong>LKR {formatMoney(order.totalAmount)}</strong>
        </div>
      </div>
    </article>
  );
}

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  const fetchOrders = useCallback(async (showLoading = false) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Please log in to view your orders.");
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);

    try {
      const response = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;

      const result = Array.isArray(data)
        ? data
        : Array.isArray(data?.orders)
        ? data.orders
        : Array.isArray(data?.data)
        ? data.data
        : null;

      if (!Array.isArray(result)) {
        throw new Error("Unexpected orders response from the server.");
      }

      setOrders(result);
      setError("");
    } catch (err) {
      console.error(
        "Fetch orders error:",
        err.response?.data || err.message
      );

      setError(
        err.response?.status === 401
          ? "Your session may have expired. Please log in again."
          : err.response?.data?.message ||
              err.message ||
              "Unable to load your orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(true);
  }, [fetchOrders, retryCount]);

  // Refresh order statuses periodically while this page is open.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOrders(false);
      }
    }, REFRESH_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchOrders(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [fetchOrders]);

  const cancelOrder = async (orderId) => {
    if (!orderId) return;

    if (!window.confirm("Are you sure you want to cancel this order?")) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      window.alert("Please log in to cancel your order.");
      return;
    }

    setCancellingOrderId(orderId);
    setError("");

    try {
      await axios.patch(
        `${CANCEL_URL}/${orderId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchOrders(false);
    } catch (err) {
      console.error(
        "Cancel order error:",
        err.response?.data || err.message
      );

      window.alert(
        err.response?.data?.message ||
          "Unable to cancel this order. Please try again."
      );
    } finally {
      setCancellingOrderId(null);
    }
  };

  const counts = useMemo(() => {
    const result = { all: orders.length };

    TABS.filter((tab) => tab.value !== "all").forEach((tab) => {
      result[tab.value] = orders.filter(
        (order) => normaliseStatus(order.status) === tab.value
      ).length;
    });

    return result;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const result =
      activeTab === "all"
        ? orders
        : orders.filter(
            (order) => normaliseStatus(order.status) === activeTab
          );

    return [...result].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
  }, [orders, activeTab]);

  const inProgressCount =
    (counts.pending || 0) +
    (counts.confirmed || 0) +
    (counts.processing || 0) +
    (counts.shipped || 0);

  return (
    <main className="my-orders-page">
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

      <section className="my-orders-container">
        <header className="my-orders-heading">
          <p className="eyebrow">YOUR PURCHASES</p>
          <h1>My Orders</h1>
          <p>
            View your purchase history and follow your furniture deliveries.
          </p>
        </header>

        <div className="orders-summary">
          <div>
            <span>Total orders</span>
            <strong>{counts.all}</strong>
          </div>

          <div>
            <span>In progress</span>
            <strong>{inProgressCount}</strong>
          </div>

          <div>
            <span>Delivered</span>
            <strong>{counts.delivered || 0}</strong>
          </div>
        </div>

        <div
          className="order-tabs"
          role="tablist"
          aria-label="Filter orders"
        >
          {TABS.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              className={`order-tab ${
                activeTab === tab.value ? "active" : ""
              }`}
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              <span className="tab-count">{counts[tab.value] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="orders-feedback">
            <p>Loading your order history...</p>
          </div>
        ) : error ? (
          <div className="orders-feedback orders-error" role="alert">
            <h2>Couldn't load orders</h2>
            <p>{error}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="orders-empty">
            <div className="empty-order-icon">▤</div>

            <h2>
              {activeTab === "all"
                ? "No orders yet"
                : `No ${activeTab} orders`}
            </h2>

            <p>
              {activeTab === "all"
                ? "Your furniture purchases will appear here."
                : "Orders with this status will appear here."}
            </p>

            {activeTab === "all" ? (
              <Link to="/products" className="primary-button">
                Explore Furniture
              </Link>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => setActiveTab("all")}
              >
                View all orders
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="orders-result-count">
              Showing {filteredOrders.length}{" "}
              {filteredOrders.length === 1 ? "order" : "orders"}
            </p>

            <div className="orders-list">
              {filteredOrders.map((order, index) => (
                <OrderCard
                  key={order._id || `order-${index}`}
                  order={order}
                  onCancel={cancelOrder}
                  cancelling={cancellingOrderId === order._id}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default MyOrders;