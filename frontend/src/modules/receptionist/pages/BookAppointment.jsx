import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { Button, Input, Select, PageHeader, FormRow } from "@/components/ui";
import PatientSearch from "@/components/ui/PatientSearch";
import {
  getActiveDoctors,
  getDoctorAvailability,
  createAppointment,
  lookupPatient,
  getAvailableSlots,
} from "../api/receptionApi";
import { toast } from "@/hooks/use-toast";

/**
 * BookAppointment
 * - Patient search (scalable)
 * - Doctor schedule / available slots fetched from API
 * - Past date/time prevention (IST)
 * - Real-time validation
 */
export default function BookAppointment() {
  const [searchParams]  = useSearchParams();
  const prePatientId    = searchParams.get("patient");

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctors,         setDoctors]         = useState([]);
  const [availability,    setAvailability]    = useState(null);
  const [slots,           setSlots]           = useState([]);     // available time slots
  const [isScheduled,     setIsScheduled]     = useState(true);   // false = no schedule on day
  const [loadingSlots,    setLoadingSlots]    = useState(false);
  const [form, setForm] = useState({
    patient: prePatientId || "",
    doctor: "",
    appointment_date: "",
    appointment_time: "",
  });
  const [errors,        setErrors]        = useState({});
  const [loading,       setLoading]       = useState(false);
  const [checkingAvail, setCheckingAvail] = useState(false);
  const navigate = useNavigate();

  // Today's date in IST
  const todayIST = useMemo(() => {
    const now       = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate   = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
    return istDate.toISOString().split("T")[0];
  }, []);

  // ── Load doctors ────────────────────────────────────────────────────────
  useEffect(() => {
    getActiveDoctors()
      .then((res) => {
        const dd = res.data.data;
        setDoctors(Array.isArray(dd) ? dd : dd?.results || []);
      })
      .catch(() => toast({ title: "Error", description: "Failed to load doctors.", variant: "destructive" }));

    if (prePatientId) {
      lookupPatient(prePatientId)
        .then((res) => {
          const patient = res.data.data || res.data;
          setSelectedPatient(patient);
          setForm((p) => ({ ...p, patient: patient.patient_id }));
        })
        .catch(() => setForm((p) => ({ ...p, patient: "" })));
    }
  }, [prePatientId]);

  // ── Fetch availability & slots when doctor + date change ────────────────
  useEffect(() => {
    if (!form.doctor || !form.appointment_date) {
      setAvailability(null);
      setSlots([]);
      return;
    }

    // Doctor capacity
    setCheckingAvail(true);
    setAvailability(null);
    getDoctorAvailability(form.doctor, form.appointment_date)
      .then((res) => setAvailability(res.data.data))
      .catch(() => setAvailability({ error: "Could not check availability." }))
      .finally(() => setCheckingAvail(false));

    // Available time slots
    setLoadingSlots(true);
    setSlots([]);
    setIsScheduled(true);
    setForm((p) => ({ ...p, appointment_time: "" }));
    getAvailableSlots(form.doctor, form.appointment_date)
      .then((res) => {
        const payload      = res.data.data || {};
        const scheduled    = payload.is_scheduled !== false; // default true for older API
        const s            = payload.available_slots || [];
        setIsScheduled(scheduled);
        setSlots(s);
        if (!scheduled) {
          // Backend confirmed: doctor has no schedule on this weekday at all
          const dayName = new Date(form.appointment_date + "T00:00:00")
            .toLocaleDateString("en-IN", { weekday: "long" });
          toast({
            title: "Doctor Not Available",
            description: `This doctor is not scheduled on ${dayName}s. Please choose a different date.`,
            variant: "destructive",
          });
        }
      })
      .catch(() => { setSlots([]); setIsScheduled(true); })
      .finally(() => setLoadingSlots(false));
  }, [form.doctor, form.appointment_date]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setForm((p) => ({ ...p, patient: patient.patient_id }));
    setErrors((p) => ({ ...p, patient: "" }));
  };

  const change = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const handleDateChange = (e) => {
    const { value } = e.target;
    setForm((p) => ({ ...p, appointment_date: value, appointment_time: "" }));
    setErrors((p) => ({ ...p, appointment_date: "", appointment_time: "" }));
    setSlots([]);
    setIsScheduled(true); // reset until API responds
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = {};
    if (!form.patient)           validationErrors.patient           = "Please select a patient.";
    if (!form.doctor)            validationErrors.doctor            = "Please select a doctor.";
    if (!form.appointment_date)  validationErrors.appointment_date  = "Please select an appointment date.";
    if (!form.appointment_time)  validationErrors.appointment_time  = "Please select an appointment time.";
    if (form.appointment_date < todayIST)
      validationErrors.appointment_date = "Cannot book for a past date.";

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({ title: "Validation Error", description: "Please fix the highlighted fields.", variant: "destructive" });
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const res  = await createAppointment(form);
      const appt = res.data.data;
      toast({
        title: "Appointment Booked",
        description: `Token #${appt.token_number} — ${appt.appointment_code}`,
      });
      navigate("/receptionist/appointments");
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
          // Surface specific conflict errors in the toast for better visibility
          const allErrorTexts = Object.values(fieldErrors).flat().map(String);
          const conflictMsg = allErrorTexts.find((msg) =>
            msg.toLowerCase().includes("patient already has")
          );
          if (conflictMsg) {
            toast({ title: "Booking Conflict", description: conflictMsg, variant: "destructive" });
          } else {
            toast({ title: "Booking Failed", description: "Please check the highlighted fields.", variant: "destructive" });
          }
        }
        setErrors(fieldErrors);
        // Refresh slots on conflict
        if (form.doctor && form.appointment_date) {
          getAvailableSlots(form.doctor, form.appointment_date)
            .then((res) => setSlots(res.data.data?.available_slots || []))
            .catch(() => {});
        }
      } else {
        toast({ title: "Error", description: data?.message || "Failed to book appointment.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const isSlotsFull    = availability && availability.remaining_slots === 0;
  const isUnscheduled  = form.doctor && form.appointment_date && !isScheduled && !loadingSlots;

  // ── Format slot for display ──────────────────────────────────────────────
  const formatSlot = (time24) => {
    const [h, m] = time24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader title="Book Appointment" subtitle="Schedule a new patient appointment" />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Patient <span className="text-red-500">*</span>
            </label>
            <PatientSearch
              onSelect={handlePatientSelect}
              selectedPatient={selectedPatient}
              placeholder="Search by name, ID, or phone..."
            />
            {errors.patient && (
              <p className="mt-1 text-sm text-red-600">{errors.patient}</p>
            )}
            {selectedPatient && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-xs text-blue-700">
                      {selectedPatient.patient_code} • {selectedPatient.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setForm((p) => ({ ...p, patient: "" }));
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Doctor */}
          <Select
            label="Doctor"
            name="doctor"
            value={form.doctor}
            onChange={change}
            error={errors.doctor}
            required
            placeholder="Select doctor"
          >
            {doctors.map((d) => (
              <option
                key={d.doctor_profile_id}
                value={d.doctor_profile_id}
                disabled={d.duty_status === "OFF_DUTY"}
              >
                {d.staff_name || `Dr. #${d.doctor_profile_id}`} — {d.specialization_name || d.specialization}
                {d.duty_status === "OFF_DUTY" ? " (Off Duty)" : ""}
              </option>
            ))}
          </Select>

          {/* Date */}
          <Input
            label="Appointment Date"
            name="appointment_date"
            type="date"
            value={form.appointment_date}
            onChange={handleDateChange}
            error={errors.appointment_date}
            required
            min={todayIST}
          />

          {/* Availability info */}
          {checkingAvail && (
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-600 flex items-center gap-2">
              <span className="animate-spin">⟳</span> Checking doctor availability…
            </div>
          )}
          {availability && !availability.error && (
            <div className={`rounded-lg p-4 text-sm border ${isSlotsFull ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              <div className="font-semibold mb-1">
                {isSlotsFull ? "No capacity available" : "Capacity available"}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>Capacity: <strong>{availability.daily_limit}</strong></div>
                <div>Booked: <strong>{availability.current_bookings}</strong></div>
                <div>Remaining: <strong>{availability.remaining_slots}</strong></div>
              </div>
            </div>
          )}
          {availability?.error && (
            <p className="text-sm text-amber-600">{availability.error}</p>
          )}

          {/* Time Slot Picker */}
          {form.doctor && form.appointment_date && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Available Time Slot <span className="text-red-500">*</span>
              </label>

              {loadingSlots ? (
                <div className="text-sm text-slate-400 py-2">Loading available slots…</div>
              ) : !isScheduled ? (
                <div className="text-sm text-amber-700 py-3 bg-amber-50 rounded-lg px-4 border border-amber-200">
                  <p className="font-semibold mb-0.5">Doctor not available on this day</p>
                  <p className="text-xs text-amber-600">
                    This doctor has no schedule for{" "}
                    {new Date(form.appointment_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" })}s.
                    Please select a different date.
                  </p>
                </div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-red-700 py-3 bg-red-50 rounded-lg px-4 border border-red-200">
                  <p className="font-semibold mb-0.5">No slots available</p>
                  <p className="text-xs text-red-600">
                    All time slots for this doctor on this date are fully booked. Try another date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setForm((p) => ({ ...p, appointment_time: slot }));
                        setErrors((p) => ({ ...p, appointment_time: "" }));
                      }}
                      className={`py-2 px-1 text-xs rounded-lg border transition-colors font-medium ${
                        form.appointment_time === slot
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      {formatSlot(slot)}
                    </button>
                  ))}
                </div>
              )}

              {errors.appointment_time && (
                <p className="mt-1 text-sm text-red-600">{errors.appointment_time}</p>
              )}
              {form.appointment_time && (
                <p className="mt-2 text-xs text-slate-500">
                  Selected: <strong>{formatSlot(form.appointment_time)}</strong>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              loading={loading}
              disabled={isSlotsFull || isUnscheduled || !form.appointment_time}
            >
              Book Appointment
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/receptionist/appointments")}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </ModuleLayout>
  );
}
