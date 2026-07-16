import PharmacistLayout from "../components/Layout";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPharmacyBillById, updatePharmacyBill } from "../api/pharmacistApi";
import { Alert, Button, PageHeader, StatusBadge } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { formatISTDate } from "@/utils/dateUtils";
import { FaPrint } from "react-icons/fa";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function openPrintWindow(html, toast) {
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
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    getPharmacyBillById(id)
      .then((res) => setBill(res.data.data || res.data))
      .catch(() => {
        setLoadError("Failed to load bill details.");
        toast.error("Failed to load bill details.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleMarkPaid = async () => {
    setPaying(true);
    try {
      const res = await updatePharmacyBill(id, { status: "PAID" });
      setBill(res.data.data || res.data);
      toast.success("Bill marked as PAID successfully.");
    } catch (err) {
      const msg =
        err.response?.data?.errors?.status?.[0] ||
        err.response?.data?.message ||
        "Failed to mark bill as paid.";
      toast.error(Array.isArray(msg) ? msg.join(" ") : msg);
    } finally {
      setPaying(false);
    }
  };

  const handlePrint = () => {
    if (bill?.status !== "PAID") {
      toast.error("Only paid bills can be printed.");
      return;
    }
    const html = generatePharmacyReceiptHTML(bill);
    openPrintWindow(html, toast);
  };

  if (loading) {
    return (
      <PharmacistLayout>
        <div className="py-12 text-center text-slate-400">Loading...</div>
      </PharmacistLayout>
    );
  }

  if (!bill) {
    return (
      <PharmacistLayout>
        <Alert type="error" message={loadError || "Bill not found."} />
      </PharmacistLayout>
    );
  }

  const totalAmount = Number(bill.total_amount ?? 0);
  const isDispensed = bill.items?.length > 0 && totalAmount > 0;
  const canMarkPaid = bill.status === "PENDING" && isDispensed;

  return (
    <PharmacistLayout>
      <PageHeader
        title="Bill Details"
        subtitle={`Code: ${bill.pharmacy_bill_code || "—"}`}
        actions={
          <Button variant="ghost" onClick={() => navigate("/pharmacist/bills")}>
            ← Back to Bills
          </Button>
        }
      />

      {/* Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-5 grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Bill Code</p>
          <p className="font-semibold text-slate-800">{bill.pharmacy_bill_code}</p>
          <p className="text-slate-400 text-xs mt-1">
            {bill.created_at ? formatISTDate(bill.created_at) : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Prescription</p>
          <p className="font-semibold text-slate-800">#{bill.prescription}</p>
          <div className="mt-1">
            <StatusBadge status={bill.status} />
          </div>
        </div>
        <div>
          <p className="text-slate-500">Patient</p>
          <p className="font-semibold text-slate-800">{bill.patient_name || "—"}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h2 className="font-semibold text-slate-700 text-sm">Dispensed Medicines</h2>
        </div>

        {!bill.items?.length ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No medicines dispensed yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-semibold text-slate-600">Medicine</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Quantity</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Unit Price</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bill.items.map((item, index) => {
                const total = Number(item.quantity) * Number(item.unit_price || 0);
                return (
                  <tr key={item.pharmacy_bill_item_id || index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.medicine_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-slate-700">
                      ₹{Number(item.unit_price || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      ₹{total.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div className="px-5 py-4 border-t border-slate-200 text-sm text-right">
          <p className="text-lg font-bold text-slate-800">
            Total: ₹{totalAmount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-2">
        {bill.status === "PENDING" && !isDispensed && (
          <p className="text-xs text-amber-600">
            Medicines must be dispensed before payment can be accepted.
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate("/pharmacist/bills")}>
            Back
          </Button>
          {bill.status === "PENDING" && (
            <Button onClick={handleMarkPaid} loading={paying} disabled={!canMarkPaid}>
              Mark as Paid
            </Button>
          )}
          {bill.status === "PAID" && (
            <Button
              variant="success"
              onClick={handlePrint}
              className="text-green-700 border-green-300 hover:bg-green-50"
            >
              <FaPrint className="mr-1.5" /> Print Receipt
            </Button>
          )}
        </div>
      </div>

    </PharmacistLayout>
  );
}
