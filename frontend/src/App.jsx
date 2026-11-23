
import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import OwnerOrders from "./pages/OwnerOrders";
import MyOrders from "./pages/MyOrders";
import MySavedDesigns from "./pages/MySavedDesigns";
import MyProfile from "./pages/MyProfile";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import Cart from "./pages/Cart";
import AdminProducts from "./pages/AdminProducts";
import AdminOrders from "./pages/AdminOrders";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import InteriorAssistant from "./pages/InteriorAssistant";
import RoomAnalyzer from "./pages/RoomAnalyzer";

import "./App.css";

// ==============================
// HOME PAGE
// ==============================

function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => Boolean(localStorage.getItem("token"))
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  });

  const isAdmin = currentUser?.role === "admin";

  const isApprovedOwner =
    currentUser?.role === "owner" &&
    currentUser?.ownerStatus === "approved";

  const navigate = useNavigate();

  // Update login status when authentication changes.
  useEffect(() => {
    const updateLoginStatus = () => {
      const token = localStorage.getItem("token");
      let user = null;

      try {
        user = JSON.parse(localStorage.getItem("user") || "null");
      } catch {
        user = null;
      }

      setIsLoggedIn(Boolean(token));
      setCurrentUser(user);

      if (!token) {
        setProfileOpen(false);
      }
    };

    window.addEventListener("storage", updateLoginStatus);
    window.addEventListener("auth-change", updateLoginStatus);

    return () => {
      window.removeEventListener("storage", updateLoginStatus);
      window.removeEventListener("auth-change", updateLoginStatus);
    };
  }, []);

  // Close profile menu when clicking outside or pressing Escape.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Logout function.
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setIsLoggedIn(false);
    setCurrentUser(null);
    setProfileOpen(false);

    window.dispatchEvent(new Event("auth-change"));
    navigate("/login");
  };

  return (
    <main className="home-page">

      {/* NAVIGATION BAR */}

      <nav className="navbar">

        <Link to="/" className="brand">
          AI Interior Shop
        </Link>

        <div className="nav-links">

          <Link to="/products">Furniture</Link>
          <Link to="/ai-assistant">AI Assistant</Link>
          <Link to="/room-analyzer">Room Analyzer</Link>
          <Link to="/cart">Cart</Link>

          {isLoggedIn ? (
            <>

              {/* Approved Owner Navigation */}

              {isApprovedOwner && (
                <>
                  <Link to="/owner/products">
                    My Shop
                  </Link>

                  <Link to="/owner/orders">
                    My Shop Orders
                  </Link>
                </>
              )}

              {/* Admin Navigation */}

              {isAdmin && (
                <Link to="/admin/orders">
                  Manage Orders
                </Link>
              )}

              {/* Profile Menu */}

              <div className="profile-menu" ref={profileRef}>

                <button
                  type="button"
                  className="profile-icon"
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-label="Toggle profile menu"
                  aria-expanded={profileOpen}
                  aria-haspopup="true"
                >
                  {currentUser?.profileImage ? (
                    <img
                      src={currentUser.profileImage}
                      alt="Profile"
                      className="profile-avatar"
                    />
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                    </svg>
                  )}
                </button>

                {profileOpen && (
                  <section
                    className="profile-dropdown"
                    aria-label="Profile details"
                  >

                    {/* Profile Information */}

                    <div className="profile-dropdown-header">

                      <div className="profile-avatar-large">

                        {currentUser?.profileImage ? (
                          <img
                            src={currentUser.profileImage}
                            alt=""
                          />
                        ) : (
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="8" r="4" />
                            <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                          </svg>
                        )}

                      </div>

                      <div className="profile-user-details">

                        <h3>
                          {currentUser?.name || "Customer"}
                        </h3>

                        <p>
                          {currentUser?.email || "Email unavailable"}
                        </p>

                      </div>

                    </div>

                    {/* Account Type */}

                    <div className="profile-role-row">

                      <span>Account type</span>

                      <span className="profile-role">
                        {currentUser?.role || "customer"}
                      </span>

                    </div>

                    {/* Profile Navigation Links */}

                    <div className="profile-dropdown-links">

                      <Link
                        to="/my-profile"
                        onClick={() => setProfileOpen(false)}
                      >
                        <span>My Profile</span>
                        <span aria-hidden="true">›</span>
                      </Link>

                      <Link
                        to="/my-orders"
                        onClick={() => setProfileOpen(false)}
                      >
                        <span>My Orders</span>
                        <span aria-hidden="true">›</span>
                      </Link>

                      <Link
                        to="/my-saved-designs"
                        onClick={() => setProfileOpen(false)}
                      >
                        <span>My Saved Designs</span>
                        <span aria-hidden="true">›</span>
                      </Link>

                      {/* Approved Owner Links */}

                      {isApprovedOwner && (
                        <>
                          <Link
                            to="/owner/products"
                            onClick={() => setProfileOpen(false)}
                          >
                            <span>My Shop Products</span>
                            <span aria-hidden="true">›</span>
                          </Link>

                          <Link
                            to="/owner/orders"
                            onClick={() => setProfileOpen(false)}
                          >
                            <span>My Shop Orders</span>
                            <span aria-hidden="true">›</span>
                          </Link>
                        </>
                      )}

                      {/* Admin Links */}

                      {isAdmin && (
                        <Link
                          to="/admin/orders"
                          onClick={() => setProfileOpen(false)}
                        >
                          <span>Manage Orders</span>
                          <span aria-hidden="true">›</span>
                        </Link>
                      )}

                    </div>

                    {/* Logout */}

                    <button
                      type="button"
                      className="profile-logout"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>

                  </section>
                )}

              </div>

            </>
          ) : (

            /* Logged Out Navigation */

            <>
              <Link to="/login">Login</Link>

              <Link
                to="/register"
                className="nav-button"
              >
                Create Account
              </Link>
            </>

          )}

        </div>

      </nav>

      {/* HOMEPAGE HERO SECTION */}

      <section className="hero">

        <p className="eyebrow">
          YOUR HOME, YOUR STYLE
        </p>

        <h1>
          Make Your Home
          <br />
          Feel Like You.
        </h1>

        <p>
          Discover furniture and find inspiration for your dream interior.
        </p>

        <div className="hero-buttons">

          <Link
            to="/products"
            className="primary-button"
          >
            Explore Furniture
          </Link>

          <Link
            to="/ai-assistant"
            className="secondary-button"
          >
            Try AI Assistant
          </Link>

          <Link
            to="/room-analyzer"
            className="secondary-button"
          >
            Analyze My Room
          </Link>

          {!isLoggedIn && (
            <Link
              to="/register"
              className="secondary-button"
            >
              Get Started
            </Link>
          )}

        </div>

      </section>

    </main>
  );
}

// ==============================
// PROTECTED ROUTE
// ==============================

function ProtectedRoute({
  children,
  adminOnly = false,
  ownerOnly = false,
}) {
  const token = localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (
    ownerOnly &&
    (
      user?.role !== "owner" ||
      user?.ownerStatus !== "approved"
    )
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ==============================
// APPLICATION ROUTES
// ==============================

function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* Home */}

        <Route
          path="/"
          element={<Home />}
        />

        {/* Authentication */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* Furniture */}

        <Route
          path="/products"
          element={<Products />}
        />

        <Route
          path="/products/:id"
          element={<ProductDetails />}
        />

        {/* AI Interior Assistant */}

        <Route
          path="/ai-assistant"
          element={<InteriorAssistant />}
        />

        {/* AI Room Analyzer */}

        <Route
          path="/room-analyzer"
          element={
            <ProtectedRoute>
              <RoomAnalyzer />
            </ProtectedRoute>
          }
        />

        {/* Shopping Cart */}

        <Route
          path="/cart"
          element={<Cart />}
        />

        {/* Checkout */}

        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />

        {/* Order Confirmation */}

        <Route
          path="/order-success"
          element={
            <ProtectedRoute>
              <OrderSuccess />
            </ProtectedRoute>
          }
        />

        {/* My Profile */}

        <Route
          path="/my-profile"
          element={
            <ProtectedRoute>
              <MyProfile />
            </ProtectedRoute>
          }
        />

        {/* Customer Orders */}

        <Route
          path="/my-orders"
          element={
            <ProtectedRoute>
              <MyOrders />
            </ProtectedRoute>
          }
        />

        {/* My Saved Designs */}

        <Route
          path="/my-saved-designs"
          element={
            <ProtectedRoute>
              <MySavedDesigns />
            </ProtectedRoute>
          }
        />

        {/* Orders Redirect */}

        <Route
          path="/orders"
          element={
            <Navigate to="/my-orders" replace />
          }
        />

        {/* Approved Owner Product Management */}

        <Route
          path="/owner/products"
          element={
            <ProtectedRoute ownerOnly>
              <AdminProducts />
            </ProtectedRoute>
          }
        />

        {/* Approved Owner Order Management */}

        <Route
          path="/owner/orders"
          element={
            <ProtectedRoute ownerOnly>
              <OwnerOrders />
            </ProtectedRoute>
          }
        />

        {/* Admin Order Management */}

        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute adminOnly>
              <AdminOrders />
            </ProtectedRoute>
          }
        />

        {/* Unknown URLs */}

        <Route
          path="*"
          element={
            <Navigate to="/" replace />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;
