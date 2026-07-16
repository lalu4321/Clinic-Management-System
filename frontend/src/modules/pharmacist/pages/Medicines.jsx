import { useState, useEffect, useCallback } from "react";
import PharmacistLayout from "../components/Layout";
import {
  Button, StatusBadge, SearchInput, Select,
  PageHeader, Modal, Input, FormRow, ConfirmModal,
} from "@/components/ui";
import {
  getMedicines, createMedicine, updateMedicine,
  deleteMedicine, activateMedicine, deactivateMedicine,
  getMedicineDosages, createMedicineDosage, deleteMedicineDosage,
} from "../api/pharmacistApi";
import { useToast } from "@/context/ToastContext";
import {
  validateMedicineName,
  validateCompanyName,
  validateGenericName,
} from "@/utils/validation";
import { FaPills, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaChevronDown, FaChevronUp } from "react-icons/fa";

const EMPTY = { med_name: "", company_name: "", generic_name: "", status: "ACTIVE" };

// Regex that matches the backend MedicineDosage.clean() validator.
// Examples that pass: 5mg, 500mg, 10mcg, 5ml, 1g, 10IU, 5units, 2.5mg
const DOSAGE_FORMAT_RE = /^\d+(\.\d+)?(mg|mcg|g|ml|%|IU|units?)$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Dosage panel — expanded inline below a medicine row in the table.
// This panel lets pharmacists manage dosages outside of the modal (post-save).
// ─────────────────────────────────────────────────────────────────────────────
function DosagePanel({ medicine, toast }) {
  const [dosages, setDosages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getMedicineDosages({ medicine: medicine.med_id })
      .then((r) => {
        const d = r.data.data;
        setDosages(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load dosages."))
      .finally(() => setLoading(false));
  }, [medicine.med_id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const v = newValue.trim();
    if (!v) { setAddError("Dosage value is required."); return; }
    if (!DOSAGE_FORMAT_RE.test(v)) {
      setAddError("Invalid format. Examples: 500mg, 10mcg, 5ml. Must start with a number followed by a unit.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      await createMedicineDosage({ medicine: medicine.med_id, dosage_value: v });
      toast.success(`Dosage "${v}" added.`);
      setNewValue("");
      load();
    } catch (e) {
      const msg =
        e.response?.data?.errors?.dosage_value?.[0] ||
        e.response?.data?.errors?.non_field_errors?.[0] ||
        e.response?.data?.message ||
        "Failed to add dosage.";
      setAddError(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMedicineDosage(deleteTarget.dosage_id);
      toast.success(`Dosage "${deleteTarget.dosage_value}" removed.`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to delete dosage.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <tr>
      <td colSpan={6} className="px-6 pb-4 bg-slate-50 border-b border-slate-200">
        <div className="pt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Allowed Dosages for <span className="text-clinical-primary">{medicine.med_name}</span>
          </p>

          {loading ? (
            <p className="text-xs text-slate-400">Loading dosages…</p>
          ) : (
            <div className="flex flex-wrap gap-2 mb-3">
              {dosages.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  No dosages configured — doctors will see an empty dropdown for this medicine.
                </p>
              ) : (
                dosages.map((d) => (
                  <span
                    key={d.dosage_id}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {d.dosage_value}
                    <button
                      onClick={() => setDeleteTarget(d)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title={`Remove ${d.dosage_value}`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          )}

          {/* Add new dosage */}
          <div className="flex items-start gap-2 max-w-sm">
            <div className="flex-1">
              <input
                type="text"
                value={newValue}
                onChange={(e) => { setNewValue(e.target.value); setAddError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="e.g. 500mg, 10mcg, 5ml"
                maxLength={20}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-primary ${
                  addError ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"
                }`}
              />
              {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
              <p className="text-xs text-slate-400 mt-1">
                Format: number + unit (mg, mcg, g, ml, IU). Press Enter or click Add.
              </p>
            </div>
            <Button size="sm" onClick={handleAdd} loading={adding}>
              <FaPlus className="mr-1" /> Add
            </Button>
          </div>
        </div>

        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
          title="Remove Dosage"
          message={`Remove dosage "${deleteTarget?.dosage_value}" from ${medicine.med_name}? Existing prescriptions using this value are not affected.`}
        />
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function Medicines() {
  const toast = useToast();

  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Which medicine row has the dosage panel expanded
  const [expandedDosage, setExpandedDosage] = useState(null);

  // ── Dosage state for the Add / Edit modal ──────────────────────────────────
  // dosageInputs  : array of string values the user is typing for NEW dosages
  // existingDosages: loaded from API for edit — {dosage_id, dosage_value, pendingDelete}
  const [dosageInputs, setDosageInputs] = useState([""]);
  const [existingDosages, setExistingDosages] = useState([]);
  const [dosageError, setDosageError] = useState("");
  const [loadingDosages, setLoadingDosages] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    getMedicines(params)
      .then((r) => {
        const d = r.data.data;
        setMedicines(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load medicines."))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Modal open helpers ─────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(EMPTY);
    setFormErrors({});
    setEditTarget(null);
    setDosageInputs([""]);   // start with one blank row
    setExistingDosages([]);
    setDosageError("");
    setModalOpen(true);
  };

  const openEdit = async (m) => {
    setForm({
      med_name:     m.med_name,
      company_name: m.company_name,
      generic_name: m.generic_name,
      status:       m.status,
    });
    setFormErrors({});
    setEditTarget(m);
    setDosageInputs([""]);  // new-dosage input row starts empty
    setDosageError("");
    setLoadingDosages(true);
    setModalOpen(true);
    try {
      const r = await getMedicineDosages({ medicine: m.med_id });
      const d = r.data.data;
      const list = Array.isArray(d) ? d : d?.results || [];
      setExistingDosages(list.map((d) => ({ ...d, pendingDelete: false })));
    } catch {
      toast.error("Failed to load existing dosages.");
      setExistingDosages([]);
    } finally {
      setLoadingDosages(false);
    }
  };

  // ── Dosage input handlers ──────────────────────────────────────────────────

  const addDosageInput = () => {
    setDosageInputs((p) => [...p, ""]);
  };

  const removeDosageInput = (idx) => {
    setDosageInputs((p) => p.filter((_, i) => i !== idx));
    setDosageError("");
  };

  const updateDosageInput = (idx, val) => {
    setDosageInputs((p) => p.map((v, i) => (i === idx ? val : v)));
    setDosageError("");
  };

  // Toggle the pending-delete flag for an existing dosage in the edit modal.
  const togglePendingDelete = (dosageId) => {
    setExistingDosages((p) =>
      p.map((d) => (d.dosage_id === dosageId ? { ...d, pendingDelete: !d.pendingDelete } : d))
    );
    setDosageError("");
  };

  // ── Dosage validation ──────────────────────────────────────────────────────

  const validateDosages = () => {
    const keepExisting  = existingDosages.filter((d) => !d.pendingDelete).length;
    const newDosages    = dosageInputs.filter((v) => v.trim());

    // At least one dosage must remain / be created
    if (keepExisting + newDosages.length === 0) {
      setDosageError("At least one dosage is required.");
      return false;
    }

    // Validate format of every new dosage value
    for (const v of newDosages) {
      if (!DOSAGE_FORMAT_RE.test(v.trim())) {
        setDosageError(
          `"${v.trim()}" has an invalid format. Examples: 500mg, 10mcg, 5ml. ` +
          "Must start with a number followed by a unit (mg, mcg, g, ml, IU)."
        );
        return false;
      }
    }

    return true;
  };

  // ── Field change handler ───────────────────────────────────────────────────

  const change = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    setFormErrors((p) => ({ ...p, [e.target.name]: "" }));
  };

  const validate = () => {
    const errs = {};
    const medNameErr  = validateMedicineName(form.med_name);
    if (medNameErr)  errs.med_name = medNameErr;
    const companyErr  = validateCompanyName(form.company_name);
    if (companyErr)  errs.company_name = companyErr;
    const genericErr  = validateGenericName(form.generic_name);
    if (genericErr)  errs.generic_name = genericErr;
    return errs;
  };

  // ── Save handler ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    // 1. Validate metadata fields
    const errs = validate();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    // 2. Validate dosages (required for both create and edit)
    if (!validateDosages()) return;

    setSaving(true);
    try {
      const payload = {
        med_name:     form.med_name.trim(),
        company_name: form.company_name.trim(),
        generic_name: form.generic_name.trim(),
        status:       form.status,
      };

      if (editTarget) {
        // ── Edit: update metadata, delete marked, add new ────────────────
        await updateMedicine(editTarget.med_id, payload);

        for (const d of existingDosages.filter((d) => d.pendingDelete)) {
          try { await deleteMedicineDosage(d.dosage_id); } catch { /* already gone */ }
        }

        for (const v of dosageInputs.filter((v) => v.trim())) {
          try {
            await createMedicineDosage({ medicine: editTarget.med_id, dosage_value: v.trim() });
          } catch { /* duplicate — skip silently */ }
        }

        toast.success("Medicine updated successfully.");
      } else {
        // ── Create: medicine first, then dosages ─────────────────────────
        const res    = await createMedicine(payload);
        const newId  = res.data?.data?.med_id;

        const toCreate = dosageInputs.filter((v) => v.trim());
        let failures   = 0;

        for (const v of toCreate) {
          try {
            await createMedicineDosage({ medicine: newId, dosage_value: v.trim() });
          } catch {
            failures++;
          }
        }

        if (failures > 0) {
          toast.warning(
            `Medicine created, but ${failures} dosage(s) could not be saved. ` +
            "Use the Dosages panel to re-add them."
          );
        } else {
          toast.success(
            `Medicine created with ${toCreate.length} dosage${toCreate.length !== 1 ? "s" : ""}.`
          );
        }
      }

      setModalOpen(false);
      load();
    } catch (e) {
      const d = e.response?.data;
      if (d?.errors && typeof d.errors === "object") {
        setFormErrors(d.errors);
      } else {
        toast.error(d?.message || "Failed to save medicine.");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Activate / Deactivate ──────────────────────────────────────────────────

  const handleToggle = async (m) => {
    try {
      if (m.status === "ACTIVE") {
        await deactivateMedicine(m.med_id);
        toast.info(`"${m.med_name}" deactivated.`);
      } else {
        await activateMedicine(m.med_id);
        toast.success(`"${m.med_name}" activated.`);
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Status change failed.");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMedicine(deleteTarget.med_id);
      toast.success(`"${deleteTarget.med_name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const toggleDosage = (medId) => {
    setExpandedDosage((prev) => (prev === medId ? null : medId));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PharmacistLayout>
      <PageHeader
        title="Medicines"
        subtitle="Manage medicine catalog and dosage options"
        actions={<Button onClick={openAdd}><FaPlus /> Add Medicine</Button>}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-xs text-blue-700">
        <strong>Dosage Setup:</strong> Dosages are configured <strong>during medicine creation</strong>.
        You can also add, edit, or remove dosages at any time using the{" "}
        <strong>Dosages</strong> button in the table.
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search medicine..." />
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : medicines.length === 0 ? (
          <div className="py-16 text-center">
            <FaPills className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No medicines found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Medicine Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Company</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Generic Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((m) => (
                  <>
                    <tr key={m.med_id} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">{m.medicine_code}</td>
                      <td className="px-4 py-3 font-medium">{m.med_name}</td>
                      <td className="px-4 py-3 text-slate-600">{m.company_name}</td>
                      <td className="px-4 py-3 text-slate-600">{m.generic_name}</td>
                      <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {/* Dosage panel toggle */}
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => toggleDosage(m.med_id)}
                            title="Manage dosages"
                            className={expandedDosage === m.med_id ? "border-clinical-primary text-clinical-primary" : ""}
                          >
                            {expandedDosage === m.med_id
                              ? <><FaChevronUp className="mr-1" /> Dosages</>
                              : <><FaChevronDown className="mr-1" /> Dosages</>
                            }
                          </Button>
                          <Button variant="outline" size="xs" onClick={() => openEdit(m)}>
                            <FaEdit />
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => handleToggle(m)}
                            title={m.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          >
                            {m.status === "ACTIVE"
                              ? <FaToggleOn className="text-green-600" />
                              : <FaToggleOff className="text-slate-400" />
                            }
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="xs"
                            onClick={() => setDeleteTarget(m)}
                          >
                            <FaTrash />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {/* Inline dosage panel — rendered as a second row */}
                    {expandedDosage === m.med_id && (
                      <DosagePanel key={`dosage-${m.med_id}`} medicine={m} toast={toast} />
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Edit Medicine" : "Add Medicine"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {editTarget ? "Save" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* ── Medicine metadata ──────────────────────────────────────── */}
          <Input
            label="Medicine Name"
            name="med_name"
            value={form.med_name}
            onChange={change}
            error={formErrors.med_name}
            required
            placeholder="e.g. Paracetamol"
            maxLength={20}
          />
          <FormRow>
            <Input
              label="Company Name"
              name="company_name"
              value={form.company_name}
              onChange={change}
              error={formErrors.company_name}
              required
              placeholder="e.g. Sun Pharma"
              maxLength={20}
            />
            <Input
              label="Generic Name"
              name="generic_name"
              value={form.generic_name}
              onChange={change}
              error={formErrors.generic_name}
              required
              placeholder="e.g. Acetaminophen"
              maxLength={20}
            />
          </FormRow>
          <Select
            label="Status"
            name="status"
            value={form.status}
            onChange={change}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>

          {/* ── Dosages ───────────────────────────────────────────────── */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Dosage Options
                <span className="ml-1 text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-slate-400">
                  (at least one required)
                </span>
              </span>
              <Button type="button" variant="outline" size="xs" onClick={addDosageInput}>
                <FaPlus className="mr-1" /> Add Row
              </Button>
            </div>

            {dosageError && (
              <p className="text-xs text-red-600 mb-2">{dosageError}</p>
            )}

            {/* Existing dosages — only shown in edit mode */}
            {editTarget && (
              loadingDosages ? (
                <p className="text-xs text-slate-400 mb-3">Loading existing dosages…</p>
              ) : existingDosages.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1.5">Existing dosages:</p>
                  <div className="flex flex-wrap gap-2">
                    {existingDosages.map((d) => (
                      <span
                        key={d.dosage_id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          d.pendingDelete
                            ? "bg-red-50 border-red-300 text-red-500 line-through"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        {d.dosage_value}
                        <button
                          type="button"
                          onClick={() => togglePendingDelete(d.dosage_id)}
                          className={`transition-colors ${
                            d.pendingDelete
                              ? "text-red-400 hover:text-green-600"
                              : "text-slate-400 hover:text-red-500"
                          }`}
                          title={d.pendingDelete ? "Undo remove" : "Mark for removal"}
                        >
                          {d.pendingDelete ? "↺" : "×"}
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Click × to mark a dosage for removal. Click ↺ to undo.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3">
                  No dosages configured yet — add at least one below.
                </p>
              )
            )}

            {/* New dosage input rows */}
            {dosageInputs.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => updateDosageInput(idx, e.target.value)}
                  placeholder="e.g. 500mg, 10mcg, 5ml"
                  maxLength={20}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-primary ${
                    dosageError && !val.trim()
                      ? "border-red-400 bg-red-50"
                      : "border-slate-300 bg-white"
                  }`}
                />
                {dosageInputs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeDosageInput(idx)}
                    className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none"
                    title="Remove this row"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <p className="text-xs text-slate-400 mt-1">
              Format: number + unit (mg, mcg, g, ml, IU). E.g. 500mg, 10mcg, 5ml, 1g.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Medicine"
        message={`Delete "${deleteTarget?.med_name}"? This cannot be undone.`}
      />
    </PharmacistLayout>
  );
}
