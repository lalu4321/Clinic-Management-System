import { useNavigate } from "react-router-dom";
import { FiLogOut } from "react-icons/fi";

export default function Header() {
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    <div className="flex justify-between items-center px-8 py-4 bg-white border-b border-blue-100 shadow-sm">

      {/* Title */}
      <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
        Crescent Valley Hospital
      </h1>


      {/* Right */}
      <div className="flex items-center gap-6">
        <span className="text-gray-500 text-sm">Admin Panel</span>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          <FiLogOut />
          Logout
        </button>
      </div>
    </div>
  );
}