import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { getStaffById } from "../api/adminApi";
import { formatIST } from "@/utils/dateUtils";

export default function ViewStaff() {
  const { id } = useParams();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await getStaffById(id);
      setStaff(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!staff)
    return (
      <div className="flex justify-center items-center h-screen text-blue-600 font-semibold">
        Loading...
      </div>
    );

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

          {/* HEADER */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Staff Details
            </h2>
          </div>

          {/* MAIN CARD */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* LEFT DETAILS */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">

                <Field label="Staff Code" value={staff.staff_code} />
                <Field label="Full Name" value={`${staff.user.first_name} ${staff.user.last_name}`} />

                <Field label="Username" value={staff.user.username} />
                <Field label="Email" value={staff.user.email} />

                <Field label="Gender" value={staff.gender} />
                <Field label="Role" value={staff.role_display || "N/A"} />

                <Field label="Date of Birth" value={staff.date_of_birth} />
                <Field label="Age" value={staff.age} />

                <Field label="Phone" value={staff.phone} />
                <Field label="Qualification" value={staff.qualification} />

                <Field label="Address" value={staff.address} />
                <Field label="Salary" value={staff.salary} />

                <Field label="Date Joined" value={formatIST(staff.user.date_joined)} />

                <StatusBadge staffStatus={staff.staff_status} isActive={staff.is_active} />

              </div>

              {/* PROFILE CARD */}
              <div className="flex flex-col items-center">

                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm flex justify-center">

                  {staff.profile_picture ? (
                    <img
                      src={staff.profile_picture}
                      alt="Profile"
                      className="w-56 h-56 object-cover rounded-xl shadow-md"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-gray-400 text-sm">
                      No Image
                    </div>
                  )}

                </div>

                <p className="mt-4 text-sm text-gray-500">
                  Profile Picture
                </p>

              </div>

            </div>
          </div>

      </div>
    </ModuleLayout>
  );
}

// 🔹 FIELD
function Field({ label, value }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="mt-1 p-2 bg-blue-50 border border-blue-100 rounded-md text-sm text-gray-700">
        {value || "N/A"}
      </div>
    </div>
  );
}

// STATUS BADGE
function StatusBadge({ staffStatus, isActive }) {
  const statusConfig = {
    ACTIVE: { bg: "bg-green-100", text: "text-green-600", label: "Active" },
    INACTIVE: { bg: "bg-red-100", text: "text-red-600", label: "Inactive" },
    ON_LEAVE: { bg: "bg-yellow-100", text: "text-yellow-700", label: "On Leave" },
  };
  const status = staffStatus || (isActive ? "ACTIVE" : "INACTIVE");
  const config = statusConfig[status] || statusConfig.ACTIVE;
  return (
    <div>
      <label className="text-xs text-gray-500">Status</label>
      <div className="mt-1">
        <span
          data-testid="staff-status-badge"
          className={`px-3 py-1 text-xs rounded-full font-medium ${config.bg} ${config.text}`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}