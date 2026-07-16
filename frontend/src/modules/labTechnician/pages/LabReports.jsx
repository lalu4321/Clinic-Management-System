import { useState, useEffect, useCallback } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import {
  Button, Alert, StatusBadge, Select, PageHeader,
  Modal, Textarea, SearchInput
} from "@/components/ui";
import {
  getLabReports, createLabReport, updateLabReport,
  getLabRequests, downloadLabReportPDF,
} from "../api/labApi";
import { useToast } from "@/context/ToastContext";
import { FaFileAlt, FaPlus, FaEye, FaDownload, FaPrint } from "react-icons/fa";
import { formatISTDate } from "@/utils/dateUtils";

/**
 * Group a list of lab requests by appointment_id, returning one entry
 * per appointment.  The first request in the group is used as the
 * representative request_id when creating the report.
 *
 * Enforces one-report-per-appointment on the frontend by surfacing
 * appointments rather than individual requests in the dropdown.
 */
function groupRequestsByAppointment(requests) {
  const map = {};
  for (const r of requests) {
    const key = r.appointment;          // appointment PK
    if (!map[key]) {
      map[key] = {
        appointment_id:        r.appointment,
        appointment_code:      r.appointment_code || `#${r.appointment}`,
        patient_name:          r.patient_name || "—",
        doctor_name:           r.doctor_name  || "—",
        // Representative request used when POSTing the report
        representative_request_id: r.lab_test_request_id,
        test_names:            [],
      };
    }
    if (r.lab_test_name) map[key].test_names.push(r.lab_test_name);
  }
  return Object.values(map);
}

export default function LabReports() {
  const toast = useToast();

  const [reports, setReports] = useState([]);
  // eligibleAppointments: one entry per appointment (derived from eligible requests)
  const [eligibleAppointments, setEligibleAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    appointment_key: "",     // appointment_id chosen by user
    overall_interpretation: "",
  });
  const [createErrors, setCreateErrors] = useState({});
  const [creating, setSaving] = useState(false);

  // View modal
  const [viewReport, setViewReport] = useState(null);

  // Finalize loading
  const [updatingId, setUpdatingId] = useState(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter && statusFilter !== "AMENDED") params.status = statusFilter;
    if (search) params.search = search;

    Promise.all([
      getLabReports(params),
      // Fetch completed requests that have NO report yet and whose bill is paid
      getLabRequests({ status: "COMPLETED", exclude_reported: "true", bill_paid: "true" }),
    ])
      .then(([rRes, reqRes]) => {
        const rd = rRes.data.data;
        const reqs = reqRes.data.data;
        setReports(Array.isArray(rd) ? rd : rd?.results || []);
        const allReqs = Array.isArray(reqs) ? reqs : reqs?.results || [];
        setEligibleAppointments(groupRequestsByAppointment(allReqs));
      })
      .catch(() => setError("Failed to load reports."))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  // ── Create report ──────────────────────────────────────────────────────────

  const openCreate = () => {
    if (eligibleAppointments.length === 0) {
      toast.warning(
        "No eligible appointments. Ensure ALL tests are completed and the bill is paid before generating a report."
      );
      return;
    }
    setCreateForm({ appointment_key: "", overall_interpretation: "" });
    setCreateErrors({});
    setCreateOpen(true);
  };

  const changeCreate = (e) => {
    const { name, value } = e.target;
    setCreateForm((p) => ({ ...p, [name]: value }));
    setCreateErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleCreate = async () => {
    if (!createForm.appointment_key) {
      setCreateErrors({ appointment_key: "Please select an appointment" });
      return;
    }

    // Find the representative request for the selected appointment
    const appt = eligibleAppointments.find(
      (a) => String(a.appointment_id) === String(createForm.appointment_key)
    );
    if (!appt) {
      setCreateErrors({ appointment_key: "Selected appointment not found" });
      return;
    }

    setSaving(true);
    try {
      await createLabReport({
        request: appt.representative_request_id,
        overall_interpretation: createForm.overall_interpretation || null,
      });
      toast.success("Lab report created successfully.");
      setCreateOpen(false);
      load();
    } catch (e) {
      const d = e.response?.data;
      if (d?.errors) {
        setCreateErrors(d.errors);
      } else {
        const msg = d?.message || "Failed to create report.";
        setCreateErrors({ _global: msg });
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Finalize report ────────────────────────────────────────────────────────

  const handleFinalize = async (report) => {
    setUpdatingId(report.report_id);
    try {
      await updateLabReport(report.report_id, { status: "FINAL" });
      toast.success("Report finalized successfully.");
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to finalize report.");
    } finally {
      setUpdatingId(null);
    }
  };

  // ── View report ────────────────────────────────────────────────────────────

  const openView = (r) => setViewReport(r);

  // ── Download PDF ───────────────────────────────────────────────────────────

  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadPDF = async (report) => {
    setDownloadingId(report.report_id);
    try {
      const response = await downloadLabReportPDF(report.request);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `lab_report_${report.appointment_code || report.appointment_id || report.report_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully.");
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to download PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrint = async (report) => {
    setDownloadingId(`print-${report.report_id}`);
    try {
      const response = await downloadLabReportPDF(report.request);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 5000);
    } catch (e) {
      toast.error(e.response?.data?.error || "Failed to open PDF for printing.");
    } finally {
      setDownloadingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <PageHeader
        title="Lab Reports"
        subtitle="Generate and manage lab reports"
        actions={
          <Button onClick={openCreate}>
            <FaPlus /> New Report
          </Button>
        }
      />

      {error && <Alert type="error" message={error} onClose={() => setError("")} className="mb-4" />}

      {/* Billing workflow notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-xs text-amber-700">
        Reports can only be generated after:{" "}
        Complete ALL test requests → <strong>Mark Bill as Paid</strong> → Generate Report.
        One consolidated report is issued per appointment.
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by patient name…"
        />
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-44"
        >
          <option value="DRAFT">Draft</option>
          <option value="FINAL">Final</option>
        </Select>
      </div>

      {/* Reports table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center">
            <FaFileAlt className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No reports found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Report ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Appt. ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Tests</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Report Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <tr key={r.report_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">
                      #{r.report_id}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                      {r.appointment_code || (r.appointment_id ? `#${r.appointment_id}` : "—")}
                    </td>
                    <td className="px-4 py-3">{r.patient_name || "—"}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-600 text-xs">
                      {r.test_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.report_date ? formatISTDate(r.report_date) : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openView(r)}
                          title="View Report"
                        >
                          <FaEye />
                        </Button>
                        {r.status === "DRAFT" && (
                          <Button
                            size="xs"
                            variant="success"
                            loading={updatingId === r.report_id}
                            onClick={() => handleFinalize(r)}
                          >
                            Finalize
                          </Button>
                        )}
                        {r.status === "FINAL" && (
                          <>
                            <Button
                              size="xs"
                              variant="outline"
                              loading={downloadingId === r.report_id}
                              onClick={() => handleDownloadPDF(r)}
                              title="Download PDF"
                            >
                              <FaDownload />
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              loading={downloadingId === `print-${r.report_id}`}
                              onClick={() => handlePrint(r)}
                              title="Print"
                            >
                              <FaPrint />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Report Modal ── */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Lab Report"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating}>Create Report</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Workflow reminder */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            Select an appointment below. All tests for that appointment must be{" "}
            <strong>completed</strong> and the lab bill must be <strong>paid</strong>.
            One consolidated report covering ALL tests will be generated.
          </div>

          {/* Appointment selector (one entry per appointment) */}
          <Select
            label="Select Appointment"
            name="appointment_key"
            value={createForm.appointment_key}
            onChange={changeCreate}
            error={createErrors.appointment_key}
            required
            placeholder="— Select an appointment —"
          >
            {eligibleAppointments.map((appt) => (
              <option key={appt.appointment_id} value={appt.appointment_id}>
                {appt.appointment_code} — {appt.patient_name}
                {appt.test_names.length > 0
                  ? ` (${appt.test_names.join(", ")})`
                  : ""}
              </option>
            ))}
          </Select>

          <Textarea
            label="Overall Interpretation (optional)"
            name="overall_interpretation"
            value={createForm.overall_interpretation}
            onChange={changeCreate}
            error={createErrors.overall_interpretation}
            rows={3}
            placeholder="Overall findings and interpretation…"
          />

          {/* Global / backend enforcement errors */}
          {createErrors._global && (
            <p className="text-red-600 text-sm font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {createErrors._global}
            </p>
          )}
          {createErrors.non_field_errors && (
            <p className="text-red-600 text-sm">{createErrors.non_field_errors}</p>
          )}
          {createErrors.error && (
            <p className="text-red-600 text-sm">{createErrors.error}</p>
          )}
        </div>
      </Modal>

      {/* ── View Report Modal ── */}
      <Modal
        isOpen={!!viewReport}
        onClose={() => setViewReport(null)}
        title={`Report #${viewReport?.report_id}`}
        size="lg"
        footer={
          <div className="flex gap-2 w-full justify-between">
            <div className="flex gap-2">
              {viewReport?.status === "FINAL" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={downloadingId === viewReport.report_id}
                    onClick={() => handleDownloadPDF(viewReport)}
                  >
                    <FaDownload className="mr-1" /> Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={downloadingId === `print-${viewReport.report_id}`}
                    onClick={() => handlePrint(viewReport)}
                  >
                    <FaPrint className="mr-1" /> Print
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => setViewReport(null)}>Close</Button>
          </div>
        }
      >
        {viewReport && (
          <div className="space-y-4 text-sm">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4">
              <div>
                <p className="text-slate-500 text-xs mb-1">Appointment ID</p>
                <p className="font-mono font-semibold text-emerald-700">
                  {viewReport.appointment_code || (viewReport.appointment_id ? `#${viewReport.appointment_id}` : "—")}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Report Date &amp; Time</p>
                <p className="font-semibold">
                  {viewReport.report_date ? formatISTDate(viewReport.report_date) : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Status</p>
                <StatusBadge status={viewReport.status} />
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Completed At</p>
                <p className="font-semibold">
                  {viewReport.completed_at ? formatISTDate(viewReport.completed_at) : "—"}
                </p>
              </div>
            </div>

            {/* Patient info */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Patient Information
              </p>
              <div className="grid grid-cols-3 gap-3 bg-blue-50 rounded-xl p-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Name</p>
                  <p className="font-medium">{viewReport.patient_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Blood Group</p>
                  <p>{viewReport.patient_blood_group || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Phone</p>
                  <p>{viewReport.patient_phone || "—"}</p>
                </div>
              </div>
            </div>

            {/* Doctor info */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Referring Doctor
              </p>
              <div className="grid grid-cols-3 gap-3 bg-emerald-50 rounded-xl p-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Doctor Code</p>
                  <p className="font-mono">{viewReport.doctor_code || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Name</p>
                  <p className="font-medium">{viewReport.doctor_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Specialization</p>
                  <p>{viewReport.doctor_specialization || "—"}</p>
                </div>
              </div>
            </div>

            {/* All tests covered by this report */}
            <div>
              <p className="text-xs text-slate-500 mb-1">Tests Covered</p>
              <p className="font-semibold text-slate-800 text-sm">
                {viewReport.test_name || "—"}
              </p>
            </div>

            {/* Results table — consolidated across ALL tests for appointment */}
            {viewReport.results && viewReport.results.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Consolidated Lab Results
                </p>
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Test</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Parameter</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Value</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Unit</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Ref Range</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewReport.results.map((res) => (
                      <tr key={res.result_id} className={res.is_abnormal ? "bg-red-50" : ""}>
                        <td className="px-3 py-2 text-slate-500">{res.test_name || "—"}</td>
                        <td className="px-3 py-2 font-medium">{res.parameter_name}</td>
                        <td className="px-3 py-2 font-semibold">{res.value}</td>
                        <td className="px-3 py-2 text-slate-500">{res.unit || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {res.reference_range ||
                            (res.reference_min || res.reference_max
                              ? `${res.reference_min || ""}–${res.reference_max || ""}`
                              : "—")}
                        </td>
                        <td className="px-3 py-2">
                          {res.is_abnormal ? (
                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                              Abnormal
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Interpretation */}
            {viewReport.overall_interpretation && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Overall Interpretation
                </p>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3 text-sm">
                  {viewReport.overall_interpretation}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </ModuleLayout>
  );
}
