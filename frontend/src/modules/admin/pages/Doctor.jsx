import { useEffect, useState } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import AdminSidebar from "../components/Sidebar";
import {
  getDoctors,
  activateDoctor,
  deactivateDoctor,
  getSpecializations,
} from "../api/adminApi";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/context/ToastContext";

import {
  FiPlus,
  FiSearch,
  FiEye,
  FiEdit,
  FiCheckCircle,
  FiXCircle,
  FiX,
} from "react-icons/fi";

export default function Doctor() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");

  const [specializations, setSpecializations] = useState([]);
  const [specFilter, setSpecFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    fetchDoctors();
    fetchSpecializations();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await getDoctors();

      const doctorData = Array.isArray(res.data)
        ? res.data
        : res.data.data?.results || [];

      setDoctors(doctorData);
    } catch (err) {
      console.error(err);
      setDoctors([]);
    }
  };

  const fetchSpecializations = async () => {
    try {
      const res = await getSpecializations();

      const specData = Array.isArray(res.data)
        ? res.data
        : res.data.data?.results || [];

      setSpecializations(specData);
    } catch (err) {
      console.error(err);
    }
  };

  // FILTER
  const filteredDoctors = doctors.filter((d) => {
    const text = `${d.doctor_code || ""} 
      ${d.staff?.user?.first_name || ""} 
      ${d.staff?.user?.last_name || ""}`.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesSpec = specFilter
      ? d.specialization?.name === specFilter
      : true;

    const matchesStatus =
      statusFilter === ""
        ? true
        : statusFilter === "Available"
        ? d.duty_status === "AVAILABLE"
        : statusFilter === "Off Duty"
        ? d.duty_status === "OFF_DUTY"
        : true;

    return matchesSearch && matchesSpec && matchesStatus;
  });

  const handleToggle = async (d) => {
    try {
      if (d.is_active) {
        await deactivateDoctor(d.doctor_profile_id);
        toast.success(`Dr. ${d.staff?.user?.first_name} deactivated.`);
      } else {
        await activateDoctor(d.doctor_profile_id);
        toast.success(`Dr. ${d.staff?.user?.first_name} activated.`);
      }
      fetchDoctors();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to update doctor status.";
      toast.error(msg);
    }
  };

  const isFilterActive = search || specFilter || statusFilter;

  return (
    <ModuleLayout sidebar={<AdminSidebar />} moduleName="Administration">
      <div>

          {/* HEADER */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Doctor Management
            </h2>

            <button
              onClick={() => navigate("/admin/doctors/add")}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              <FiPlus />
              Add Doctor
            </button>
          </div>

          {/* FILTER BAR */}
          <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm mb-6 flex flex-wrap gap-4 items-center">

            {/* SEARCH */}
            <div className="flex items-center border rounded-md px-3 py-2 w-72">
              <FiSearch className="text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="Search doctor..."
                className="outline-none w-full text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* SPECIALIZATION */}
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={specFilter}
              onChange={(e) => setSpecFilter(e.target.value)}
            >
              <option value="">All Specializations</option>
              {specializations.map((s) => (
                <option key={s.specialization_id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* STATUS */}
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              data-testid="doctor-status-filter"
            >
              <option value="">All Status</option>
              <option value="Available">Available</option>
              <option value="Off Duty">Off Duty</option>
            </select>

            {/* CLEAR */}
            <button
              onClick={() => {
                setSearch("");
                setSpecFilter("");
                setStatusFilter("");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition text-sm font-medium"
            >
              <FiX />
              Clear Filters
            </button>

          </div>

          {/* TABLE */}
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">

              <thead className="bg-blue-50 text-gray-600">
                <tr>
                  <th className="p-3 text-left">Doctor Code</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Specialization</th>
                  <th className="p-3 text-left">Fee</th>
                  <th className="p-3 text-left">Duty Status</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredDoctors.length > 0 ? (
                  filteredDoctors.map((d) => (
                    <tr key={d.doctor_profile_id} className="border-t hover:bg-blue-50">

                      <td className="p-3">{d.doctor_code}</td>

                      <td className="p-3">
                        {d.staff?.user?.first_name} {d.staff?.user?.last_name}
                      </td>

                      <td className="p-3">
                        {d.specialization?.name || "N/A"}
                      </td>

                      <td className="p-3">
                        ₹ {d.consultation_fee}
                      </td>

                      <td className="p-3">
                        <span
                          data-testid={`doctor-duty-status-${d.doctor_profile_id}`}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            d.duty_status === "AVAILABLE"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {d.duty_status === "AVAILABLE" ? "Available" : "Off Duty"}
                        </span>
                      </td>

                      <td className="p-3 flex gap-3 flex-wrap">

                        <button
                          onClick={() =>
                            navigate(`/admin/doctors/view/${d.doctor_profile_id}`)
                          }
                          className="flex items-center gap-1 text-blue-600 hover:underline"
                        >
                          <FiEye /> View
                        </button>

                        <button
                          onClick={() =>
                            navigate(`/admin/doctors/edit/${d.doctor_profile_id}`)
                          }
                          className="flex items-center gap-1 text-yellow-600 hover:underline"
                        >
                          <FiEdit /> Edit
                        </button>

                        <button
                          onClick={() => handleToggle(d)}
                          className={`flex items-center gap-1 ${
                            d.is_active
                              ? "text-orange-600"
                              : "text-green-600"
                          } hover:underline`}
                        >
                          {d.is_active ? <FiXCircle /> : <FiCheckCircle />}
                          {d.is_active ? "Deactivate" : "Activate"}
                        </button>

                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center p-6 text-gray-500">
                      No doctors found
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          </div>

      </div>
    </ModuleLayout>
  );
}