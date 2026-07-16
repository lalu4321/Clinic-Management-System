import API from "@/api/axiosInstance";

// Dashboard
export const getPharmacistDashboard = () => API.get("/pharmacy/dashboard/");

// Medicines
export const getMedicines = (params = {}) => API.get("/pharmacy/medicines/", { params });
export const getMedicineById = (id) => API.get(`/pharmacy/medicines/${id}/`);
export const createMedicine = (data) => API.post("/pharmacy/medicines/", data);
export const updateMedicine = (id, data) => API.patch(`/pharmacy/medicines/${id}/`, data);
export const deleteMedicine = (id) => API.delete(`/pharmacy/medicines/${id}/`);
export const activateMedicine = (id) => API.patch(`/pharmacy/medicines/${id}/activate/`);
export const deactivateMedicine = (id) => API.patch(`/pharmacy/medicines/${id}/deactivate/`);

// Medicine Dosages
export const getMedicineDosages = (params = {}) => API.get("/pharmacy/medicine-dosages/", { params });
export const createMedicineDosage = (data) => API.post("/pharmacy/medicine-dosages/", data);
export const deleteMedicineDosage = (id) => API.delete(`/pharmacy/medicine-dosages/${id}/`);

// Inventory (Batches)
export const getInventory = (params = {}) => API.get("/pharmacy/inventory/", { params });
export const getInventoryById = (id) => API.get(`/pharmacy/inventory/${id}/`);
export const createInventory = (data) => API.post("/pharmacy/inventory/", data);
export const updateInventory = (id, data) => API.patch(`/pharmacy/inventory/${id}/`, data);
export const deleteInventory = (id) => API.delete(`/pharmacy/inventory/${id}/`);

// Prescriptions (pending)
export const getPendingPrescriptions = () => API.get("/pharmacy/prescriptions/pending/");
export const getPrescriptionDetail = (id) => API.get(`/pharmacy/prescriptions/${id}/`);

// Generate bill from prescription
export const generateBillFromPrescription = (prescriptionId) =>
  API.post(`/pharmacy/prescriptions/${prescriptionId}/generate-bill/`);

// Pharmacy Bills
export const getPharmacyBills = (params = {}) => API.get("/pharmacy/pharmacy-bills/", { params });
export const getPharmacyBillById = (id) => API.get(`/pharmacy/pharmacy-bills/${id}/`);
export const updatePharmacyBill = (id, data) => API.patch(`/pharmacy/pharmacy-bills/${id}/`, data);
export const deletePharmacyBill = (id) => API.delete(`/pharmacy/pharmacy-bills/${id}/`);

// Pharmacy Bill Items
export const getPharmacyBillItems = (params = {}) => API.get("/pharmacy/pharmacy-bill-items/", { params });

