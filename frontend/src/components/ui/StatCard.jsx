export default function StatCard({ title, value, icon: Icon, color = "blue", subtitle, trend }) {
  const colors = {
    blue:   "bg-clinical-primary",
    green:  "bg-emerald-500",
    amber:  "bg-amber-500",
    red:    "bg-red-500",
    purple: "bg-purple-500",
    cyan:   "bg-cyan-500",
    indigo: "bg-indigo-500",
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-soft p-5
      flex items-center gap-4 hover:shadow-sm transition-shadow">
      <div className={`${colors[color]} p-3 rounded-xl text-white flex-shrink-0`}>
        {Icon && <Icon className="text-2xl" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-on-variant truncate">{title}</p>
        <p className="text-2xl font-bold text-surface-on">{value ?? "—"}</p>
        {subtitle && <p className="text-xs text-surface-on-variant mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
