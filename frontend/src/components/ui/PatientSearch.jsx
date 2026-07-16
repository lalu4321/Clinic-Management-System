import { useState, useEffect, useCallback, useRef } from "react";
import { FaSearch, FaSpinner, FaUser, FaPhone } from "react-icons/fa";
import API from "@/api/axiosInstance";

/**
 * Scalable Patient Search Component
 * Features:
 * - Debounced search (300ms)
 * - Multi-field matching (ID, name, phone)
 * - Pagination support
 * - Keyboard navigation
 * - Loading states
 */
export default function PatientSearch({
  onSelect,
  selectedPatient = null,
  placeholder = "Search by name, ID, or phone...",
  className = "",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState("");
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  // Debounced search function
  const searchPatients = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await API.get("/reception/patients/search/", {
        params: { q: searchQuery, page_size: 10 },
      });

      const data = response.data.data || response.data;
      setResults(data.results || []);
      setShowDropdown(true);
      setHighlightedIndex(-1);
    } catch (err) {
      setError("Failed to search patients");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new debounce timer
    debounceTimer.current = setTimeout(() => {
      searchPatients(value);
    }, 300);
  };

  // Handle patient selection
  const handleSelect = (patient) => {
    setQuery(`${patient.first_name} ${patient.last_name}`);
    setShowDropdown(false);
    setResults([]);
    onSelect(patient);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
      default:
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Set initial value if patient is selected
  useEffect(() => {
    if (selectedPatient) {
      setQuery(`${selectedPatient.first_name} ${selectedPatient.last_name}`);
    }
  }, [selectedPatient]);

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? (
            <FaSpinner className="w-4 h-4 animate-spin" />
          ) : (
            <FaSearch className="w-4 h-4" />
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          data-testid="patient-search-input"
          autoComplete="off"
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
          data-testid="patient-search-dropdown"
        >
          {results.length === 0 && !loading && query.length >= 2 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No patients found matching "{query}"
            </div>
          ) : (
            results.map((patient, index) => (
              <div
                key={patient.patient_id}
                onClick={() => handleSelect(patient)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-4 py-3 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${
                  index === highlightedIndex
                    ? "bg-blue-50"
                    : "hover:bg-slate-50"
                }`}
                data-testid={`patient-option-${patient.patient_id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <FaUser className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800 truncate">
                        {patient.first_name} {patient.last_name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {patient.patient_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <FaPhone className="w-3 h-3" />
                      <span>{patient.phone}</span>
                      <span className="mx-1">•</span>
                      <span>{patient.gender === "MALE" ? "Male" : patient.gender === "FEMALE" ? "Female" : patient.gender}</span>
                      {patient.blood_group && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="font-medium text-red-600">{patient.blood_group}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
