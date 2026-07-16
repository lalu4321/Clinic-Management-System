import LiveAppointmentDashboard from "@/components/shared/LiveAppointmentDashboard";
import DoctorLayout from "../components/Layout";

export default function LiveBoardPage() {
  return (
    <DoctorLayout>
      <LiveAppointmentDashboard />
    </DoctorLayout>
  );
}
