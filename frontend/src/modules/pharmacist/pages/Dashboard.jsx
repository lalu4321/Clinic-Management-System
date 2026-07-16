import { useState, useEffect } from "react";
import PharmacistLayout from "../components/Layout";
import { StatCard, Loader, Button } from "@/components/ui";
import { getPharmacistDashboard, getPendingPrescriptions } from "../api/pharmacistApi";
import { useToast } from "@/context/ToastContext";
import { FaFileMedical, FaExclamationTriangle, FaCalendarTimes, FaMoneyBillWave } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function PharmacistDashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPharmacistDashboard(), getPendingPrescriptions()])
      .then(([dRes, pRes]) => {
        setStats(dRes.data.data);
        const d = pRes.data.data;
        setPrescriptions(Array.isArray(d) ? d.slice(0, 5) : (d?.results || []).slice(0, 5));
      })
      .catch(() => toast.error("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PharmacistLayout><Loader /></PharmacistLayout>;

  return (
    <PharmacistLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-on">Pharmacy Dashboard</h1>
          <p className="text-sm text-surface-on-variant mt-1">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
              timeZone: "Asia/Kolkata",
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Pending Prescriptions" value={stats?.pending_prescriptions ?? 0} icon={FaFileMedical} color="amber" />
        <StatCard title="Low Stock Items" value={stats?.low_stock ?? 0} icon={FaExclamationTriangle} color="red" />
        <StatCard title="Expiring Soon" value={stats?.expiring_soon ?? 0} icon={FaCalendarTimes} color="purple" />
        <StatCard
          title="Today's Sales (₹)"
          value={stats?.todays_sales ? Number(stats.todays_sales).toFixed(2) : "0.00"}
          icon={FaMoneyBillWave}
          color="green"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-outline-soft">
        <div className="px-5 py-4 border-b border-outline-soft flex justify-between items-center">
          <h2 className="font-semibold text-surface-on">Pending Prescriptions</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/pharmacist/prescriptions")}>
            View All →
          </Button>
        </div>
        {prescriptions.length === 0 ? (
          <div className="py-10 text-center text-surface-on-variant text-sm">
            No pending prescriptions.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Code</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Patient</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Doctor</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-soft">
                {prescriptions.map((p) => (
                  <tr key={p.prescription_id} className="hover:bg-surface-container">
                    <td className="px-5 py-3 font-mono text-xs text-clinical-primary">{p.prescription_code}</td>
                    <td className="px-5 py-3 text-surface-on">{p.patient_name || "—"}</td>
                    <td className="px-5 py-3 text-surface-on">{p.doctor_name || "—"}</td>
                    <td className="px-5 py-3">
                      <Button
                        size="xs"
                        onClick={() => navigate(`/pharmacist/prescriptions/${p.prescription_id}`)}
                      >
                        Process
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
