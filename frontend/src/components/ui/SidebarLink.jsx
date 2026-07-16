import { NavLink } from "react-router-dom";

/**
 * Shared sidebar navigation link — clinical light theme.
 * Used by Doctor, Lab Technician, Pharmacist, and Receptionist sidebars.
 * Admin sidebar uses its own NavLink (refactored in Phase 2).
 *
 * Props:
 *   to    — route path
 *   icon  — react-icons component (preserved; icons replaced per-sidebar in Phase 2)
 *   label — display text
 */
export default function SidebarLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
         transition-colors mb-0.5
         ${
           isActive
             ? "bg-clinical-light text-clinical-primary"
             : "text-surface-on-variant hover:text-clinical-primary hover:bg-surface-container"
         }`
      }
    >
      {Icon && <Icon className="text-base flex-shrink-0" />}
      <span>{label}</span>
    </NavLink>
  );
}
