import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PharmacistLayout from "../components/Layout";
import { Button, StatusBadge, SearchInput, Select, PageHeader } from "@/components/ui";
import { getInventory } from "../api/pharmacistApi";
import { useToast } from "@/context/ToastContext";

export default function Inventory() {
  const navigate = useNavigate();
  const toast = useToast();

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    getInventory(params)
      .then((r) => {
        const d = r.data.data;
        setBatches(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load inventory."))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <PharmacistLayout>
      {/* Sticky header area */}
      <div className="sticky top-0 z-10 bg-surface pb-3">
        <PageHeader
          title="Inventory"
          subtitle="Manage medicine batches"
          actions={
            <Button onClick={() => navigate("/pharmacist/inventory/add-batch")}>
              + Add Batch
            </Button>
          }
        />

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search medicine or batch..." />
          <Select
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            className="w-44"
          >
            <option value="AVAILABLE">Available</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="EXPIRED">Expired</option>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading...</div>
        ) : batches.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm">No inventory records found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Medicine</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Batch #</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Supplier</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Expiry</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Qty</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Unit Price</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((item) => (
                  <tr key={item.inventory_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{item.medicine_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600">{item.batch_number}</td>
                    <td className="px-4 py-3 text-slate-600">{item.supplier_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.expiry_date}</td>
                    <td className="px-4 py-3 text-slate-600">{item.quantity_available}</td>
                    <td className="px-4 py-3 text-slate-600">₹{item.unit_price}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PharmacistLayout>
  );
}
