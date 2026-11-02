import { apiClient } from './client';

/**
 * Meta and Health API service
 * - GET /meta returns PARAM_LIMITS for UI sliders
 * - GET /health returns database connectivity status
 */

// Fallback limits matching FastAPI schemas.py PARAM_LIMITS exactly
export const DEFAULT_PARAM_LIMITS = {
  station_diameter_mm: { min: 20, max: 220 },
  total_length_mm: { min: 60, max: 600 },
  wall_thickness_mm: { min: 2.0, max: 10.0, step: 0.1 },
  vent_hole_mm: { min: 3, max: 16, step: 0.5 },
  vent_spacing_mm: { min: 8, max: 50, step: 1 },
  seam_angle_deg: { min: 0, max: 180, step: 5 },
  tab_count: { min: 0, max: 6 },
  vent_patterns: ['grid', 'staggered'],
};

export async function getHealth() {
  const response = await fetch('/api/health');

  if (!response.ok) {
    throw new Error('Backend health check failed');
  }

  return response.json();
}

export async function getMetaLimits() {
  try {
    const res = await apiClient.get('/meta');
    return res?.parameter_limits || res || DEFAULT_PARAM_LIMITS;
  } catch (err) {
    return DEFAULT_PARAM_LIMITS;
  }
}