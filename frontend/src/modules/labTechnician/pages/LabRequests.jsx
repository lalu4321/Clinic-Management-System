import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import { Button, Alert, StatusBadge, Select, PageHeader, SearchInput } from "@/components/ui";
import { getLabRequests } from "../api/labApi";
import { FaVial, FaClipboardList } from "react-icons/fa";

export default function LabRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ORDERED");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;

    if (statusFilter === "CANCELLED") {
      // Cancelled requests are soft-deleted — need a special flag to expose them
      params.show_cancelled = "true";
    } else if (statusFilter) {
      params.status = statusFilter;
    }

    getLabRequests(params)
      .then((r) => {
        const d = r.data.data;
        setRequests(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => setError("Failed to load requests."))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <PageHeader title="Test Requests" subtitle="Process lab test requests from doctors" />

      {error && <Alert type="error" message={error} onClose={() => setError("")} className="mb-4" />}

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by patient name or test…"
        />
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-48"
        >
          <option value="ORDERED">Ordered</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled by Doctor</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("ORDERED"); }}>
          Clear
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center">
            <FaClipboardList className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Req. ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Appt. ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Test</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Doctor</th>
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
                      <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                        {r.appointment_code || `#${r.appointment}`}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {r.lab_test_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.patient_name || "—"}
                      </td>
                      <td className="px-4 py-3">{r.doctor_name || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {r.notes || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isCancelled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Cancelled by Doctor
                          </span>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!isCancelled && r.status === "ORDERED" && (
                            <Button
                              size="xs"
                              onClick={() => navigate(`/lab/results/add/${r.lab_test_request_id}`)}
                            >
                              <FaVial /> Add Results
                            </Button>
                          )}
                          {isCancelled && (
                            <span className="text-xs text-red-400 italic">No action</span>
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
    </ModuleLayout>
  );
}
