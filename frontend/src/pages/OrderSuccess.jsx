
import { Link, useLocation } from "react-router-dom";

function OrderSuccess() {
  const location = useLocation();
  const order = location.state?.order;

  if (!order?._id) {
    return (
      <main className="checkout-page">
        <section className="checkout-card">
          <h1>No order details found</h1>
          <p>Please check your order history or continue shopping.</p>
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
        <Link to="/products">Furniture</Link>
      </nav>

      <section className="checkout-card">
        <h1>Order Placed Successfully!</h1>

        <p>
          Thank you for shopping with AI Interior Shop.
          Your order has been saved successfully.
        </p>

        <p>
          <strong>Order ID:</strong> {order._id}
        </p>

        <p>
          <strong>Order Status:</strong> {order.status}
        </p>

        <p>
          <strong>Payment Method:</strong>{" "}
          {order.paymentMethod}
        </p>

        <p>
          <strong>Total Amount:</strong>{" "}
          LKR {Number(order.totalAmount).toLocaleString("en-LK")}
        </p>

        <h2>Delivery Details</h2>

        <p>{order.shippingAddress?.fullName}</p>
        <p>{order.shippingAddress?.address}</p>
        <p>
          {order.shippingAddress?.city}{" "}
          {order.shippingAddress?.postalCode}
        </p>
        <p>{order.shippingAddress?.phone}</p>

        <Link to="/products" className="primary-button">
          Continue Shopping
        </Link>
      </section>
    </main>
  );
}

export default OrderSuccess;
