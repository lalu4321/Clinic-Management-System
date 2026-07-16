import { useState, useEffect } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { StatCard, Alert, Loader } from "@/components/ui";
import { getReceptionDashboard, getAppointments } from "../api/receptionApi";
import { FaUserInjured, FaCalendarAlt, FaFileInvoiceDollar, FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      getReceptionDashboard(),
      getAppointments({ appointment_date: today }),
    ])
      .then(([dashRes, apptsRes]) => {
        setStats(dashRes.data.data);
        const appts = apptsRes.data.data;
        setTodayAppts(Array.isArray(appts) ? appts : appts?.results || []);
      })
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      {loading ? (
        <Loader />
      ) : (
        <>
          {error && <Alert type="error" message={error} className="mb-4" />}

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-surface-on">Reception Dashboard</h1>
              <p className="text-sm text-surface-on-variant mt-1">
                {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/receptionist/patients/add")} size="sm">
                <FaPlus /> New Patient
              </Button>
              <Button onClick={() => navigate("/receptionist/appointments/book")} variant="success" size="sm">
                <FaCalendarAlt /> Book Appointment
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="Today's Appointments"
              value={stats?.today_appointments ?? 0}
              icon={FaCalendarAlt}
              color="blue"
            />
            <StatCard
              title="Total Patients"
              value={stats?.total_patients ?? 0}
              icon={FaUserInjured}
              color="green"
            />
            <StatCard
              title="Pending Bills"
              value={stats?.pending_bills ?? 0}
              icon={FaFileInvoiceDollar}
              color="amber"
            />
          </div>

          {/* Today's Appointments */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-soft overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-soft flex justify-between items-center">
              <h2 className="font-semibold text-surface-on">Today's Appointments</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/receptionist/appointments")}>
                View All →
              </Button>
            </div>
            {todayAppts.length === 0 ? (
              <div className="py-12 text-center text-surface-on-variant text-sm">No appointments today.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-container text-left">
                      <th className="px-5 py-3 text-surface-on-variant font-semibold">Token</th>
                      <th className="px-5 py-3 text-surface-on-variant font-semibold">Patient</th>
                      <th className="px-5 py-3 text-surface-on-variant font-semibold">Doctor</th>
                      <th className="px-5 py-3 text-surface-on-variant font-semibold">Time</th>
                      <th className="px-5 py-3 text-surface-on-variant font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-soft">
                    {todayAppts.map((a) => (
                      <tr key={a.appointment_id} className="hover:bg-surface-container">
                        <td className="px-5 py-3 font-bold text-clinical-primary">#{a.token_number}</td>
                        <td className="px-5 py-3">
                          <div className="font-medium text-surface-on">{a.patient_name || a.patient_code}</div>
                          <div className="text-xs text-surface-on-variant">{a.appointment_code}</div>
                        </td>
                        <td className="px-5 py-3 text-surface-on">{a.doctor_name || `Dr. #${a.doctor}`}</td>
                        <td className="px-5 py-3 text-surface-on">{a.appointment_time}</td>
                        <td className="px-5 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </ModuleLayout>
  );
}
