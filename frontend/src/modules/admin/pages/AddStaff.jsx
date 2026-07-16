import { useEffect, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { createStaff, getRoles } from "../api/adminApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import { FiUserPlus } from "react-icons/fi";
import {
  validateUsername,
  validateEmail,
  validateIndianPhone,
  validateName,
  validateQualification,
  validateAddress,
  validateSalary,
} from "@/utils/validation";

export default function AddStaff() {
  const navigate = useNavigate();
  const toast = useToast();

  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    user: {
      first_name: "",
      last_name: "",
      username: "",
      password: "",
      email: "",
    },
    role: "",
    gender: "",
    date_of_birth: "",
    phone: "",
    address: "",
    qualification: "",
    salary: "",
    profile_picture: null,
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await getRoles();
      setRoles(res.data.data || []);
    } catch {
      toast.error("Failed to load roles.");
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
      case "username":
        error = validateUsername(value);
        break;
      case "password":
        if (!value?.trim()) error = "Password is required.";
        else if (value.trim().length < 8) error = "Password must be at least 8 characters.";
        break;
      case "email":
        error = validateEmail(value);
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

    if (name in form.user) {
      setForm((prev) => ({ ...prev, user: { ...prev.user, [name]: value } }));
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setForm((prev) => ({ ...prev, profile_picture: file }));
    if (file) {
      setErrors((prev) => { const n = { ...prev }; delete n.profile_picture; return n; });
    } else {
      setErrors((prev) => ({ ...prev, profile_picture: "Profile picture is required." }));
    }
  };

  // ── Full form validation (runs on submit as final gate) ───────────────────────
  const validateForm = () => {
    const newErrors = {};

    const firstNameErr = validateName(form.user.first_name, "First name");
    if (firstNameErr) newErrors.first_name = firstNameErr;

    const lastNameErr = validateName(form.user.last_name, "Last name");
    if (lastNameErr) newErrors.last_name = lastNameErr;

    const usernameErr = validateUsername(form.user.username);
    if (usernameErr) newErrors.username = usernameErr;

    if (!form.user.password?.trim()) newErrors.password = "Password is required.";
    else if (form.user.password.trim().length < 8) newErrors.password = "Password must be at least 8 characters.";

    const emailErr = validateEmail(form.user.email);
    if (emailErr) newErrors.email = emailErr;

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

    if (!form.profile_picture) newErrors.profile_picture = "Profile picture is required.";

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

      Object.entries(form.user).forEach(([key, val]) =>
        formData.append(`user.${key}`, val)
      );

      Object.entries(form).forEach(([key, val]) => {
        if (key !== "user" && val !== null) {
          formData.append(key, val);
        }
      });

      await createStaff(formData);

      toast.success("Staff created successfully.");
      navigate("/admin/staff");

    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      backendErrors = backendErrors || {};
      const mappedErrors = mapBackendErrors(backendErrors);
      setErrors(mappedErrors);
      toast.error(mappedErrors.general || "Failed to create staff. Please check the form.");
    }
  };

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Add Staff
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
            <Input label="First Name" name="first_name" onChange={handleChange} onBlur={handleBlur} error={errors.first_name} />
            <Input
              label="Username"
              name="username"
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.username}
              placeholder="4–7 chars, letters and dots only (e.g. j.smith)"
            />
            <Input label="Email" name="email" onChange={handleChange} onBlur={handleBlur} error={errors.email} placeholder="e.g. user@hospital.com" />
            <Select label="Gender" name="gender" options={["MALE", "FEMALE", "OTHER"]} onChange={handleChange} error={errors.gender} />
            <Input label="Phone" name="phone" onChange={handleChange} onBlur={handleBlur} error={errors.phone} placeholder="10-digit Indian number (e.g. 9876543210)" />
            <Input label="Address" name="address" onChange={handleChange} onBlur={handleBlur} error={errors.address} placeholder="Max 100 characters" />
            <FileInput label="Profile Picture" onChange={handleFileChange} error={errors.profile_picture} />
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            <Input label="Last Name" name="last_name" onChange={handleChange} onBlur={handleBlur} error={errors.last_name} />
            <Input label="Password" name="password" type="password" onChange={handleChange} onBlur={handleBlur} error={errors.password} />
            <Select label="Role" name="role" options={roles} onChange={handleChange} error={errors.role} />
            <Input label="Date of Birth" name="date_of_birth" type="date" onChange={handleChange} onBlur={handleBlur} error={errors.date_of_birth} />
            <Input label="Qualification" name="qualification" onChange={handleChange} onBlur={handleBlur} error={errors.qualification} placeholder="e.g. MBBS, M.D." />
            <Input label="Salary (₹)" name="salary" onChange={handleChange} onBlur={handleBlur} error={errors.salary} placeholder="Min ₹1,000" />
          </div>

          <div className="col-span-2 flex justify-end">
            <button className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition">
              <FiUserPlus />
              Add Staff
            </button>
          </div>

        </form>
      </div>
    </ModuleLayout>
  );
}

function Input({ label, name, type = "text", onChange, onBlur, error, placeholder }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        type={type}
        name={name}
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

function Select({ label, name, options, onChange, error }) {
  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>
      <select
        name={name}
        onChange={onChange}
        className={`w-full border rounded-md p-2 mt-1 ${
          error ? "border-red-400" : "border-blue-100"
        }`}
      >
        <option value="">Select</option>
        {options.map((opt, i) => (
          <option key={i} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}

function FileInput({ label, onChange, error }) {
  const [fileName, setFileName] = useState("");

  const handleFile = (e) => {
    const file = e.target.files[0];
    setFileName(file ? file.name : "");
    onChange(e);
  };

  return (
    <div>
      <label className="text-sm text-gray-600">{label}</label>

      <div className="mt-1 flex items-center gap-3">
        <input type="file" id="fileUpload" className="hidden" accept=".jpg,.jpeg,.png" onChange={handleFile} />

        <label htmlFor="fileUpload" className="cursor-pointer px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          Choose File
        </label>

        <span className="text-sm text-gray-500">
          {fileName || "No file chosen"}
        </span>
      </div>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
