
import { apiClient, API_BASE_URL, uploadMultipart } from './client';


/**
 * Scan API service
 * Handles multipart scan image uploads and metadata tracking
 */

export async function uploadScan(patientId, file, angle = 'top', onProgress = null) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('angle', angle); // 'top' | 'side'

  return uploadMultipart(`/patients/${patientId}/scans`, formData, onProgress);
}

export async function getScans(patientId) {
  try {
    const res = await apiClient.get(`/patients/${patientId}/scans`);
    return res?.scans ?? res ?? [];
  } catch (err) {
    const response = await apiClient.get(`/patients/${patientId}`);
    return response?.scans ?? [];
  }
}

export async function deleteScan(patientId, scanId) {
  return apiClient.delete(`/patients/${patientId}/scans/${scanId}`);
}


// export async function measureScan(patientId, scanId) {
//   return apiClient.post(
//     `/patients/${patientId}/scans/${scanId}/measure`
//   );
// }

// export function getAnnotatedPreviewUrl(patientId, scanId) {
//   const baseURL = apiClient.defaults?.baseURL || "/api/v1";

//   return `${baseURL}/patients/${encodeURIComponent(patientId)}/scans/${encodeURIComponent(scanId)}/preview`;
// }


export async function measureScan(patientId, scanId) {
  return apiClient.post(
    `/patients/${encodeURIComponent(patientId)}/scans/${encodeURIComponent(scanId)}/measure`
  );
}

export function getAnnotatedPreviewUrl(patientId, scanId) {
  return `${API_BASE_URL}/patients/${encodeURIComponent(patientId)}/scans/${encodeURIComponent(scanId)}/preview`;
}
