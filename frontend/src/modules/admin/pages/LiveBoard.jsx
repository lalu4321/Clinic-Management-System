import LiveAppointmentDashboard from "@/components/shared/LiveAppointmentDashboard";
import ModuleLayout from "@/components/layout/ModuleLayout";
import Sidebar from "../components/Sidebar";

export default function LiveBoardPage() {
  return (
    <ModuleLayout sidebar={<Sidebar />} moduleName="Administration">
      <LiveAppointmentDashboard />
    </ModuleLayout>
  );
}
