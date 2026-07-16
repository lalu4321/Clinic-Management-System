import { useState, useEffect } from "react";
import DoctorLayout from "../components/Layout";
import { StatCard, Alert, Loader, Button } from "@/components/ui";
import { getDoctorAppointments } from "../api/doctorApi";
import { FaCalendarAlt, FaClock, FaUserInjured } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatTime12h, todayIST } from "@/utils/dateUtils";

// ── IST time helpers — mirrors Appointments.jsx ───────────────────────────────

/** True when IST wall-clock time is at or past the appointment's scheduled time.
 *  Controls whether "Start Consultation" is enabled on the dashboard. */
function isTimeReached(appointmentTimeStr) {
  if (!appointmentTimeStr) return false;
  try {
    const now = new Date();
    const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    const [h, m] = String(appointmentTimeStr).split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return false;
    return currentMinutes >= h * 60 + m;
  } catch {
    return false;
  }
}

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Re-evaluate isTimeReached every 30 s so buttons activate without a refresh.
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    getDoctorAppointments()
      .then((res) => {
        const d = res.data.data;
        setAppointments(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => setError("Failed to load appointments."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // All returned appointments are today's SCHEDULED ones — no further filter needed.
  const remaining = appointments.length;
  const nextToken = appointments[0]?.token_number ?? null;

  if (loading) return <DoctorLayout><Loader /></DoctorLayout>;

  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-on">
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, Dr. {user?.username}
          </h1>
          <p className="text-sm text-surface-on-variant mt-1">{todayIST()}</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <StatCard title="Remaining Today" value={remaining} icon={FaCalendarAlt} color="blue" />
        <StatCard
          title="Next Token"
          value={nextToken !== null ? `#${nextToken}` : "—"}
          icon={FaUserInjured}
          color="amber"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-soft">
        <div className="px-5 py-4 border-b border-outline-soft flex justify-between items-center">
          <h2 className="font-semibold text-surface-on">Today's Patient Queue</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/doctor/appointments")}>View All →</Button>
        </div>

        {appointments.length === 0 ? (
          <div className="py-12 text-center text-surface-on-variant text-sm">
            No upcoming appointments for the rest of today.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Token</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Patient</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Time</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-soft">
                {appointments.map((a) => {
                  const timeReached = isTimeReached(a.appointment_time);
                  return (
                    <tr key={a.appointment_id} className="hover:bg-surface-container">
                      <td className="px-5 py-3 font-bold text-clinical-primary">#{a.token_number}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-surface-on">{a.patient_name}</div>
                        <div className="text-xs text-surface-on-variant">{a.appointment_code}</div>
                      </td>
                      <td className="px-5 py-3 text-surface-on">{formatTime12h(a.appointment_time)}</td>
                      <td className="px-5 py-3">
                        {a.has_prescription ? (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                            Prescribed
                          </span>
                        ) : timeReached ? (
                          /* Appointment time reached — allow starting consultation */
                          <Button
                            size="xs"
                            onClick={() =>
                              navigate(`/doctor/prescriptions/new?appointment=${a.appointment_id}`)
                            }
                          >
                            Start Consultation
                          </Button>
                        ) : (
                          /* Appointment time not yet reached — block with tooltip */
                          <span title={`Consultation allowed from ${formatTime12h(a.appointment_time)}`}>
                            <Button size="xs" disabled>
                              <FaClock className="mr-1 text-xs" />
                              {formatTime12h(a.appointment_time)}
                            </Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
