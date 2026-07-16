import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/routes/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import LabCatalog from "./pages/LabCatalog";
import LabRequests from "./pages/LabRequests";
import LabResults from "./pages/LabResults";
import AddLabResult from "./pages/AddLabResult";
import LabReports from "./pages/LabReports";
import LabBills from "./pages/LabBills";
import LiveBoard from "./pages/LiveBoard";

export default function LabRoutes() {
  return (
    <ProtectedRoute role="LabTechnician">
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="live-board" element={<LiveBoard />} />
        <Route path="catalog" element={<LabCatalog />} />
        <Route path="requests" element={<LabRequests />} />
        <Route path="results" element={<LabResults />} />
        <Route path="results/add/:requestId" element={<AddLabResult />} />
        <Route path="reports" element={<LabReports />} />
        <Route path="bills" element={<LabBills />} />
        <Route path="*" element={<Navigate to="/lab/dashboard" replace />} />
      </Routes>
    </ProtectedRoute>
  );
}
