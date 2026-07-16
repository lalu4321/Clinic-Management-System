import { NavLink } from "react-router-dom";

const menu = [
  { name: "Dashboard",      path: "/doctor/dashboard",      icon: "dashboard" },
  { name: "Live Board",     path: "/doctor/live-board",     icon: "monitor_heart" },
  { name: "Appointments",   path: "/doctor/appointments",   icon: "calendar_month" },
  { name: "Prescriptions",  path: "/doctor/prescriptions",  icon: "medication" },
  { name: "Lab Requests",   path: "/doctor/lab-requests",   icon: "biotech" },
  { name: "Patient History",path: "/doctor/patient-history",icon: "history" },
];

export default function DoctorSidebar() {
  return (
    <div>
      {/* Section label */}
      <p className="text-[11px] font-semibold text-surface-on-variant/60 uppercase tracking-widest px-3 mb-3">
        Doctor Portal
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
