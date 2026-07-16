import ModuleLayout from "@/components/layout/ModuleLayout";
import PharmacistSidebar from "./Sidebar";

export default function PharmacistLayout({ children }) {
  return (
    <ModuleLayout sidebar={<PharmacistSidebar />} moduleName="Pharmacy">
      {children}
    </ModuleLayout>
  );
}
