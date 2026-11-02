import { apiClient, streamJobProgress } from './client';

/**
 * Pipeline API service
 * Corresponds to MongoDB `jobs` & `job_events` collections
 * Starts ML measurement extraction / pipeline run
 */

export async function startPipeline(patientId, options = {}) {
  // options: { mode: "scan" | "measurements", marker_mm: 50.0, total_length_mm?: number }
  const payload = {
    mode: options.mode || 'scan',
    marker_mm: options.marker_mm || 50.0,
    total_length_mm: options.total_length_mm || null,
  };
  return apiClient.post(`/patients/${patientId}/pipeline/start`, payload);
}

export async function getJobStatus(jobId) {
  return apiClient.get(`/jobs/${jobId}`);
}

export async function getPatientJobs(patientId) {
  return apiClient.get(`/patients/${patientId}/jobs`);
}

export function subscribeJobEvents(jobId, onEvent, onError, onComplete) {
  return streamJobProgress(jobId, onEvent, onError, onComplete);
}
