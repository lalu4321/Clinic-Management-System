import { useEffect, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { getDashboard } from "../api/adminApi";
import { todayIST } from "@/utils/dateUtils";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await getDashboard();
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!data)
    return (
      <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
        <div className="flex justify-center items-center h-64 text-clinical-primary font-semibold">
          Loading…
        </div>
      </ModuleLayout>
    );

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">

      {/* Top */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-surface-on">Dashboard</h2>
        <span className="text-sm text-surface-on-variant">
          {todayIST()}
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <Card title="Total Staffs"      value={data.total_staff} />
        <Card title="Total Doctors"     value={data.total_doctors} />
        <Card title="Active Staffs"     value={data.active_staff} />
        <Card title="Active Doctors"    value={data.active_doctors} />
        <Card title="Specializations"   value={data.total_specializations} />
      </div>

    </ModuleLayout>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-soft
      hover:shadow-sm transition-shadow">
      <div className="text-2xl font-bold text-clinical-primary font-display">
        {value}
      </div>
      <div className="text-sm text-surface-on-variant mt-1">
        {title}
      </div>
    </div>
  );
}
