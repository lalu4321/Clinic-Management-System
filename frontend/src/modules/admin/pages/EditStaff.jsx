import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { useToast } from "@/context/ToastContext";
import {
  getStaffById,
  updateStaff,
  getRoles,
} from "../api/adminApi";
import {
  validateName,
  validateIndianPhone,
  validateAddress,
  validateQualification,
  validateSalary,
} from "@/utils/validation";

export default function EditStaff() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [roles, setRoles] = useState([]);
  const [staffCode, setStaffCode] = useState("");
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    user: {
      first_name: "",
      last_name: "",
      username: "",
      email: "",
    },
    role: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    address: "",
    qualification: "",
    salary: "",
    is_active: true,
    staff_status: "ACTIVE",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [staffRes, roleRes] = await Promise.all([
        getStaffById(id),
        getRoles(),
      ]);

      const s = staffRes.data.data;

      setStaffCode(s.staff_code);

      setForm({
        user: {
          first_name: s.user?.first_name || "",
          last_name: s.user?.last_name || "",
          username: s.user?.username || "",
          email: s.user?.email || "",
        },
        role: s.role_display || "",
        gender: s.gender || "",
        date_of_birth: s.date_of_birth || "",
        phone: s.phone || "",
        address: s.address || "",
        qualification: s.qualification || "",
        salary: s.salary || "",
        is_active: s.is_active,
        staff_status: s.staff_status || "ACTIVE",
      });

      setRoles(roleRes.data.data || []);

    } catch (err) {
      const statusCode = err.response?.status;
      if (statusCode === 404 || statusCode === 400) {
        toast.error("Staff member not found.");
        navigate("/admin/staff");
      } else {
        toast.error("Failed to load staff data.");
        navigate("/admin/staff");
      }
    }
  };

  // ── Live validation for a single field ───────────────────────────────────────
  const validateSingleField = (name, value) => {
    let error = null;

    switch (name) {
      case "first_name":
        error = validateName(value, "First name");
        break;
      case "last_name":
        error = validateName(value, "Last name");
        break;
      case "phone":
        error = validateIndianPhone(value);
        break;
      case "address":
        error = validateAddress(value);
        break;
      case "qualification":
        error = validateQualification(value);
        break;
      case "salary":
        error = validateSalary(value);
        break;
      case "role":
        if (!value) error = "Role is required.";
        break;
      case "gender":
        if (!value) error = "Gender is required.";
        break;
      case "date_of_birth":
        if (!value) error = "Date of birth is required.";
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

    if (Object.keys(form.user).includes(name)) {
      setForm((prev) => ({
        ...prev,
        user: { ...prev.user, [name]: value },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

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

    const firstNameErr = validateName(form.user.first_name, "First name");
    if (firstNameErr) newErrors.first_name = firstNameErr;

    const lastNameErr = validateName(form.user.last_name, "Last name");
    if (lastNameErr) newErrors.last_name = lastNameErr;

    if (!form.role) newErrors.role = "Role is required.";
    if (!form.gender) newErrors.gender = "Gender is required.";
    if (!form.date_of_birth) newErrors.date_of_birth = "Date of birth is required.";

    const phoneErr = validateIndianPhone(form.phone);
    if (phoneErr) newErrors.phone = phoneErr;

    const addressErr = validateAddress(form.address);
    if (addressErr) newErrors.address = addressErr;

    const qualErr = validateQualification(form.qualification);
    if (qualErr) newErrors.qualification = qualErr;

    const salaryErr = validateSalary(form.salary);
    if (salaryErr) newErrors.salary = salaryErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mapBackendErrors = (backendErrors) => {
    const mapped = {};
    if (!backendErrors || typeof backendErrors !== "object") return mapped;

    Object.entries(backendErrors).forEach(([key, val]) => {
      if (key === "__all__" || key === "non_field_errors") {
        mapped.general = Array.isArray(val) ? val[0] : val;
      } else if (key === "user" && typeof val === "object") {
        Object.entries(val).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v[0] : v;
        });
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
      const formData = new FormData();
      formData.append("user.first_name", form.user.first_name);
      formData.append("user.last_name", form.user.last_name);
      formData.append("role", form.role);
      formData.append("gender", form.gender);
      formData.append("date_of_birth", form.date_of_birth);
      formData.append("phone", form.phone);
      formData.append("address", form.address);
      formData.append("qualification", form.qualification);
      formData.append("salary", form.salary);
      formData.append("is_active", form.is_active);
      formData.append("staff_status", form.staff_status);

      await updateStaff(id, formData);

      toast.success("Staff updated successfully.");
      navigate("/admin/staff");

    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      backendErrors = backendErrors || {};
      const mappedErrors = mapBackendErrors(backendErrors);
      setErrors(mappedErrors);
      toast.error(mappedErrors.general || "Failed to update staff. Please check the form.");
    }
  };

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Edit Staff
        </h2>

        <p className="mb-4 text-sm text-gray-600">
          <strong>Staff Code:</strong> {staffCode}
        </p>

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
            <Input label="First Name" name="first_name" value={form.user.first_name} onChange={handleChange} onBlur={handleBlur} error={errors.first_name} />
            <DisabledInput label="Username" value={form.user.username} />
            <DisabledInput label="Email" value={form.user.email} />
            <Select label="Gender" name="gender" value={form.gender} options={["MALE","FEMALE","OTHER"]} onChange={handleChange} error={errors.gender} />
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} onBlur={handleBlur} error={errors.phone} placeholder="10-digit Indian number (e.g. 9876543210)" />
            <Input label="Address" name="address" value={form.address} onChange={handleChange} onBlur={handleBlur} error={errors.address} placeholder="Max 100 characters" />
            <Select label="Staff Status" name="staff_status" value={form.staff_status} options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "ON_LEAVE", label: "On Leave" },
            ]} onChange={handleChange} error={errors.staff_status} />
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <Input label="Last Name" name="last_name" value={form.user.last_name} onChange={handleChange} onBlur={handleBlur} error={errors.last_name} />
            <Select label="Role" name="role" value={form.role} options={roles} onChange={handleChange} error={errors.role} />
            <Input label="Date of Birth" type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} onBlur={handleBlur} error={errors.date_of_birth} />
            <Input label="Qualification" name="qualification" value={form.qualification} onChange={handleChange} onBlur={handleBlur} error={errors.qualification} placeholder="e.g. MBBS, M.D." />
            <Input label="Salary (₹)" name="salary" value={form.salary} onChange={handleChange} onBlur={handleBlur} error={errors.salary} placeholder="Min ₹1,000" />
          </div>

          <div className="col-span-2 flex justify-end">
            <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </ModuleLayout>
  );
}

function Input({ label, name, value, onChange, onBlur, error, type = "text", placeholder }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        type={type}
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

function DisabledInput({ label, value }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        value={value}
        disabled
        className="w-full border p-2 mt-1 bg-gray-100 rounded-md"
      />
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
        {options.map((opt, i) => {
          const optValue = typeof opt === "object" ? opt.value : opt;
          const optLabel = typeof opt === "object" ? opt.label : opt;
          return (
            <option key={i} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
