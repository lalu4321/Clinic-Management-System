import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Staff from "./pages/Staff";
import AddStaff from "./pages/AddStaff";
import EditStaff from "./pages/EditStaff";
import ViewStaff from "./pages/ViewStaff";
import Doctor from "./pages/Doctor";
import AddDoctor from "./pages/AddDoctor";
import EditDoctor from "./pages/EditDoctor";
import ViewDoctor from "./pages/ViewDoctor";
import Schedule from "./pages/Schedule";
import Specialization from "./pages/Specialization";
import LiveBoard from "./pages/LiveBoard";



export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="live-board" element={<LiveBoard />} />
      <Route path="staff" element={<Staff />} />
      <Route path="staff/add" element={<AddStaff />} />
      <Route path="staff/edit/:id" element={<EditStaff />} />
      <Route path="staff/view/:id" element={<ViewStaff />} />
      <Route path="doctors" element={<Doctor />} />
      <Route path="doctors/add" element={<AddDoctor />} />
      <Route path="doctors/edit/:id" element={<EditDoctor />} />
      <Route path="doctors/view/:id" element={<ViewDoctor />} />
      <Route path="schedules" element={<Schedule />} />
      <Route path="specializations" element={<Specialization />} />

      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}