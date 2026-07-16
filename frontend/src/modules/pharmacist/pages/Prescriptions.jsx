import PharmacistLayout from "../components/Layout";
import { useEffect, useState } from "react";
import { getPendingPrescriptions } from "../api/pharmacistApi";
import { useNavigate } from "react-router-dom";
import { Button, SearchInput, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { FaFileMedical } from "react-icons/fa";
import { formatISTDate } from "@/utils/dateUtils";

export default function Prescriptions() {
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getPendingPrescriptions()
      .then((res) => {
        const results =
          res.data.results ||
          res.data.data?.results ||
          res.data.data ||
          [];
        setData(Array.isArray(results) ? results : []);
      })
      .catch(() => toast.error("Failed to load prescriptions."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.patient_name || "").toLowerCase().includes(q) ||
      (p.prescription_code || "").toLowerCase().includes(q)
    );
  });

  return (
    <PharmacistLayout>
      <PageHeader title="Pending Prescriptions" subtitle="Prescriptions awaiting dispensing" />

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by patient name or prescription code..."
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FaFileMedical className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No pending prescriptions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">#</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Doctor Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Date (IST)</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p, index) => (
                  <tr key={p.prescription_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{String(index + 1).padStart(3, "0")}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.prescription_code || "—"}</td>
                    <td className="px-4 py-3 font-medium">{p.patient_name || p.patient?.name || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.doctor_name || p.doctor?.name || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.created_at ? formatISTDate(p.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="xs"
                        onClick={() => navigate(`/pharmacist/prescriptions/${p.prescription_id}`)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PharmacistLayout>
  );
}
