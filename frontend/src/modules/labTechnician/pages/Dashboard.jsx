import { useState, useEffect } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import { StatCard, Alert, Loader, Button } from "@/components/ui";
import { getLabDashboard, getLabRequests } from "../api/labApi";
import { FaFlask, FaCheckCircle, FaFileInvoiceDollar, FaClipboardList } from "react-icons/fa";
import StatusBadge from "@/components/ui/StatusBadge";
import { useNavigate } from "react-router-dom";

export default function LabDashboard() {
  const [stats, setStats] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getLabDashboard(), getLabRequests({ status: "ORDERED" })])
      .then(([dashRes, reqRes]) => {
        setStats(dashRes.data.data);
        const d = reqRes.data.data;
        setPendingRequests(Array.isArray(d) ? d.slice(0, 5) : (d?.results || []).slice(0, 5));
      })
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician"><Loader /></ModuleLayout>;

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-on">Lab Dashboard</h1>
          <p className="text-sm text-surface-on-variant mt-1">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {error && <Alert type="error" message={error} className="mb-4" />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Pending Tests" value={stats?.pending_tests ?? 0} icon={FaClipboardList} color="amber" />
        <StatCard title="Completed" value={stats?.completed_tests ?? 0} icon={FaCheckCircle} color="green" />
        <StatCard title="Total Lab Bills" value={`₹${stats?.total_bills ?? 0}`} icon={FaFileInvoiceDollar} color="blue" />
      </div>

      {/* Pending Requests */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-soft">
        <div className="px-5 py-4 border-b border-outline-soft flex justify-between items-center">
          <h2 className="font-semibold text-surface-on">Pending Test Requests</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/lab/requests")}>View All →</Button>
        </div>
        {pendingRequests.length === 0 ? (
          <div className="py-10 text-center text-surface-on-variant text-sm">No pending test requests.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Request ID</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Appt. ID</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Test Name</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Patient</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Status</th>
                  <th className="px-5 py-3 text-left text-surface-on-variant font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-soft">
                {pendingRequests.map((r) => (
                  <tr key={r.lab_test_request_id} className="hover:bg-surface-container">
                    <td className="px-5 py-3 font-mono text-xs text-clinical-primary">#{r.lab_test_request_id}</td>
                    <td className="px-5 py-3 font-mono text-xs text-emerald-600">
                      {r.appointment_code || (r.appointment ? `#${r.appointment}` : "—")}
                    </td>
                    <td className="px-5 py-3 text-surface-on">{r.lab_test_name || r.lab_test}</td>
                    <td className="px-5 py-3 text-surface-on">{r.patient_name || r.patient_code || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3">
                      <Button size="xs" onClick={() => navigate(`/lab/results/add/${r.lab_test_request_id}`)}>
                        Add Results
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModuleLayout>
  );
}
