import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import { getDoctorById } from "../api/adminApi";

export default function ViewDoctor() {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    fetchDoctor();
  }, []);

  const fetchDoctor = async () => {
    try {
      const res = await getDoctorById(id);
      setDoctor(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!doctor)
    return (
      <div className="flex justify-center items-center h-screen text-blue-600 font-semibold">
        Loading...
      </div>
    );

  const staff = doctor?.staff;
  const user = staff?.user;

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

          {/* HEADER */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Doctor Details
            </h2>
          </div>

          {/* MAIN CARD */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* LEFT DETAILS */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">

                <Field label="Doctor Code" value={doctor?.doctor_code} />
                <Field label="Full Name" value={`${user?.first_name} ${user?.last_name}`} />

                <Field label="Staff Code" value={staff?.staff_code} />
                <Field label="Email" value={user?.email} />

                <Field label="Phone" value={staff?.phone} />
                <Field label="Specialization" value={doctor?.specialization?.name} />

                <Field label="Consultation Fee" value={doctor?.consultation_fee} />
                <Field label="Max Patients/Day" value={doctor?.max_patient_per_day} />

                <DutyStatusBadge dutyStatus={doctor?.duty_status} />

              </div>

              {/* PROFILE */}
              <div className="flex flex-col items-center">

                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm flex justify-center">

                  {staff?.profile_picture ? (
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

            {/* SCHEDULE SECTION */}
            <div className="mt-8">

              <h3 className="text-md font-semibold text-gray-700 mb-4">
                Schedules
              </h3>

              <div className="space-y-3">

                {Array.isArray(doctor?.schedules) &&
                doctor.schedules.length > 0 ? (
                  doctor.schedules.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-white border border-blue-100 rounded-lg px-4 py-3 shadow-sm hover:shadow transition"
                    >
                      {/* LEFT: DAY */}
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-blue-500 rounded"></div>

                        <span className="font-medium text-gray-700">
                          {s.day_of_week}
                        </span>
                      </div>

                      {/* RIGHT: TIME */}
                      <div className="text-sm text-gray-600 font-medium">
                        {s.start_time} - {s.end_time}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center text-gray-500 text-sm">
                    No schedules available
                  </div>
                )}

              </div>

            </div>

          </div>

      </div>
    </ModuleLayout>
  );
}

// 🔹 FIELD COMPONENT
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

// DUTY STATUS BADGE
function DutyStatusBadge({ dutyStatus }) {
  const statusConfig = {
    AVAILABLE: { bg: "bg-green-100", text: "text-green-600", label: "Available" },
    OFF_DUTY: { bg: "bg-red-100", text: "text-red-600", label: "Off Duty" },
  };
  const config = statusConfig[dutyStatus] || statusConfig.AVAILABLE;
  return (
    <div>
      <label className="text-xs text-gray-500">Duty Status</label>
      <div className="mt-1">
        <span
          data-testid="doctor-duty-status-badge"
          className={`px-3 py-1 text-xs rounded-full font-medium ${config.bg} ${config.text}`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
}

// STATUS BADGE
function StatusBadge({ isActive }) {
  return (
    <div>
      <label className="text-xs text-gray-500">Status</label>
      <div className="mt-1">
        <span
          className={`px-3 py-1 text-xs rounded-full font-medium ${
            isActive
              ? "bg-green-100 text-green-600"
              : "bg-red-100 text-red-600"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}