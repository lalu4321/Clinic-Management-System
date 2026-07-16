import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL + "/api",
});

// REQUEST INTERCEPTOR
API.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("accessToken");

    if (
      token &&
      !config.url.includes("/auth/login") &&
      !config.url.includes("/auth/refresh")
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// RESPONSE INTERCEPTOR
API.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = sessionStorage.getItem("refreshToken");

        const res = await axios.post(
          import.meta.env.VITE_BACKEND_URL + "/api/auth/refresh/",
          { refresh: refreshToken }
        );

        const newAccess = res.data.data?.access || res.data.access;

        sessionStorage.setItem("accessToken", newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return API(originalRequest);

      } catch (err) {
        sessionStorage.clear();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default API;
