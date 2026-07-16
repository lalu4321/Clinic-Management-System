import API from "@/api/axiosInstance";

// Dashboard
export const getReceptionDashboard = () =>
  API.get("/reception/dashboard/");

// Doctor availability
export const getDoctorAvailability = (doctorId, date) =>
  API.get("/reception/doctor-availability/", { params: { doctor: doctorId, date } });

// Patients
export const getPatients = (params = {}) =>
  API.get("/reception/patients/", { params });

export const getPatientById = (id) =>
  API.get(`/reception/patients/${id}/`);

export const createPatient = (data) =>
  API.post("/reception/patients/", data);

export const updatePatient = (id, data) =>
  API.patch(`/reception/patients/${id}/`, data);

export const deletePatient = (id) =>
  API.delete(`/reception/patients/${id}/`);

// Patient Search (scalable)
export const searchPatients = (query, page = 1, pageSize = 20) =>
  API.get("/reception/patients/search/", { params: { q: query, page, page_size: pageSize } });

export const lookupPatient = (identifier) =>
  API.get(`/reception/patients/lookup/${identifier}/`);

// Appointments
export const getAppointments = (params = {}) =>
  API.get("/reception/appointments/", { params });

export const getAppointmentById = (id) =>
  API.get(`/reception/appointments/${id}/`);

export const createAppointment = (data) =>
  API.post("/reception/appointments/", data);

export const updateAppointment = (id, data) =>
  API.patch(`/reception/appointments/${id}/`, data);

export const updateAppointmentStatus = (id, data) =>
  API.patch(`/reception/appointments/${id}/update_status/`, data);

export const deleteAppointment = (id) =>
  API.delete(`/reception/appointments/${id}/`);

// Consultation Bills
export const getConsultationBills = (params = {}) =>
  API.get("/reception/consultation-bills/", { params });

export const getConsultationBillById = (id) =>
  API.get(`/reception/consultation-bills/${id}/`);

export const updateConsultationBill = (id, data) =>
  API.patch(`/reception/consultation-bills/${id}/`, data);

export const updateBillStatus = (id, data) =>
  API.patch(`/reception/consultation-bills/${id}/update_status/`, data);

// Print receipt — backend verifies bill is PAID before returning data
export const printConsultationBill = (id) =>
  API.get(`/reception/consultation-bills/${id}/print/`);

// Active doctors for appointment booking (receptionist-accessible endpoint)
export const getActiveDoctors = () =>
  API.get("/reception/doctors/");

export const getSpecializations = () =>
  API.get("/admin/specializations/");

// Available time slots for a doctor on a given date
export const getAvailableSlots = (doctorId, date) =>
  API.get("/reception/available-slots/", { params: { doctor: doctorId, date } });

