import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import { Button, Input, Alert, PageHeader, FormRow, Select } from "@/components/ui";
import {
  createLabResult,
  getLabRequestById,
  updateLabRequest,
  getLabParametersByTest,
} from "../api/labApi";
import { useToast } from "@/context/ToastContext";

export default function AddLabResult() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [requestDetails, setRequestDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState([]);
  const [hasParams, setHasParams] = useState(false);
  const [rowErrors, setRowErrors] = useState([]);
  const [globalError, setGlobalError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Load request + catalog parameters ─────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const reqRes = await getLabRequestById(requestId);
        const detail = reqRes.data.data || reqRes.data;
        setRequestDetails(detail);

        const labTestId = detail.lab_test;
        if (labTestId) {
          const pRes = await getLabParametersByTest(labTestId);
          const d = pRes.data.data;
          const catalogParams = Array.isArray(d) ? d : d?.results || [];

          if (catalogParams.length > 0) {
            setHasParams(true);
            setParams(
              catalogParams.map((cp) => ({
                // From catalog (immutable — locked in form)
                parameter_name: cp.parameter_name,
                reference_min:  String(cp.reference_min),
                reference_max:  String(cp.reference_max),
                unit:           cp.unit || "",
                // Technician fills this:
                value: "",
              }))
            );
            setRowErrors(catalogParams.map(() => ({})));
          } else {
            setHasParams(false);
            setParams([emptyRow()]);
            setRowErrors([{}]);
          }
        } else {
          setHasParams(false);
          setParams([emptyRow()]);
          setRowErrors([{}]);
        }
      } catch {
        setGlobalError("Failed to load request details. Please go back and retry.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [requestId]);

  function emptyRow() {
    return {
      parameter_name: "",
      value: "",
      unit: "",
      reference_min: "",
      reference_max: "",
    };
  }

  // ── Field update ───────────────────────────────────────────────────────────

  const updateRow = (idx, field, val) => {
    setParams((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
    setRowErrors((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: "" } : e)));
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    return params.map((p, i) => {
      const e = {};
      if (!hasParams && !p.parameter_name?.trim()) {
        e.parameter_name = `Parameter ${i + 1}: name is required`;
      }
      const raw = p.value;
      if (raw === "" || raw === null || raw === undefined) {
        e.value = `Parameter ${i + 1}: result value is required`;
      } else {
        const n = Number(raw);
        if (isNaN(n)) {
          e.value = `Parameter ${i + 1}: result value must be a number between 1 and 500`;
        } else if (n < 1 || n > 500) {
          e.value = `Parameter ${i + 1}: result value must be a number between 1 and 500`;
        }
      }
      return e;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");

    const errs = validate();
    if (errs.some((e) => Object.keys(e).length > 0)) {
      setRowErrors(errs);
      setGlobalError("Please fix the errors below before submitting.");
      return;
    }

    setSaving(true);
    try {
      // Create results sequentially to avoid DB race conditions
      for (const p of params) {
        await createLabResult({
          request:       requestId,
          parameter_name: p.parameter_name.trim(),
          value:          p.value,
          unit:           p.unit || null,
          reference_min:  p.reference_min !== "" ? p.reference_min : null,
          reference_max:  p.reference_max !== "" ? p.reference_max : null,
        });
      }

      // Mark request as COMPLETED
      await updateLabRequest(requestId, { status: "COMPLETED" });

      toast.success("Results saved and test marked as completed.");
      setTimeout(() => navigate("/lab/requests"), 1200);
    } catch (err) {
      const d = err.response?.data;
      if (!err.response) {
        setGlobalError("Unable to connect. Check your network connection.");
      } else if (err.response.status >= 500) {
        setGlobalError("Server error. Please try again.");
      } else {
        setGlobalError(d?.message || "Failed to save results. Check your input and try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
        <div className="py-20 text-center text-slate-400">Loading test details…</div>
      </ModuleLayout>
    );
  }

  // Show locked notice if request is no longer in ORDERED stage
  const isLocked = requestDetails && requestDetails.status !== "ORDERED";

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <PageHeader
        title="Add Lab Results"
        subtitle={`Test Request #${requestId}`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/lab/requests")}>
            ← Back
          </Button>
        }
      />

      {/* Request context */}
      {requestDetails && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-blue-600 text-xs mb-1 font-medium">Appointment ID</p>
            <p className="font-mono font-semibold text-emerald-700">
              {requestDetails.appointment_code || `#${requestDetails.appointment}`}
            </p>
          </div>
          <div>
            <p className="text-blue-600 text-xs mb-1 font-medium">Test Name</p>
            <p className="font-semibold text-slate-800">{requestDetails.lab_test_name || "—"}</p>
          </div>
          <div>
            <p className="text-blue-600 text-xs mb-1 font-medium">Patient</p>
            <p className="font-semibold text-slate-800">{requestDetails.patient_name || "—"}</p>
          </div>
          <div>
            <p className="text-blue-600 text-xs mb-1 font-medium">Doctor</p>
            <p className="font-semibold text-slate-800">{requestDetails.doctor_name || "—"}</p>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700 font-medium">
          Results cannot be added — this request is already{" "}
          <strong>{requestDetails.status}</strong>. Only ORDERED requests accept new results.
        </div>
      )}

      {!isLocked && hasParams && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-4 text-xs text-emerald-700">
          Parameters are auto-filled from the test catalog and are <strong>immutable</strong>.
          Enter the measured result value below for each parameter.
        </div>
      )}
      {!isLocked && !hasParams && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4 text-xs text-amber-700">
          No parameters defined in catalog. Enter result details manually.
        </div>
      )}

      {globalError && (
        <Alert type="error" message={globalError} onClose={() => setGlobalError("")} className="mb-4" />
      )}

      {isLocked ? (
        <div className="flex gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={() => navigate("/lab/requests")}>
            ← Back to Requests
          </Button>
        </div>
      ) : (
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {params.map((param, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700">
                  {hasParams
                    ? `Parameter: ${param.parameter_name}`
                    : `Parameter ${idx + 1}`}
                </h3>
                {!hasParams && params.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setParams((p) => p.filter((_, i) => i !== idx));
                      setRowErrors((e) => e.filter((_, i) => i !== idx));
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {/* Parameter name: read-only if from catalog */}
                {!hasParams && (
                  <Input
                    label="Parameter Name"
                    value={param.parameter_name}
                    onChange={(e) => updateRow(idx, "parameter_name", e.target.value)}
                    error={rowErrors[idx]?.parameter_name}
                    required
                    placeholder="Letters only, 3–15 chars"
                    maxLength={15}
                  />
                )}

                {/* Catalog reference info (read-only display) */}
                {hasParams && (
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                    <div>
                      <span className="font-semibold">Reference Min:</span>{" "}
                      <span className="text-slate-800">{param.reference_min}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Reference Max:</span>{" "}
                      <span className="text-slate-800">{param.reference_max}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Unit:</span>{" "}
                      <span className="text-slate-800">{param.unit || "—"}</span>
                    </div>
                  </div>
                )}

                {/* Result Value (numeric) — renamed from "Numeric Value" */}
                <Input
                  label="Result Value"
                  type="number"
                  step="0.01"
                  value={param.value}
                  onChange={(e) => updateRow(idx, "value", e.target.value)}
                  error={rowErrors[idx]?.value}
                  required
                  placeholder="Enter measured value"
                />

                {/* Per-row error summary */}
                {Object.values(rowErrors[idx] || {}).filter(Boolean).length > 0 && (
                  <ul className="text-red-600 text-xs space-y-1">
                    {Object.values(rowErrors[idx]).filter(Boolean).map((msg, i) => (
                      <li key={i}>• {msg}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}

          {/* Manual add row button (only when no catalog params) */}
          {!hasParams && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setParams((p) => [...p, emptyRow()]);
                setRowErrors((e) => [...e, {}]);
              }}
            >
              + Add Parameter
            </Button>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button type="submit" loading={saving}>Save All Results</Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/lab/requests")}>
            Cancel
          </Button>
        </div>
      </form>
      )}
    </ModuleLayout>
  );
}
