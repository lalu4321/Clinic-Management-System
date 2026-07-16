const STATUS_CONFIG = {
  // Appointment
  SCHEDULED: { color: "bg-blue-100 text-blue-700", label: "Scheduled" },
  COMPLETED: { color: "bg-emerald-100 text-emerald-700", label: "Completed" },
  CANCELLED: { color: "bg-red-100 text-red-700", label: "Cancelled" },
  // Bill
  PENDING: { color: "bg-amber-100 text-amber-700", label: "Pending" },
  PAID: { color: "bg-emerald-100 text-emerald-700", label: "Paid" },
  // Doctor/Staff
  ACTIVE: { color: "bg-emerald-100 text-emerald-700", label: "Active" },
  INACTIVE: { color: "bg-slate-100 text-slate-600", label: "Inactive" },
  // Prescription
  DRAFT: { color: "bg-slate-100 text-slate-600", label: "Draft" },
  ACTIVE_P: { color: "bg-blue-100 text-blue-700", label: "Active" },
  // Lab
  ORDERED: { color: "bg-purple-100 text-purple-700", label: "Ordered" },
  FINAL: { color: "bg-emerald-100 text-emerald-700", label: "Final" },
  AMENDED: { color: "bg-amber-100 text-amber-700", label: "Amended" },
  // Inventory
  AVAILABLE: { color: "bg-emerald-100 text-emerald-700", label: "Available" },
  OUT_OF_STOCK: { color: "bg-red-100 text-red-700", label: "Out of Stock" },
  EXPIRED: { color: "bg-slate-100 text-slate-600", label: "Expired" },
  // Generic
  true: { color: "bg-emerald-100 text-emerald-700", label: "Active" },
  false: { color: "bg-slate-100 text-slate-600", label: "Inactive" },
};

export default function StatusBadge({ status, customLabel }) {
  const key = String(status).toUpperCase();
  const config = STATUS_CONFIG[key] || STATUS_CONFIG[status] || {
    color: "bg-gray-100 text-gray-600",
    label: status,
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {customLabel || config.label}
    </span>
  );
}
