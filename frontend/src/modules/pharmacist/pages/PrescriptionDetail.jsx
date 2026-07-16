import PharmacistLayout from "../components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPrescriptionDetail } from "../api/pharmacistApi";
import { Alert, Button, PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatISTDate } from "@/utils/dateUtils";

export default function PrescriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    getPrescriptionDetail(id)
      .then((res) => {
        const d = res.data.data || res.data;
        setData(d);
      })
      .catch(() => {
        setLoadFailed(true);
        toast.error("Failed to load prescription details.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PharmacistLayout>
        <div className="py-12 text-center text-slate-400">Loading...</div>
      </PharmacistLayout>
    );
  }

  if (loadFailed || !data) {
    return (
      <PharmacistLayout>
        <Alert type="error" message="Prescription not found." />
      </PharmacistLayout>
    );
  }

  return (
    <PharmacistLayout>
      <PageHeader
        title="Prescription Detail"
        subtitle={`Code: ${data.prescription_code || "—"}`}
        actions={
          <Button variant="ghost" onClick={() => navigate("/pharmacist/prescriptions")}>
            ← Back
          </Button>
        }
      />

      {/* Prescription Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Prescription ID</p>
          <p className="font-semibold text-slate-800">{data.prescription_id}</p>
        </div>
        <div>
          <p className="text-slate-500">Status</p>
          <StatusBadge status={data.status} />
        </div>
        <div>
          <p className="text-slate-500">Patient Name</p>
          <p className="font-semibold text-slate-800">{data.patient_name || "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Doctor Name</p>
          <p className="font-semibold text-slate-800">{data.doctor_name || "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Date</p>
          <p className="font-semibold text-slate-800">
            {data.created_at ? formatISTDate(data.created_at) : "—"}
          </p>
        </div>
      </div>

      {/* Medicine Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-700 text-sm">Prescribed Medicines</h2>
        </div>
        {data.items?.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No medicines in this prescription.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Medicine</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Dosage</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Qty Prescribed</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Available Stock</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.medicine_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.dosage}</td>
                    <td className="px-4 py-3">{item.quantity}</td>
                    <td className="px-4 py-3">
                      <span className={item.available_quantity < item.quantity ? "text-red-600 font-semibold" : "text-green-700"}>
                        {item.available_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batch_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispense Action */}
      {data.status === "ACTIVE" && (
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/pharmacist/prescriptions/${id}/generate-bill`)}>
            Confirm Dispense →
          </Button>
        </div>
      )}

      {data.status === "COMPLETED" && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <span className="text-green-700 text-sm font-medium flex-1">
            This prescription has been dispensed. Medicines have been issued to the patient.
          </span>
          <Button size="sm" variant="outline" onClick={() => navigate("/pharmacist/bills")}>
            View Bills
          </Button>
        </div>
      )}

      {data.status === "CANCELLED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-red-700 text-sm font-medium">This prescription has been cancelled and cannot be dispensed.</p>
        </div>
      )}

      {data.status === "DRAFT" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-amber-700 text-sm font-medium">This prescription is still in Draft. The doctor must activate it before it can be dispensed.</p>
        </div>
      )}
    </PharmacistLayout>
  );
}
