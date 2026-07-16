import { Routes, Route, Navigate } from "react-router-dom";
import PublicPage from "./PublicPage";
import Login from "@/pages/Login";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoutes from "@/modules/admin/routes";
import DoctorRoutes from "@/modules/doctor/routes";
import ReceptionistRoutes from "@/modules/receptionist/routes";
import LabRoutes from "@/modules/labTechnician/routes";
import PharmacistRoutes from "@/modules/pharmacist/routes";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<PublicPage />} />
      <Route path="/login" element={<Login />} />

      {/* Role-protected modules */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute role="Admin">
            <AdminRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/*"
        element={
          <ProtectedRoute role="Doctor">
            <DoctorRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/receptionist/*"
        element={
          <ProtectedRoute role="Receptionist">
            <ReceptionistRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lab/*"
        element={
          <ProtectedRoute role="LabTechnician">
            <LabRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacist/*"
        element={
          <ProtectedRoute role="Pharmacist">
            <PharmacistRoutes />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}