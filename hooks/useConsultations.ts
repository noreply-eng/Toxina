import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { CONSULTATION_SELECT } from '../constants/consultationSelect';
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
import { isActiveConsultationStatus } from '../utils/consultationHelpers';
import { toQueryFrom, toQueryTo } from '../utils/dateRange';

export type { CachedFetchResult };

export { isActiveConsultationStatus, ACTIVE_CONSULTATION_STATUSES } from '../utils/consultationHelpers';

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

export async function fetchConsultationsForDay(
  userId: string,
  date: Date,
  excludeId?: string
): Promise<Consultation[]> {
  const result = await fetchUpcoming(userId, {
    from: toQueryFrom(date),
    to: toQueryTo(date),
    status: ['scheduled', 'in_progress'],
  });
  return excludeId
    ? result.data.filter((c) => c.id !== excludeId)
    : result.data;
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
  const updates: UpdateConsultationInput = {
    status: 'completed',
    completed_at: new Date().toISOString(),
  };
  if (treatmentId) {
    updates.linked_treatment_id = treatmentId;
  }
  return updateConsultation(id, updates);
}

export async function cancelConsultation(
  id: string,
  cancellationReason?: string
): Promise<Consultation> {
  return updateConsultation(id, {
    status: 'cancelled',
    cancellation_reason: cancellationReason?.trim() || null,
  });
}

export async function markConsultationInProgress(id: string): Promise<Consultation> {
  return updateConsultation(id, { status: 'in_progress' });
}

export async function markConsultationNoShow(id: string): Promise<Consultation> {
  return updateConsultation(id, { status: 'no_show' });
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

export async function fetchPatientsNeedingFollowUp(
  userId: string
): Promise<{ patientId: string; patientName: string; lastTreatmentDate: string; daysSince: number }[]> {
  const { data: treatments, error } = await supabase
    .from('treatments')
    .select('patient_id, date, patients(full_name)')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error || !treatments) return [];

  const upcoming = await fetchUpcoming(userId, {
    from: new Date().toISOString(),
    status: ['scheduled', 'in_progress'],
    visitType: 'post_application_review',
  });
  const patientsWithFollowUp = new Set(
    upcoming.data.map((c) => c.patient_id)
  );

  const latestByPatient = new Map<string, { date: string; name: string }>();
  for (const t of treatments) {
    if (latestByPatient.has(t.patient_id)) continue;
    const patients = t.patients as { full_name?: string } | { full_name?: string }[] | null;
    const name = Array.isArray(patients) ? patients[0]?.full_name : patients?.full_name;
    latestByPatient.set(t.patient_id, {
      date: t.date,
      name: name ?? 'Paciente',
    });
  }

  const now = Date.now();
  const results: { patientId: string; patientName: string; lastTreatmentDate: string; daysSince: number }[] = [];

  for (const [patientId, info] of latestByPatient) {
    if (patientsWithFollowUp.has(patientId)) continue;
    const daysSince = Math.floor((now - new Date(info.date).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 56) {
      results.push({
        patientId,
        patientName: info.name,
        lastTreatmentDate: info.date,
        daysSince,
      });
    }
  }

  return results.sort((a, b) => b.daysSince - a.daysSince).slice(0, 10);
}
