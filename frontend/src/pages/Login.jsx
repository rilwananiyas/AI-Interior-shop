
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login", formData);

      console.log("Login response:", {
        ...response.data,
        token: response.data?.token ? "[REDACTED]" : undefined,
      });

      const token = response.data?.token;

      // Support common response formats:
      // { token, user: {...} }
      // { token, data: { user: {...} } }
      const user =
        response.data?.user ??
        response.data?.data?.user ??
        response.data?.data ??
        null;

      if (!token) {
        setMessage(
          "Login response did not contain a token. Check your backend response."
        );
        return;
      }

      // Save the JWT token.
      localStorage.setItem("token", token);

      // Save user information only when the backend returns it.
      if (user && typeof user === "object") {
        localStorage.setItem("user", JSON.stringify(user));
      } else {
        localStorage.removeItem("user");
        console.warn(
          "Login succeeded, but no user object was returned by the backend."
        );
      }

      // Clear the password from the form state after successful login.
      setFormData({
        email: "",
        password: "",
      });

      navigate("/profile");
    } catch (error) {
      console.error(
        "Login error:",
        error.response?.data || error.message
      );

      setMessage(
        error.response?.data?.message ||
          "Could not connect to the server. Check your backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <Link to="/" className="back-link">
          ← Home
        </Link>

        <h1>Welcome Back</h1>
        <p>Login to continue to AI Interior Shop.</p>

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        {message && (
          <div className="form-message" role="alert">
            {message}
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="auth-footer">
          New to AI Interior Shop?{" "}
          <Link to="/register">Create account</Link>
        </div>
      </form>
    </div>
  );
}

export default Login;
