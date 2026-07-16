import Layout from "../components/Layout";
import { useEffect, useState, useCallback } from "react";
import { getPharmacyBills, getPharmacyBillById } from "../api/pharmacistApi";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge, SearchInput, Select, Button } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { FaFileInvoiceDollar, FaPrint } from "react-icons/fa";
import { formatISTDate } from "@/utils/dateUtils";

// ── Receipt helpers (mirrors consultation bill approach) ──────────────────────

function formatBillDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildMedicineRows(items) {
  if (!items || items.length === 0) {
    return `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:12px 0;">No medicines dispensed</td></tr>`;
  }
  return items.map((item) => {
    const subtotal = Number(item.quantity) * Number(item.unit_price || 0);
    return `
      <tr>
        <td>${item.medicine_name || "—"}</td>
        <td>${item.quantity}</td>
        <td>&#8377;${Number(item.unit_price || 0).toFixed(2)}</td>
        <td>&#8377;${subtotal.toFixed(2)}</td>
      </tr>`;
  }).join("");
}

function generatePharmacyReceiptHTML(bill) {
  const medicineRows = buildMedicineRows(bill.items);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Pharmacy Receipt — ${bill.pharmacy_bill_code}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; padding: 48px 40px; color: #1a1a1a; max-width: 600px; margin: auto; }
  .header { text-align: center; border-bottom: 2px solid #00647c; padding-bottom: 18px; margin-bottom: 28px; }
  .clinic-name { font-size: 24px; font-weight: bold; color: #00647c; letter-spacing: 1px; }
  .receipt-title { font-size: 13px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
  .bill-code { font-size: 11px; color: #999; font-family: monospace; margin-top: 6px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .row .label { color: #555; }
  .row .value { font-weight: 500; text-align: right; }
  .divider { border: none; border-top: 1px solid #eee; margin: 8px 0; }
  .total-row { display: flex; justify-content: space-between; padding: 14px 0 10px; font-size: 17px; font-weight: bold; border-top: 2px solid #00647c; margin-top: 6px; color: #00647c; }
  .paid-stamp { text-align: center; margin: 28px 0 20px; }
  .paid-badge { display: inline-block; border: 3px solid #16a34a; color: #16a34a; font-size: 26px; font-weight: bold; padding: 8px 36px; border-radius: 8px; letter-spacing: 6px; transform: rotate(-4deg); }
  .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 14px; }
  table.med-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 4px; }
  table.med-table thead th { background: #00647c; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
  table.med-table thead th:nth-child(2),
  table.med-table thead th:nth-child(3),
  table.med-table thead th:nth-child(4) { text-align: right; }
  table.med-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.med-table tbody td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
  table.med-table tbody td:nth-child(2),
  table.med-table tbody td:nth-child(3),
  table.med-table tbody td:nth-child(4) { text-align: right; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>

<div class="header">
  <div class="clinic-name">Crescent Valley Hospital</div>
  <div class="receipt-title">Pharmacy Receipt</div>
  <div class="bill-code">${bill.pharmacy_bill_code}</div>
</div>

<div class="section">
  <div class="section-title">Patient Information</div>
  <div class="row"><span class="label">Patient Name</span><span class="value">${bill.patient_name || "—"}</span></div>
</div>

<div class="section">
  <div class="section-title">Prescription Details</div>
  <div class="row"><span class="label">Prescription No.</span><span class="value">#${bill.prescription}</span></div>
  <div class="row"><span class="label">Bill Date</span><span class="value">${formatBillDate(bill.created_at)}</span></div>
</div>

<div class="section">
  <div class="section-title">Dispensed Medicines</div>
  <table class="med-table">
    <thead>
      <tr>
        <th>Medicine</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>${medicineRows}</tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Payment Details</div>
  <div class="row"><span class="label">Payment Date &amp; Time (IST)</span><span class="value">${bill.paid_at_ist || "—"}</span></div>
  <hr class="divider"/>
  <div class="total-row"><span>Total Amount</span><span>&#8377;${Number(bill.total_amount).toFixed(2)}</span></div>
</div>

<div class="paid-stamp"><span class="paid-badge">PAID</span></div>

<div class="footer">
  Thank you for choosing Crescent Valley Hospital &bull; This is a computer generated receipt &bull; No signature required
</div>

</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Bills() {
  const toast = useToast();
  const navigate = useNavigate();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [printing, setPrinting] = useState(null); // bill id currently loading

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    getPharmacyBills(params)
      .then((res) => {
        const d = res.data.data;
        setBills(Array.isArray(d) ? d : d?.results || []);
      })
      .catch((err) => {
        const msg =
          err.response?.data?.message ||
          (err.response ? "Failed to load bills." : "Unable to connect. Check your network.");
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = async (bill) => {
    if (bill.status !== "PAID") {
      toast.error("Only paid bills can be printed.");
      return;
    }
    setPrinting(bill.pharmacy_bill_id);
    try {
      // Fetch full bill data (includes items array) before generating the receipt
      const res = await getPharmacyBillById(bill.pharmacy_bill_id);
      const fullBill = res.data.data || res.data;
      const html = generatePharmacyReceiptHTML(fullBill);

      const blob = new Blob([html], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      const w    = window.open(url, "_blank", "width=720,height=900");
      if (!w) {
        URL.revokeObjectURL(url);
        toast.error("Popup blocked. Please allow popups for this site to print receipts.");
        return;
      }
      w.addEventListener("load", () => { setTimeout(() => w.print(), 250); });
      w.addEventListener("afterprint", () => { w.close(); URL.revokeObjectURL(url); });
    } catch {
      toast.error("Failed to load bill data. Please try again.");
    } finally {
      setPrinting(null);
    }
  };

  return (
    <Layout>
      <PageHeader title="Pharmacy Bills" subtitle="View dispensed prescription bills" />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search bill code or patient..." />
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-44"
        >
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); }}>
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading bills...</div>
        ) : bills.length === 0 ? (
          <div className="py-16 text-center">
            <FaFileInvoiceDollar className="text-5xl text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No bills found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600">Bill Code</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Prescription</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Date (IST)</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Total Amount</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill) => (
                  <tr key={bill.pharmacy_bill_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">
                      {bill.pharmacy_bill_code}
                    </td>
                    <td className="px-4 py-3 text-slate-600">#{bill.prescription}</td>
                    <td className="px-4 py-3">{bill.patient_name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {bill.created_at ? formatISTDate(bill.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">₹{Number(bill.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={bill.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => navigate(`/pharmacist/bills/${bill.pharmacy_bill_id}`)}
                        >
                          View
                        </Button>
                        {bill.status === "PAID" && (
                          <Button
                            variant="ghost"
                            size="xs"
                            title="Print receipt"
                            loading={printing === bill.pharmacy_bill_id}
                            onClick={() => handlePrint(bill)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <FaPrint />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </Layout>
  );
}
