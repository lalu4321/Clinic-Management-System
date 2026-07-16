import { FaSearch, FaTimes } from "react-icons/fa";
import { useState, useEffect } from "react";

export default function SearchInput({ value, onChange, placeholder = "Search...", debounceMs = 400 }) {
  const [local, setLocal] = useState(value || "");

  useEffect(() => {
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
  }, [local]);

  return (
    <div className="relative">
      <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-400 outline-none w-64"
      />
      {local && (
        <button
          onClick={() => { setLocal(""); onChange(""); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <FaTimes className="text-xs" />
        </button>
      )}
    </div>
  );
}
