import { useEffect, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import {
  getSpecializations,
  createDoctor,
  getDoctorStaff,
} from "../api/adminApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { validateConsultationFee } from "@/utils/validation";

export default function AddDoctor() {
  const navigate = useNavigate();
  const toast = useToast();

  const [staffList, setStaffList] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    staff: "",
    specialization_id: "",
    consultation_fee: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [staffRes, specRes] = await Promise.all([
        getDoctorStaff(),
        getSpecializations(),
      ]);

      const staffData = Array.isArray(staffRes.data)
        ? staffRes.data
        : staffRes.data.data?.results || [];

      const specData = Array.isArray(specRes.data)
        ? specRes.data
        : specRes.data.data?.results || [];

      const activeSpecs = specData.filter((sp) => sp.is_active === true);
      setSpecializations(activeSpecs);

      const doctorStaff = staffData.filter(
        (s) =>
          s.role_display === "Doctor" &&
          !s.has_doctor_profile &&
          s.is_active === true
      );
      setStaffList(doctorStaff);

    } catch (err) {
      console.error(err);
      toast.error("Failed to load data.");
      setStaffList([]);
      setSpecializations([]);
    }
  };

  // ── Live validation for a single field ───────────────────────────────────────
  const validateSingleField = (name, value) => {
    let error = null;

    switch (name) {
      case "staff":
        if (!value) error = "Staff selection is required.";
        break;
      case "specialization_id":
        if (!value) error = "Specialization is required.";
        break;
      case "consultation_fee":
        error = validateConsultationFee(value);
        break;
      default:
        break;
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[name] = error;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  // ── onChange: update state + live-validate ───────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    validateSingleField(name, value);
  };

  // ── onBlur: always re-validate on leave ──────────────────────────────────────
  const handleBlur = (e) => {
    const { name, value } = e.target;
    validateSingleField(name, value);
  };

  // ── Full form validation (final gate on submit) ───────────────────────────────
  const validateForm = () => {
    const newErrors = {};

    if (!form.staff) newErrors.staff = "Staff selection is required.";
    if (!form.specialization_id) newErrors.specialization_id = "Specialization is required.";

    const feeErr = validateConsultationFee(form.consultation_fee);
    if (feeErr) newErrors.consultation_fee = feeErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mapBackendErrors = (backendErrors) => {
    const mapped = {};

    if (!backendErrors || typeof backendErrors !== "object") return mapped;

    Object.entries(backendErrors).forEach(([key, val]) => {
      if (key === "__all__" || key === "non_field_errors") {
        mapped.general = Array.isArray(val) ? val[0] : val;
      } else {
        mapped[key] = Array.isArray(val) ? val[0] : val;
      }
    });

    return mapped;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await createDoctor({
        staff_id: Number(form.staff),
        specialization_id: Number(form.specialization_id),
        consultation_fee: Number(form.consultation_fee),
        max_patient_per_day: 25,
      });

      toast.success("Doctor created successfully.");
      navigate("/admin/doctors");

    } catch (err) {
      let backendErrors = err.response?.data;

      while (backendErrors?.errors) {
        backendErrors = backendErrors.errors;
      }

      backendErrors = backendErrors || {};

      const mappedErrors = mapBackendErrors(backendErrors);
      setErrors(mappedErrors);
      toast.error(mappedErrors.general || "Failed to create doctor. Please check the form.");
    }
  };

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Add Doctor
          </h2>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 text-red-600 border border-red-200 rounded-md text-sm">
              {errors.general}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6"
          >

            {/* LEFT */}
            <div className="space-y-4">

              <Select
                label="Select Staff"
                name="staff"
                value={form.staff}
                options={staffList.map((s) => ({
                  value: s.staff_id,
                  label: `${s.user?.first_name || ""} ${s.user?.last_name || ""}`,
                }))}
                onChange={handleChange}
                error={errors.staff}
              />

              <Select
                label="Specialization"
                name="specialization_id"
                value={form.specialization_id}
                options={specializations.map((sp) => ({
                  value: sp.specialization_id,
                  label: sp.name,
                }))}
                onChange={handleChange}
                error={errors.specialization_id}
              />

              <Input
                label="Consultation Fee (₹)"
                name="consultation_fee"
                value={form.consultation_fee}
                onChange={handleChange}
                onBlur={handleBlur}
                error={errors.consultation_fee}
                placeholder="₹100 – ₹5,000"
              />

            </div>

            {/* RIGHT */}
            <div className="space-y-4">

              <div>
                <label className="text-sm text-gray-600">
                  Max Patient Per Day
                </label>
                <div className="border p-2 mt-1 bg-gray-100 rounded-md">25</div>
              </div>

            </div>

            <div className="col-span-2 flex justify-end">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition">
                Add Doctor
              </button>
            </div>

          </form>

      </div>
    </ModuleLayout>
  );
}

function Input({ label, name, value, onChange, onBlur, error, placeholder }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full border rounded-md p-2 mt-1 outline-none ${
          error ? "border-red-400" : "border-blue-100 focus:ring-2 focus:ring-blue-200"
        }`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Select({ label, name, value, options, onChange, error }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full border rounded-md p-2 mt-1 ${
          error ? "border-red-400" : "border-blue-100"
        }`}
      >
        <option value="">Select</option>
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
