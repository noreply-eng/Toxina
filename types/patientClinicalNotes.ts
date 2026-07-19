export type ClinicalNoteType = 'evolution' | 'follow_up' | 'general';

export const CLINICAL_NOTE_TYPE_LABELS: Record<ClinicalNoteType, string> = {
  evolution: 'Evolución',
  follow_up: 'Seguimiento',
  general: 'General',
};

export interface PatientClinicalNote {
  id: string;
  user_id: string;
  patient_id: string;
  note_date: string;
  content: string;
  note_type: ClinicalNoteType;
  consultation_id?: string | null;
  treatment_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientClinicalNoteInput {
  note_date: string;
  content: string;
  note_type?: ClinicalNoteType;
  consultation_id?: string | null;
  treatment_id?: string | null;
}

export type PatientClinicalNoteUpdate = Partial<PatientClinicalNoteInput>;
