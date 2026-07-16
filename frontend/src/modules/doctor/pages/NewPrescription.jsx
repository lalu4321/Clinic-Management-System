import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DoctorLayout from "../components/Layout";
import { Button, Input, Textarea, PageHeader } from "@/components/ui";
import { AutoSuggest } from "@/components/ui/AutoSuggest";
import { useToast } from "@/context/ToastContext";
import {
  createPrescriptionWithItems, createLabRequest,
  getMedicines, getActiveLabTests, getDoctorAppointments,
} from "../api/doctorApi";

// ── Constants ────────────────────────────────────────────
const FREQUENCY_OPTIONS = [
  { value: "1-0-1", label: "1-0-1  (Morning & Night)" },
  { value: "1-1-1", label: "1-1-1  (Morning, Afternoon & Night)" },
  { value: "1-1-0", label: "1-1-0  (Morning & Afternoon)" },
  { value: "0-1-1", label: "0-1-1  (Afternoon & Night)" },
  { value: "1-0-0", label: "1-0-0  (Morning only)" },
  { value: "0-1-0", label: "0-1-0  (Afternoon only)" },
  { value: "0-0-1", label: "0-0-1  (Night only)" },
];

// No static dosage list — dosage options are fetched per-medicine from the API.

// Duration options in days (1–30)
const DURATION_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Count total doses per day from a frequency string like "1-0-1" */
function dosesPerDay(frequency) {
  if (!frequency) return 0;
  return frequency.split("-").reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);
}

const CLINICAL_PATTERN = /^[A-Za-z\s.,()]+$/;

const EMPTY_MEDICINE = { medicine: "", dosage: "", frequency: "", duration: "", quantity: "" };
const EMPTY_LAB = { lab_test: "", notes: "" };

// ── Inline validation helpers ────────────────────────────

function validateClinicalText(value, fieldName) {
  const v = (value || "").trim();
  if (!v) return `${fieldName} is required.`;
  if (v.length < 3) return `${fieldName} must be at least 3 characters.`;
  if (v.length > 100) return `${fieldName} must not exceed 100 characters.`;
  if (!CLINICAL_PATTERN.test(v))
    return `${fieldName} may only contain letters, spaces, '.', ',', '(', ')'.`;
  if (!/[A-Za-z]/.test(v))
    return `${fieldName} must contain at least one letter.`;
  if (/(.)\1{3,}/.test(v))
    return `${fieldName} cannot contain the same character repeated 4+ times.`;
  return null;
}

function validateDosage(value) {
  const v = (value || "").trim();
  if (!v) return "Dosage is required.";
  return null;
}

function validateQuantity(value, availableQty = null) {
  const n = Number(value);
  if (!value && value !== 0) return "Quantity is required.";
  if (isNaN(n) || !Number.isInteger(n)) return "Quantity must be a whole number.";
  if (n < 1) return "Quantity must be at least 1.";
  if (n > 100) return "Quantity must not exceed 100.";
  if (availableQty !== null && n > availableQty) {
    return `Only ${availableQty} unit${availableQty === 1 ? "" : "s"} available in stock.`;
  }
  return null;
}

function validateNotes(value) {
  const v = (value || "").trim();
  if (!v) return null; // optional
  if (v.length < 3) return "Notes must be at least 3 characters.";
  if (v.length > 50) return "Notes must not exceed 50 characters.";
  return null;
}

// ── Component ────────────────────────────────────────────

export default function NewPrescription() {
  const [searchParams] = useSearchParams();
  const preAppt = searchParams.get("appointment");

  const [appointments, setAppointments] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [form, setForm] = useState({ appointment: preAppt || "", symptoms: "", diagnosis: "" });
  const [medItems, setMedItems] = useState([{ ...EMPTY_MEDICINE }]);
  const [labItems, setLabItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // Redirect if accessed without an appointment
  useEffect(() => {
    if (!preAppt) {
      navigate("/doctor/appointments", { replace: true });
    }
  }, [preAppt, navigate]);

  useEffect(() => {
    if (!preAppt) return;
    Promise.all([getDoctorAppointments(), getMedicines(), getActiveLabTests()])
      .then(([aRes, mRes, lRes]) => {
        const ad = aRes.data.data;
        const md = mRes.data.data;
        const ld = lRes.data.data;
        setAppointments(Array.isArray(ad) ? ad.filter(a => a.status === "SCHEDULED") : []);
        // Keep full medicine objects so available_quantity is accessible
        setMedicines(Array.isArray(md) ? md : md?.results || []);
        setLabTests(Array.isArray(ld) ? ld : ld?.results || []);
      })
      .catch(() => toast.error("Failed to load form data. Please refresh the page."));
  }, [preAppt]);

  const selectedAppointment = appointments.find(
    (a) => String(a.appointment_id) === String(preAppt)
  );

  const changeForm = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  // ── Helper: get available stock for a given medicine id ──────────────────────
  const getAvailableQty = (medId) => {
    if (!medId) return null;
    const med = medicines.find((m) => String(m.med_id) === String(medId));
    return med ? (med.available_quantity ?? null) : null;
  };

  // ── Helper: get dosage options configured for a given medicine id ─────────
  // Returns an array of { dosage_id, dosage_value } objects, or [] if none.
  const getDosageOptions = (medId) => {
    if (!medId) return [];
    const med = medicines.find((m) => String(m.med_id) === String(medId));
    return med?.dosage_options || [];
  };

  // ── Medicine row handlers ────────────────────────────
  const updateMed = (idx, field, val) => {
    setMedItems((p) => {
      const newRow = { ...p[idx], [field]: val };

      // When medicine changes: clear dosage selection (it's medicine-specific)
      if (field === "medicine") {
        newRow.dosage = "";
      }

      // Auto-calculate quantity = doses_per_day × duration_days
      // Fires whenever frequency OR duration changes so the doctor
      // only needs to pick those two fields for quantity to self-populate.
      if (field === "frequency" || field === "duration") {
        const freq = field === "frequency" ? val : p[idx].frequency;
        const dur  = field === "duration"  ? val : p[idx].duration;
        if (freq && dur) {
          const dpd      = dosesPerDay(freq);
          const durDays  = parseInt(dur, 10);
          if (dpd > 0 && durDays > 0) {
            newRow.quantity = String(dpd * durDays);
          }
        }
      }

      return p.map((m, i) => i === idx ? newRow : m);
    });

    const key = `med_${idx}_${field}`;
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
    if (errors[`med_dup_${idx}`]) setErrors((p) => ({ ...p, [`med_dup_${idx}`]: undefined }));

    // Live stock check when medicine selection changes (quantity is auto-calculated)
    if (field === "medicine") {
      setMedItems((prev) => {
        const row   = prev[idx];
        const medId = val;
        const qty   = row.quantity;
        const avail = getAvailableQty(medId);
        const qErr  = qty !== "" ? validateQuantity(qty, avail) : null;
        setErrors((errs) => {
          const next = { ...errs };
          if (qErr) { next[`med_${idx}_quantity`] = qErr; }
          else       { delete next[`med_${idx}_quantity`]; }
          return next;
        });
        return prev;
      });
    }
  };
  const addMed = () => setMedItems((p) => [...p, { ...EMPTY_MEDICINE }]);
  const removeMed = (idx) => {
    setMedItems((p) => p.filter((_, i) => i !== idx));
    // Clear errors for removed row and re-index (simplest: clear all med errors)
    setErrors((p) => {
      const cleaned = { ...p };
      Object.keys(cleaned).forEach(k => {
        if (k.startsWith("med_")) delete cleaned[k];
      });
      return cleaned;
    });
  };

  // ── Lab test row handlers ────────────────────────────
  const updateLab = (idx, field, val) => {
    setLabItems((p) => p.map((l, i) => i === idx ? { ...l, [field]: val } : l));
    const key = `lab_${idx}_${field}`;
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
    if (errors[`lab_dup_${idx}`]) setErrors((p) => ({ ...p, [`lab_dup_${idx}`]: undefined }));
  };
  const addLab = () => setLabItems((p) => [...p, { ...EMPTY_LAB }]);
  const removeLab = (idx) => {
    setLabItems((p) => p.filter((_, i) => i !== idx));
    setErrors((p) => {
      const cleaned = { ...p };
      Object.keys(cleaned).forEach(k => {
        if (k.startsWith("lab_")) delete cleaned[k];
      });
      return cleaned;
    });
  };

  // ── Full frontend validation ─────────────────────────
  const runValidation = () => {
    const newErrors = {};

    if (!form.appointment) newErrors.appointment = "Appointment is required.";

    const sympErr = validateClinicalText(form.symptoms, "Symptoms");
    if (sympErr) newErrors.symptoms = sympErr;

    const diagErr = validateClinicalText(form.diagnosis, "Diagnosis");
    if (diagErr) newErrors.diagnosis = diagErr;

    // At least one medicine row must be filled
    const filledMeds = medItems.filter((m) => m.medicine);
    if (filledMeds.length === 0) {
      newErrors.medicines = "At least one medicine is required.";
    }

    // Duplicate medicine check
    const seenMedIds = {};
    medItems.forEach((m, idx) => {
      if (!m.medicine) return;
      if (seenMedIds[m.medicine] !== undefined) {
        newErrors[`med_dup_${idx}`] = "This medicine is already added.";
        newErrors[`med_dup_${seenMedIds[m.medicine]}`] = "This medicine is already added.";
      } else {
        seenMedIds[m.medicine] = idx;
      }
    });

    // Per-medicine field validation (includes stock check)
    medItems.forEach((m, idx) => {
      if (!m.medicine) return; // only validate rows with a medicine selected
      const dosageErr = validateDosage(m.dosage);
      if (dosageErr) newErrors[`med_${idx}_dosage`] = dosageErr;
      if (!m.frequency) newErrors[`med_${idx}_frequency`] = "Frequency is required.";
      if (!m.duration) newErrors[`med_${idx}_duration`] = "Duration is required.";
      const avail = getAvailableQty(m.medicine);
      const qErr  = validateQuantity(m.quantity, avail);
      if (qErr) newErrors[`med_${idx}_quantity`] = qErr;
    });

    // Duplicate lab test check
    const seenLabIds = {};
    labItems.forEach((l, idx) => {
      if (!l.lab_test) return;
      if (seenLabIds[l.lab_test] !== undefined) {
        newErrors[`lab_dup_${idx}`] = "Lab test already added.";
        newErrors[`lab_dup_${seenLabIds[l.lab_test]}`] = "Lab test already added.";
      } else {
        seenLabIds[l.lab_test] = idx;
      }
    });

    // Per-lab notes validation
    labItems.forEach((l, idx) => {
      if (!l.lab_test) return;
      const notesErr = validateNotes(l.notes);
      if (notesErr) newErrors[`lab_${idx}_notes`] = notesErr;
    });

    return newErrors;
  };

  // ── IST time guard: block submission before appointment time ────────────────
  const isConsultationAllowed = () => {
    if (!selectedAppointment) return true; // let the backend catch it
    try {
      const now = new Date();
      const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
      const [h, m] = String(selectedAppointment.appointment_time).split(":").map(Number);
      return currentMinutes >= h * 60 + m;
    } catch {
      return true; // fail open; backend is the authoritative guard
    }
  };

  // ── Submit handler ───────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    // ── Frontend time guard ──────────────────────────
    if (!isConsultationAllowed()) {
      toast.error("Consultation cannot start before scheduled time.");
      setSaving(false);
      return;
    }

    const validationErrors = runValidation();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSaving(false);
      toast.error("Please fix the validation errors before submitting.");
      return;
    }

    try {
      // Single atomic call: prescription + all medicine items are created together.
      // If ANY medicine fails validation the backend rolls back the entire transaction
      // — no orphaned DRAFT prescription is left in the database.
      await createPrescriptionWithItems({
        appointment: form.appointment,
        symptoms:    form.symptoms,
        diagnosis:   form.diagnosis,
        medicines: medItems
          .filter((m) => m.medicine && m.dosage && m.frequency && m.quantity)
          .map((m) => ({
            medicine:  m.medicine,
            dosage:    m.dosage.trim(),
            frequency: m.frequency,
            quantity:  Number(m.quantity),
          })),
      });

      // Lab requests are independent of the prescription — add them after.
      for (const l of labItems) {
        if (l.lab_test) {
          await createLabRequest({
            appointment: form.appointment,
            lab_test: l.lab_test,
            notes: (l.notes || "").trim(),
          });
        }
      }

      toast.success("Prescription created successfully.");
      setTimeout(() => navigate("/doctor/appointments"), 1500);
    } catch (err) {
      const d = err.response?.data;
      const httpStatus = err.response?.status;

      if (!err.response) {
        toast.error("Unable to connect to server. Check your network connection.");
        return;
      }

      if (httpStatus >= 500) {
        toast.error("Server error. Please try again later.");
        return;
      }

      const errs = d?.errors || {};

      // ── Medicine-row errors: backend returns { medicines: { "0": { quantity: [...] } } }
      const medicineRowErrors = errs.medicines;
      if (medicineRowErrors && typeof medicineRowErrors === "object") {
        const newErrors = {};

        // Map each row index back to the visible medicine row.
        // The backend index is the position inside the filtered medicines array;
        // we need to find the matching position in medItems (which may have blanks).
        const filledIndices = medItems.reduce((acc, m, i) => {
          if (m.medicine && m.dosage && m.frequency && m.quantity) acc.push(i);
          return acc;
        }, []);

        Object.entries(medicineRowErrors).forEach(([backendIdx, fieldErrors]) => {
          const originalIdx = filledIndices[parseInt(backendIdx)] ?? parseInt(backendIdx);
          const extract = (v) => (v ? (Array.isArray(v) ? v[0] : String(v)) : null);
          // quantity = stock reservation error (from serializer)
          // medicine = stock error (from view's perform_create) or duplicate
          const msg =
            extract(fieldErrors.quantity) ||
            extract(fieldErrors.medicine) ||
            extract(fieldErrors.non_field_errors) ||
            extract(fieldErrors.dosage) ||
            extract(fieldErrors.frequency) ||
            d?.message ||
            "Invalid medicine data.";
          newErrors[`med_${originalIdx}_quantity`] = msg;
        });

        setErrors(newErrors);
        // Prefer the specific per-row message over the generic d.message
        const firstRowMsg = Object.values(newErrors)[0];
        toast.error(firstRowMsg || d?.message || "One or more medicines could not be added. No prescription was created.");
        return;
      }

      // ── Non-field / top-level errors ─────────────────────────────────
      const nonField = errs.non_field_errors;
      if (nonField) {
        const raw = Array.isArray(nonField) ? nonField[0] : String(nonField);
        if (raw.toLowerCase().includes("already exists")) {
          toast.warning("A prescription already exists for this appointment.");
          navigate("/doctor/prescriptions");
        } else if (raw.toLowerCase().includes("paid consultation")) {
          toast.error("Consultation bill not paid. Please complete payment first.");
        } else {
          toast.error(raw);
        }
        return;
      }

      // ── Prescription-level field errors (symptoms, diagnosis, appointment) ─
      const topFieldErrors = {};
      ["symptoms", "diagnosis", "appointment"].forEach((f) => {
        if (errs[f]) {
          topFieldErrors[f] = Array.isArray(errs[f]) ? errs[f][0] : errs[f];
        }
      });
      if (Object.keys(topFieldErrors).length > 0) {
        setErrors(topFieldErrors);
      }

      toast.error(d?.message || "Prescription not created. Please review the errors.");
    } finally {
      setSaving(false);
    }
  };

  if (!preAppt) return null;

  return (
    <DoctorLayout>
      <PageHeader title="New Prescription" subtitle="Create a prescription for a patient" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* ── Appointment ─────────────────────────────── */}
        <div className={`bg-white rounded-xl border p-5 ${errors.appointment ? "border-red-300" : "border-slate-200"}`}>
          <h3 className="font-semibold text-slate-700 mb-3">Appointment</h3>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
            <span className="material-symbols-outlined text-clinical-primary" style={{ fontSize: 18 }}>
              calendar_month
            </span>
            {selectedAppointment ? (
              <span className="font-medium text-slate-800">
                Token #{selectedAppointment.token_number} — {selectedAppointment.patient_name}{" "}
                <span className="text-slate-500">({selectedAppointment.appointment_time})</span>
              </span>
            ) : (
              <span className="text-slate-500">Appointment #{preAppt}</span>
            )}
            <span className="ml-auto text-xs text-slate-400 italic">auto-selected</span>
          </div>
          {errors.appointment && (
            <p className="text-xs text-red-600 mt-2">{
              Array.isArray(errors.appointment) ? errors.appointment[0] : errors.appointment
            }</p>
          )}
        </div>

        {/* ── Clinical Information ─────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Clinical Information</h3>
          <div className="space-y-4">
            <div>
              <Textarea
                label="Symptoms"
                name="symptoms"
                value={form.symptoms}
                onChange={changeForm}
                rows={2}
                placeholder="e.g. Fever, headache, cough"
              />
              {errors.symptoms && (
                <p className="text-xs text-red-600 mt-1">{errors.symptoms}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Letters, spaces, '.', ',', '(', ')' only · 3–100 characters
              </p>
            </div>
            <div>
              <Textarea
                label="Diagnosis"
                name="diagnosis"
                value={form.diagnosis}
                onChange={changeForm}
                rows={2}
                placeholder="e.g. Viral fever, Upper respiratory infection"
              />
              {errors.diagnosis && (
                <p className="text-xs text-red-600 mt-1">{errors.diagnosis}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Letters, spaces, '.', ',', '(', ')' only · 3–100 characters
              </p>
            </div>
          </div>
        </div>

        {/* ── Medicines ────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">Medicines</h3>
            <Button type="button" variant="outline" size="sm" onClick={addMed}>
              + Add Medicine
            </Button>
          </div>

          {errors.medicines && (
            <p className="text-xs text-red-600 mb-3">{errors.medicines}</p>
          )}

          {medItems.map((m, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 mb-3 ${
                errors[`med_dup_${idx}`] ? "border-red-300 bg-red-50" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-600">Medicine {idx + 1}</span>
                {medItems.length > 1 && (
                  <Button type="button" variant="ghost" size="xs" onClick={() => removeMed(idx)}>
                    Remove
                  </Button>
                )}
              </div>

              {errors[`med_dup_${idx}`] && (
                <p className="text-xs text-red-600 font-medium mb-2">
                  {errors[`med_dup_${idx}`]}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Medicine name */}
                <div>
                  <AutoSuggest
                    items={medicines.map((med) => ({ value: med.med_id, label: med.med_name }))}
                    value={m.medicine}
                    onChange={(val) => updateMed(idx, "medicine", val)}
                    placeholder="Search medicine..."
                    label="Medicine"
                    data-testid={`medicine-autosuggest-${idx}`}
                  />
                </div>

                {/* Dosage — per-medicine options from API */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dosage
                  </label>
                  {(() => {
                    const dosageOpts = getDosageOptions(m.medicine);
                    const noDosages  = m.medicine && dosageOpts.length === 0;
                    return (
                      <>
                        <select
                          value={m.dosage}
                          onChange={(e) => updateMed(idx, "dosage", e.target.value)}
                          data-testid={`medicine-dosage-${idx}`}
                          disabled={!m.medicine || noDosages}
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-primary disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
                            errors[`med_${idx}_dosage`]
                              ? "border-red-400 bg-red-50"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {!m.medicine ? (
                            <option value="">Select medicine first</option>
                          ) : noDosages ? (
                            <option value="">No dosages configured</option>
                          ) : (
                            <>
                              <option value="">Select dosage...</option>
                              {dosageOpts.map((d) => (
                                <option key={d.dosage_id} value={d.dosage_value}>
                                  {d.dosage_value}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                        {noDosages && (
                          <p className="text-xs text-amber-600 mt-1">
                            No dosages set up — ask the pharmacist to configure dosages
                            for {medicines.find((med) => String(med.med_id) === String(m.medicine))?.med_name || "this medicine"}.
                          </p>
                        )}
                        {errors[`med_${idx}_dosage`] && (
                          <p className="text-xs text-red-600 mt-1">{errors[`med_${idx}_dosage`]}</p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Frequency — dropdown */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={m.frequency}
                    onChange={(e) => updateMed(idx, "frequency", e.target.value)}
                    data-testid={`medicine-frequency-${idx}`}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-primary ${
                      errors[`med_${idx}_frequency`]
                        ? "border-red-400 bg-red-50"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    <option value="">Select frequency...</option>
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {errors[`med_${idx}_frequency`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`med_${idx}_frequency`]}</p>
                  )}
                </div>

                {/* Duration — number of days; drives auto-calculation */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Duration (days)
                  </label>
                  <select
                    value={m.duration}
                    onChange={(e) => updateMed(idx, "duration", e.target.value)}
                    data-testid={`medicine-duration-${idx}`}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-primary ${
                      errors[`med_${idx}_duration`]
                        ? "border-red-400 bg-red-50"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    <option value="">Select duration...</option>
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>
                    ))}
                  </select>
                  {errors[`med_${idx}_duration`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`med_${idx}_duration`]}</p>
                  )}
                </div>

                {/* Quantity — read-only, auto-calculated from frequency × duration */}
                <div className="sm:col-span-2">
                  {(() => {
                    const avail = getAvailableQty(m.medicine);
                    const isCalculated = !!(m.frequency && m.duration && m.quantity);
                    return (
                      <>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Quantity
                          <span className="ml-1.5 text-xs font-normal text-slate-400">
                            (auto-calculated — not editable)
                          </span>
                        </label>
                        <div
                          data-testid={`medicine-quantity-${idx}`}
                          className={`w-full rounded-lg border px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed select-none ${
                            errors[`med_${idx}_quantity`]
                              ? "border-red-400"
                              : isCalculated
                              ? "border-teal-300 text-slate-800 font-semibold"
                              : "border-slate-200"
                          }`}
                        >
                          {isCalculated ? (
                            <span className="text-teal-700 font-semibold">
                              {m.quantity}
                            </span>
                          ) : (
                            <span className="italic text-slate-400">
                              Select frequency &amp; duration above
                            </span>
                          )}
                        </div>
                        {m.frequency && m.duration && m.quantity && (
                          <p className="text-xs text-slate-400 mt-1">
                            {dosesPerDay(m.frequency)} dose{dosesPerDay(m.frequency) !== 1 ? "s" : ""}/day
                            × {m.duration} {parseInt(m.duration) === 1 ? "day" : "days"}
                            {" = "}
                            <span className="font-medium text-slate-600">
                              {m.quantity} tablet{Number(m.quantity) !== 1 ? "s" : ""}
                            </span>
                            <span className="ml-1 text-teal-600 font-medium">✓ locked</span>
                          </p>
                        )}
                        {m.medicine && avail !== null && (
                          <p className={`text-xs mt-1 ${avail === 0 ? "text-red-500 font-medium" : "text-slate-400"}`}>
                            {avail === 0
                              ? "Out of stock — cannot prescribe"
                              : `Available in stock: ${avail}`}
                          </p>
                        )}
                        {errors[`med_${idx}_quantity`] && (
                          <p className="text-xs text-red-600 mt-1">{errors[`med_${idx}_quantity`]}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Lab Tests ─────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">Lab Tests</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLab}>
              + Add Lab Test
            </Button>
          </div>

          {labItems.length === 0 && (
            <p className="text-sm text-slate-400">No lab tests ordered.</p>
          )}

          {labItems.map((l, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 mb-3 ${
                errors[`lab_dup_${idx}`] ? "border-red-300 bg-red-50" : "border-slate-200"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-600">Lab Test {idx + 1}</span>
                <Button type="button" variant="ghost" size="xs" onClick={() => removeLab(idx)}>
                  Remove
                </Button>
              </div>

              {errors[`lab_dup_${idx}`] && (
                <p className="text-xs text-red-600 font-medium mb-2">
                  {errors[`lab_dup_${idx}`]}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AutoSuggest
                  items={labTests.map((t) => ({ value: t.lab_test_id, label: t.test_name }))}
                  value={l.lab_test}
                  onChange={(val) => updateLab(idx, "lab_test", val)}
                  placeholder="Search lab test..."
                  label="Lab Test"
                  data-testid={`labtest-autosuggest-${idx}`}
                />
                <div>
                  <Input
                    label="Notes (optional)"
                    placeholder="e.g. Fasting required"
                    value={l.notes}
                    onChange={(e) => updateLab(idx, "notes", e.target.value)}
                    data-testid={`labtest-notes-${idx}`}
                  />
                  {errors[`lab_${idx}_notes`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`lab_${idx}_notes`]}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Optional · 3–50 characters if provided</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={saving}>
            Create Prescription
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/doctor/appointments")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </DoctorLayout>
  );
}
