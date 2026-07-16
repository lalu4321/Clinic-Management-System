import { FaSpinner } from "react-icons/fa";

/* ✅ ADD THIS (no logic change, just extracted styles) */
export const buttonVariants = ({
  variant = "primary",
  size = "md",
  className = "",
} = {}) => {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-slate-600 hover:bg-slate-700 text-white focus:ring-slate-500",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    warning: "bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500",
    outline: "border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 bg-transparent",
    ghost: "text-slate-600 hover:bg-slate-100 focus:ring-slate-400 bg-transparent",
    "outline-danger": "border border-red-500 text-red-500 hover:bg-red-50 focus:ring-red-400 bg-transparent",
  };

  const sizes = {
    xs: "px-2.5 py-1 text-xs",
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
};

/* ✅ YOUR ORIGINAL COMPONENT (UNCHANGED LOGIC) */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {loading && <FaSpinner className="animate-spin text-sm" />}
      {children}
    </button>
  );
}