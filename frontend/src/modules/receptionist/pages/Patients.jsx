import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import {
  Button, StatusBadge, SearchInput, Select, ConfirmModal, PageHeader, Pagination
} from "@/components/ui";
import { getPatients, deletePatient } from "../api/receptionApi";
import { toast } from "@/hooks/use-toast";
import { FaPlus, FaEye, FaEdit, FaTrash, FaUserInjured } from "react-icons/fa";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [bloodFilter, setBloodFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (genderFilter) params.gender = genderFilter;
    if (bloodFilter) params.blood_group = bloodFilter;
    getPatients(params)
      .then((res) => {
        const d = res.data.data;
        setPatients(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast({ title: "Error", description: "Failed to load patients.", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [search, genderFilter, bloodFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePatient(deleteTarget.patient_id);
      toast({ title: "Patient Deleted", description: `${deleteTarget.first_name} ${deleteTarget.last_name} has been deleted.` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast({ title: "Error", description: e.response?.data?.message || "Failed to delete patient.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader
        title="Patients"
        subtitle="Manage all registered patients"
        actions={
          <Button onClick={() => navigate("/receptionist/patients/add")}>
            <FaPlus /> Add Patient
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, code..." />
        <Select name="gender" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} placeholder="All Genders" className="w-40">
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </Select>
        <Select name="blood" value={bloodFilter} onChange={(e) => setBloodFilter(e.target.value)} placeholder="All Blood Groups" className="w-44">
          {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </Select>
        {(genderFilter || bloodFilter || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setGenderFilter(""); setBloodFilter(""); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading patients...</div>
        ) : patients.length === 0 ? (
          <div className="py-16 text-center">
            <FaUserInjured className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Gender</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Blood Group</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Phone</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => (
                  <tr key={p.patient_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">{p.patient_code}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">
                        {p.first_name} {p.last_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600">{p.gender?.toLowerCase()}</td>
                    <td className="px-4 py-3">
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded">
                        {p.blood_group}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.phone}</td>
                    <td className="px-4 py-3">
                      <span
                        data-testid={`patient-status-${p.patient_id}`}
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          p.patient_status === "UNDER_CARE"
                            ? "bg-blue-100 text-blue-700"
                            : p.patient_status === "ARCHIVED"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {p.patient_status === "UNDER_CARE" ? "Under Care" : p.patient_status === "ARCHIVED" ? "Archived" : "Registered"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => navigate(`/receptionist/patients/${p.patient_id}`)}
                        >
                          <FaEye />
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => navigate(`/receptionist/patients/${p.patient_id}/edit`)}
                        >
                          <FaEdit />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="xs"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <FaTrash />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Patient"
        message={`Are you sure you want to delete patient "${deleteTarget?.first_name} ${deleteTarget?.last_name}"? This action cannot be undone if they have no active appointments.`}
      />
    </ModuleLayout>
  );
}
