import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "../components/Layout";
import { Alert, PageHeader, Button } from "@/components/ui";
import { getDoctorAppointments } from "../api/doctorApi";
import { FaCalendarAlt, FaClock, FaExclamationCircle } from "react-icons/fa";
import { formatTime12h } from "@/utils/dateUtils";

// ── IST time comparison helpers ───────────────────────────────────────────────

/** Returns true when IST wall-clock time is at or past the appointment time.
 *  Used to enable the "Prescribe" button and show the "In Progress" status. */
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

/** Returns true only after the 10-minute grace window has expired.
 *  Used for queue reordering and the "Missed" badge.
 *  Example: appointment at 5:00 PM → missed only at 5:10 PM or later. */
function isMissedFrontend(appointmentTimeStr) {
  if (!appointmentTimeStr) return false;
  try {
    const now = new Date();
    const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    const [h, m] = String(appointmentTimeStr).split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return false;
    return currentMinutes >= h * 60 + m + 10; // 10-minute grace period
  } catch {
    return false;
  }
}

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Re-evaluate time helpers every 30 seconds so buttons activate without a
  // full page refresh when the scheduled minute arrives.
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    getDoctorAppointments()
      .then((res) => {
        const d = res.data.data;
        setAppointments(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => setError("Failed to load appointments."))
      .finally(() => setLoading(false));
  }, []);

  // Tick every 30 s so the component re-renders and re-evaluates time helpers.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Sort appointments on every render so the list re-orders dynamically as
  // time passes — no page refresh needed.
  //
  // Ordering rules:
  //   1. Active appointments (not yet missed) come first, sorted by time asc.
  //   2. After the 10-minute grace window expires, the appointment moves to
  //      the end of the queue (also sorted by time among themselves).
  //
  // Queue ordering uses isMissedFrontend (10-min grace) so a doctor arriving
  // at 5:01 for a 5:00 PM slot still sees it at the top for 9 more minutes.
  const sortedAppointments = [...appointments].sort((a, b) => {
    const aMissed = isMissedFrontend(a.appointment_time) ? 1 : 0;
    const bMissed = isMissedFrontend(b.appointment_time) ? 1 : 0;
    if (aMissed !== bMissed) return aMissed - bMissed; // missed go last
    return a.appointment_time.localeCompare(b.appointment_time);
  });

  return (
    <DoctorLayout>
      <PageHeader
        title="Today's Appointments"
        subtitle="Upcoming and current appointments for today"
      />
      {error && <Alert type="error" message={error} className="mb-4" />}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-xs text-blue-700">
        <FaClock className="inline mr-1.5" />
        Consultation can only begin <strong>at or after</strong> the scheduled appointment
        time. A <strong>10-minute grace window</strong> is provided — appointments move to
        the end of the queue only after the grace period expires.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : sortedAppointments.length === 0 ? (
          <div className="py-16 text-center">
            <FaCalendarAlt className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No remaining appointments for today.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Token</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Appointment Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Time</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAppointments.map((a) => {
                  const timeReached     = isTimeReached(a.appointment_time);
                  // "Missed" = backend annotation OR 10 min grace expired on frontend.
                  // Using both ensures the badge is correct even if the backend snapshot
                  // was taken before the grace window expired this render cycle.
                  const isMissed        = isMissedFrontend(a.appointment_time) || a.is_missed === true;
                  const hasPrescription = a.has_prescription;

                  return (
                    <tr
                      key={a.appointment_id}
                      className={
                        isMissed
                          ? "bg-amber-50 hover:bg-amber-100"
                          : "hover:bg-slate-50"
                      }
                    >
                      {/* Token */}
                      <td className="px-4 py-3 font-bold text-blue-600">
                        #{a.token_number}
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3 font-medium">{a.patient_name}</td>

                      {/* Appointment code */}
                      <td className="px-4 py-3 font-mono text-xs">{a.appointment_code}</td>

                      {/* Time + missed indicator */}
                      <td className="px-4 py-3">
                        <span className={isMissed ? "text-amber-700 font-semibold" : ""}>
                          {formatTime12h(a.appointment_time)}
                        </span>
                      </td>

                      {/* Queue status badge */}
                      <td className="px-4 py-3">
                        {hasPrescription ? (
                          <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                            Prescribed
                          </span>
                        ) : isMissed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full border border-amber-300">
                            <FaExclamationCircle className="text-amber-500" />
                            Missed — moved to end
                          </span>
                        ) : timeReached ? (
                          <span className="text-xs font-medium text-clinical-primary bg-teal-50 px-2 py-1 rounded-full border border-teal-200">
                            In progress
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">
                            Upcoming
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {hasPrescription ? (
                            /* Already prescribed — nothing more to do */
                            null
                          ) : timeReached ? (
                            /* Time reached — allow prescribing */
                            <Button
                              size="xs"
                              onClick={() =>
                                navigate(
                                  `/doctor/prescriptions/new?appointment=${a.appointment_id}`
                                )
                              }
                            >
                              Prescribe
                            </Button>
                          ) : (
                            /* Time not yet reached — block with tooltip */
                            <span title={`Consultation allowed from ${formatTime12h(a.appointment_time)}`}>
                              <Button size="xs" disabled>
                                <FaClock className="mr-1 text-xs" />
                                {formatTime12h(a.appointment_time)}
                              </Button>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Legend */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>
                <span className="inline-block w-3 h-3 rounded-full bg-slate-200 mr-1" />
                Upcoming — time not yet reached
              </span>
              <span>
                <span className="inline-block w-3 h-3 rounded-full bg-teal-200 mr-1" />
                In progress — within appointment window
              </span>
              <span>
                <span className="inline-block w-3 h-3 rounded-full bg-amber-200 mr-1" />
                Missed — 10-min grace expired, moved to end
              </span>
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
