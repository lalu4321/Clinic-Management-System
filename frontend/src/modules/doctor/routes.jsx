import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/routes/ProtectedRoute";
import DoctorDashboard from "./pages/DoctorDashboard";
import Appointments from "./pages/Appointments";
import Prescriptions from "./pages/Prescriptions";
import NewPrescription from "./pages/NewPrescription";
import PrescriptionDetail from "./pages/PrescriptionDetail";
import PatientHistory from "./pages/PatientHistory";
import DoctorLabRequests from "./pages/LabRequestsPage";
import LiveBoard from "./pages/LiveBoard";

export default function DoctorRoutes() {
  return (
    <ProtectedRoute role="Doctor">
      <Routes>
        <Route path="dashboard" element={<DoctorDashboard />} />
        <Route path="live-board" element={<LiveBoard />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="prescriptions/new" element={<NewPrescription />} />
        <Route path="prescriptions/:id" element={<PrescriptionDetail />} />
        <Route path="lab-requests" element={<DoctorLabRequests />} />
        <Route path="patient-history" element={<PatientHistory />} />
        <Route path="*" element={<Navigate to="/doctor/dashboard" replace />} />
      </Routes>
    </ProtectedRoute>
  );
}