import { useEffect, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";
import {
  getStaff,
  deleteStaff,
  activateStaff,
  deactivateStaff,
} from "../api/adminApi";

import {
  FiPlus,
  FiSearch,
  FiEdit,
  FiEye,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name }
  const [togglingId, setTogglingId] = useState(null);       // prevent double-click
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await getStaff();
      const staffData = Array.isArray(res.data)
        ? res.data
        : res.data.data?.results || [];
      setStaff(staffData);
    } catch {
      toast.error("Failed to load staff list.");
      setStaff([]);
    }
  };

  // FILTER LOGIC
  const filteredStaff = staff.filter((s) => {
    const text = `${s.staff_code || ""}
      ${s.user?.first_name || ""}
      ${s.user?.last_name || ""}
      ${s.user?.email || ""}`.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesRole = roleFilter
      ? s.role_display === roleFilter
      : true;

    const matchesStatus =
      statusFilter === ""
        ? true
        : statusFilter === "Active"
        ? (s.staff_status === "ACTIVE" || (!s.staff_status && s.is_active))
        : statusFilter === "Inactive"
        ? (s.staff_status === "INACTIVE" || (!s.staff_status && !s.is_active))
        : statusFilter === "On Leave"
        ? s.staff_status === "ON_LEAVE"
        : true;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    try {
      await deleteStaff(confirmDelete.id);
      toast.success(`${confirmDelete.name} deleted successfully.`);
      fetchStaff();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete staff.";
      toast.error(msg);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleToggle = async (s) => {
    if (togglingId === s.staff_id) return; // prevent double-click
    setTogglingId(s.staff_id);

    const newIsActive = !s.is_active;
    const newStatus   = newIsActive ? "ACTIVE" : "INACTIVE";

    // Optimistic update — badge changes instantly
    setStaff((prev) =>
      prev.map((item) =>
        item.staff_id === s.staff_id
          ? { ...item, is_active: newIsActive, staff_status: newStatus }
          : item
      )
    );

    try {
      if (s.is_active) {
        await deactivateStaff(s.staff_id);
        toast.success(`${s.user?.first_name} deactivated.`);
      } else {
        await activateStaff(s.staff_id);
        toast.success(`${s.user?.first_name} activated.`);
      }
      fetchStaff(); // sync server state
    } catch (err) {
      // Roll back on failure
      setStaff((prev) =>
        prev.map((item) =>
          item.staff_id === s.staff_id
            ? { ...item, is_active: s.is_active, staff_status: s.staff_status }
            : item
        )
      );
      const msg = err.response?.data?.detail || "Failed to update staff status.";
      toast.error(msg);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

        {/* DELETE CONFIRM MODAL */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
              <div className="flex items-center gap-3 mb-4">
                <FiAlertTriangle className="text-red-500 text-2xl flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">Delete Staff</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Are you sure you want to delete <strong>{confirmDelete.name}</strong>? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirmed}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Staff Management
          </h2>

          <button
            onClick={() => navigate("/admin/staff/add")}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            <FiPlus />
            Add Staff
          </button>
        </div>

        {/* FILTER BAR */}
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center">

          <div className="flex items-center border rounded-md px-3 py-2 w-72">
            <FiSearch className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search staff..."
              className="outline-none w-full text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Doctor">Doctor</option>
            <option value="Receptionist">Receptionist</option>
            <option value="LabTechnician">LabTechnician</option>
            <option value="Pharmacist">Pharmacist</option>
          </select>

          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="staff-status-filter"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>

          <button
            onClick={() => {
              setSearch("");
              setRoleFilter("");
              setStatusFilter("");
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition text-sm font-medium"
          >
            <FiX />
            Clear Filters
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">

            <thead className="bg-blue-50 text-gray-600">
              <tr>
                <th className="p-3 text-left">Code</th>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredStaff.length > 0 ? (
                filteredStaff.map((s) => (
                  <tr key={s.staff_id} className="border-t hover:bg-blue-50">

                    <td className="p-3">{s.staff_code || "N/A"}</td>

                    <td className="p-3">
                      {s.user?.first_name} {s.user?.last_name}
                    </td>

                    <td className="p-3">{s.role_display}</td>

                    <td className="p-3">{s.user?.email}</td>

                    <td className="p-3">{s.phone}</td>

                    <td className="p-3">
                      <span
                        data-testid={`staff-status-${s.staff_id}`}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          (s.staff_status || "ACTIVE") === "ACTIVE"
                            ? "bg-green-100 text-green-600"
                            : s.staff_status === "ON_LEAVE"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-600"
                        }`}
                      >
                        {s.staff_status === "ON_LEAVE" ? "On Leave" : s.staff_status === "INACTIVE" ? "Inactive" : "Active"}
                      </span>
                    </td>

                    <td className="p-3 flex gap-2 flex-wrap">

                      <button
                        onClick={() => navigate(`/admin/staff/view/${s.staff_id}`)}
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <FiEye /> View
                      </button>

                      <button
                        onClick={() => navigate(`/admin/staff/edit/${s.staff_id}`)}
                        className="flex items-center gap-1 text-yellow-600 hover:underline"
                      >
                        <FiEdit /> Edit
                      </button>

                      <button
                        onClick={() => handleToggle(s)}
                        disabled={togglingId === s.staff_id}
                        className={`flex items-center gap-1 ${
                          s.is_active ? "text-orange-600" : "text-green-600"
                        } hover:underline disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {s.is_active ? <FiXCircle /> : <FiCheckCircle />}
                        {togglingId === s.staff_id
                          ? "Updating…"
                          : s.is_active ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        onClick={() =>
                          setConfirmDelete({
                            id: s.staff_id,
                            name: `${s.user?.first_name} ${s.user?.last_name}`,
                          })
                        }
                        className="flex items-center gap-1 text-red-600 hover:underline"
                      >
                        <FiTrash2 /> Delete
                      </button>

                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-gray-500">
                    No staff found
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
