import { apiClient, API_BASE_URL } from './client';

/**
 * 3D Cast API service
 * Corresponds to MongoDB `casts` & `cast_versions` collections and CAD generator logic
 * Schemas:
 * - CastParams: { region, station_diameters_mm, total_length_mm, wall_thickness_mm, vent, seam_angle_deg, tabs }
 * - PreviewIn: { params: CastParams, quick: bool }
 * - VersionIn: { params: CastParams, label: string }
 */

export async function generateCast(patientId, castParams) {
  return apiClient.post(`/patients/${patientId}/casts`, castParams, {
    timeout: 120000, // 2 minutes for trimesh lofting & boolean CSG operations
  });
}

export async function getCast(patientId) {
  const response = await apiClient.get(`/patients/${patientId}`);
  const casts = response?.casts ?? [];
  return casts[0] ?? null;
}

export async function getCastVersions(castId) {
  return apiClient.get(`/casts/${castId}/versions`);
}

export async function saveCastVersion(castId, versionData) {
  // versionData: { params: CastParams, label?: string }
  return apiClient.post(`/casts/${castId}/versions`, versionData);
}

export async function previewCast(previewParams) {
  // previewParams: { params: CastParams, quick: boolean }
  return apiClient.post('/preview', previewParams);
}

export function getCastDownloadUrl(castId, filename) {
  return `${API_BASE_URL}/casts/${castId}/download/${encodeURIComponent(filename)}`;
}
