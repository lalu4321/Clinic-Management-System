import { useEffect, useRef, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { useToast } from "@/context/ToastContext";
import {
  getSchedules,
  createSchedule,
  activateSchedule,
  deactivateSchedule,
  getDoctors,
  updateSchedule,
} from "../api/adminApi";

import {
  FiEdit,
  FiSave,
  FiX,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
} from "react-icons/fi";
import { validateScheduleDuration } from "@/utils/validation";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

// ---------------------------------------------------------------------------
// DoctorSearch — type-to-search by doctor code, returns selected doctor id
// ---------------------------------------------------------------------------
function DoctorSearch({ doctors, value, onSelect, error }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const containerRef = useRef(null);

  // Sync label when value is preset (e.g. edit mode)
  useEffect(() => {
    if (value) {
      const d = doctors.find((doc) => doc.doctor_profile_id === Number(value));
      if (d) setSelectedLabel(`${d.doctor_code} — ${d.staff?.user?.first_name || ""} ${d.staff?.user?.last_name || ""}`.trim());
    } else {
      setSelectedLabel("");
      setQuery("");
    }
  }, [value, doctors]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? doctors
        .filter((d) => d.is_active)
        .filter((d) =>
          d.doctor_code.toLowerCase().includes(query.toLowerCase())
        )
    : [];

  const handleSelect = (d) => {
    const label = `${d.doctor_code} — ${d.staff?.user?.first_name || ""} ${d.staff?.user?.last_name || ""}`.trim();
    setSelectedLabel(label);
    setQuery("");
    setOpen(false);
    onSelect(d.doctor_profile_id);
  };

  const handleClear = () => {
    setSelectedLabel("");
    setQuery("");
    setOpen(false);
    onSelect("");
  };

  return (
    <div ref={containerRef}>
      <label className="text-sm text-gray-600">Doctor</label>

      {selectedLabel ? (
        // Locked display after selection
        <div className={`flex items-center justify-between border rounded-md p-2 mt-1 bg-blue-50 ${error ? "border-red-400" : "border-blue-200"}`}>
          <span className="text-sm font-medium text-blue-700">{selectedLabel}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500 transition"
            title="Clear selection"
          >
            <FiX size={14} />
          </button>
        </div>
      ) : (
        // Search input
        <div className="relative mt-1">
          <div className={`flex items-center border rounded-md px-2 ${error ? "border-red-400" : "border-blue-100"} bg-white`}>
            <FiSearch className="text-gray-400 mr-1 flex-shrink-0" size={14} />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => query && setOpen(true)}
              placeholder="Type doctor code (e.g. DR001)"
              className="w-full p-2 text-sm outline-none bg-transparent"
            />
          </div>

          {open && query.trim() && (
            <div className="absolute z-20 w-full bg-white border border-blue-100 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((d) => (
                  <button
                    key={d.doctor_profile_id}
                    type="button"
                    onMouseDown={() => handleSelect(d)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm transition-colors"
                  >
                    <span className="font-semibold text-blue-700">{d.doctor_code}</span>
                    <span className="text-gray-500 ml-2">
                      {d.staff?.user?.first_name} {d.staff?.user?.last_name}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-400">No doctors match "{query}"</div>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Schedule() {
  const toast = useToast();

  const [schedules, setSchedules] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loadError, setLoadError] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});

  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    doctor: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadError(false);
    try {
      const [schRes, docRes] = await Promise.all([
        getSchedules(),
        getDoctors(),
      ]);

      const scheduleData = Array.isArray(schRes.data)
        ? schRes.data
        : schRes.data.data?.results || [];

      const doctorData = Array.isArray(docRes.data)
        ? docRes.data
        : docRes.data.data?.results || [];

      setSchedules(scheduleData);
      setDoctors(doctorData);
    } catch {
      setLoadError(true);
      setSchedules([]);
      setDoctors([]);
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
    const { name, value } = e.target;
    const updated = { ...form, [name]: value };
    setForm(updated);

    // Live-validate time fields together whenever either changes
    if (name === "start_time" || name === "end_time") {
      const st = name === "start_time" ? value : updated.start_time;
      const et = name === "end_time"   ? value : updated.end_time;
      const durationErr = validateScheduleDuration(st, et);
      setErrors((prev) => {
        const n = { ...prev };
        delete n.start_time;
        if (durationErr) {
          n.end_time = durationErr;
        } else {
          delete n.end_time;
        }
        return n;
      });
    } else {
      setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.doctor) newErrors.doctor = "Doctor is required.";
    if (!form.day_of_week) newErrors.day_of_week = "Day is required.";
    if (!form.start_time) newErrors.start_time = "Start time is required.";
    if (!form.end_time) {
      newErrors.end_time = "End time is required.";
    } else {
      const durationErr = validateScheduleDuration(form.start_time, form.end_time);
      if (durationErr) newErrors.end_time = durationErr;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createSchedule({
        doctor: Number(form.doctor),
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
      });

      setForm({ doctor: "", day_of_week: "", start_time: "", end_time: "" });
      setErrors({});
      toast.success("Schedule created successfully.");
      fetchData();
    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      const mapped = mapBackendErrors(backendErrors);
      setErrors(mapped);
      toast.error(mapped.general || "Failed to create schedule.");
    }
  };

  // ===================== EDIT =====================

  const handleEdit = (s) => {
    setEditingId(s.schedule_id);
    setEditForm({
      doctor: s.doctor,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      is_active: s.is_active,
    });
    setEditErrors({});
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    const updated = { ...editForm, [name]: type === "checkbox" ? checked : value };
    setEditForm(updated);

    // Live-validate time fields together whenever either changes
    if (name === "start_time" || name === "end_time") {
      const st = name === "start_time" ? value : updated.start_time;
      const et = name === "end_time"   ? value : updated.end_time;
      const durationErr = validateScheduleDuration(st, et);
      setEditErrors((prev) => {
        const n = { ...prev };
        delete n.start_time;
        if (durationErr) {
          n.end_time = durationErr;
        } else {
          delete n.end_time;
        }
        return n;
      });
    } else {
      setEditErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validateEditForm = () => {
    const newErrors = {};
    if (!editForm.day_of_week) newErrors.day_of_week = "Day is required.";
    if (!editForm.start_time) newErrors.start_time = "Start time is required.";
    if (!editForm.end_time) {
      newErrors.end_time = "End time is required.";
    } else {
      const durationErr = validateScheduleDuration(editForm.start_time, editForm.end_time);
      if (durationErr) newErrors.end_time = durationErr;
    }
    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (id) => {
    if (!validateEditForm()) return;
    try {
      await updateSchedule(id, {
        day_of_week: editForm.day_of_week,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        is_active: editForm.is_active,
      });
      setEditingId(null);
      toast.success("Schedule updated.");
      fetchData();
    } catch (err) {
      let backendErrors = err.response?.data;
      while (backendErrors?.errors) backendErrors = backendErrors.errors;
      const mapped = mapBackendErrors(backendErrors);
      setEditErrors(mapped);
      toast.error(mapped.general || "Failed to update schedule.");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
    setEditErrors({});
  };

  // ===================== TOGGLE (optimistic) =====================

  const handleToggle = async (s) => {
    // Optimistic update
    setSchedules((prev) =>
      prev.map((item) =>
        item.schedule_id === s.schedule_id
          ? { ...item, is_active: !item.is_active }
          : item
      )
    );

    try {
      if (s.is_active) {
        await deactivateSchedule(s.schedule_id);
        toast.success("Schedule deactivated.");
      } else {
        await activateSchedule(s.schedule_id);
        toast.success("Schedule activated.");
      }
    } catch (err) {
      // Roll back optimistic update
      setSchedules((prev) =>
        prev.map((item) =>
          item.schedule_id === s.schedule_id
            ? { ...item, is_active: s.is_active }
            : item
        )
      );
      const msg = err.response?.data?.detail || "Failed to update schedule status.";
      toast.error(msg);
    }
  };

  const getDoctorLabel = (id) => {
    const d = doctors.find((doc) => doc.doctor_profile_id === id);
    return d ? `${d.doctor_code} — ${d.staff?.user?.first_name || ""}` : `ID: ${id}`;
  };

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Doctor Schedule Management
        </h2>

        {loadError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            Unable to load schedule data. Please try refreshing the page.
          </div>
        )}

        {/* ================= ADD FORM ================= */}
        <form
          className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm grid grid-cols-2 gap-6 mb-6"
          onSubmit={handleSubmit}
        >
          <h3 className="col-span-2 text-sm font-semibold text-gray-700 -mb-2">Add New Schedule</h3>

          {/* Doctor search — left column */}
          <DoctorSearch
            doctors={doctors}
            value={form.doctor}
            onSelect={(id) => {
              setErrors((prev) => { const n = { ...prev }; delete n.doctor; return n; });
              setForm((prev) => ({ ...prev, doctor: id }));
            }}
            error={errors.doctor}
          />

          {/* Day select — right column */}
          <div>
            <label className="text-sm text-gray-600">Day</label>
            <select
              name="day_of_week"
              value={form.day_of_week}
              onChange={handleChange}
              className={`w-full border rounded-md p-2 mt-1 text-sm ${errors.day_of_week ? "border-red-400" : "border-blue-100"}`}
            >
              <option value="">Select day</option>
              {DAYS.map((d) => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
            </select>
            {errors.day_of_week && <p className="text-red-500 text-xs mt-1">{errors.day_of_week}</p>}
          </div>

          {/* Start time */}
          <div>
            <label className="text-sm text-gray-600">Start Time</label>
            <input
              type="time"
              name="start_time"
              value={form.start_time}
              onChange={handleChange}
              className={`w-full border rounded-md p-2 mt-1 text-sm ${errors.start_time ? "border-red-400" : "border-blue-100"}`}
            />
            {errors.start_time && <p className="text-red-500 text-xs mt-1">{errors.start_time}</p>}
          </div>

          {/* End time */}
          <div>
            <label className="text-sm text-gray-600">End Time</label>
            <input
              type="time"
              name="end_time"
              value={form.end_time}
              onChange={handleChange}
              className={`w-full border rounded-md p-2 mt-1 text-sm ${errors.end_time ? "border-red-400" : "border-blue-100"}`}
            />
            {errors.end_time && <p className="text-red-500 text-xs mt-1">{errors.end_time}</p>}
          </div>

          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition text-sm"
            >
              Add Schedule
            </button>
          </div>
        </form>

        {/* ================= TABLE ================= */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-blue-50 text-gray-600">
              <tr>
                <th className="p-3 text-left">Doctor</th>
                <th className="p-3 text-left">Day</th>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {schedules.length === 0 && !loadError ? (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-400">
                    No schedules found
                  </td>
                </tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.schedule_id} className="border-t hover:bg-blue-50 transition-colors">

                    {/* Doctor — read-only in edit mode (doctor cannot be changed) */}
                    <td className="p-3 font-medium text-blue-700">
                      {getDoctorLabel(s.doctor)}
                    </td>

                    {/* Day */}
                    <td className="p-3">
                      {editingId === s.schedule_id ? (
                        <div>
                          <select
                            name="day_of_week"
                            value={editForm.day_of_week}
                            onChange={handleEditChange}
                            className={`border rounded p-1 text-sm ${editErrors.day_of_week ? "border-red-400" : "border-blue-100"}`}
                          >
                            {DAYS.map((d) => (
                              <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                            ))}
                          </select>
                          {editErrors.day_of_week && <p className="text-red-500 text-xs mt-1">{editErrors.day_of_week}</p>}
                        </div>
                      ) : (
                        <span>{s.day_of_week.charAt(0) + s.day_of_week.slice(1).toLowerCase()}</span>
                      )}
                    </td>

                    {/* Time */}
                    <td className="p-3">
                      {editingId === s.schedule_id ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              name="start_time"
                              value={editForm.start_time}
                              onChange={handleEditChange}
                              className={`border rounded p-1 text-sm ${editErrors.start_time ? "border-red-400" : "border-blue-100"}`}
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                              type="time"
                              name="end_time"
                              value={editForm.end_time}
                              onChange={handleEditChange}
                              className={`border rounded p-1 text-sm ${editErrors.end_time ? "border-red-400" : "border-blue-100"}`}
                            />
                          </div>
                          {(editErrors.start_time || editErrors.end_time) && (
                            <p className="text-red-500 text-xs mt-1">
                              {editErrors.end_time || editErrors.start_time}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">{s.start_time} – {s.end_time}</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        s.is_active
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      <div className="flex gap-3 flex-wrap">
                        {editingId === s.schedule_id ? (
                          <>
                            <button
                              onClick={() => handleSave(s.schedule_id)}
                              className="flex items-center gap-1 text-green-600 hover:underline text-sm"
                            >
                              <FiSave size={13} /> Save
                            </button>
                            <button
                              onClick={handleCancel}
                              className="flex items-center gap-1 text-gray-500 hover:underline text-sm"
                            >
                              <FiX size={13} /> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(s)}
                              className="flex items-center gap-1 text-yellow-600 hover:underline text-sm"
                            >
                              <FiEdit size={13} /> Edit
                            </button>
                            <button
                              onClick={() => handleToggle(s)}
                              className={`flex items-center gap-1 text-sm hover:underline ${
                                s.is_active ? "text-orange-600" : "text-green-600"
                              }`}
                            >
                              {s.is_active ? <FiXCircle size={13} /> : <FiCheckCircle size={13} />}
                              {s.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </ModuleLayout>
  );
}
