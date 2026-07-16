import { useState, useEffect, useCallback } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import ReceptionistSidebar from "../components/Sidebar";
import { StatusBadge, Select, PageHeader, Button } from "@/components/ui";
import {
  getConsultationBills,
  updateConsultationBill,
  getConsultationBillById,
  printConsultationBill,
} from "../api/receptionApi";
import { toast } from "@/hooks/use-toast";
import { FaEye, FaFileInvoiceDollar, FaTimes, FaPrint } from "react-icons/fa";

// ────────────────────────────────────────────────────────────
// Bill Detail Modal
// ────────────────────────────────────────────────────────────
function BillDetailModal({ bill, onClose }) {
  if (!bill) return null;

  const paidInfo = bill.paid_at_ist;

  const rows = [
    { label: "Bill Code",         value: bill.bill_code },
    { label: "Payment Date",      value: paidInfo?.date    || "—" },
    { label: "Payment Time",      value: paidInfo?.time    || "—" },
    { label: "Patient Code",      value: bill.patient_code || "—" },
    { label: "Patient Name",      value: bill.patient_name || "—" },
    { label: "Doctor Code",       value: bill.doctor_code  || "—" },
    { label: "Doctor Name",       value: bill.doctor_name  || "—" },
    { label: "Specialization",    value: bill.specialization || "—" },
    { label: "Registration Fee",  value: `₹${Number(bill.registration_fee).toFixed(2)}` },
    { label: "Consultation Fee",  value: `₹${Number(bill.consultation_fee).toFixed(2)}` },
    { label: "Total Amount",      value: `₹${Number(bill.total_amount).toFixed(2)}`, bold: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 rounded-t-2xl border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500 font-mono">{bill.bill_code}</p>
            <h2 className="text-lg font-bold text-slate-800">Bill Details</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-0 divide-y divide-slate-100">
          {rows.map(({ label, value, bold }) => (
            <div key={label} className="flex justify-between py-2.5 text-sm">
              <span className="text-slate-500 font-medium w-40 flex-shrink-0">{label}</span>
              <span className={`text-slate-800 text-right ${bold ? "font-bold text-base" : ""}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Print Receipt Modal — only rendered for PAID bills
// ────────────────────────────────────────────────────────────
function PrintReceiptModal({ bill, onClose }) {
  if (!bill) return null;

  const handlePrint = () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Consultation Receipt — ${bill.bill_code}</title>
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
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="clinic-name">Crescent Valley Hospital</div>
  <div class="receipt-title">Consultation Receipt</div>
  <div class="bill-code">${bill.bill_code}</div>
</div>

<div class="section">
  <div class="section-title">Patient Information</div>
  <div class="row"><span class="label">Patient Name</span><span class="value">${bill.patient_name || "—"}</span></div>
  <div class="row"><span class="label">Patient Code</span><span class="value">${bill.patient_code || "—"}</span></div>
</div>

<div class="section">
  <div class="section-title">Doctor Information</div>
  <div class="row"><span class="label">Doctor Name</span><span class="value">${bill.doctor_name || "—"}</span></div>
  <div class="row"><span class="label">Doctor Code</span><span class="value">${bill.doctor_code || "—"}</span></div>
  <div class="row"><span class="label">Specialization</span><span class="value">${bill.specialization || "—"}</span></div>
  <div class="row"><span class="label">Appointment</span><span class="value">${bill.appointment_code || "—"}</span></div>
</div>

<div class="section">
  <div class="section-title">Payment Details</div>
  <div class="row"><span class="label">Payment Date</span><span class="value">${bill.paid_at_ist?.date || "—"}</span></div>
  <div class="row"><span class="label">Payment Time (IST)</span><span class="value">${bill.paid_at_ist?.time || "—"}</span></div>
  <hr class="divider"/>
  <div class="row"><span class="label">Registration Fee</span><span class="value">&#8377;${Number(bill.registration_fee).toFixed(2)}</span></div>
  <div class="row"><span class="label">Consultation Fee</span><span class="value">&#8377;${Number(bill.consultation_fee).toFixed(2)}</span></div>
  <div class="total-row"><span>Total Amount</span><span>&#8377;${Number(bill.total_amount).toFixed(2)}</span></div>
</div>

<div class="paid-stamp"><span class="paid-badge">PAID</span></div>

<div class="footer">
  Thank you for choosing Crescent Valley Hospital &bull; This is a computer generated receipt &bull; No signature required
</div>
</body>
</html>`;

    // Use a Blob URL to avoid the deprecated document.write API
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, "_blank", "width=720,height=900");

    if (!w) {
      URL.revokeObjectURL(url);
      toast({
        title: "Popup Blocked",
        description: "Allow popups for this site to print receipts.",
        variant: "destructive",
      });
      return;
    }

    // Revoke the object URL after the window has had time to load and print
    // Auto-trigger the browser print dialog once the content has loaded.
    // The 250 ms delay lets the blob page fully render before print() fires.
    // afterprint closes the window and revokes the URL after the user is done.
    w.addEventListener("load", () => {
      setTimeout(() => w.print(), 250);
    });
    w.addEventListener("afterprint", () => {
      w.close();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-green-50 rounded-t-2xl border-b border-green-200">
          <div>
            <p className="text-xs text-slate-500 font-mono">{bill.bill_code}</p>
            <h2 className="text-lg font-bold text-slate-800">Print Receipt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-sm text-slate-600 space-y-3">
          <p>Ready to print the <strong>paid consultation receipt</strong> for:</p>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs font-mono border border-slate-200">
            <p><span className="text-slate-400">Patient:</span> {bill.patient_name || "—"}</p>
            <p><span className="text-slate-400">Amount: </span>&#8377;{Number(bill.total_amount).toFixed(2)}</p>
            <p><span className="text-slate-400">Paid on:</span> {bill.paid_at_ist?.date || "—"} at {bill.paid_at_ist?.time || "—"}</p>
          </div>
          <p className="text-xs text-slate-400">
            A new window will open with a print-ready receipt. Allow popups if prompted.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={handlePrint}>
            <FaPrint className="mr-1.5" /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
export default function ConsultationBills() {
  const [bills, setBills]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [updating, setUpdating]         = useState(null);
  const [printing, setPrinting]         = useState(null);
  const [viewBill, setViewBill]         = useState(null);
  const [printBill, setPrintBill]       = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    getConsultationBills(params)
      .then((res) => {
        const d = res.data.data;
        setBills(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() =>
        toast({ title: "Error", description: "Failed to load bills.", variant: "destructive" })
      )
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handlePay = async (bill) => {
    setUpdating(bill.consultation_bill_id);
    try {
      await updateConsultationBill(bill.consultation_bill_id, {
        status: "PAID",
        version: bill.version,
      });
      toast({ title: "Payment Recorded", description: `Bill ${bill.bill_code} marked as paid.` });
      load();
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to process payment.";
      toast({ title: "Error", description: msg, variant: "destructive" });
      load(); // refresh to get current version
    } finally {
      setUpdating(null);
    }
  };

  const handleView = async (bill) => {
    try {
      const res = await getConsultationBillById(bill.consultation_bill_id);
      setViewBill(res.data.data);
    } catch {
      setViewBill(bill); // fallback to list data
    }
  };

  /**
   * Print receipt — only allowed for PAID bills.
   * Calls the backend /print/ endpoint which enforces the status check
   * server-side before returning the enriched bill data.
   */
  const handlePrint = async (bill) => {
    // Guard: belt-and-suspenders UI check (backend also enforces this)
    if (bill.status !== "PAID") {
      toast({
        title: "Print Not Allowed",
        description: "Only paid bills can be printed.",
        variant: "destructive",
      });
      return;
    }

    setPrinting(bill.consultation_bill_id);
    try {
      const res = await printConsultationBill(bill.consultation_bill_id);
      setPrintBill(res.data.data);
    } catch (e) {
      const msg = e.response?.data?.message || "Cannot print this bill.";
      toast({ title: "Print Error", description: msg, variant: "destructive" });
    } finally {
      setPrinting(null);
    }
  };

  return (
    <ModuleLayout sidebar={<ReceptionistSidebar />} moduleName="Receptionist">
      <PageHeader title="Consultation Bills" subtitle="Manage consultation billing" />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex gap-3">
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          className="w-44"
        >
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
        </Select>
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
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Reg. Fee</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Consult. Fee</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Total</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.consultation_bill_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">
                      {b.bill_code}
                    </td>
                    <td className="px-4 py-3">
                      {b.patient_name || b.appointment_code || `#${b.appointment}`}
                    </td>
                    <td className="px-4 py-3">&#8377;{Number(b.registration_fee).toFixed(2)}</td>
                    <td className="px-4 py-3">&#8377;{Number(b.consultation_fee).toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold">&#8377;{Number(b.total_amount).toFixed(2)}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {/* View — always available */}
                        <Button
                          variant="ghost"
                          size="xs"
                          title="View bill details"
                          onClick={() => handleView(b)}
                        >
                          <FaEye />
                        </Button>

                        {/* Pay — only for PENDING bills */}
                        {b.status === "PENDING" && (
                          <Button
                            variant="success"
                            size="xs"
                            loading={updating === b.consultation_bill_id}
                            onClick={() => handlePay(b)}
                          >
                            Pay
                          </Button>
                        )}

                        {/* Print Receipt — ONLY for PAID bills */}
                        {b.status === "PAID" && (
                          <Button
                            variant="ghost"
                            size="xs"
                            title="Print receipt"
                            loading={printing === b.consultation_bill_id}
                            onClick={() => handlePrint(b)}
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

      {/* Bill Detail Modal */}
      {viewBill && (
        <BillDetailModal bill={viewBill} onClose={() => setViewBill(null)} />
      )}

      {/* Print Receipt Modal — only reachable for PAID bills */}
      {printBill && (
        <PrintReceiptModal bill={printBill} onClose={() => setPrintBill(null)} />
      )}
    </ModuleLayout>
  );
}
