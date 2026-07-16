import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { Button, Loader, StatusBadge, PageHeader, ConfirmModal } from "@/components/ui";
import { formatIST, formatISTDate, formatTime12h } from "@/utils/dateUtils";
import { getAppointmentById, updateAppointmentStatus } from "../api/receptionApi";
import { toast } from "@/hooks/use-toast";
import { FaTimes } from "react-icons/fa";

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider sm:w-40 flex-shrink-0">
        {label}
      </span>
      <span className="text-slate-800 text-sm mt-1 sm:mt-0">{value}</span>
    </div>
  );
}

export default function ViewAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appt, setAppt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = () => {
    setLoading(true);
    getAppointmentById(id)
      .then((res) => setAppt(res.data.data))
      .catch(() => toast({ title: "Error", description: "Failed to load appointment.", variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await updateAppointmentStatus(id, { status: "CANCELLED", version: appt.version });
      toast({ title: "Appointment Cancelled", description: "The appointment has been cancelled and the bill voided." });
      setConfirmCancel(false);
      load();
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to cancel appointment.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  if (loading)
    return (
      <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
        <Loader />
      </ModuleLayout>
    );

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader
        title="Appointment Details"
        actions={
          appt?.status === "SCHEDULED" && (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => setConfirmCancel(true)}
            >
              <FaTimes className="mr-1" /> Cancel Appointment
            </Button>
          )
        }
      />

      {appt && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 max-w-2xl">
          <div className="px-6 py-4 bg-slate-50 rounded-t-xl border-b border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 font-mono">{appt.appointment_code}</p>
              <p className="text-xl font-bold text-slate-800">Token #{appt.token_number}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>

          <div className="px-6 py-2">
            <InfoRow label="Patient" value={appt.patient_name || `#${appt.patient}`} />
            <InfoRow label="Doctor" value={appt.doctor_name || `Dr. #${appt.doctor}`} />
            <InfoRow label="Date" value={formatISTDate(appt.appointment_date)} />
            <InfoRow label="Time" value={formatTime12h(appt.appointment_time)} />
            <InfoRow label="Status" value={<StatusBadge status={appt.status} />} />
            {appt.completed_at && (
              <InfoRow label="Completed At" value={formatIST(appt.completed_at)} />
            )}
          </div>

          {appt.status === "SCHEDULED" && (
            <div className="px-6 pb-4">
              <p className="text-xs text-slate-400 mt-2">
                Appointments are marked complete automatically when the doctor submits a prescription.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <Button variant="ghost" onClick={() => navigate("/receptionist/appointments")}>
          ← Back to Appointments
        </Button>
      </div>

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        loading={cancelling}
        title="Cancel Appointment"
        message="Are you sure you want to cancel this appointment? The associated bill will also be voided."
      />
    </ModuleLayout>
  );
}
