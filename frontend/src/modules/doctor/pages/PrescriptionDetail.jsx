import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DoctorLayout from "../components/Layout";
import { Button, PageHeader, StatusBadge, Alert } from "@/components/ui";
import { getPrescriptionById } from "../api/doctorApi";
import { formatIST } from "@/utils/dateUtils";
import { FaArrowLeft, FaSpinner, FaFileMedical } from "react-icons/fa";

function resolveError(err) {
  if (!err.response) return "Unable to connect to server. Check your network connection.";
  if (err.response.status === 404) return "Prescription not found.";
  if (err.response.status === 403) return "You do not have permission to view this prescription.";
  if (err.response.status >= 500) return "Server error. Please try again later.";
  return err.response?.data?.message || err.response?.data?.error || "Failed to load prescription.";
}

export default function PrescriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPrescriptionById(id)
      .then((res) => {
        const d = res.data.data;
        setPrescription(d);
      })
      .catch((err) => setError(resolveError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <DoctorLayout>
      <PageHeader
        title="Prescription Detail"
        subtitle={prescription ? prescription.prescription_code : ""}
        actions={
          <Button variant="ghost" onClick={() => navigate("/doctor/prescriptions")}>
            <FaArrowLeft /> Back to Prescriptions
          </Button>
        }
      />

      {loading && (
        <div className="py-20 text-center">
          <FaSpinner className="text-3xl text-clinical-primary animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading prescription...</p>
        </div>
      )}

      {!loading && error && (
        <Alert type="error" message={error} className="mb-4" />
      )}

      {!loading && !error && prescription && (
        <div className="space-y-5 max-w-3xl">

          {/* Header card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FaFileMedical className="text-clinical-primary text-xl" />
                <div>
                  <p className="font-semibold text-slate-800 font-mono">{prescription.prescription_code}</p>
                  <p className="text-xs text-slate-500">
                    {formatIST(prescription.created_at)}
                  </p>
                </div>
              </div>
              <StatusBadge status={prescription.status} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Patient</p>
                <p className="text-slate-700">{prescription.patient_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Doctor</p>
                <p className="text-slate-700">{prescription.doctor_name || "—"}</p>
              </div>
            </div>
          </div>

          {/* Clinical info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Clinical Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Symptoms</p>
                <p className="text-slate-700">{prescription.symptoms || <span className="text-slate-400 italic">Not recorded</span>}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Diagnosis</p>
                <p className="text-slate-700">{prescription.diagnosis || <span className="text-slate-400 italic">Not recorded</span>}</p>
              </div>
            </div>
          </div>

          {/* Medicines */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-700 mb-4">
              Prescribed Medicines
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({prescription.items?.length || 0})
              </span>
            </h3>
            {!prescription.items?.length ? (
              <p className="text-sm text-slate-400 italic">No medicines prescribed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      <th className="px-3 py-2 font-semibold text-slate-500 text-xs">#</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-xs">Medicine</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-xs">Dosage</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-xs">Frequency</th>
                      <th className="px-3 py-2 font-semibold text-slate-500 text-xs">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {prescription.items.map((item, idx) => (
                      <tr key={item.prescription_item_id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {item.medicine_name || `Medicine #${item.medicine}`}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{item.dosage}</td>
                        <td className="px-3 py-3 text-slate-600">{item.frequency}</td>
                        <td className="px-3 py-3 text-slate-600">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </DoctorLayout>
  );
}
