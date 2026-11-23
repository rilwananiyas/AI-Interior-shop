
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

const ORDERS_URL = "/api/orders/owner/orders";

function OwnerOrders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await axios.get(ORDERS_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (err) {
      console.error("Load owner orders error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load your shop orders."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [navigate]);

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

    loadOrders();
  }, [navigate, loadOrders]);

  const updateStatus = async (orderId, status) => {
    const isProgressUpdate = [
      "Processing",
      "Shipped",
      "Delivered",
    ].includes(status);

    const actionUrl = isProgressUpdate
      ? `${ORDERS_URL}/${orderId}/progress`
      : `${ORDERS_URL}/${orderId}/status`;

    const actionLabels = {
      Confirmed: "confirm this order",
      Rejected: "reject this order",
      Processing: "start processing this order",
      Shipped: "mark this order as shipped",
      Delivered: "mark this order as delivered",
    };

    const action = actionLabels[status] || "update this order";

    if (!window.confirm(`Are you sure you want to ${action}?`)) {
      return;
    }

    setUpdatingId(orderId);
    setError("");
    setMessage("");

    try {
      const token = localStorage.getItem("token");

      await axios.patch(
        actionUrl,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(`Order status updated to ${status}.`);
      await loadOrders(false);
    } catch (err) {
      console.error("Update order status error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to update this order."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const formatMoney = (amount) =>
    `LKR ${Number(amount || 0).toLocaleString("en-LK")}`;

  const formatDate = (date) => {
    if (!date) return null;

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return null;

    return parsedDate.toLocaleString();
  };

  if (loading) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <p>Loading your shop orders...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <nav className="navbar">
        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/owner/products">My Shop Products</Link>
          <Link to="/owner/orders">My Shop Orders</Link>
        </div>
      </nav>

      <section className="admin-card">
        <p className="eyebrow">SHOP OWNER DASHBOARD</p>
        <h1>My Shop Orders</h1>
        <p>
          Manage customer orders and update delivery progress.
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

        <button
          type="button"
          onClick={() => loadOrders()}
          disabled={updatingId !== null}
        >
          Refresh Orders
        </button>

        <h2>Orders ({orders.length})</h2>

        {orders.length === 0 ? (
          <p>No orders were returned for your shop.</p>
        ) : (
          <div className="owner-orders-list">
            {orders.map((order) => {
              const estimatedDate = formatDate(
                order.estimatedDeliveryDate
              );

              const deliveredDate = formatDate(order.deliveredAt);

              const isUpdating = updatingId === order._id;

              return (
                <article
                  className="admin-product-item"
                  key={order._id}
                >
                  <div className="admin-product-info">
                    <h3>Order #{order._id}</h3>

                    <p>
                      Status: <strong>{order.status}</strong>
                    </p>

                    <p>
                      Placed:{" "}
                      {formatDate(order.createdAt) ||
                        "Date unavailable"}
                    </p>

                    <h4>Items</h4>

                    {order.items?.map((item, index) => (
                      <div key={item._id || `${item.name}-${index}`}>
                        <p>
                          {item.name || "Furniture"} ×{" "}
                          {item.quantity}
                        </p>
                        <p>
                          {formatMoney(
                            Number(item.price) *
                              Number(item.quantity)
                          )}
                        </p>
                      </div>
                    ))}

                    <h3>Total: {formatMoney(order.totalAmount)}</h3>

                    <p>
                      Payment:{" "}
                      {order.paymentMethod || "Not specified"}
                    </p>

                    {order.shippingAddress && (
                      <>
                        <h4>Shipping Details</h4>
                        <p>
                          {order.shippingAddress.fullName || ""}
                        </p>
                        <p>
                          {order.shippingAddress.phone || ""}
                        </p>
                        <p>
                          {order.shippingAddress.address || ""}
                          {order.shippingAddress.city
                            ? `, ${order.shippingAddress.city}`
                            : ""}
                        </p>
                        {order.shippingAddress.postalCode && (
                          <p>
                            Postal code:{" "}
                            {order.shippingAddress.postalCode}
                          </p>
                        )}
                      </>
                    )}

                    <h4>Delivery Tracking</h4>

                    <p>
                      Current stage: <strong>{order.status}</strong>
                    </p>

                    {estimatedDate && (
                      <p>
                        Estimated delivery: {estimatedDate}
                      </p>
                    )}

                    {order.status === "Delivered" &&
                      deliveredDate && (
                        <p>
                          Delivered on: {deliveredDate}
                        </p>
                      )}

                    {!estimatedDate &&
                      !deliveredDate &&
                      order.status !== "Delivered" && (
                        <p>
                          Delivery date has not been provided yet.
                        </p>
                      )}

                    {order.status === "Pending" && (
                      <div className="admin-product-actions">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus(order._id, "Confirmed")
                          }
                        >
                          {isUpdating
                            ? "Updating..."
                            : "Confirm Order"}
                        </button>

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus(order._id, "Rejected")
                          }
                        >
                          Reject Order
                        </button>
                      </div>
                    )}

                    {order.status === "Confirmed" && (
                      <div className="admin-product-actions">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus(order._id, "Processing")
                          }
                        >
                          {isUpdating
                            ? "Updating..."
                            : "Start Processing"}
                        </button>
                      </div>
                    )}

                    {order.status === "Processing" && (
                      <div className="admin-product-actions">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus(order._id, "Shipped")
                          }
                        >
                          {isUpdating
                            ? "Updating..."
                            : "Mark as Shipped"}
                        </button>
                      </div>
                    )}

                    {order.status === "Shipped" && (
                      <div className="admin-product-actions">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            updateStatus(order._id, "Delivered")
                          }
                        >
                          {isUpdating
                            ? "Updating..."
                            : "Mark as Delivered"}
                        </button>
                      </div>
                    )}

                    {order.status === "Delivered" && (
                      <p>Order delivered successfully.</p>
                    )}

                    {order.status === "Rejected" && (
                      <p>This order was rejected.</p>
                    )}

                    {order.status === "Cancelled" && (
                      <p>This order was cancelled.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default OwnerOrders;
