import { useEffect, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import {
  getSpecializations,
  createSpecialization,
  updateSpecialization,
  activateSpecialization,
  deactivateSpecialization,
} from "../api/adminApi";
import { useToast } from "@/context/ToastContext";
import { validateSpecialization } from "@/utils/validation";

import {
  FiPlus,
  FiEdit,
  FiSave,
  FiX,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";

export default function Specialization() {
  const toast = useToast();

  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await getSpecializations();
      const data = Array.isArray(res.data)
        ? res.data
        : res.data.data?.results || [];
      setList(data);
    } catch {
      toast.error("Failed to load specializations.");
      setList([]);
    }
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

  // ===================== CREATE =====================

  const handleChange = (e) => {
    const value = e.target.value;
    setName(value);
    setErrors((prev) => { const n = { ...prev }; delete n.name; return n; });
  };

  const validateCreate = () => {
    const err = validateSpecialization(name);
    if (err) {
      setErrors({ name: err });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleCreate = async () => {
    if (!validateCreate()) return;

    try {
      await createSpecialization({ name: name.trim() });
      setName("");
      setErrors({});
      toast.success("Specialization created successfully.");
      fetchData();

    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      const mapped = mapBackendErrors(backendErrors);
      setErrors(mapped);
      toast.error(mapped.general || mapped.name || "Failed to create specialization.");
    }
  };

  // ===================== EDIT =====================

  const handleEdit = (sp) => {
    setEditingId(sp.specialization_id);
    setEditValue(sp.name);
    setEditErrors({});
  };

  const handleEditChange = (e) => {
    const value = e.target.value;
    setEditValue(value);
    // Live validation
    const err = validateSpecialization(value);
    setEditErrors(err ? { name: err } : {});
  };

  const validateEditForm = () => {
    const err = validateSpecialization(editValue);
    if (err) {
      setEditErrors({ name: err });
      return false;
    }
    setEditErrors({});
    return true;
  };

  const handleSave = async (id) => {
    if (!validateEditForm()) return;

    try {
      await updateSpecialization(id, { name: editValue.trim() });
      setEditingId(null);
      setEditValue("");
      setEditErrors({});
      toast.success("Specialization updated successfully.");
      fetchData();

    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      const mapped = mapBackendErrors(backendErrors);
      setEditErrors(mapped);
      toast.error(mapped.general || mapped.name || "Failed to update specialization.");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
    setEditErrors({});
  };

  // ===================== TOGGLE =====================

  const handleToggle = async (sp) => {
    try {
      if (sp.is_active) {
        await deactivateSpecialization(sp.specialization_id);
        toast.success(`"${sp.name}" deactivated.`);
      } else {
        await activateSpecialization(sp.specialization_id);
        toast.success(`"${sp.name}" activated.`);
      }
      fetchData();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.errors?.detail ||
        "Failed to update specialization status.";
      toast.error(msg);
    }
  };

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Specialization Management
            </h2>
          </div>

          {/* ================= ADD ================= */}
          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm mb-6 flex gap-4 items-start">

            <div className="flex-1">
              <input
                value={name}
                onChange={handleChange}
                placeholder="Enter specialization name (e.g. Cardiology)"
                className={`w-full border rounded-md px-3 py-2 ${
                  errors.name ? "border-red-400" : "border-blue-100"
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              <FiPlus />
              Add
            </button>
          </div>

          {/* ================= TABLE ================= */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">

              <thead className="bg-blue-50 text-gray-600">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Doctor Count</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {list.length > 0 ? (
                  list.map((sp) => (
                    <tr key={sp.specialization_id} className="border-t hover:bg-blue-50">

                      <td className="p-3">
                        {editingId === sp.specialization_id ? (
                          <>
                            <input
                              value={editValue}
                              onChange={handleEditChange}
                              className={`border px-2 py-1 w-full rounded-md ${
                                editErrors.name ? "border-red-400" : ""
                              }`}
                            />
                            {editErrors.name && (
                              <p className="text-red-500 text-xs mt-1">{editErrors.name}</p>
                            )}
                          </>
                        ) : (
                          sp.name
                        )}
                      </td>

                      <td className="p-3">{sp.doctor_count || 0}</td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            sp.is_active
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {sp.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="p-3 flex gap-3 flex-wrap">

                        {editingId === sp.specialization_id ? (
                          <>
                            <button
                              onClick={() => handleSave(sp.specialization_id)}
                              className="flex items-center gap-1 text-green-600"
                            >
                              <FiSave /> Save
                            </button>

                            <button
                              onClick={handleCancel}
                              className="flex items-center gap-1 text-gray-600"
                            >
                              <FiX /> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(sp)}
                              className="flex items-center gap-1 text-yellow-600"
                            >
                              <FiEdit /> Edit
                            </button>

                            <button
                              onClick={() => handleToggle(sp)}
                              disabled={sp.is_active && sp.doctor_count > 0}
                              className={`flex items-center gap-1 ${
                                sp.is_active && sp.doctor_count > 0
                                  ? "text-gray-400 cursor-not-allowed"
                                  : sp.is_active
                                  ? "text-orange-600"
                                  : "text-green-600"
                              }`}
                            >
                              {sp.is_active ? <FiXCircle /> : <FiCheckCircle />}
                              {sp.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}

                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center p-6 text-gray-500">
                      No specializations found
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>

      </div>
    </ModuleLayout>
  );
}
