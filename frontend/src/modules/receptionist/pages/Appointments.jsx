import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { Button, StatusBadge, SearchInput, Select, ConfirmModal, PageHeader } from "@/components/ui";
import { formatISTDate, formatTime12h } from "@/utils/dateUtils";
import { getAppointments, deleteAppointment } from "../api/receptionApi";
import { toast } from "@/hooks/use-toast";
import { FaPlus, FaEye, FaTrash, FaCalendarAlt } from "react-icons/fa";

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (dateFilter) params.appointment_date = dateFilter;
    getAppointments(params)
      .then((res) => {
        const d = res.data.data;
        setAppointments(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast({ title: "Error", description: "Failed to load appointments.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [search, statusFilter, dateFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAppointment(deleteTarget.appointment_id);
      toast({ title: "Appointment Deleted", description: `${deleteTarget.appointment_code} has been removed.` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.message || "Cannot delete this appointment.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader
        title="Appointments"
        subtitle="Manage patient appointments"
        actions={
          <Button onClick={() => navigate("/receptionist/appointments/book")}>
            <FaPlus /> Book Appointment
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 items-end">
        <SearchInput value={search} onChange={setSearch} placeholder="Search patient, code..." />
        <Select name="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} placeholder="All Statuses" className="w-44">
          <option value="SCHEDULED">Scheduled</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 outline-none"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setDateFilter(""); }}>
          Clear
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDateFilter(today)}>
          Today
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center">
            <FaCalendarAlt className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No appointments found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Token</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Appointment Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Doctor</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Time</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <tr key={a.appointment_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-blue-600">#{a.token_number}</td>
                    <td className="px-4 py-3 font-mono text-xs">{a.appointment_code}</td>
                    <td className="px-4 py-3">
                      {a.patient_name || a.patient_code || `#${a.patient}`}
                    </td>
                    <td className="px-4 py-3">{a.doctor_name || `Dr. #${a.doctor}`}</td>
                    <td className="px-4 py-3">{formatISTDate(a.appointment_date)}</td>
                    <td className="px-4 py-3">{formatTime12h(a.appointment_time)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="xs" variant="ghost" onClick={() => navigate(`/receptionist/appointments/${a.appointment_id}`)}>
                          <FaEye />
                        </Button>
                        {a.status === "SCHEDULED" && (
                          <Button size="xs" variant="outline-danger" onClick={() => setDeleteTarget(a)}>
                            <FaTrash />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Cancel Appointment"
        message={`Cancel appointment ${deleteTarget?.appointment_code}?`}
        confirmLabel="Cancel Appointment"
      />
    </ModuleLayout>
  );
}
