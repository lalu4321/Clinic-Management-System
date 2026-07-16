import { useState, useEffect, useCallback } from "react";
import ModuleLayout from "@/components/layout/ModuleLayout";
import LabSidebar from "../components/Sidebar";
import {
  Button, Alert, StatusBadge, Select, PageHeader,
  SearchInput, Modal, ConfirmModal
} from "@/components/ui";
import { getLabBills, updateLabBill, printLabBill } from "../api/labApi";
import { useToast } from "@/context/ToastContext";
import { formatISTDate } from "@/utils/dateUtils";
import { FaFileInvoiceDollar, FaEye, FaPrint } from "react-icons/fa";

// ── Print Receipt Modal ────────────────────────────────────────────────────────
// Layout, CSS, and structure match Consultation Bill and Pharmacy Bill receipts.
function PrintReceiptModal({ bill, onClose }) {
  if (!bill) return null;

  const handlePrint = () => {
    const items = bill.items || [];
    const itemRows = items
      .map(
        (item) => `
      <tr>
        <td class="item-name">${item.test_name || "—"}</td>
        <td class="item-cell">${item.quantity}</td>
        <td class="item-cell">&#8377;${Number(item.unit_price || 0).toFixed(2)}</td>
        <td class="item-cell item-total">&#8377;${Number(item.subtotal || 0).toFixed(2)}</td>
      </tr>`
      )
      .join("");

    const paidOn = bill.paid_at_ist
      ? (typeof bill.paid_at_ist === "object"
          ? `${bill.paid_at_ist.date || "—"} at ${bill.paid_at_ist.time || "—"}`
          : String(bill.paid_at_ist))
      : (bill.paid_at ? formatISTDate(bill.paid_at) : "—");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Lab Receipt — ${bill.lab_bill_code}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; padding: 48px 40px; color: #1a1a1a; max-width: 640px; margin: auto; }
  .header { text-align: center; border-bottom: 2px solid #00647c; padding-bottom: 18px; margin-bottom: 28px; }
  .clinic-name { font-size: 24px; font-weight: bold; color: #00647c; letter-spacing: 1px; }
  .receipt-title { font-size: 13px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
  .bill-code { font-size: 11px; color: #999; font-family: monospace; margin-top: 6px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .row .label { color: #555; }
  .row .value { font-weight: 500; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { border-bottom: 1px solid #ccc; }
  th { text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  th.item-cell, td.item-cell { text-align: right; }
  td { padding: 7px 8px; border-bottom: 1px solid #f0f0f0; }
  td.item-name { color: #333; }
  td.item-total { font-weight: 600; }
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
  <div class="receipt-title">Laboratory Receipt</div>
  <div class="bill-code">${bill.lab_bill_code}</div>
</div>

<div class="section">
  <div class="section-title">Patient Information</div>
  <div class="row"><span class="label">Patient Name</span><span class="value">${bill.patient_name || "—"}</span></div>
  <div class="row"><span class="label">Appointment</span><span class="value">${bill.appointment_code || (bill.appointment ? "#" + bill.appointment : "—")}</span></div>
</div>

<div class="section">
  <div class="section-title">Lab Tests Performed</div>
  <table>
    <thead>
      <tr>
        <th>Test Name</th>
        <th class="item-cell">Qty</th>
        <th class="item-cell">Unit Price</th>
        <th class="item-cell">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="4" style="text-align:center;color:#aaa;">No items</td></tr>'}
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Payment Details</div>
  <div class="row"><span class="label">Paid On (IST)</span><span class="value">${paidOn}</span></div>
  <div class="total-row"><span>Total Amount</span><span>&#8377;${Number(bill.total_amount || 0).toFixed(2)}</span></div>
</div>

<div class="paid-stamp"><span class="paid-badge">PAID</span></div>

<div class="footer">
  Thank you for choosing Crescent Valley Hospital &bull; This is a computer generated receipt &bull; No signature required
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, "_blank", "width=720,height=900");

    if (!w) {
      URL.revokeObjectURL(url);
      return;
    }
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
            <p className="text-xs text-slate-500 font-mono">{bill.lab_bill_code}</p>
            <h2 className="text-lg font-bold text-slate-800">Print Lab Receipt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-sm text-slate-600 space-y-3">
          <p>Ready to print the <strong>paid lab receipt</strong> for:</p>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs font-mono border border-slate-200">
            <p><span className="text-slate-400">Patient:</span> {bill.patient_name || "—"}</p>
            <p><span className="text-slate-400">Amount: </span>&#8377;{Number(bill.total_amount || 0).toFixed(2)}</p>
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

export default function LabBills() {
  const toast = useToast();

  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  // View modal
  const [viewBill, setViewBill] = useState(null);

  // Pay confirmation
  const [payTarget, setPayTarget] = useState(null);
  const [paying, setPaying] = useState(false);

  // Print
  const [printBill, setPrintBill] = useState(null);
  const [printing, setPrinting] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    getLabBills(params)
      .then((r) => {
        const d = r.data.data;
        setBills(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => setError("Failed to load bills."))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  // ── Pay bill ───────────────────────────────────────────────────────────────

  const handlePay = async () => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await updateLabBill(payTarget.lab_bill_id, { status: "PAID" });
      toast.success(`Bill ${payTarget.lab_bill_code} marked as paid. Reports can now be generated.`);
      setPayTarget(null);
      load();
    } catch (e) {
      // Surface exact backend error — critical for the "incomplete tests" message
      const msg = e.response?.data?.message
        || e.response?.data?.detail
        || "Failed to update payment.";
      toast.error(msg);
      setPayTarget(null);
    } finally {
      setPaying(false);
    }
  };

  // ── Print ──────────────────────────────────────────────────────────────────

  const handlePrint = async (bill) => {
    if (bill.status !== "PAID") {
      toast.error("Only paid bills can be printed.");
      return;
    }
    setPrinting(true);
    try {
      // Fetch enriched bill data from the backend print endpoint (enforces PAID
      // check server-side and returns items + patient details).
      const res = await printLabBill(bill.lab_bill_id);
      setPrintBill(res.data.data || res.data);
    } catch (e) {
      const msg =
        e.response?.data?.message ||
        "Failed to prepare print. Only paid bills can be printed.";
      toast.error(msg);
    } finally {
      setPrinting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout sidebar={<LabSidebar />} moduleName="Lab Technician">
      <PageHeader title="Lab Bills" subtitle="Manage laboratory billing and payments" />

      {error && <Alert type="error" message={error} onClose={() => setError("")} className="mb-4" />}

      {/* Workflow notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-xs text-blue-700">
        Workflow: Complete all tests for the appointment →{" "}
        <strong>Mark as Paid</strong> → Lab report can then be generated.
        Bill total is auto-calculated as tests are completed.
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by patient name or bill code…"
        />
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading…</div>
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
                  <th className="px-4 py-3 font-semibold text-slate-600">Appt. ID</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Patient</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Total (₹)</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.lab_bill_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">
                      {b.lab_bill_code}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-700">
                      {b.appointment_code || (b.appointment ? `#${b.appointment}` : "—")}
                    </td>
                    <td className="px-4 py-3">
                      {b.patient_name || `#${b.patient}`}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {Number(b.total_amount || 0) > 0
                        ? `₹${Number(b.total_amount).toFixed(2)}`
                        : <span className="text-slate-400 text-xs italic">Pending test completion</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {/* View always available */}
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setViewBill(b)}
                          title="View Bill"
                        >
                          <FaEye />
                        </Button>

                        {b.status === "PENDING" && (
                          <Button
                            size="xs"
                            variant="success"
                            onClick={() => setPayTarget(b)}
                          >
                            Pay
                          </Button>
                        )}

                        {b.status === "CANCELLED" && (
                          <span className="text-xs text-red-500 italic px-1">
                            Cancelled
                          </span>
                        )}

                        {b.status === "PAID" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handlePrint(b)}
                            loading={printing}
                            title="Print Receipt"
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

      {/* ── Print Receipt ── */}
      {printBill && (
        <PrintReceiptModal bill={printBill} onClose={() => setPrintBill(null)} />
      )}

      {/* ── View Bill Modal ── */}
      <Modal
        isOpen={!!viewBill}
        onClose={() => setViewBill(null)}
        title={`Bill ${viewBill?.lab_bill_code || ""}`}
        size="md"
        footer={
          <div className="flex gap-2">
            {viewBill?.status === "PAID" && (
              <Button variant="outline" onClick={() => { setViewBill(null); handlePrint(viewBill); }}>
                <FaPrint className="mr-1" /> Print Receipt
              </Button>
            )}
            <Button onClick={() => setViewBill(null)}>Close</Button>
          </div>
        }
      >
        {viewBill && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1">Appointment ID</p>
                <p className="font-mono font-semibold text-emerald-700">
                  {viewBill.appointment_code || (viewBill.appointment ? `#${viewBill.appointment}` : "—")}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Patient</p>
                <p className="font-semibold">{viewBill.patient_name || `#${viewBill.patient}`}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Status</p>
                <StatusBadge status={viewBill.status} />
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Total Amount</p>
                <p className="font-semibold text-lg text-clinical-primary">
                  {Number(viewBill.total_amount || 0) > 0
                    ? `₹${Number(viewBill.total_amount).toFixed(2)}`
                    : <span className="text-slate-400 text-sm italic">Pending test completion</span>
                  }
                </p>
              </div>
              {viewBill.paid_at && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Paid On</p>
                  <p className="font-semibold">{formatISTDate(viewBill.paid_at)}</p>
                </div>
              )}
            </div>

            {/* Bill items */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Bill Items
              </p>
              {viewBill.items && viewBill.items.length > 0 ? (
                <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Test</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Unit Price</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewBill.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium">{item.test_name || `#${item.test_catalog}`}</td>
                        <td className="px-3 py-2">{item.quantity}</td>
                        <td className="px-3 py-2">₹{Number(item.unit_price).toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold">₹{Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={3} className="px-3 py-2 text-right text-slate-600">Total</td>
                      <td className="px-3 py-2 text-clinical-primary">
                        ₹{Number(viewBill.total_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="text-amber-600 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Bill items will appear here as tests are completed.
                  Total is calculated automatically once all tests are done.
                </p>
              )}
            </div>

            {viewBill.status === "PENDING" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                All test requests for this appointment must be{" "}
                <strong>completed</strong> before this bill can be marked as{" "}
                <strong>Paid</strong>. After payment, the lab report can be generated.
              </div>
            )}

            {viewBill.status === "CANCELLED" && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                This bill has been <strong>cancelled</strong> because all associated lab
                test requests for this appointment were cancelled by the doctor. No
                payment can be processed for this bill.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Pay Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        onConfirm={handlePay}
        loading={paying}
        title="Confirm Payment"
        message={
          Number(payTarget?.total_amount || 0) > 0
            ? `Mark bill ${payTarget?.lab_bill_code} (₹${Number(payTarget?.total_amount).toFixed(2)}) as PAID? ` +
              `This will allow the lab report to be generated and cannot be reversed.`
            : `All test requests for this appointment must be completed before payment. ` +
              `Once all tests are done, the total will be auto-calculated and you can mark as PAID.`
        }
      />
    </ModuleLayout>
  );
}
