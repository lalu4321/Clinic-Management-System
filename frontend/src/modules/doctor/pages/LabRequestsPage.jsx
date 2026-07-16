import { useState, useEffect, useCallback } from "react";
import DoctorLayout from "../components/Layout";
import { Button, StatusBadge, Select, PageHeader, ConfirmModal } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { getLabRequests, deleteLabRequest, getDoctorLabResults } from "../api/doctorApi";
import { FaFlask, FaVial } from "react-icons/fa";

export default function DoctorLabRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Results modal state
  const [resultsTarget, setResultsTarget] = useState(null); // lab_test_request_id
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter === "CANCELLED") {
      params.show_cancelled = "true";
    } else if (statusFilter) {
      params.status = statusFilter;
    }
    getLabRequests(params)
      .then((r) => {
        const d = r.data.data;
        setRequests(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load lab requests."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLabRequest(deleteTarget.lab_test_request_id);
      toast.success("Lab request cancelled successfully.");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel lab request.");
    } finally {
      setDeleting(false);
    }
  };

  // ── View lab results for a completed request ─────────
  const handleViewResults = async (request) => {
    setResultsTarget(request);
    setResultsLoading(true);
    setResults([]);
    try {
      const res = await getDoctorLabResults({ "request__appointment": request.appointment });
      const d = res.data.data;
      const all = Array.isArray(d) ? d : d?.results || [];
      // Filter by this specific request
      setResults(all.filter((r) => r.request === request.lab_test_request_id));
    } catch {
      toast.error("Failed to load lab results.");
      setResultsTarget(null);
    } finally {
      setResultsLoading(false);
    }
  };

  return (
    <DoctorLayout>
      <PageHeader title="Lab Test Requests" subtitle="Tests ordered for your patients" />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex gap-3">
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-48"
        >
          <option value="ORDERED">Ordered</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setStatusFilter("")}>Clear</Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <FaFlask className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No lab requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Test Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Appointment</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Notes</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const isCancelled = r.is_deleted === true;
                  return (
                    <tr key={r.lab_test_request_id} className={isCancelled ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">
                        #{r.lab_test_request_id}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {r.lab_test_name || r.lab_test}
                      </td>
                      <td className="px-4 py-3">
                        {r.appointment_code ? r.appointment_code : `#${r.appointment}`}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {r.notes || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isCancelled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Cancelled
                          </span>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!isCancelled && r.status === "COMPLETED" && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleViewResults(r)}
                            >
                              <FaVial className="mr-1" />
                              View Results
                            </Button>
                          )}
                          {!isCancelled && r.status === "ORDERED" && (
                            <Button
                              size="xs"
                              variant="outline-danger"
                              onClick={() => setDeleteTarget(r)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel confirmation modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Cancel Lab Request"
        message={`Cancel lab request for "${deleteTarget?.lab_test_name || deleteTarget?.lab_test}"?`}
        confirmLabel="Cancel Request"
      />

      {/* Lab Results modal */}
      {resultsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setResultsTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-slate-800">
                  Lab Results — {resultsTarget.lab_test_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient: {resultsTarget.patient_name}
                </p>
              </div>
              <Button variant="ghost" size="xs" onClick={() => setResultsTarget(null)}>✕</Button>
            </div>

            <div className="p-5">
              {resultsLoading ? (
                <p className="text-sm text-slate-400 text-center py-4">Loading results...</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  No results recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {results.map((result, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-4 p-3 rounded-lg ${
                        result.is_abnormal ? "bg-red-50 border border-red-200" : "bg-slate-50"
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">
                          {result.parameter_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {result.result_value}
                          {result.unit && (
                            <span className="text-slate-400 ml-1">{result.unit}</span>
                          )}
                        </p>
                      </div>
                      {result.is_abnormal && (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                          ABNORMAL
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DoctorLayout>
  );
}
