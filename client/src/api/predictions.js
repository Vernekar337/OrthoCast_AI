
import { apiClient } from './client';

export async function getPrediction(patientId) {
  try {
    const response = await apiClient.get(`/patients/${patientId}`);
    const predictions = response?.predictions ?? [];
    const rec = predictions[0] ?? null;
    if (!rec) return null;
    const inner = (typeof rec.data === 'object' && rec.data !== null) ? rec.data : (rec.prediction || {});
    return {
      ...inner,
      id: rec.id || rec._id,
      patient_id: rec.patient_id,
      measurement_id: rec.measurement_id,
      region: rec.region || inner.region,
      created_at: rec.created_at,
      data: inner,
    };
  } catch (err) {
    return null;
  }
}

export async function runPrediction(patientId) {
  const res = await apiClient.post(`/patients/${patientId}/predictions`);
  const inner = (typeof res?.data === 'object' && res?.data !== null) ? res.data : (res?.prediction || res || {});
  return {
    ...inner,
    id: res?.id || res?._id || res?.prediction_id,
    patient_id: res?.patient_id || patientId,
    measurement_id: res?.measurement_id,
    created_at: res?.created_at,
    data: inner,
  };
}