import AppRoutes from "./routes";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <>
      <AppRoutes />
      <Toaster />
    </>
  );
}
