import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/routes/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Prescriptions from "./pages/Prescriptions";
import PrescriptionDetail from "./pages/PrescriptionDetail";
import GenerateBill from "./pages/GenerateBill";
import Bills from "./pages/Bills";
import BillDetail from "./pages/BillDetail";
import Inventory from "./pages/Inventory";
import AddBatch from "./pages/AddBatch";
import Medicines from "./pages/Medicines";
import LiveBoard from "./pages/LiveBoard";

export default function PharmacistRoutes() {
  return (
    <ProtectedRoute role="Pharmacist">
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="live-board" element={<LiveBoard />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="prescriptions/:id" element={<PrescriptionDetail />} />
        <Route path="prescriptions/:id/generate-bill" element={<GenerateBill />} />
        <Route path="bills" element={<Bills />} />
        <Route path="bills/:id" element={<BillDetail />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/add-batch" element={<AddBatch />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="*" element={<Navigate to="/pharmacist/dashboard" replace />} />
      </Routes>
    </ProtectedRoute>
  );
}
