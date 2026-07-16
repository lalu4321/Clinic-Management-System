import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PharmacistLayout from "../components/Layout";
import { Button, Input, Select, PageHeader, FormRow } from "@/components/ui";
import { getMedicines, createInventory } from "../api/pharmacistApi";
import { useToast } from "@/context/ToastContext";
import {
  validateSupplierName,
  validateInventoryUnitPrice,
  validateInventoryQuantity,
  validateInventoryExpiryDate,
} from "@/utils/validation";

export default function AddBatch() {
  const navigate = useNavigate();
  const toast = useToast();

  const [medicines, setMedicines] = useState([]);
  const [form, setForm] = useState({
    medicine: "",
    supplier_name: "",
    purchased_date: "",
    expiry_date: "",
    unit_price: "",
    quantity_available: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMedicines({ status: "ACTIVE" })
      .then((r) => {
        const d = r.data.data;
        setMedicines(Array.isArray(d) ? d : d?.results || []);
      })
      .catch(() => toast.error("Failed to load medicines."));
  }, []);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.medicine) {
      newErrors.medicine = "Medicine is required.";
    }

    const supplierErr = validateSupplierName(form.supplier_name);
    if (supplierErr) newErrors.supplier_name = supplierErr;

    if (!form.purchased_date) {
      newErrors.purchased_date = "Purchase date is required.";
    }

    const expiryErr = validateInventoryExpiryDate(form.expiry_date);
    if (expiryErr) newErrors.expiry_date = expiryErr;

    // Additional cross-check: expiry must also be after purchase date
    if (!newErrors.expiry_date && form.purchased_date && form.expiry_date && form.expiry_date <= form.purchased_date) {
      newErrors.expiry_date = "Expiry date must be after purchase date.";
    }

    const priceErr = validateInventoryUnitPrice(form.unit_price);
    if (priceErr) newErrors.unit_price = priceErr;

    const qtyErr = validateInventoryQuantity(form.quantity_available);
    if (qtyErr) newErrors.quantity_available = qtyErr;

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        medicine: form.medicine,
        supplier_name: form.supplier_name.trim(),
        purchased_date: form.purchased_date,
        expiry_date: form.expiry_date,
        unit_price: form.unit_price,
        quantity_available: form.quantity_available,
      };

      await createInventory(payload);
      toast.success("Batch added successfully.");
      setTimeout(() => navigate("/pharmacist/inventory"), 1200);
    } catch (err) {
      if (!err.response) {
        toast.error("Unable to connect. Check your network connection.");
      } else if (err.response.status >= 500) {
        toast.error("Server error. Please try again later.");
      } else {
        const d = err.response?.data;
        if (d?.errors && typeof d.errors === "object" && !Array.isArray(d.errors)) {
          setErrors(d.errors);
        } else {
          toast.error(d?.message || "Failed to add batch.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PharmacistLayout>
      <PageHeader
        title="Add Medicine Batch"
        subtitle="Record a new inventory batch — batch number is auto-generated"
      />

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">

          <Select
            label="Medicine"
            name="medicine"
            value={form.medicine}
            onChange={change}
            error={errors.medicine}
            required
            placeholder="Select medicine"
          >
            {medicines.map((m) => (
              <option key={m.med_id} value={m.med_id}>
                {m.med_name}
              </option>
            ))}
          </Select>

          <Input
            label="Supplier Name"
            name="supplier_name"
            value={form.supplier_name}
            onChange={change}
            error={errors.supplier_name}
            required
            placeholder="e.g. MedLine Distributors"
            maxLength={20}
          />

          <FormRow>
            <Input
              label="Purchase Date"
              name="purchased_date"
              type="date"
              value={form.purchased_date}
              onChange={change}
              error={errors.purchased_date}
              required
            />
            <Input
              label="Expiry Date"
              name="expiry_date"
              type="date"
              value={form.expiry_date}
              onChange={change}
              error={errors.expiry_date}
              required
            />
          </FormRow>

          <FormRow>
            <Input
              label="Unit Price (₹)"
              name="unit_price"
              type="number"
              min="10"
              max="1000"
              step="0.01"
              value={form.unit_price}
              onChange={change}
              error={errors.unit_price}
              required
              placeholder="10 – 1000"
            />
            <Input
              label="Quantity"
              name="quantity_available"
              type="number"
              min="5"
              max="500"
              value={form.quantity_available}
              onChange={change}
              error={errors.quantity_available}
              required
              placeholder="5 – 500"
            />
          </FormRow>

          <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
            Batch number is automatically generated (e.g. BT000001) — no manual entry required.
          </p>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              Add Batch
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/pharmacist/inventory")}
            >
              Cancel
            </Button>
          </div>

        </form>
      </div>
    </PharmacistLayout>
  );
}
