import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, role }) {
  const { user, logout } = useAuth();
  const token = sessionStorage.getItem("accessToken");

  // Not authenticated at all → login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  // Wrong role → force logout and redirect to login
  if (role && user.role !== role) {
    // Clear session immediately (synchronous)
    logout();
    return <Navigate to="/login" replace />;
  }

  return children;
}
