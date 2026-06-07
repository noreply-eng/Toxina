import { supabase } from '../supabaseClient';
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

export async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Usuario no autenticado');
  return user.id;
}

export async function fetchUpcoming(
  userId: string,
  options: FetchUpcomingOptions = {}
): Promise<Consultation[]> {
  let query = supabase
    .from('consultations')
    .select(CONSULTATION_SELECT)
    .eq('user_id', userId)
    .order('consultation_date', { ascending: true });

  if (options.from) {
    query = query.gte('consultation_date', options.from);
  }
  if (options.to) {
    query = query.lte('consultation_date', options.to);
  }
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    query = query.in('status', statuses);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Consultation[];
}

export async function fetchByPatient(patientId: string): Promise<Consultation[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('consultations')
    .select(CONSULTATION_SELECT)
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .order('consultation_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Consultation[];
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
  return data as Consultation | null;
}

export async function createConsultation(
  input: CreateConsultationInput
): Promise<Consultation> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('consultations')
    .insert({
      user_id: userId,
      patient_id: input.patient_id,
      consultation_date: input.consultation_date,
      visit_type: input.visit_type,
      treatment_type: input.treatment_type ?? null,
      pathology_id: input.pathology_id ?? null,
      notes: input.notes ?? null,
      linked_treatment_id: input.linked_treatment_id ?? null,
      status: input.status ?? 'scheduled',
    })
    .select(CONSULTATION_SELECT)
    .single();

  if (error) throw error;
  return data as Consultation;
}

export async function updateConsultation(
  id: string,
  input: UpdateConsultationInput
): Promise<Consultation> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('consultations')
    .update(input)
    .eq('user_id', userId)
    .eq('id', id)
    .select(CONSULTATION_SELECT)
    .single();

  if (error) throw error;
  return data as Consultation;
}

export async function completeConsultation(
  id: string,
  treatmentId?: string
): Promise<Consultation> {
  const updates: UpdateConsultationInput = { status: 'completed' };
  if (treatmentId) {
    const { error: linkError } = await supabase
      .from('consultations')
      .update({ linked_treatment_id: treatmentId })
      .eq('id', id);
    if (linkError) throw linkError;
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
