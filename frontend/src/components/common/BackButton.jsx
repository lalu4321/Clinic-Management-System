import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Role → home dashboard mapping
const DASHBOARD_ROUTES = {
  Admin:         "/admin/dashboard",
  Doctor:        "/doctor/dashboard",
  Receptionist:  "/receptionist/dashboard",
  Pharmacist:    "/pharmacist/dashboard",
  LabTechnician: "/lab/dashboard",
};

// Pages that should NOT show the back button (they ARE the home/root for their module)
const DASHBOARD_PATHS = new Set([
  "/admin/dashboard",
  "/admin/live-board",
  "/doctor/dashboard",
  "/doctor/live-board",
  "/receptionist/dashboard",
  "/pharmacist/dashboard",
  "/lab/dashboard",
]);

export default function BackButton() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  // Hide on dashboard / root pages — nothing to go back to
  if (DASHBOARD_PATHS.has(location.pathname)) return null;

  const handleBack = () => {
    // If there is in-app history (more than the current entry) go back
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback: go to the role's dashboard
      const role = user?.role || "Admin";
      navigate(DASHBOARD_ROUTES[role] || "/login");
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="
        inline-flex items-center gap-1.5
        px-3 py-1.5 rounded-lg
        text-sm font-medium
        text-surface-on-variant
        hover:bg-surface-container hover:text-surface-on
        transition-colors
        shrink-0
      "
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        arrow_back
      </span>
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
