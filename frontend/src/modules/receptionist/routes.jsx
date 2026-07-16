import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/routes/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientForm from "./pages/PatientForm";
import ViewPatient from "./pages/ViewPatient";
import Appointments from "./pages/Appointments";
import BookAppointment from "./pages/BookAppointment";
import ViewAppointment from "./pages/ViewAppointment";
import ConsultationBills from "./pages/ConsultationBills";
import LiveBoard from "./pages/LiveBoard";

export default function ReceptionistRoutes() {
  return (
    <ProtectedRoute role="Receptionist">
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="live-board" element={<LiveBoard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/add" element={<PatientForm mode="add" />} />
        <Route path="patients/:id" element={<ViewPatient />} />
        <Route path="patients/:id/edit" element={<PatientForm mode="edit" />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="appointments/book" element={<BookAppointment />} />
        <Route path="appointments/:id" element={<ViewAppointment />} />
        <Route path="bills" element={<ConsultationBills />} />
        <Route path="*" element={<Navigate to="/receptionist/dashboard" replace />} />
      </Routes>
    </ProtectedRoute>
  );
}
