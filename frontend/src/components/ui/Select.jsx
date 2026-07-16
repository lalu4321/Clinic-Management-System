export default function Select({
  label,
  name,
  value,
  onChange,
  error,
  required,
  disabled,
  className = "",
  children,
  placeholder,
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors outline-none appearance-none bg-white
          ${error
            ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400"
            : "border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-400"
          }
          disabled:bg-slate-100 disabled:cursor-not-allowed`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
