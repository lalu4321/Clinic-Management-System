import { NavLink } from "react-router-dom";

const menu = [
  { name: "Dashboard",      path: "/admin/dashboard",       icon: "dashboard" },
  { name: "Live Board",     path: "/admin/live-board",      icon: "monitor_heart" },
  { name: "Staff",          path: "/admin/staff",           icon: "group" },
  { name: "Doctors",        path: "/admin/doctors",         icon: "stethoscope" },
  { name: "Specialization", path: "/admin/specializations", icon: "category" },
  { name: "Schedules",      path: "/admin/schedules",       icon: "calendar_month" },
];

export default function Sidebar() {
  return (
    <div>
      {/* Section label */}
      <p className="text-[11px] font-semibold text-surface-on-variant/60 uppercase tracking-widest px-3 mb-3">
        Admin Portal
      </p>

      {menu.map((item) => (
        <NavLink
          key={item.name}
          to={item.path}
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
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {item.icon}
          </span>
          <span>{item.name}</span>
        </NavLink>
      ))}
    </div>
  );
}
