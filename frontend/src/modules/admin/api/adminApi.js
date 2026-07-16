import API from "@/api/axiosInstance";

// Dashboard
export const getDashboard = () =>
  API.get("/admin/dashboard/");

// Roles
export const getRoles = () =>
  API.get("/admin/roles/");

// Staff
export const getStaff = () =>
  API.get("/admin/staff/");

export const createStaff = (data) =>
  API.post("/admin/staff/", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateStaff = (id, data) =>
  API.patch(`/admin/staff/${id}/`, data);

export const deleteStaff = (id) =>
  API.delete(`/admin/staff/${id}/`);

export const activateStaff = (id) =>
  API.patch(`/admin/staff/${id}/activate/`);

export const deactivateStaff = (id) =>
  API.patch(`/admin/staff/${id}/deactivate/`);

export const getStaffById = (id) =>
  API.get(`/admin/staff/${id}/`);

// DOCTOR APIs

export const getDoctors = (params = {}) =>
  API.get("/admin/doctors/", { params });

export const activateDoctor = (id) =>
  API.patch(`/admin/doctors/${id}/activate/`);

export const deactivateDoctor = (id) =>
  API.patch(`/admin/doctors/${id}/deactivate/`);
// SPECIALIZATIONS
export const getSpecializations = () =>
  API.get("/admin/specializations/");

// CREATE DOCTOR
export const createDoctor = (data) =>
  API.post("/admin/doctors/", data);

// GET STAFF (filter doctor role)
export const getDoctorStaff = () =>
  API.get("/admin/staff/?role=Doctor&is_active=true");

export const getDoctorById = (id) =>
  API.get(`/admin/doctors/${id}/`);

export const updateDoctor = (id, data) =>
  API.patch(`/admin/doctors/${id}/`, data);

// SCHEDULE APIs

export const getSchedules = (params = {}) =>
  API.get("/admin/doctor-schedules/", { params });

export const createSchedule = (data) =>
  API.post("/admin/doctor-schedules/", data);

export const activateSchedule = (id) =>
  API.patch(`/admin/doctor-schedules/${id}/activate/`);

export const deactivateSchedule = (id) =>
  API.patch(`/admin/doctor-schedules/${id}/deactivate/`);

export const updateSchedule = (id, data) =>
  API.patch(`/admin/doctor-schedules/${id}/`, data);

// SPECIALIZATION APIs

export const createSpecialization = (data) =>
  API.post("/admin/specializations/", data);

export const updateSpecialization = (id, data) =>
  API.patch(`/admin/specializations/${id}/`, data);

export const deleteSpecialization = (id) =>
  API.delete(`/admin/specializations/${id}/`);

export const activateSpecialization = (id) =>
  API.patch(`/admin/specializations/${id}/activate/`);

export const deactivateSpecialization = (id) =>
  API.patch(`/admin/specializations/${id}/deactivate/`);