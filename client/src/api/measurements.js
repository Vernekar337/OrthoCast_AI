import { apiClient } from './client';

/**
 * Measurement API service
 * Corresponds to MongoDB `measurements` collection and `MeasurementIn` schema
 * Constraints from schemas.py:
 * - wrist_width_mm: 20 to 120 mm
 * - palm_length_mm: 40 to 150 mm
 * - hand_length_mm: 80 to 260 mm
 * - foot_length_mm: 100 to 340 mm
 * - foot_width_mm: 40 to 140 mm
 * - ankle_circumference_mm: 100 to 380 mm
 * - note: max 300 characters
 */

export const MEASUREMENT_BOUNDS = {
  wrist: {
    wrist_width_mm: { min: 20, max: 120, label: 'Wrist Width (Biepicondylar)', unit: 'mm' },
    palm_length_mm: { min: 40, max: 150, label: 'Palm Length (Crease to MCP)', unit: 'mm' },
    hand_length_mm: { min: 80, max: 260, label: 'Total Hand Length', unit: 'mm' },
  },
  ankle: {
    foot_length_mm: { min: 100, max: 340, label: 'Foot Length (Heel to Toe)', unit: 'mm' },
    foot_width_mm: { min: 40, max: 140, label: 'Foot Width (Metatarsal)', unit: 'mm' },
    ankle_circumference_mm: { min: 100, max: 380, label: 'Ankle Circumference (Malleolar)', unit: 'mm' },
  },
};

export async function saveMeasurements(patientId, measurements) {
  return apiClient.post(`/patients/${patientId}/measurements`, measurements);
}


export async function updateMeasurements(patientId, measurements) {
  // Measurements are stored as historical snapshots.
  // Use one POST request instead of PUT + POST fallback.
  return apiClient.post(
    `/patients/${patientId}/measurements`,
    measurements
  );
}


export async function getMeasurements(patientId) {
  return apiClient.get(`/patients/${patientId}/measurements`);
}
