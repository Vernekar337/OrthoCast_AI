import { apiClient } from './client';

/**
 * Patient API service
 * Corresponds to MongoDB `patients` collection and `PatientIn` / `PatientPatch` schemas
 */

export async function getPatients(params = {}) {
  return apiClient.get('/patients', { params });
}

export async function getPatient(patientId) {
  const response = await apiClient.get(`/patients/${patientId}`);
  return response?.patient ?? response;
}

export async function createPatient(patientData) {
  // patientData: { name, age, gender, height_cm, injury_region, swelling_stage, notes }
  return apiClient.post('/patients', patientData);
}

export async function updatePatient(patientId, patchData) {
  // patchData: PatientPatch
  return apiClient.patch(`/patients/${patientId}`, patchData);
}

export async function deletePatient(patientId) {
  return apiClient.delete(`/patients/${patientId}`);
}

export async function getDashboardStats() {
  try {
    return await apiClient.get('/dashboard/stats');
  } catch (err) {
    // If backend endpoint /dashboard/stats is not implemented, return null
    return null;
  }
}

