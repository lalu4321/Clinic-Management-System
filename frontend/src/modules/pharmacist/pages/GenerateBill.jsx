import PharmacistLayout from "../components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPrescriptionDetail, generateBillFromPrescription } from "../api/pharmacistApi";
import { Alert, Button, PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatISTDate } from "@/utils/dateUtils";

export default function GenerateBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);
  const [dispensed, setDispensed] = useState(false);

  useEffect(() => {
    getPrescriptionDetail(id)
      .then((res) => setData(res.data.data || res.data))
      .catch(() => toast.error("Failed to load prescription details."))
      .finally(() => setLoading(false));
  }, [id]);

  const insufficientStock = data?.items?.some(
    (item) => item.available_quantity < item.quantity
  );

  const notDispensable = data && data.status !== "ACTIVE";
  const notDispensableMessage =
    data?.status === "COMPLETED"
      ? "This prescription has already been dispensed."
      : data?.status === "DRAFT"
      ? "This prescription is still in Draft. The doctor must activate it first."
      : data?.status === "CANCELLED"
      ? "This prescription has been cancelled and cannot be dispensed."
      : null;

  const handleDispense = async () => {
    setDispensing(true);
    try {
      const res = await generateBillFromPrescription(id);
      const payload = res.data?.data || res.data;
      const billCode = payload?.bill_code || payload?.bill_id;
      toast.success(`Dispensed successfully! Bill: ${billCode || "generated"}`);
      setDispensed(true);
      setTimeout(() => navigate("/pharmacist/bills"), 1800);
    } catch (err) {
      if (!err.response) {
        toast.error("Unable to connect. Check your network connection.");
      } else if (err.response.status >= 500) {
        toast.error("Server error. Please try again later.");
      } else {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to dispense prescription.";
        toast.error(Array.isArray(msg) ? msg.join(" ") : msg);
      }
    } finally {
      setDispensing(false);
    }
  };

  return (
    <PharmacistLayout>
      <PageHeader
        title="Confirm Dispense"
        subtitle={`Prescription: ${data?.prescription_code || id}`}
        actions={
          <Button variant="ghost" onClick={() => navigate(`/pharmacist/prescriptions/${id}`)}>
            ← Back
          </Button>
        }
      />

      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading...</div>
      ) : !data ? (
        <Alert type="error" message="Prescription not found." />
      ) : (
        <>
          {notDispensable && notDispensableMessage && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-5">
              <p className="text-amber-700 text-sm font-medium">{notDispensableMessage}</p>
            </div>
          )}

          {/* Prescription Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Patient</p>
              <p className="font-semibold text-slate-800">{data.patient_name || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Doctor</p>
              <p className="font-semibold text-slate-800">{data.doctor_name || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <StatusBadge status={data.status} />
            </div>
            <div>
              <p className="text-slate-500">Date (IST)</p>
              <p className="font-semibold text-slate-800">
                {data.created_at ? formatISTDate(data.created_at) : "—"}
              </p>
            </div>
          </div>

          {/* Medicines to Dispense */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-700 text-sm">Medicines to Dispense</h2>
            </div>
            {!data.items?.length ? (
              <div className="py-8 text-center text-slate-400 text-sm">No medicines in prescription.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Medicine</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Dosage</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Qty Required</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">In Stock</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Batch</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Ready</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item, idx) => {
                    const hasStock = item.available_quantity >= item.quantity;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{item.medicine_name}</td>
                        <td className="px-4 py-3 text-slate-600">{item.dosage}</td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">
                          <span className={hasStock ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                            {item.available_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batch_number || "—"}</td>
                        <td className="px-4 py-3">
                          {hasStock ? (
                            <span className="text-green-600 font-semibold">✓</span>
                          ) : (
                            <span className="text-red-600 font-semibold">✗ Insufficient</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {insufficientStock && (
            <Alert
              type="error"
              message="One or more medicines have insufficient stock. Replenish inventory before dispensing."
              className="mb-4"
            />
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => navigate(`/pharmacist/prescriptions/${id}`)}>
              Cancel
            </Button>
            <Button
              onClick={handleDispense}
              loading={dispensing}
              disabled={insufficientStock || dispensed || notDispensable}
            >
              Confirm Dispense
            </Button>
          </div>
        </>
      )}
    </PharmacistLayout>
  );
}
