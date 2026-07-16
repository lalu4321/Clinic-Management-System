import API from "@/api/axiosInstance";

// ── Lab Test Catalog ────────────────────────────────────────────────────────
export const getLabTests = (params = {}) => API.get("/lab/lab-tests/", { params });
export const getLabTestById = (id) => API.get(`/lab/lab-tests/${id}/`);
export const createLabTest = (data) => API.post("/lab/lab-tests/", data);
export const updateLabTest = (id, data) => API.patch(`/lab/lab-tests/${id}/`, data);
export const deleteLabTest = (id) => API.delete(`/lab/lab-tests/${id}/`);
export const activateLabTest = (id) => API.patch(`/lab/lab-tests/${id}/activate/`);
export const deactivateLabTest = (id) => API.patch(`/lab/lab-tests/${id}/deactivate/`);

// ── Lab Test Parameters (catalog-level) ────────────────────────────────────
export const getLabParameters = (params = {}) => API.get("/lab/lab-parameters/", { params });
export const getLabParametersByTest = (labTestId) =>
  API.get("/lab/lab-parameters/", { params: { lab_test: labTestId } });
export const createLabParameter = (data) => API.post("/lab/lab-parameters/", data);
export const updateLabParameter = (id, data) => API.patch(`/lab/lab-parameters/${id}/`, data);
export const deleteLabParameter = (id) => API.delete(`/lab/lab-parameters/${id}/`);

// ── Lab Test Requests ───────────────────────────────────────────────────────
export const getLabRequests = (params = {}) => API.get("/lab/lab-requests/", { params });
export const getLabRequestById = (id) => API.get(`/lab/lab-requests/${id}/`);
export const updateLabRequest = (id, data) => API.patch(`/lab/lab-requests/${id}/`, data);

// ── Lab Test Results ────────────────────────────────────────────────────────
export const getLabDashboard = () => API.get("/lab/lab-results/dashboard/");
export const getLabResults = (params = {}) => API.get("/lab/lab-results/", { params });
export const getLabResultById = (id) => API.get(`/lab/lab-results/${id}/`);
export const createLabResult = (data) => API.post("/lab/lab-results/", data);
export const updateLabResult = (id, data) => API.patch(`/lab/lab-results/${id}/`, data);
export const deleteLabResult = (id) => API.delete(`/lab/lab-results/${id}/`);

// ── Lab Reports ─────────────────────────────────────────────────────────────
export const getLabReports = (params = {}) => API.get("/lab/lab-reports/", { params });
export const getLabReportById = (id) => API.get(`/lab/lab-reports/${id}/`);
export const createLabReport = (data) => API.post("/lab/lab-reports/", data);
export const updateLabReport = (id, data) => API.patch(`/lab/lab-reports/${id}/`, data);
// PDF download — requestId is the LabTestRequest PK (report.request)
export const downloadLabReportPDF = (requestId) =>
  API.get(`/lab/lab-requests/${requestId}/pdf/`, { responseType: "blob" });

// ── Lab Bills ───────────────────────────────────────────────────────────────
export const getLabBills = (params = {}) => API.get("/lab/lab-bills/", { params });
export const getLabBillById = (id) => API.get(`/lab/lab-bills/${id}/`);
export const createLabBill = (data) => API.post("/lab/lab-bills/", data);
export const updateLabBill = (id, data) => API.patch(`/lab/lab-bills/${id}/`, data);
export const generateLabBillItems = (id) => API.post(`/lab/lab-bills/${id}/generate_items/`);
export const printLabBill = (id) => API.get(`/lab/lab-bills/${id}/print/`);
export const getLabBillItems = (params = {}) => API.get("/lab/lab-bill-items/", { params });
