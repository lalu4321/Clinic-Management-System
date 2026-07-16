import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { useToast } from "@/context/ToastContext";
import {
  getDoctorById,
  updateDoctor,
  getSpecializations,
} from "../api/adminApi";
import { validateConsultationFee } from "@/utils/validation";

export default function EditDoctor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [doctor, setDoctor] = useState(null);
  const [specializations, setSpecializations] = useState([]);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    specialization_id: "",
    consultation_fee: "",
    duty_status: "AVAILABLE",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [docRes, specRes] = await Promise.all([
        getDoctorById(id),
        getSpecializations(),
      ]);

      const d = docRes.data.data;

      setDoctor(d);

      setForm({
        specialization_id: d?.specialization?.specialization_id || "",
        consultation_fee: d?.consultation_fee || "",
        duty_status: d?.duty_status || "AVAILABLE",
      });

      const specData = (Array.isArray(specRes.data)
        ? specRes.data
        : specRes.data.data?.results || []).filter((sp) => sp.is_active === true);

      setSpecializations(specData);

    } catch (err) {
      const statusCode = err.response?.status;
      if (statusCode === 404 || statusCode === 400) {
        toast.error("Doctor not found.");
      } else {
        toast.error("Failed to load doctor data.");
      }
      navigate("/admin/doctors");
    }
  };

  // ── Live validation for a single field ───────────────────────────────────────
  const validateSingleField = (name, value) => {
    let error = null;

    switch (name) {
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

    if (!form.specialization_id) newErrors.specialization_id = "Specialization is required.";

    const feeErr = validateConsultationFee(form.consultation_fee);
    if (feeErr) newErrors.consultation_fee = feeErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mapBackendErrors = (backendErrors) => {
    let mapped = {};

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
      const payload = {
        specialization_id: Number(form.specialization_id),
        consultation_fee: Number(form.consultation_fee),
        duty_status: form.duty_status,
      };

      await updateDoctor(id, payload);

      toast.success("Doctor updated successfully.");
      navigate("/admin/doctors");

    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      backendErrors = backendErrors || {};
      const mappedErrors = mapBackendErrors(backendErrors);
      setErrors(mappedErrors);
      toast.error(mappedErrors.general || "Failed to update doctor. Please check the form.");
    }
  };

  if (!doctor) return <p className="p-6">Loading...</p>;

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

          <h2 className="text-xl font-semibold text-gray-800 mb-6">
            Edit Doctor
          </h2>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 text-red-600 border border-red-200 rounded-md text-sm">
              {errors.general}
            </div>
          )}

          {/* Static info */}
          <div className="mb-6 space-y-2">
            <p><strong>Doctor Code:</strong> {doctor?.doctor_code}</p>
            <p><strong>Staff Code:</strong> {doctor?.staff?.staff_code}</p>
            <p>
              <strong>Full Name:</strong>{" "}
              {doctor?.staff?.user?.first_name} {doctor?.staff?.user?.last_name}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6"
          >

            {/* LEFT */}
            <div className="space-y-4">

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

              <Select
                label="Duty Status"
                name="duty_status"
                value={form.duty_status}
                options={[
                  { value: "AVAILABLE", label: "Available" },
                  { value: "OFF_DUTY", label: "Off Duty" },
                ]}
                onChange={handleChange}
                error={errors.duty_status}
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
                Save Changes
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
