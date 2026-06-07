import type {
  CreateConsultationInput,
  UpdateConsultationInput,
} from './clinical';

export const SYNC_CHANGED_EVENT = 'toxina:sync-changed';

export type OutboxStatus = 'pending' | 'failed';

export interface PatientCreatePayload {
  full_name: string;
  birth_date?: string | null;
  email?: string | null;
  phone?: string | null;
  weight?: number | null;
  age?: number | null;
  height?: number | null;
  gender?: string | null;
  medical_summary?: string | null;
  medical_history?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
}

export interface TreatmentDetailPayload {
  muscle_name: string;
  side: string;
  units: number;
}

export interface TreatmentCreatePayload {
  product_name: string;
  total_units: number;
  dilution?: number | null;
  notes?: string | null;
  clinical_summary?: string | null;
  pathology_id?: string | null;
  pathology_title?: string | null;
  adjustment_factor?: number | null;
  consultation_id?: string | null;
}

export type OutboxOperation =
  | {
      type: 'patient.create';
      localId: string;
      payload: PatientCreatePayload;
    }
  | {
      type: 'patient.update';
      patientId: string;
      payload: Partial<PatientCreatePayload>;
    }
  | {
      type: 'consultation.create';
      localId: string;
      payload: CreateConsultationInput;
    }
  | {
      type: 'consultation.update';
      consultationId: string;
      payload: UpdateConsultationInput;
    }
  | {
      type: 'treatment.create';
      localId: string;
      patientId: string;
      payload: TreatmentCreatePayload;
      details: TreatmentDetailPayload[];
      completeConsultationId?: string | null;
    };

export interface OutboxEntry {
  id: string;
  userId: string;
  operation: OutboxOperation;
  status: OutboxStatus;
  createdAt: string;
  retryCount: number;
  error?: string;
}

export interface IdMapping {
  localId: string;
  serverId: string;
  userId: string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export interface SaveTreatmentInput {
  patientId?: string;
  createPatient?: PatientCreatePayload;
  treatment: TreatmentCreatePayload;
  details: TreatmentDetailPayload[];
  completeConsultationId?: string | null;
}

export interface SaveTreatmentResult {
  treatmentId: string;
  patientId: string;
  queued: boolean;
}

export function isLocalId(id: string): boolean {
  return id.startsWith('local_');
}

export function generateLocalId(prefix: 'patient' | 'consultation' | 'treatment' = 'patient'): string {
  return `local_${prefix}_${crypto.randomUUID()}`;
}
