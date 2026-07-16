import * as React from "react";
import { createContext, useContext, useReducer, useCallback } from "react";
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimesCircle, FaTimes } from "react-icons/fa";

// ==========================================
// TOAST CONTEXT
// ==========================================

const ToastContext = createContext(null);

const TOAST_TYPES = {
  success: {
    icon: FaCheckCircle,
    className: "bg-green-50 border-green-200 text-green-800",
    iconClass: "text-green-500",
  },
  error: {
    icon: FaExclamationCircle,
    className: "bg-red-50 border-red-200 text-red-800",
    iconClass: "text-red-500",
  },
  warning: {
    icon: FaInfoCircle,
    className: "bg-amber-50 border-amber-200 text-amber-800",
    iconClass: "text-amber-500",
  },
  info: {
    icon: FaInfoCircle,
    className: "bg-blue-50 border-blue-200 text-blue-800",
    iconClass: "text-blue-500",
  },
};

const toastReducer = (state, action) => {
  switch (action.type) {
    case "ADD":
      return [...state, action.toast];
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
    case "CLEAR_ALL":
      return [];
    default:
      return state;
  }
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const addToast = useCallback((message, type = "info", duration = 5000) => {
    const id = ++toastId;
    dispatch({ type: "ADD", toast: { id, message, type, duration } });

    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: "REMOVE", id });
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  const success = useCallback((message, duration) => addToast(message, "success", duration), [addToast]);
  const error = useCallback((message, duration) => addToast(message, "error", duration), [addToast]);
  const warning = useCallback((message, duration) => addToast(message, "warning", duration), [addToast]);
  const info = useCallback((message, duration) => addToast(message, "info", duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ==========================================
// TOAST CONTAINER
// ==========================================

function ToastContainer({ toasts, removeToast }) {
  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// ==========================================
// TOAST COMPONENT
// ==========================================

function Toast({ toast, onClose }) {
  const config = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
  const Icon = config.icon;

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        animate-slide-in
        ${config.className}
      `}
      role="alert"
      data-testid={`toast-${toast.type}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClass}`} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
        aria-label="Close notification"
      >
        <FaTimes className="w-3 h-3 opacity-60" />
      </button>
    </div>
  );
}

// ==========================================
// CSS ANIMATION (add to global styles)
// ==========================================

const toastStyles = `
  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  .animate-slide-in {
    animation: slide-in 0.3s ease-out forwards;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = toastStyles;
  document.head.appendChild(styleEl);
}

export default { ToastProvider, useToast };
