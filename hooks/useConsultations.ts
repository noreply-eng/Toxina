import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import {
  fetchConsultationsByPatientCached,
  fetchUpcomingCached,
  upsertConsultationInCache,
  type CachedFetchResult,
} from '../services/clinicalCache';
import {
  createConsultationMutation,
  updateConsultationMutation,
} from '../services/clinicalMutations';
import type {
  Consultation,
  CreateConsultationInput,
  FetchUpcomingOptions,
  UpdateConsultationInput,
} from '../types/clinical';

const CONSULTATION_SELECT = `
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
  created_at,
  updated_at,
  patients (id, full_name, avatar_url)
`;

export type { CachedFetchResult };

export async function getCurrentUserId(): Promise<string> {
  const user = await getAuthUser();
  if (!user) throw new Error('Usuario no autenticado');
  return user.id;
}

export async function fetchUpcoming(
  userId: string,
  options: FetchUpcomingOptions = {}
): Promise<CachedFetchResult<Consultation[]>> {
  return fetchUpcomingCached(userId, options);
}

export async function fetchByPatient(
  patientId: string
): Promise<CachedFetchResult<Consultation[]>> {
  const userId = await getCurrentUserId();
  return fetchConsultationsByPatientCached(userId, patientId);
}

export async function fetchById(id: string): Promise<Consultation | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('consultations')
    .select(CONSULTATION_SELECT)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    await upsertConsultationInCache(data as Consultation);
  }
  return data as Consultation | null;
}

export async function createConsultation(
  input: CreateConsultationInput
): Promise<Consultation> {
  const userId = await getCurrentUserId();
  return createConsultationMutation(userId, input);
}

export async function updateConsultation(
  id: string,
  input: UpdateConsultationInput
): Promise<Consultation> {
  const userId = await getCurrentUserId();
  return updateConsultationMutation(userId, id, input);
}

export async function completeConsultation(
  id: string,
  treatmentId?: string
): Promise<Consultation> {
  const updates: UpdateConsultationInput = { status: 'completed' };
  if (treatmentId) {
    updates.linked_treatment_id = treatmentId;
  }
  return updateConsultation(id, updates);
}

export async function cancelConsultation(id: string): Promise<Consultation> {
  return updateConsultation(id, { status: 'cancelled' });
}

export async function markConsultationInProgress(id: string): Promise<Consultation> {
  return updateConsultation(id, { status: 'in_progress' });
}

export function getPatientFromConsultation(
  consultation: Consultation
): Consultation['patients'] extends (infer P)[] ? P : Consultation['patients'] {
  const patients = consultation.patients;
  if (!patients) return undefined as never;
  return (Array.isArray(patients) ? patients[0] : patients) as never;
}

export function formatRelativeAppointmentDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const appointmentDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  if (appointmentDay.getTime() === today.getTime()) {
    return `Hoy ${time}`;
  }
  if (appointmentDay.getTime() === tomorrow.getTime()) {
    return `Mañana ${time}`;
  }
  return `${date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${time}`;
}
