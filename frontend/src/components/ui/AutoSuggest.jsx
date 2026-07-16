import { useState, useRef, useEffect } from "react";

export function AutoSuggest({
  items = [],
  value,
  onChange,
  displayKey = "label",
  valueKey = "value",
  placeholder = "Type to search...",
  label,
  error,
  className = "",
  "data-testid": testId,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedItem = items.find((i) => String(i[valueKey]) === String(value));

  useEffect(() => {
    if (selectedItem) setQuery(selectedItem[displayKey]);
  }, [selectedItem, displayKey]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((i) =>
    i[displayKey].toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {label}
        </label>
      )}
      <input
        type="text"
        data-testid={testId}
        className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 ${
          error ? "border-red-400" : "border-slate-200"
        }`}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.map((item) => (
            <li
              key={item[valueKey]}
              data-testid={`autosuggest-option-${item[valueKey]}`}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 transition-colors ${
                String(item[valueKey]) === String(value)
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-700"
              }`}
              onMouseDown={() => {
                onChange(String(item[valueKey]));
                setQuery(item[displayKey]);
                setOpen(false);
              }}
            >
              {item[displayKey]}
              {item.extra && (
                <span className="text-xs text-slate-400 ml-2">{item.extra}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm text-slate-400">
          No results found
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
