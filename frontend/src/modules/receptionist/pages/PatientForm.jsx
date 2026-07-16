import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { Button, Input, Select, Textarea, PageHeader, FormRow } from "@/components/ui";
import { createPatient, updatePatient, getPatientById } from "../api/receptionApi";
import { toast } from "@/hooks/use-toast";
import {
  validateName,
  validateIndianPhone,
  validateEmail,
  validateAddress,
} from "@/utils/validation";

const EMPTY = {
  first_name: "", last_name: "", gender: "", blood_group: "",
  date_of_birth: "", phone: "", email: "", emergency_contact_number: "", address: "",
};

// Run all field validators; return an errors object (empty = valid)
function validateAll(form) {
  const errs = {};

  const fn = validateName(form.first_name, "First name");
  if (fn) errs.first_name = fn;

  const ln = validateName(form.last_name, "Last name");
  if (ln) errs.last_name = ln;

  if (!form.gender) errs.gender = "Gender is required.";
  if (!form.blood_group) errs.blood_group = "Blood group is required.";
  if (!form.date_of_birth) errs.date_of_birth = "Date of birth is required.";

  const phoneErr = validateIndianPhone(form.phone);
  if (phoneErr) errs.phone = phoneErr;

  const ecErr = validateIndianPhone(form.emergency_contact_number);
  if (ecErr) errs.emergency_contact_number = ecErr;

  if (
    form.phone && form.emergency_contact_number &&
    form.phone.replace(/^\+91/, "") === form.emergency_contact_number.replace(/^\+91/, "")
  ) {
    errs.emergency_contact_number = "Emergency contact cannot be the same as patient phone.";
  }

  if (form.email) {
    const emailErr = validateEmail(form.email);
    if (emailErr) errs.email = emailErr;
  }

  const addrErr = validateAddress(form.address);
  if (addrErr) errs.address = addrErr;

  return errs;
}

// Validate a single field on change
function validateSingleField(name, value, form) {
  switch (name) {
    case "first_name": return validateName(value, "First name");
    case "last_name":  return validateName(value, "Last name");
    case "phone":      return validateIndianPhone(value);
    case "emergency_contact_number": {
      const err = validateIndianPhone(value);
      if (err) return err;
      const phone = form.phone.replace(/^\+91/, "");
      const ec    = value.replace(/^\+91/, "");
      if (phone && ec && phone === ec)
        return "Emergency contact cannot be the same as patient phone.";
      return null;
    }
    case "email":   return value ? validateEmail(value) : null;
    case "address": return validateAddress(value);
    default:        return null;
  }
}

export default function PatientForm({ mode = "add" }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (mode === "edit" && id) {
      getPatientById(id)
        .then((res) => {
          const d = res.data.data;
          setForm({
            first_name: d.first_name || "",
            last_name: d.last_name || "",
            gender: d.gender || "",
            blood_group: d.blood_group || "",
            date_of_birth: d.date_of_birth || "",
            phone: d.phone || "",
            email: d.email || "",
            emergency_contact_number: d.emergency_contact_number || "",
            address: d.address || "",
          });
        })
        .catch(() =>
          toast({ title: "Error", description: "Failed to load patient data.", variant: "destructive" })
        );
    }
  }, [mode, id]);

  const change = useCallback((e) => {
    const { name, value } = e.target;
    setForm((p) => {
      const next = { ...p, [name]: value };
      const err = validateSingleField(name, value, next);
      setErrors((prev) => ({ ...prev, [name]: err || "" }));
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Full validation before submit
    const allErrors = validateAll(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      toast({
        title: "Validation Error",
        description: "Please fix the highlighted fields before submitting.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Trim & normalise before sending
      const payload = {
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address: form.address.trim(),
        email: form.email ? form.email.trim().toLowerCase() : form.email,
        phone: form.phone.replace(/^\+91/, "").trim(),
        emergency_contact_number: form.emergency_contact_number.replace(/^\+91/, "").trim(),
      };

      if (mode === "add") {
        await createPatient(payload);
        toast({ title: "Success", description: "Patient registered successfully." });
      } else {
        await updatePatient(id, payload);
        toast({ title: "Success", description: "Patient updated successfully." });
      }
      navigate("/receptionist/patients");
    } catch (err) {
      const data = err.response?.data;
      if (!err.response) {
        toast({ title: "Network Error", description: "Unable to connect. Check your network.", variant: "destructive" });
      } else if (err.response.status >= 500) {
        toast({ title: "Server Error", description: "Server error. Please try again later.", variant: "destructive" });
      } else if (data?.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
        const fieldErrors = { ...data.errors };
        const nfe = fieldErrors.non_field_errors;
        if (nfe) {
          toast({ title: "Error", description: Array.isArray(nfe) ? nfe[0] : String(nfe), variant: "destructive" });
          delete fieldErrors.non_field_errors;
        } else {
          toast({ title: "Validation Error", description: "Please fix the highlighted fields.", variant: "destructive" });
        }
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Error",
          description: data?.message || "An error occurred. Please check your input.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader
        title={mode === "add" ? "Register New Patient" : "Edit Patient"}
        subtitle={mode === "add" ? "Enter patient information" : "Update patient information"}
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormRow>
            <Input
              label="First Name"
              name="first_name"
              value={form.first_name}
              onChange={change}
              error={errors.first_name}
              required
              placeholder="John"
            />
            <Input
              label="Last Name"
              name="last_name"
              value={form.last_name}
              onChange={change}
              error={errors.last_name}
              required
              placeholder="Doe"
            />
          </FormRow>

          <FormRow>
            <Select
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={change}
              error={errors.gender}
              required
              placeholder="Select gender"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Select
              label="Blood Group"
              name="blood_group"
              value={form.blood_group}
              onChange={change}
              error={errors.blood_group}
              required
              placeholder="Select blood group"
            >
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </FormRow>

          <FormRow>
            <Input
              label="Date of Birth"
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={change}
              error={errors.date_of_birth}
              required
              max={new Date().toISOString().split("T")[0]}
            />
            <Input
              label="Phone Number"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={change}
              error={errors.phone}
              required
              placeholder="9XXXXXXXXX (10 digits)"
            />
          </FormRow>

          <Input
            label="Email (for notifications)"
            name="email"
            type="email"
            value={form.email}
            onChange={change}
            error={errors.email}
            placeholder="patient@example.com"
          />

          <Input
            label="Emergency Contact Number"
            name="emergency_contact_number"
            type="tel"
            value={form.emergency_contact_number}
            onChange={change}
            error={errors.emergency_contact_number}
            required
            placeholder="Must differ from patient phone"
          />

          <Textarea
            label="Address"
            name="address"
            value={form.address}
            onChange={change}
            error={errors.address}
            required
            rows={3}
            placeholder="Full address (min 5 chars, letters required)"
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              {mode === "add" ? "Register Patient" : "Update Patient"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/receptionist/patients")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </ModuleLayout>
  );
}
