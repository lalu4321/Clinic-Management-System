import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "../components/Layout";
import { Button, StatusBadge, Select, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { getPrescriptions, activatePrescription, completePrescription, cancelPrescription } from "../api/doctorApi";
import { FaFileMedical, FaPlus } from "react-icons/fa";

export default function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    getPrescriptions(params)
      .then((r) => {
        const d = r.data.data;
        setPrescriptions(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load prescriptions."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id, action, label) => {
    setUpdatingId(id);
    try {
      if (action === "activate") await activatePrescription(id);
      else if (action === "complete") await completePrescription(id);
      else if (action === "cancel") await cancelPrescription(id);
      toast.success(`Prescription ${label}.`);
      load();
    } catch (e) {
      toast.error(
        e.response?.data?.message ||
        e.response?.data?.error ||
        `Failed to ${label.toLowerCase()} prescription.`
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <DoctorLayout>
      <PageHeader
        title="Prescriptions"
        subtitle="Manage patient prescriptions"
        actions={
          <Button onClick={() => navigate("/doctor/prescriptions/new")}>
            <FaPlus /> New Prescription
          </Button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex gap-3">
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-44"
        >
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
        </Select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : prescriptions.length === 0 ? (
          <div className="py-16 text-center">
            <FaFileMedical className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No prescriptions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Symptoms</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescriptions.map((p) => (
                  <tr key={p.prescription_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">
                      {p.prescription_code}
                    </td>
                    <td className="px-4 py-3">{p.patient_name || `#${p.appointment}`}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {p.symptoms || "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => navigate(`/doctor/prescriptions/${p.prescription_id}`)}
                        >
                          View
                        </Button>
                        {p.status === "DRAFT" && (
                          <Button
                            size="xs"
                            variant="success"
                            loading={updatingId === p.prescription_id}
                            onClick={() => handleAction(p.prescription_id, "activate", "activated")}
                          >
                            Activate
                          </Button>
                        )}
                        {/* Complete is triggered by pharmacist after dispensing */}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
