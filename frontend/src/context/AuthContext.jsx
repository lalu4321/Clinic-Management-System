import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { logoutUser } from "@/api/authApi";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Key written to localStorage to signal all tabs to log out
const LOGOUT_BROADCAST_KEY = "cms_logout_signal";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  // Clear only this tab's session storage — shared across both direct logout
  // and the cross-tab listener below.
  const clearSession = useCallback(() => {
    sessionStorage.clear();
    setUser(null);
  }, []);

  // Listen for logout signals broadcast by other tabs via localStorage.
  // The storage event fires in all OTHER tabs when localStorage is written.
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === LOGOUT_BROADCAST_KEY && e.newValue) {
        clearSession();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [clearSession]);

  const login = ({ access, refresh, user: userData }) => {
    sessionStorage.setItem("accessToken", access);
    sessionStorage.setItem("refreshToken", refresh);
    sessionStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  // Async: blacklists the refresh token on the backend, then broadcasts the
  // logout to all other open tabs via localStorage before clearing this tab's
  // own session. Access tokens (30-min lifetime) expire naturally — this is
  // the standard JWT trade-off; refresh token reuse is fully blocked.
  const logout = async () => {
    const refreshToken = sessionStorage.getItem("refreshToken");
    try {
      if (refreshToken) {
        await logoutUser(refreshToken);
      }
    } catch (_) {
      // Network error or already-blacklisted token — always clear locally
    } finally {
      // Broadcast to all other tabs (storage event fires in OTHER tabs only)
      localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
      localStorage.removeItem(LOGOUT_BROADCAST_KEY); // clean up immediately
      clearSession();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
