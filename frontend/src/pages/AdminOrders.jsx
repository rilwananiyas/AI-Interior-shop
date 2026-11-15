import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "../styles/AdminOrders.css";

const API_URL = "http://localhost:5000/api/orders";

const NEXT_STATUS = {
  Confirmed: "Processing",
  Processing: "Shipped",
  Shipped: "Delivered",
};

function formatMoney(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [filter, setFilter] = useState("All");

  const getToken = () => localStorage.getItem("token");

  // Fetch all orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = getToken();

    if (!token) {
      setError("Please log in with your admin account.");
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/admin/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Backend currently returns an array directly.
      // This also supports { orders: [...] } if the API changes later.
      const fetchedOrders = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data.orders)
        ? response.data.orders
        : [];

      setOrders(fetchedOrders);
    } catch (err) {
      const statusCode = err.response?.status;

      if (statusCode === 401) {
        setError("Your session has expired. Please log in again.");
      } else if (statusCode === 403) {
        setError("Access denied. This page is for administrators only.");
      } else {
        setError(
          err.response?.data?.message ||
            "Unable to load orders. Check that the backend is running."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Update order status
  const updateStatus = async (order, newStatus) => {
    if (!order?._id || !newStatus || updatingId) return;

    const confirmed = window.confirm(
      `Are you sure you want to change this order from ${order.status} to ${newStatus}?`
    );

    if (!confirmed) return;

    const token = getToken();

    if (!token) {
      setError("Please log in again.");
      return;
    }

    setUpdatingId(order._id);
    setError("");

    try {
      const response = await axios.patch(
        `${API_URL}/admin/${order._id}/status`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedOrder = response.data.order;

      if (!updatedOrder) {
        throw new Error("The server did not return the updated order.");
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder._id === updatedOrder._id
            ? { ...currentOrder, ...updatedOrder }
            : currentOrder
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update the order status."
      );
    } finally {
      setUpdatingId("");
    }
  };

  // Available filters
  const statuses = [
    "All",
    "Pending",
    "Confirmed",
    "Rejected",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];

  const filteredOrders =
    filter === "All"
      ? orders
      : orders.filter((order) => order.status === filter);

  // Dashboard statistics
  const pendingCount = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  const deliveredCount = orders.filter(
    (order) => order.status === "Delivered"
  ).length;

  const totalRevenue = orders
    .filter(
      (order) =>
        order.status !== "Cancelled" &&
        order.status !== "Rejected"
    )
    .reduce(
      (total, order) => total + Number(order.totalAmount || 0),
      0
    );

  return (
    <div className="admin-orders-page">
      <header className="admin-orders-header">
        <div>
          <p className="admin-eyebrow">AI INTERIOR SHOP</p>
          <h1>Order Management</h1>
          <p className="admin-header-description">
            Manage customer orders and delivery progress.
          </p>
        </div>

        <div className="admin-header-actions">
          <Link to="/" className="admin-back-link">
            Back to Shop
          </Link>

          <button
            type="button"
            className="admin-refresh-button"
            onClick={fetchOrders}
            disabled={loading || Boolean(updatingId)}
          >
            {loading ? "Loading..." : "Refresh Orders"}
          </button>
        </div>
      </header>

      <main className="admin-orders-content">
        <section className="admin-order-stats">
          <article className="admin-stat-card">
            <span>Total Orders</span>
            <strong>{orders.length}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Pending Orders</span>
            <strong>{pendingCount}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Delivered Orders</span>
            <strong>{deliveredCount}</strong>
          </article>

          <article className="admin-stat-card">
            <span>Non-cancelled Order Value</span>
            <strong>{formatMoney(totalRevenue)}</strong>
            <small>
              Excludes cancelled and rejected orders; not verified payment revenue
            </small>
          </article>
        </section>

        {error && (
          <div className="admin-orders-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={fetchOrders}>
              Try Again
            </button>
          </div>
        )}

        <section className="admin-orders-list-section">
          <div className="admin-list-heading">
            <div>
              <h2>Customer Orders</h2>
              <p>
                {filteredOrders.length} order
                {filteredOrders.length === 1 ? "" : "s"} shown
              </p>
            </div>
          </div>

          {/* Order status filters */}
          <div className="admin-order-filters">
            {statuses.map((status) => (
              <button
                type="button"
                key={status}
                className={
                  filter === status
                    ? "admin-filter-button active"
                    : "admin-filter-button"
                }
                onClick={() => setFilter(status)}
              >
                {status}
                {status === "All"
                  ? ` (${orders.length})`
                  : ` (${orders.filter((order) => order.status === status).length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="admin-orders-message">
              Loading customer orders...
            </div>
          ) : !error && filteredOrders.length === 0 ? (
            <div className="admin-orders-message">
              <h3>No orders found</h3>
              <p>There are no orders in this category yet.</p>
            </div>
          ) : (
            <div className="admin-orders-list">
              {filteredOrders.map((order) => {
                const nextStatus = NEXT_STATUS[order.status];

                const customer =
                  order.user && typeof order.user === "object"
                    ? order.user
                    : null;

                const isUpdating = updatingId === order._id;

                return (
                  <article
                    className="admin-order-card"
                    key={order._id}
                  >
                    {/* Order header */}
                    <div className="admin-order-card-header">
                      <div>
                        <span className="admin-order-label">
                          ORDER ID
                        </span>

                        <strong className="admin-order-id">
                          {order._id}
                        </strong>

                        <p className="admin-order-date">
                          Placed: {formatDate(order.createdAt)}
                        </p>
                      </div>

                      <span
                        className={`admin-status-badge status-${String(
                          order.status || "pending"
                        ).toLowerCase()}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    {/* Customer, delivery and payment details */}
                    <div className="admin-order-details">
                      <section className="admin-detail-section">
                        <h3>Customer</h3>

                        <p>
                          <strong>
                            {customer?.name || "Customer"}
                          </strong>
                        </p>

                        <p>
                          {customer?.email || "Email unavailable"}
                        </p>
                      </section>

                      <section className="admin-detail-section">
                        <h3>Delivery Address</h3>

                        <p>
                          {order.shippingAddress?.fullName || "—"}
                        </p>

                        <p>
                          {order.shippingAddress?.phone || "—"}
                        </p>

                        <p>
                          {order.shippingAddress?.address || "—"}
                        </p>

                        <p>
                          {order.shippingAddress?.city || "—"}
                          {order.shippingAddress?.postalCode
                            ? `, ${order.shippingAddress.postalCode}`
                            : ""}
                        </p>
                      </section>

                      <section className="admin-detail-section">
                        <h3>Payment</h3>

                        <p>
                          Method: {order.paymentMethod || "—"}
                        </p>

                        <p>
                          Payment status: {order.paymentStatus || "Pending"}
                        </p>

                        <p>
                          Total:{" "}
                          <strong>
                            {formatMoney(order.totalAmount)}
                          </strong>
                        </p>
                      </section>
                    </div>

                    {/* Ordered products */}
                    <div className="admin-order-items">
                      <h3>Ordered Items</h3>

                      {(order.items || []).map((item, index) => (
                        <div
                          className="admin-order-item"
                          key={`${order._id}-${item._id || item.product || index}`}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name || "Product"}
                              className="admin-item-image"
                            />
                          ) : (
                            <div className="admin-item-image admin-item-placeholder">
                              No image
                            </div>
                          )}

                          <div className="admin-item-info">
                            <strong>{item.name || "Product"}</strong>
                            <span>
                              Quantity: {item.quantity}
                            </span>
                          </div>

                          <strong className="admin-item-price">
                            {formatMoney(
                              Number(item.price || 0) *
                                Number(item.quantity || 0)
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {/* Delivery information and status actions */}
                    <div className="admin-order-footer">
                      <div className="admin-delivery-info">
                        <span>
                          Estimated delivery:{" "}
                          {order.estimatedDeliveryDate
                            ? formatDate(order.estimatedDeliveryDate)
                            : "Not set"}
                        </span>

                        {order.deliveredAt && (
                          <span>
                            Delivered: {formatDate(order.deliveredAt)}
                          </span>
                        )}
                      </div>

                      <div className="admin-order-actions">
                        {order.status === "Pending" ? (
                          <>
                            <button
                              type="button"
                              className="admin-update-status-button"
                              onClick={() =>
                                updateStatus(order, "Confirmed")
                              }
                              disabled={Boolean(updatingId)}
                            >
                              {isUpdating ? "Updating..." : "Confirm Order"}
                            </button>

                            <button
                              type="button"
                              className="admin-reject-button"
                              onClick={() =>
                                updateStatus(order, "Rejected")
                              }
                              disabled={Boolean(updatingId)}
                            >
                              Reject Order
                            </button>

                            <button
                              type="button"
                              className="admin-cancel-button"
                              onClick={() =>
                                updateStatus(order, "Cancelled")
                              }
                              disabled={Boolean(updatingId)}
                            >
                              Cancel Order
                            </button>
                          </>
                        ) : nextStatus ? (
                          <button
                            type="button"
                            className="admin-update-status-button"
                            onClick={() =>
                              updateStatus(order, nextStatus)
                            }
                            disabled={Boolean(updatingId)}
                          >
                            {isUpdating
                              ? "Updating..."
                              : `Mark as ${nextStatus}`}
                          </button>
                        ) : (
                          <span className="admin-final-status">
                            {order.status === "Cancelled"
                              ? "Order cancelled"
                              : order.status === "Rejected"
                              ? "Order rejected"
                              : "Order completed"}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminOrders;