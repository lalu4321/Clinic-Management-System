import ModuleLayout from "@/components/layout/ModuleLayout";
import DoctorSidebar from "./Sidebar";

export default function DoctorLayout({ children }) {
  return (
    <ModuleLayout sidebar={<DoctorSidebar />} moduleName="Doctor Portal">
      {children}
    </ModuleLayout>
  );
}
