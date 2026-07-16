import { NavLink } from "react-router-dom";

const menu = [
  { name: "Dashboard",     path: "/lab/dashboard",   icon: "dashboard" },
  { name: "Live Board",    path: "/lab/live-board",   icon: "monitor_heart" },
  { name: "Test Catalog",  path: "/lab/catalog",     icon: "science" },
  { name: "Test Requests", path: "/lab/requests",    icon: "assignment" },
  { name: "Test Results",  path: "/lab/results",     icon: "biotech" },
  { name: "Lab Reports",   path: "/lab/reports",     icon: "summarize" },
  { name: "Lab Bills",     path: "/lab/bills",       icon: "receipt_long" },
];

export default function LabSidebar() {
  return (
    <div>
      {/* Section label */}
      <p className="text-[11px] font-semibold text-surface-on-variant/60 uppercase tracking-widest px-3 mb-3">
        Lab Module
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
