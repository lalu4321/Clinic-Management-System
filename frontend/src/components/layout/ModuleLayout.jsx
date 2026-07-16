import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/common/BackButton";

// ── Role accent colours (light clinical palette) ────────────────────────────
const ROLE_ICON_BG = {
  Admin:         "bg-purple-600",
  Doctor:        "bg-clinical-primary",
  Receptionist:  "bg-blue-600",
  Pharmacist:    "bg-emerald-600",
  LabTechnician: "bg-amber-600",
};

const ROLE_BADGE = {
  Admin:         "bg-purple-50 text-purple-700 border-purple-200",
  Doctor:        "bg-clinical-light text-clinical-primary border-outline-soft",
  Receptionist:  "bg-blue-50 text-blue-700 border-blue-200",
  Pharmacist:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  LabTechnician: "bg-amber-50 text-amber-700 border-amber-200",
};

function getInitials(username) {
  if (!username) return "U";
  return username
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ModuleLayout({ children, sidebar, moduleName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role       = user?.role || "Admin";
  const iconBg     = ROLE_ICON_BG[role] || "bg-clinical-primary";
  const badgeClass = ROLE_BADGE[role]   || "bg-clinical-light text-clinical-primary border-outline-soft";
  const initials   = getInitials(user?.username);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-surface overflow-hidden">

      {/* ── Mobile backdrop overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/25 z-20 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          Sidebar — 256px fixed, white surface, tonal border
          ══════════════════════════════════════════════════════════════════ */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 w-64 flex flex-col
          bg-surface-container-lowest border-r border-outline-soft
          transform transition-transform duration-250 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand area */}
        <div className="px-5 py-[18px] border-b border-outline-soft flex items-center gap-3 shrink-0">
          <div
            className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 18 }}>
              health_and_safety
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-[13px] leading-tight text-surface-on truncate">
              Crescent Valley
            </p>
            <p className="text-[11px] text-surface-on-variant truncate">{moduleName}</p>
          </div>
        </div>

        {/* Navigation — role-specific items injected via sidebar prop */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {sidebar}
        </nav>

        {/* User profile + logout */}
        <div className="border-t border-outline-soft p-4 space-y-1 shrink-0">
          {/* Avatar + name + role */}
          <div className="flex items-center gap-3 px-1 py-1">
            <div
              className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
            >
              <span className="text-white text-xs font-display font-bold select-none">
                {initials}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-surface-on truncate">
                {user?.username || "User"}
              </p>
              <span
                className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full
                  text-[10px] font-semibold border ${badgeClass}`}
              >
                {role}
              </span>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl
              text-surface-on-variant hover:text-red-600 hover:bg-red-50
              transition-colors text-[13px] font-medium group"
          >
            <span
              className="material-symbols-outlined group-hover:text-red-600 transition-colors"
              style={{ fontSize: 18 }}
            >
              logout
            </span>
            <span>Sign Out</span>
            <span
              className="material-symbols-outlined ml-auto text-surface-on-variant/40
                group-hover:text-red-400 transition-colors"
              style={{ fontSize: 16 }}
            >
              chevron_right
            </span>
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          Main content column
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Glass top bar */}
        <header className="bg-white border-b border-gray-100 flex items-center gap-3 px-4 lg:px-6 py-3.5 shrink-0">

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-surface-on-variant
              hover:bg-surface-container transition-colors"
            aria-label="Open sidebar"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu</span>
          </button>

          {/* Back button — hidden on dashboard/root pages */}
          <BackButton />

          {/* Module title */}
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-semibold text-[15px] text-surface-on truncate">
              {moduleName}
            </h1>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            {/* Notification bell */}
            <button
              className="relative p-2 rounded-lg text-surface-on-variant
                hover:bg-surface-container transition-colors"
              aria-label="Notifications"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                notifications
              </span>
              {/* Unread indicator */}
              <span
                className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-clinical-primary"
              />
            </button>

            {/* Role badge — desktop only */}
            <span
              className={`hidden sm:inline-flex items-center px-3 py-1 rounded-lg
                text-xs font-semibold border ${badgeClass}`}
            >
              {role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-surface p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
