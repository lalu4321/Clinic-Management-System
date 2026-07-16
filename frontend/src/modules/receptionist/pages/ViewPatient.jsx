import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { Button, Alert, Loader, PageHeader } from "@/components/ui";
import { getPatientById } from "../api/receptionApi";
import { FaEdit, FaCalendarAlt } from "react-icons/fa";

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider sm:w-40 flex-shrink-0">
        {label}
      </span>
      <span className="text-slate-800 text-sm mt-1 sm:mt-0">{value || "—"}</span>
    </div>
  );
}

export default function ViewPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPatientById(id)
      .then((res) => setPatient(res.data.data))
      .catch(() => setError("Failed to load patient."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist"><Loader /></ModuleLayout>;
  if (error) return <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist"><Alert type="error" message={error} /></ModuleLayout>;

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader
        title="Patient Details"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(`/receptionist/patients/${id}/edit`)}>
              <FaEdit /> Edit
            </Button>
            <Button size="sm" onClick={() => navigate(`/receptionist/appointments/book?patient=${id}`)}>
              <FaCalendarAlt /> Book Appointment
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 max-w-2xl">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 text-xl font-bold">
                {patient?.first_name?.[0]}{patient?.last_name?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {patient?.first_name} {patient?.last_name}
              </h2>
              <p className="text-sm text-slate-500 font-mono">{patient?.patient_code}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-2">
          <InfoRow label="Gender" value={patient?.gender} />
          <InfoRow label="Blood Group" value={patient?.blood_group} />
          <InfoRow label="Date of Birth" value={patient?.date_of_birth} />
          <InfoRow label="Phone" value={patient?.phone} />
          <InfoRow label="Email" value={patient?.email} />
          <InfoRow label="Emergency Contact" value={patient?.emergency_contact_number} />
          <InfoRow label="Address" value={patient?.address} />
          <InfoRow
            label="Status"
            value={
              <span
                data-testid="patient-status-badge"
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  patient?.patient_status === "UNDER_CARE"
                    ? "bg-blue-100 text-blue-700"
                    : patient?.patient_status === "ARCHIVED"
                    ? "bg-gray-100 text-gray-600"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {patient?.patient_status === "UNDER_CARE" ? "Under Care" : patient?.patient_status === "ARCHIVED" ? "Archived" : "Registered"}
              </span>
            }
          />
        </div>
      </div>
    </ModuleLayout>
  );
}
