import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimesCircle, FaTimes } from "react-icons/fa";

const TYPES = {
  success: {
    container: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon: FaCheckCircle,
    iconColor: "text-emerald-500",
  },
  error: {
    container: "bg-red-50 border-red-200 text-red-800",
    icon: FaTimesCircle,
    iconColor: "text-red-500",
  },
  warning: {
    container: "bg-amber-50 border-amber-200 text-amber-800",
    icon: FaExclamationCircle,
    iconColor: "text-amber-500",
  },
  info: {
    container: "bg-blue-50 border-blue-200 text-blue-800",
    icon: FaInfoCircle,
    iconColor: "text-blue-500",
  },
};

export default function Alert({ type = "info", message, onClose, className = "" }) {
  if (!message) return null;
  const cfg = TYPES[type];
  const Icon = cfg.icon;

  // Support string or object (Django DRF errors)
  const renderMessage = () => {
    if (typeof message === "string") return <p className="text-sm">{message}</p>;
    if (typeof message === "object") {
      return (
        <ul className="text-sm list-disc list-inside space-y-1">
          {Object.entries(message).map(([key, val]) => (
            <li key={key}>
              <strong className="capitalize">{key.replace(/_/g, " ")}:</strong>{" "}
              {Array.isArray(val) ? val.join(", ") : val}
            </li>
          ))}
        </ul>
      );
    }
    return null;
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${cfg.container} ${className}`}>
      <Icon className={`${cfg.iconColor} text-lg flex-shrink-0 mt-0.5`} />
      <div className="flex-1">{renderMessage()}</div>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-60 hover:opacity-100 transition-opacity">
          <FaTimes />
        </button>
      )}
    </div>
  );
}
