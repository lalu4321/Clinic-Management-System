import { useState, useRef } from "react";
import DoctorLayout from "../components/Layout";
import { Button, Input, Alert, PageHeader, StatusBadge } from "@/components/ui";
import { getPatientHistory, searchPatients } from "../api/doctorApi";
import { FaSearch, FaHistory, FaSpinner, FaUser } from "react-icons/fa";
import { formatISTDate } from "@/utils/dateUtils";

function resolveError(err) {
  if (!err.response) return "Unable to connect to server. Check your network connection.";
  const status = err.response.status;
  if (status === 404) return "Patient not found. Please verify the name or code.";
  if (status >= 500) return "Server error. Please try again later.";
  return err.response?.data?.message || err.response?.data?.error || "Failed to load patient history.";
}

export default function PatientHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef(null);

  // ── Debounced name search ────────────────────────────
  const handleQueryChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSelectedPatient(null);
    setHistory(null);
    setError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPatients(q.trim());
        setSuggestions(res.data.data?.patients || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  // ── Select a patient from suggestions ───────────────
  const handleSelect = async (patient) => {
    setSelectedPatient(patient);
    setSearchQuery(patient.full_name);
    setSuggestions([]);
    setHistory(null);
    setError("");
    await loadHistory(patient.patient_id);
  };

  // ── Load history by patient ID ───────────────────────
  const loadHistory = async (patientId) => {
    setLoading(true);
    setError("");
    try {
      const res = await getPatientHistory(patientId);
      setHistory(res.data.data?.history || []);
    } catch (err) {
      setError(resolveError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Manual form submit (numeric ID fallback) ─────────
  const handleManualSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // If it's a numeric ID, fetch directly
    if (/^\d+$/.test(q)) {
      setSelectedPatient(null);
      setSuggestions([]);
      await loadHistory(q);
    }
  };

  return (
    <DoctorLayout>
      <PageHeader
        title="Patient History"
        subtitle="Search by patient name or code to view visit history"
      />

      {/* Search box */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 max-w-lg relative">
        <form onSubmit={handleManualSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Input
              name="searchQuery"
              value={searchQuery}
              onChange={handleQueryChange}
              placeholder="Enter patient name or ID..."
              className="w-full"
              autoComplete="off"
            />
            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                {suggestions.map((p) => (
                  <button
                    key={p.patient_id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    onClick={() => handleSelect(p)}
                  >
                    <div className="flex items-center gap-2">
                      <FaUser className="text-slate-400 text-xs flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.full_name}</p>
                        <p className="text-xs text-slate-500">{p.patient_code} · {p.phone}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 px-4 py-3 text-sm text-slate-400">
                <FaSpinner className="inline animate-spin mr-2" />
                Searching...
              </div>
            )}
          </div>
          <Button type="submit" disabled={loading || !searchQuery.trim()}>
            {loading ? <FaSpinner className="animate-spin" /> : <FaSearch />}
            {loading ? "Loading..." : "Search"}
          </Button>
        </form>

        {/* Selected patient info */}
        {selectedPatient && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
            <FaUser className="text-clinical-primary" />
            <span className="font-medium">{selectedPatient.full_name}</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-xs">{selectedPatient.patient_code}</span>
            <span className="text-slate-400">·</span>
            <span>{selectedPatient.phone}</span>
          </div>
        )}
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError("")} className="mb-4" />}

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center">
          <FaSpinner className="text-3xl text-clinical-primary animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading patient history...</p>
        </div>
      )}

      {/* History results */}
      {!loading && history && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="py-16 text-center">
              <FaHistory className="text-5xl text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No patient history found</p>
              <p className="text-slate-400 text-sm mt-1">
                This patient has no recorded visits with you yet.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                {history.length} visit{history.length !== 1 ? "s" : ""} found
              </p>
              {history.map((visit, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Visit header */}
                  <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-800">
                        Visit on {formatISTDate(visit.date)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{visit.appointment_code}</p>
                    </div>
                    <StatusBadge status={visit.status} />
                  </div>

                  {/* Prescription details */}
                  {(visit.symptoms || visit.diagnosis || visit.medicines?.length > 0) && (
                    <div className="px-5 py-4 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Prescription
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Symptoms:</span> {visit.symptoms || "—"}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Diagnosis:</span> {visit.diagnosis || "—"}
                      </p>
                      {visit.medicines?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-500 mb-1">Medicines:</p>
                          <ul className="text-sm space-y-1">
                            {visit.medicines.map((m, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="font-medium">{m.medicine}</span>
                                <span className="text-slate-500">
                                  {m.dosage} — {m.frequency} × {m.quantity}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lab results */}
                  {visit.lab_results?.length > 0 && (
                    <div className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
                        Lab Results
                      </p>
                      <div className="space-y-1">
                        {visit.lab_results.map((r, j) => (
                          <div key={j} className="flex gap-4 text-sm">
                            <span className="font-medium">{r.parameter}</span>
                            <span>{r.result}</span>
                            {r.unit && <span className="text-slate-400">{r.unit}</span>}
                            {r.is_abnormal && (
                              <span className="text-red-500 text-xs font-semibold">ABNORMAL</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </DoctorLayout>
  );
}
