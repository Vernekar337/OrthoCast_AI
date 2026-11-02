import { apiClient } from './client';

/**
 * Validation Report API service
 * Corresponds to MongoDB `validation_logs` collection and `ValidationLogIn` schema
 * Fields:
 * - patient_id?: string
 * - metric: string (max 40)
 * - manual_value: float
 * - system_value: float
 * - note?: string (max 200)
 */

export async function getValidationLogs(params = {}) {
  return apiClient.get('/validation', { params });
}

export async function logValidation(entry) {
  return apiClient.post('/validation', entry);
}

export async function getValidationReport() {
  return apiClient.get('/validation/report');
}

export async function getAuditTrail(patientId = null) {
  return apiClient.get('/audit', { params: patientId ? { patient_id: patientId } : {} });
}
