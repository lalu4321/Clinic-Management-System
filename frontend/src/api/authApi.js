import API from "./axiosInstance";

// 🔐 LOGIN
export const loginUser = (data) => {
  return API.post("/auth/login/", data);
};

// 🔁 REFRESH TOKEN
export const refreshToken = (data) => {
  return API.post("/auth/refresh/", data);
};

// 🚪 LOGOUT — sends the refresh token so the backend can blacklist it
export const logoutUser = (refreshToken) => {
  return API.post("/auth/logout/", { refresh: refreshToken });
};