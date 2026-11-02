import axios from 'axios';

// Base URL resolution: honors VITE_API_BASE_URL, falls back to relative /api or localhost
const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Strip trailing slash if present
    return envUrl.replace(/\/+$/, '');
  }
  return '/api/v1';
};

export const API_BASE_URL = resolveBaseUrl();

// Centralized Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s standard timeout for clinical API
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Standardized API Error format
 */
export class ApiClientError extends Error {
  constructor(status, code, message, hint = null, raw = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.raw = raw;
  }
}

// Response interceptor to normalize error responses
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle offline status
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      throw new ApiClientError(
        0,
        'offline',
        'Device is offline. Check clinical network connectivity.',
        'Reconnect to hospital or local network.'
      );
    }

    if (error.response) {
      const { status, data } = error.response;
      // FastAPI ApiError format: { detail: { code, message, hint } } or { detail: "message" }
      let message = 'An unexpected server error occurred.';
      let code = 'server_error';
      let hint = null;

      if (typeof data?.detail === 'string') {
        message = data.detail;
        code = `http_${status}`;
      } else if (data?.detail && typeof data.detail === 'object') {
        if (Array.isArray(data.detail)) {
          // FastAPI Pydantic validation error format
          code = 'validation_error';
          message = data.detail.map((err) => `${err.loc?.slice(1).join('.')}: ${err.msg}`).join(', ');
          hint = 'Please check the entered values match clinical parameter boundaries.';
        } else {
          message = data.detail.message || data.detail.msg || message;
          code = data.detail.code || code;
          hint = data.detail.hint || null;
        }
      } else if (data?.message) {
        message = data.message;
        code = data.code || `http_${status}`;
        hint = data.hint || null;
      }

      throw new ApiClientError(status, code, message, hint, data);
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new ApiClientError(
        408,
        'timeout',
        'Request timed out. Pipeline or CAD server took too long to respond.',
        'Check backend processing load or try again.'
      );
    }

    // Network error / server unreachable
    throw new ApiClientError(
      0,
      'network_error',
      'Unable to connect to OrthoCast backend service.',
      `Check if FastAPI server is running on ${API_BASE_URL} and MongoDB service is active.`,
      error
    );
  }
);

/**
 * Helper for multipart form upload with upload progress
 */
export async function uploadMultipart(url, formData, onUploadProgress) {
  return apiClient.post(url, formData, {
    headers: {
      // Allow browser and Axios to automatically compute Content-Type with boundary
      'Content-Type': undefined,
    },
    timeout: 120000, // 2 minutes for high-res photo/DICOM/scan uploads
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percent, progressEvent.loaded, progressEvent.total);
      }
    },
  });
}

/**
 * Server-Sent Events / Stream reader for pipeline job tracking
 */
export function streamJobProgress(jobId, onEvent, onError, onComplete) {
  let active = true;
  let seenSeq = 0;

  const poll = async () => {
    if (!active) return;
    try {
      // 1. Fetch latest events list
      try {
        const eventsRes = await apiClient.get(`/jobs/${jobId}/events`);
        const eventList = eventsRes?.events || [];
        for (const evt of eventList) {
          if (evt.seq > seenSeq) {
            seenSeq = evt.seq;
            if (onEvent) onEvent(evt);
          }
        }
      } catch (evtErr) {
        // Continue to main status check
      }

      // 2. Fetch main job document
      const job = await apiClient.get(`/jobs/${jobId}`);
      if (!active) return;
      if (onEvent && seenSeq === 0) onEvent(job);

      if (job.status === 'completed') {
        active = false;
        if (onComplete) onComplete(job);
      } else if (job.status === 'failed') {
        active = false;
        const errDetail = (typeof job.error === 'object' && job.error?.message) ? job.error.message : (job.error || 'Job processing failed');
        if (onError) onError(new ApiClientError(500, 'job_failed', errDetail));
      }
    } catch (e) {
      // Transient network retry
    }
  };

  poll();
  const interval = setInterval(poll, 1500);

  return () => {
    active = false;
    clearInterval(interval);
  };
}

export default apiClient;
