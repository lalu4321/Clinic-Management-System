import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import { Button, Alert, PageHeader, SearchInput, Modal, Input } from "@/components/ui";
import { getLabResults, updateLabResult } from "../api/labApi";
import { useToast } from "@/context/ToastContext";
import { FaVial, FaEye } from "react-icons/fa";

// Group individual result rows by their request ID
function groupByRequest(results) {
  const map = {};
  for (const r of results) {
    const key = r.request;
    if (!map[key]) {
      map[key] = {
        request:          r.request,
        request_code:     r.request_code,
        appointment_id:   r.appointment_id,
        appointment_code: r.appointment_code,
        patient_name:     r.patient_name,
        test_name:        r.test_name,
        parameters:       [],
        overall_abnormal: false,
        has_report:       false,
      };
    }
    map[key].parameters.push(r);
    if (r.is_abnormal) map[key].overall_abnormal = true;
    if (r.has_report)  map[key].has_report = true;
  }
  return Object.values(map);
}

export default function LabResults() {
  const toast = useToast();
  const navigate = useNavigate();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // View modal (grouped)
  const [viewGroup, setViewGroup] = useState(null);

  // Edit modal (per parameter)
  const [editItem, setEditItem]     = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving]         = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    getLabResults(params)
      .then((r) => {
        const d = r.data.data;
        setResults(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => setError("Failed to load results."))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const grouped = groupByRequest(results);

  // ── View ───────────────────────────────────────────────────────────────────

  const openView = (group) => setViewGroup(group);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = (r) => {
    setEditItem(r);
    setEditForm({ value: r.value });
    setEditErrors({});
  };

  const changeEdit = (e) => {
    const { name, value } = e.target;
    setEditForm((p) => ({ ...p, [name]: value }));
    setEditErrors((p) => ({ ...p, [name]: "" }));
  };

  const validateEdit = () => {
    const errs = {};
    if (editForm.value === "" || editForm.value === null) {
      errs.value = "Result value is required";
    } else {
      const n = Number(editForm.value);
      if (isNaN(n) || n < 1 || n > 500)
        errs.value = "Result value must be a number between 1 and 500";
    }
    return errs;
  };

  const handleSaveEdit = async () => {
    const errs = validateEdit();
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setSaving(true);
    try {
      await updateLabResult(editItem.result_id, { value: editForm.value });
      toast.success("Result updated successfully.");
      setEditItem(null);
      load();
      setViewGroup(null);
    } catch (e) {
      const d = e.response?.data;
      const msg = d?.message || "Failed to update result.";
      if (d?.errors?.value) {
        setEditErrors({ value: Array.isArray(d.errors.value) ? d.errors.value[0] : d.errors.value });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <PageHeader
        title="Lab Results"
        subtitle="View test results grouped by request"
        actions={
          <Button onClick={() => navigate("/lab/requests")}>
            Add Results (via Requests)
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError("")} className="mb-4" />}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by patient name or parameter…"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="py-16 text-center">
            <FaVial className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No results found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Request</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Appt. ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Test</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Parameters</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Abnormality</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((g) => (
                  <tr key={g.request} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">
                      #{g.request_code || g.request}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                      {g.appointment_code || (g.appointment_id ? `#${g.appointment_id}` : "—")}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{g.patient_name || "—"}</td>
                    <td className="px-4 py-3">{g.test_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {g.parameters.length} param{g.parameters.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3">
                      {g.overall_abnormal ? (
                        <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          Abnormal
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Button variant="outline" size="xs" onClick={() => openView(g)} title="View Details">
                          <FaEye />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── View Modal (per request, all parameters) ── */}
      <Modal
        isOpen={!!viewGroup}
        onClose={() => setViewGroup(null)}
        title={`Results — ${viewGroup?.test_name || `Request #${viewGroup?.request_code || viewGroup?.request}`}`}
        size="lg"
        footer={<Button onClick={() => setViewGroup(null)}>Close</Button>}
      >
        {viewGroup && (
          <div className="space-y-4 text-sm">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3 text-xs">
              <div>
                <p className="text-slate-500 mb-1">Request #</p>
                <p className="font-mono font-semibold text-blue-600">
                  #{viewGroup.request_code || viewGroup.request}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Appointment ID</p>
                <p className="font-mono font-semibold text-emerald-700">
                  {viewGroup.appointment_code || (viewGroup.appointment_id ? `#${viewGroup.appointment_id}` : "—")}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Patient</p>
                <p className="font-semibold">{viewGroup.patient_name || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Test Name</p>
                <p className="font-semibold">{viewGroup.test_name || "—"}</p>
              </div>
            </div>

            {/* Report lock notice */}
            {viewGroup.has_report && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700 font-medium">
                After report creation, lab results cannot be edited.
              </div>
            )}

            {/* Overall status */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Overall Status:</span>
              {viewGroup.overall_abnormal ? (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  Abnormal — one or more parameters out of range
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  All parameters Normal
                </span>
              )}
            </div>

            {/* Parameters table */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Parameters</p>
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Parameter</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Result Value</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Unit</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Reference Range</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewGroup.parameters.map((res) => (
                    <tr key={res.result_id} className={res.is_abnormal ? "bg-red-50" : ""}>
                      <td className="px-3 py-2 font-medium">{res.parameter_name}</td>
                      <td className="px-3 py-2 font-semibold">{res.value}</td>
                      <td className="px-3 py-2 text-slate-500">{res.unit || "—"}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {res.reference_range ||
                          (res.reference_min != null && res.reference_max != null
                            ? `${res.reference_min} – ${res.reference_max}`
                            : "—")}
                      </td>
                      <td className="px-3 py-2">
                        {res.is_abnormal ? (
                          <span className="bg-red-100 text-red-700 font-semibold px-1.5 py-0.5 rounded-full">
                            Abnormal
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEdit(res)}
                          disabled={viewGroup.has_report}
                          title={viewGroup.has_report ? "After report creation, lab results cannot be edited." : "Edit result"}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit Modal (per parameter) ── */}
      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title={`Edit Result — ${editItem?.parameter_name || ""}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} loading={saving} disabled={editItem?.has_report}>Save Changes</Button>
          </>
        }
      >
        {editItem && (
          <div className="space-y-4">
            {editItem.has_report && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 font-medium">
                After report creation, lab results cannot be edited.
              </div>
            )}

            {/* Immutable catalog-sourced fields — read-only display */}
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <div>
                <span className="font-semibold">Parameter:</span>{" "}
                <span className="text-slate-800">{editItem.parameter_name}</span>
              </div>
              <div>
                <span className="font-semibold">Unit:</span>{" "}
                <span className="text-slate-800">{editItem.unit || "—"}</span>
              </div>
              <div>
                <span className="font-semibold">Reference Range:</span>{" "}
                <span className="text-slate-800">
                  {editItem.reference_range ||
                    (editItem.reference_min != null && editItem.reference_max != null
                      ? `${editItem.reference_min} – ${editItem.reference_max}`
                      : "—")}
                </span>
              </div>
              <p className="text-slate-400 mt-1">
                Parameter name, unit, and reference range are immutable once entered.
              </p>
            </div>

            {/* Only the measured result value is editable */}
            <Input
              label="Result Value"
              name="value"
              type="number"
              step="0.01"
              min="1"
              max="500"
              value={editForm.value}
              onChange={changeEdit}
              error={editErrors.value}
              required
              disabled={editItem.has_report}
            />

            {editErrors.non_field_errors && (
              <p className="text-red-600 text-sm">{editErrors.non_field_errors}</p>
            )}
            {editErrors.error && (
              <p className="text-red-600 text-sm">{editErrors.error}</p>
            )}
          </div>
        )}
      </Modal>
    </ModuleLayout>
  );
}
