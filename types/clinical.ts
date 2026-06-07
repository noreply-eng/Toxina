export type VisitType = 'new_application' | 'post_application_review';

export type ConsultationStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  new_application: 'Nueva aplicación',
  post_application_review: 'Revaloración post-aplicación',
};

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  scheduled: 'Programada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export interface ConsultationPatient {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface Consultation {
  id: string;
  user_id: string;
  patient_id: string;
  consultation_date: string;
  visit_type: VisitType;
  status: ConsultationStatus;
  treatment_type: string | null;
  pathology_id: string | null;
  notes: string | null;
  linked_treatment_id: string | null;
  created_at: string;
  updated_at: string;
  patients?: ConsultationPatient | ConsultationPatient[];
}

export interface CreateConsultationInput {
  patient_id: string;
  consultation_date: string;
  visit_type: VisitType;
  treatment_type?: string | null;
  pathology_id?: string | null;
  notes?: string | null;
  linked_treatment_id?: string | null;
  status?: ConsultationStatus;
}

export interface UpdateConsultationInput {
  consultation_date?: string;
  visit_type?: VisitType;
  treatment_type?: string | null;
  pathology_id?: string | null;
  notes?: string | null;
  linked_treatment_id?: string | null;
  status?: ConsultationStatus;
}

export interface FetchUpcomingOptions {
  from?: string;
  to?: string;
  status?: ConsultationStatus | ConsultationStatus[];
  limit?: number;
}
