import { useState, useEffect, useCallback } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import {
  Button, Input, Select, PageHeader, StatusBadge, SearchInput,
  ConfirmModal, Modal, Textarea, FormRow
} from "@/components/ui";
import {
  getLabTests, createLabTest, updateLabTest, deleteLabTest,
  activateLabTest, deactivateLabTest,
  getLabParametersByTest, createLabParameter, updateLabParameter, deleteLabParameter
} from "../api/labApi";
import { useToast } from "@/context/ToastContext";
import { FaPlus, FaEdit, FaTrash, FaFlask, FaToggleOn, FaToggleOff, FaEye, FaMinus } from "react-icons/fa";

// ── Validation helpers ────────────────────────────────────────────────────────

const SPECIAL_CHARS = /[$#%&*@!^<>=+|\\\/;:"'`~]/;
const LETTERS_SPACES = /^[A-Za-z ]+$/;
const LETTERS_ONLY   = /^[A-Za-z]+$/;
const CONSECUTIVE    = /(.)\1{3,}/;

function validateTestName(v) {
  if (!v || !v.trim()) return "Test name is required";
  const s = v.trim();
  if (s.length < 3) return "Test name must be at least 3 characters";
  if (s.length > 20) return "Test name cannot exceed 20 characters";
  if (!LETTERS_SPACES.test(s)) return "Test name can only contain letters and spaces";
  if (CONSECUTIVE.test(s)) return "Same character cannot be repeated more than 3 times";
  return "";
}

function validateDescription(v) {
  if (!v) return "";
  const s = v.trim();
  if (!s) return "";
  if (s.length > 100) return "Description cannot exceed 100 characters";
  if (SPECIAL_CHARS.test(s)) return "Enter a valid value";
  if (CONSECUTIVE.test(s)) return "Same character cannot be repeated more than 3 times";
  return "";
}

function validateCharge(v) {
  if (v === "" || v === null || v === undefined) return "Test charge is required";
  const n = Number(v);
  if (isNaN(n) || n === 0) return "Enter a valid non-zero value";
  if (n < 50) return "Test charge must be at least ₹50";
  if (n > 5000) return "Test charge cannot exceed ₹5000";
  return "";
}

function validateParamName(v) {
  if (!v || !v.trim()) return "Parameter name is required";
  const s = v.trim();
  if (s.length < 3) return "Parameter name must be at least 3 characters";
  if (s.length > 15) return "Parameter name cannot exceed 15 characters";
  if (!LETTERS_ONLY.test(s)) return "Parameter name can only contain letters (no spaces or numbers)";
  return "";
}

function validateRefMin(v) {
  if (v === "" || v === null || v === undefined) return "Minimum reference value is required";
  const n = Number(v);
  if (isNaN(n)) return "Enter a valid number";
  if (n < 1) return "Minimum reference value must be at least 1";
  return "";
}

function validateRefMax(v) {
  if (v === "" || v === null || v === undefined) return "Maximum reference value is required";
  const n = Number(v);
  if (isNaN(n)) return "Enter a valid number";
  if (n > 500) return "Maximum reference value cannot exceed 500";
  return "";
}

function validateMinMax(min, max) {
  if (min !== "" && max !== "" && Number(min) >= Number(max)) {
    return "Minimum must be less than maximum";
  }
  return "";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_TEST  = { test_name: "", description: "", test_charge: "", status: "ACTIVE" };
const EMPTY_PARAM = { parameter_name: "", reference_min: "", reference_max: "", unit: "" };

const LAB_UNITS = [
  "g/dL", "mg/dL", "mg/L", "U/L", "IU/L", "mmol/L", "µIU/mL",
  "cells/µL", "%", "mEq/L", "pg/mL", "ng/mL", "µg/dL", "fl", "fmol/cell"
];

export default function LabCatalog() {
  const toast = useToast();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // View modal
  const [viewTarget, setViewTarget]   = useState(null);
  const [viewParams, setViewParams]   = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Add/Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [modalOpen, setModalOpen]   = useState(false);
  const [form, setForm]             = useState(EMPTY_TEST);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]         = useState(false);

  // Parameters (always required — at least 1)
  const [params, setParams]           = useState([{ ...EMPTY_PARAM }]);
  const [paramErrors, setParamErrors] = useState([{}]);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true);
    const p = {};
    if (search) p.search = search;
    if (statusFilter) p.status = statusFilter;
    getLabTests(p)
      .then((r) => {
        const d = r.data.data;
        setTests(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load tests."))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── View modal ────────────────────────────────────────────────────────────────

  const openView = async (t) => {
    setViewTarget(t);
    setViewLoading(true);
    try {
      const r = await getLabParametersByTest(t.lab_test_id);
      const d = r.data.data;
      setViewParams(Array.isArray(d) ? d : d?.results || []);
    } catch {
      setViewParams([]);
    } finally {
      setViewLoading(false);
    }
  };

  // ── Add modal ─────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(EMPTY_TEST);
    setFormErrors({});
    setParams([{ ...EMPTY_PARAM }]);
    setParamErrors([{}]);
    setEditTarget(null);
    setModalOpen(true);
  };

  // ── Edit modal ────────────────────────────────────────────────────────────────

  const openEdit = async (t) => {
    setForm({
      test_name: t.test_name,
      description: t.description || "",
      test_charge: t.test_charge,
      status: t.status,
    });
    setFormErrors({});
    setEditTarget(t);

    try {
      const r = await getLabParametersByTest(t.lab_test_id);
      const d = r.data.data;
      const existing = Array.isArray(d) ? d : d?.results || [];
      if (existing.length > 0) {
        setParams(existing.map((p) => ({
          parameter_id:  p.parameter_id,
          parameter_name: p.parameter_name,
          reference_min:  p.reference_min,
          reference_max:  p.reference_max,
          unit:           p.unit || "",
        })));
        setParamErrors(existing.map(() => ({})));
      } else {
        setParams([{ ...EMPTY_PARAM }]);
        setParamErrors([{}]);
      }
    } catch {
      setParams([{ ...EMPTY_PARAM }]);
      setParamErrors([{}]);
    }

    setModalOpen(true);
  };

  // ── Form change ───────────────────────────────────────────────────────────────

  const changeField = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setFormErrors((p) => ({ ...p, [name]: "" }));
  };

  const changeParam = (idx, field, value) => {
    setParams((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    setParamErrors((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: "" } : e));
  };

  const addParamRow = () => {
    setParams((p) => [...p, { ...EMPTY_PARAM }]);
    setParamErrors((e) => [...e, {}]);
  };

  const removeParamRow = (idx) => {
    if (params.length === 1) {
      toast.error("Each test must have at least one parameter.");
      return;
    }
    setParams((p) => p.filter((_, i) => i !== idx));
    setParamErrors((e) => e.filter((_, i) => i !== idx));
  };

  // ── Validation ────────────────────────────────────────────────────────────────

  const validateForm = () => {
    const errs = {};
    const nameErr   = validateTestName(form.test_name);
    const descErr   = validateDescription(form.description);
    const chargeErr = validateCharge(form.test_charge);
    if (nameErr)   errs.test_name   = nameErr;
    if (descErr)   errs.description = descErr;
    if (chargeErr) errs.test_charge = chargeErr;
    return errs;
  };

  const validateAllParams = () => {
    return params.map((p) => {
      const e = {};
      const nameErr = validateParamName(p.parameter_name);
      const minErr  = validateRefMin(p.reference_min);
      const maxErr  = validateRefMax(p.reference_max);
      const mmErr   = validateMinMax(p.reference_min, p.reference_max);
      if (nameErr) e.parameter_name = nameErr;
      if (minErr)  e.reference_min  = minErr;
      if (maxErr)  e.reference_max  = maxErr;
      if (mmErr)   e.reference_min  = mmErr;
      if (!p.unit) e.unit           = "Unit is required";
      return e;
    });
  };

  // ── Save (sequential param saves to avoid DB integrity errors) ────────────────

  const handleSave = async () => {
    const formErrs  = validateForm();
    const paramErrs = validateAllParams();
    const hasFormErr  = Object.keys(formErrs).length > 0;
    const hasParamErr = paramErrs.some((e) => Object.keys(e).length > 0);

    if (hasFormErr)  setFormErrors(formErrs);
    if (hasParamErr) setParamErrors(paramErrs);
    if (hasFormErr || hasParamErr) return;

    setSaving(true);
    try {
      let testId = editTarget?.lab_test_id;

      if (editTarget) {
        await updateLabTest(testId, {
          test_name:   form.test_name.trim(),
          description: form.description?.trim() || null,
          test_charge: form.test_charge,
          status:      form.status,
        });
        toast.success("Test updated successfully.");
      } else {
        const res = await createLabTest({
          test_name:   form.test_name.trim(),
          description: form.description?.trim() || null,
          test_charge: form.test_charge,
          status:      form.status,
        });
        testId = res.data.data?.lab_test_id;
        toast.success("Test created successfully.");
      }

      // --- Manage parameters (sequential to avoid unique constraint races) ---
      const existingIds = params.filter((p) => p.parameter_id).map((p) => p.parameter_id);

      if (editTarget) {
        // Delete parameters removed from the form
        const r = await getLabParametersByTest(testId);
        const d = r.data.data;
        const serverParams = Array.isArray(d) ? d : d?.results || [];
        const toDelete = serverParams.filter((sp) => !existingIds.includes(sp.parameter_id));
        for (const sp of toDelete) {
          await deleteLabParameter(sp.parameter_id);
        }
      }

      // Upsert parameters sequentially to avoid race conditions
      for (const p of params) {
        const payload = {
          lab_test:      testId,
          parameter_name: p.parameter_name.trim(),
          reference_min:  p.reference_min,
          reference_max:  p.reference_max,
          unit:           p.unit,
        };
        if (p.parameter_id) {
          await updateLabParameter(p.parameter_id, payload);
        } else {
          await createLabParameter(payload);
        }
      }

      setModalOpen(false);
      load();
    } catch (e) {
      const d = e.response?.data;
      if (d?.errors) {
        setFormErrors(d.errors);
      } else {
        toast.error(d?.message || "Save failed. Please check your input.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active/inactive ────────────────────────────────────────────────────

  const handleToggle = async (t) => {
    try {
      if (t.status === "ACTIVE") {
        await deactivateLabTest(t.lab_test_id);
        toast.success(`"${t.test_name}" deactivated.`);
      } else {
        await activateLabTest(t.lab_test_id);
        toast.success(`"${t.test_name}" activated.`);
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Toggle failed.");
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLabTest(deleteTarget.lab_test_id);
      toast.success("Test deleted successfully.");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <PageHeader
        title="Test Catalog"
        subtitle="Manage available lab tests and their parameters"
        actions={<Button onClick={openAdd}><FaPlus /> Add Test</Button>}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search test name or code…" />
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-40"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
        ) : tests.length === 0 ? (
          <div className="py-16 text-center">
            <FaFlask className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No tests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Test Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Parameters</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Charge (₹)</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tests.map((t) => (
                  <tr key={t.lab_test_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{t.lab_test_code}</td>
                    <td className="px-4 py-3 font-medium">{t.test_name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {t.parameters?.length > 0
                        ? `${t.parameters.length} param${t.parameters.length > 1 ? "s" : ""}`
                        : <span className="text-amber-500 italic text-xs font-medium">None — add params</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold">₹{Number(t.test_charge).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="xs" onClick={() => openView(t)} title="View">
                          <FaEye />
                        </Button>
                        <Button variant="outline" size="xs" onClick={() => openEdit(t)} title="Edit">
                          <FaEdit />
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleToggle(t)}
                          title={t.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        >
                          {t.status === "ACTIVE"
                            ? <FaToggleOn className="text-green-600" />
                            : <FaToggleOff className="text-slate-400" />}
                        </Button>
                        <Button variant="outline-danger" size="xs" onClick={() => setDeleteTarget(t)} title="Delete">
                          <FaTrash />
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

      {/* ── View Modal ── */}
      <Modal
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={`Test Details — ${viewTarget?.test_name || ""}`}
        size="md"
        footer={<Button onClick={() => setViewTarget(null)}>Close</Button>}
      >
        {viewTarget && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1">Code</p>
                <p className="font-mono font-semibold text-blue-600">{viewTarget.lab_test_code}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Status</p>
                <StatusBadge status={viewTarget.status} />
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Charge</p>
                <p className="font-semibold">₹{Number(viewTarget.test_charge).toFixed(2)}</p>
              </div>
            </div>

            {viewTarget.description && (
              <div>
                <p className="text-slate-500 text-xs mb-1">Description</p>
                <p className="text-slate-700 bg-slate-50 rounded-lg p-3">{viewTarget.description}</p>
              </div>
            )}

            <div>
              <p className="text-slate-500 text-xs mb-2 font-semibold">Parameters</p>
              {viewLoading ? (
                <p className="text-slate-400 text-xs">Loading parameters…</p>
              ) : viewParams.length === 0 ? (
                <p className="text-amber-600 text-xs">No parameters defined.</p>
              ) : (
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Parameter</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Ref Min</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Ref Max</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewParams.map((p) => (
                      <tr key={p.parameter_id}>
                        <td className="px-3 py-2 font-medium">{p.parameter_name}</td>
                        <td className="px-3 py-2">{p.reference_min}</td>
                        <td className="px-3 py-2">{p.reference_max}</td>
                        <td className="px-3 py-2 text-slate-500">{p.unit || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add/Edit Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `Edit: ${editTarget.test_name}` : "Add Lab Test"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editTarget ? "Save Changes" : "Create Test"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Test Name"
            name="test_name"
            value={form.test_name}
            onChange={changeField}
            error={formErrors.test_name}
            required
            placeholder="Letters and spaces only (3–20 chars)"
            maxLength={20}
          />

          <Textarea
            label="Description (optional, max 100 chars)"
            name="description"
            value={form.description}
            onChange={changeField}
            error={formErrors.description}
            rows={2}
            maxLength={100}
            placeholder="Brief description — no special characters"
          />

          <FormRow>
            <Input
              label="Test Charge (₹)"
              name="test_charge"
              type="number"
              step="0.01"
              min="50"
              max="5000"
              value={form.test_charge}
              onChange={changeField}
              error={formErrors.test_charge}
              required
              placeholder="50 – 5000"
            />
            <Select label="Status" name="status" value={form.status} onChange={changeField}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </FormRow>

          {/* Parameters — always required, at least 1 */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="font-semibold text-slate-700 text-sm">Parameters</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each test must have at least one parameter. Letters only, 3–15 chars.
                  Reference range: Min ≥ 1, Max ≤ 500, Min &lt; Max.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addParamRow}>
                <FaPlus /> Add
              </Button>
            </div>

            <div className="space-y-3">
              {params.map((p, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-600">Parameter {idx + 1}</span>
                    {params.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeParamRow(idx)}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                      >
                        <FaMinus /> Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Input
                      label="Parameter Name"
                      value={p.parameter_name}
                      onChange={(e) => changeParam(idx, "parameter_name", e.target.value)}
                      error={paramErrors[idx]?.parameter_name}
                      placeholder="e.g., Haemoglobin"
                      maxLength={15}
                      required
                    />
                    <Select
                      label="Unit"
                      value={p.unit}
                      onChange={(e) => changeParam(idx, "unit", e.target.value)}
                      error={paramErrors[idx]?.unit}
                      required
                    >
                      <option value="">— Select unit —</option>
                      {LAB_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Reference Min (≥ 1)"
                      type="number"
                      step="0.01"
                      min="1"
                      value={p.reference_min}
                      onChange={(e) => changeParam(idx, "reference_min", e.target.value)}
                      error={paramErrors[idx]?.reference_min}
                      placeholder="e.g., 12"
                      required
                    />
                    <Input
                      label="Reference Max (≤ 500)"
                      type="number"
                      step="0.01"
                      max="500"
                      value={p.reference_max}
                      onChange={(e) => changeParam(idx, "reference_max", e.target.value)}
                      error={paramErrors[idx]?.reference_max}
                      placeholder="e.g., 16"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formErrors.non_field_errors && (
            <p className="text-red-600 text-sm">{formErrors.non_field_errors}</p>
          )}
          {formErrors.error && (
            <p className="text-red-600 text-sm">{formErrors.error}</p>
          )}
        </div>
      </Modal>

      {/* ── Delete Confirmation ── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Lab Test"
        message={`Delete "${deleteTarget?.test_name}"? This cannot be undone.`}
      />
    </ModuleLayout>
  );
}
