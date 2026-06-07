export const CONSULTATION_SELECT = `
  id,
  user_id,
  patient_id,
  consultation_date,
  visit_type,
  status,
  treatment_type,
  pathology_id,
  notes,
  linked_treatment_id,
  duration_minutes,
  completed_at,
  cancellation_reason,
  source,
  created_at,
  updated_at,
  patients (id, full_name, avatar_url)
`;
