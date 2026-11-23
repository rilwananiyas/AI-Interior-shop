
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 60000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Let the browser set multipart Content-Type and boundary.
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    } else if (config.data && !(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
