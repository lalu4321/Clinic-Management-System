import API from "@/api/axiosInstance";

// Appointments
export const getDoctorAppointments = () => API.get("/doctor/dashboard-appointments/");

// Prescriptions
export const getPrescriptions = (params = {}) => API.get("/doctor/prescriptions/", { params });
export const getPrescriptionById = (id) => API.get(`/doctor/prescriptions/${id}/`);
export const createPrescription = (data) => API.post("/doctor/prescriptions/", data);
export const updatePrescription = (id, data) => API.patch(`/doctor/prescriptions/${id}/`, data);
export const deletePrescription = (id) => API.delete(`/doctor/prescriptions/${id}/`);
export const activatePrescription = (id) => API.patch(`/doctor/prescriptions/${id}/activate/`);
export const completePrescription = (id) => API.patch(`/doctor/prescriptions/${id}/complete/`);
export const cancelPrescription = (id) => API.patch(`/doctor/prescriptions/${id}/cancel/`);
// Atomic creation: prescription + items in one request; rolls back if any item fails
export const createPrescriptionWithItems = (data) => API.post("/doctor/prescriptions/create-with-items/", data);

// Prescription Items
export const getPrescriptionItems = (params = {}) => API.get("/doctor/prescription-items/", { params });
export const createPrescriptionItem = (data) => API.post("/doctor/prescription-items/", data);
export const updatePrescriptionItem = (id, data) => API.patch(`/doctor/prescription-items/${id}/`, data);
export const deletePrescriptionItem = (id) => API.delete(`/doctor/prescription-items/${id}/`);

// Lab Requests
export const getLabRequests = (params = {}) => API.get("/doctor/lab-requests/", { params });
export const createLabRequest = (data) => API.post("/doctor/lab-requests/", data);
export const deleteLabRequest = (id) => API.delete(`/doctor/lab-requests/${id}/`);

// Lab Results (read-only for doctor)
export const getDoctorLabResults = (params = {}) => API.get("/doctor/lab-results/", { params });

// Patient history by numeric ID
export const getPatientHistory = (patientId) => API.get(`/doctor/patients/${patientId}/history/`);

// Patient search by name or code
export const searchPatients = (q) => API.get("/doctor/patients/search/", { params: { q } });

// Patient record (comprehensive)
export const createPatientRecord = (data) => API.post("/doctor/patient-records/", data);

// Lab test catalog (for ordering tests in prescription form)
export const getActiveLabTests = () => API.get("/doctor/lab-tests/");

// Medicines (for prescription items)
export const getMedicines = () => API.get("/doctor/medicines/");
