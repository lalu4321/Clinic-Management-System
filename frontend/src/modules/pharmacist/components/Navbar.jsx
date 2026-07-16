import { LogOut, Bell } from "lucide-react";

export default function Navbar() {
  const handleLogout = () => {
    sessionStorage.removeItem("accessToken");
    window.location.href = "/login";
  };

  return (
    <header className="h-20  bg-gradient-to-r from-gray-800 to-blue-600 text-white flex items-center justify-between px-10 shadow-md sticky top-0 z-50">
      
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-base font-semibold">
          C
        </div>

        <h1 className="text-lg font-medium">
          Clinical Management System
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-6">

        {/* Notification */}
        <div className="relative cursor-pointer p-2.5 rounded-md transition hover:bg-white/10">
          <Bell size={20} />
          <span className="absolute top-1 right-1 bg-red-500 text-[10px] px-1.5 rounded-full">
            3
          </span>
        </div>

        {/* User */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-md transition hover:bg-white/10 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center text-sm font-semibold">
            P
          </div>
          <span className="text-sm font-medium">Pharmacist</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition hover:bg-white hover:text-indigo-600"
        >
          <LogOut size={18} />
          Logout
        </button>

      </div>
    </header>
  );
}