import { supabase } from '../supabaseClient';
import { isOnline } from '../utils/auth';
import { getOfflineDb, type ClinicalCacheMeta } from '../utils/offlineDb';
import { clearOutboxForUser } from './offlineSync';
import type { Consultation, FetchUpcomingOptions } from '../types/clinical';
import type { PatientRecord } from '../types/patient';

export type { ClinicalCacheMeta };

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

const PREFETCH_CONSULTATION_LIMIT = 500;

export interface CachedFetchResult<T> {
  data: T;
  fromCache: boolean;
}

function filterConsultations(
  consultations: Consultation[],
  options: FetchUpcomingOptions = {}
): Consultation[] {
  let result = [...consultations];

  if (options.from) {
    result = result.filter((c) => c.consultation_date >= options.from!);
  }
  if (options.to) {
    result = result.filter((c) => c.consultation_date <= options.to!);
  }
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    result = result.filter((c) => statuses.includes(c.status));
  }

  result.sort((a, b) => a.consultation_date.localeCompare(b.consultation_date));

  if (options.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

async function readPatientsForUser(userId: string): Promise<PatientRecord[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex('patients', 'by-user', userId);
}

async function readConsultationsForUser(userId: string): Promise<Consultation[]> {
  const db = await getOfflineDb();
  return db.getAllFromIndex('consultations', 'by-user', userId);
}

export async function getClinicalCacheMeta(userId: string): Promise<ClinicalCacheMeta | null> {
  const db = await getOfflineDb();
  return (await db.get('meta', userId)) ?? null;
}

export async function replacePatientsCache(
  userId: string,
  patients: PatientRecord[]
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('patients', 'readwrite');
  const existing = await tx.store.index('by-user').getAllKeys(userId);
  await Promise.all(existing.map((id) => tx.store.delete(id)));
  await Promise.all(patients.map((patient) => tx.store.put({ ...patient, user_id: userId })));
  await tx.done;
}

export async function replaceConsultationsCache(
  userId: string,
  consultations: Consultation[]
): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('consultations', 'readwrite');
  const existing = await tx.store.index('by-user').getAllKeys(userId);
  await Promise.all(existing.map((id) => tx.store.delete(id)));
  await Promise.all(consultations.map((consultation) => tx.store.put(consultation)));
  await tx.done;
}

export async function upsertPatientInCache(patient: PatientRecord): Promise<void> {
  const db = await getOfflineDb();
  await db.put('patients', patient);
}

export async function removePatientFromCache(patientId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('patients', patientId);
}

export async function upsertConsultationInCache(consultation: Consultation): Promise<void> {
  const db = await getOfflineDb();
  await db.put('consultations', consultation);
}

export async function removeConsultationFromCache(consultationId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('consultations', consultationId);
}

async function updateCacheMeta(
  userId: string,
  patientsCount: number,
  consultationsCount: number
): Promise<void> {
  const db = await getOfflineDb();
  await db.put('meta', {
    userId,
    lastSyncedAt: new Date().toISOString(),
    patientsCount,
    consultationsCount,
  });
}

export async function prefetchClinicalData(userId: string): Promise<void> {
  if (!isOnline()) return;

  const [patientsResult, consultationsResult] = await Promise.all([
    supabase.from('patients').select('*').eq('user_id', userId).order('full_name'),
    supabase
      .from('consultations')
      .select(CONSULTATION_SELECT)
      .eq('user_id', userId)
      .order('consultation_date', { ascending: true })
      .limit(PREFETCH_CONSULTATION_LIMIT),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (consultationsResult.error) throw consultationsResult.error;

  const patients = (patientsResult.data ?? []) as PatientRecord[];
  const consultations = (consultationsResult.data ?? []) as Consultation[];

  await replacePatientsCache(userId, patients);
  await replaceConsultationsCache(userId, consultations);
  await updateCacheMeta(userId, patients.length, consultations.length);
}

export async function clearClinicalCacheForUser(userId: string): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(['patients', 'consultations', 'meta'], 'readwrite');

  const patientKeys = await tx.objectStore('patients').index('by-user').getAllKeys(userId);
  const consultationKeys = await tx.objectStore('consultations').index('by-user').getAllKeys(userId);

  await Promise.all([
    ...patientKeys.map((id) => tx.objectStore('patients').delete(id)),
    ...consultationKeys.map((id) => tx.objectStore('consultations').delete(id)),
    tx.objectStore('meta').delete(userId),
  ]);

  await tx.done;
  await clearOutboxForUser(userId);
}

export async function fetchPatientsCached(
  userId: string
): Promise<CachedFetchResult<PatientRecord[]>> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .order('full_name');

      if (error) throw error;

      const patients = (data ?? []) as PatientRecord[];
      await replacePatientsCache(userId, patients);

      const meta = await getClinicalCacheMeta(userId);
      await updateCacheMeta(
        userId,
        patients.length,
        meta?.consultationsCount ?? 0
      );

      return { data: patients, fromCache: false };
    } catch (error) {
      console.warn('Patients network fetch failed, using cache:', error);
      const cached = await readPatientsForUser(userId);
      return { data: cached.sort((a, b) => a.full_name.localeCompare(b.full_name)), fromCache: true };
    }
  }

  const cached = await readPatientsForUser(userId);
  return { data: cached.sort((a, b) => a.full_name.localeCompare(b.full_name)), fromCache: true };
}

export async function fetchPatientByIdCached(
  userId: string,
  patientId: string
): Promise<CachedFetchResult<PatientRecord | null>> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .eq('id', patientId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        await upsertPatientInCache(data as PatientRecord);
      }
      return { data: (data as PatientRecord | null) ?? null, fromCache: false };
    } catch (error) {
      console.warn('Patient fetch failed, using cache:', error);
      const db = await getOfflineDb();
      const cached = await db.get('patients', patientId);
      if (cached?.user_id === userId) {
        return { data: cached, fromCache: true };
      }
      return { data: null, fromCache: true };
    }
  }

  const db = await getOfflineDb();
  const cached = await db.get('patients', patientId);
  if (cached?.user_id === userId) {
    return { data: cached, fromCache: true };
  }
  return { data: null, fromCache: true };
}

export async function searchPatientsCached(
  userId: string,
  query: string,
  limit = 10
): Promise<CachedFetchResult<PatientRecord[]>> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) {
    return { data: [], fromCache: false };
  }

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .ilike('full_name', `%${query.trim()}%`)
        .limit(limit);

      if (error) throw error;

      const patients = (data ?? []) as PatientRecord[];
      await Promise.all(patients.map((patient) => upsertPatientInCache(patient)));
      return { data: patients, fromCache: false };
    } catch (error) {
      console.warn('Patient search failed, using cache:', error);
    }
  }

  const cached = await readPatientsForUser(userId);
  const filtered = cached
    .filter((patient) => patient.full_name.toLowerCase().includes(normalized))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .slice(0, limit);

  return { data: filtered, fromCache: true };
}

export async function fetchUpcomingCached(
  userId: string,
  options: FetchUpcomingOptions = {}
): Promise<CachedFetchResult<Consultation[]>> {
  if (isOnline()) {
    try {
      let query = supabase
        .from('consultations')
        .select(CONSULTATION_SELECT)
        .eq('user_id', userId)
        .order('consultation_date', { ascending: true });

      if (options.from) query = query.gte('consultation_date', options.from);
      if (options.to) query = query.lte('consultation_date', options.to);
      if (options.status) {
        const statuses = Array.isArray(options.status) ? options.status : [options.status];
        query = query.in('status', statuses);
      }
      if (options.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;

      const consultations = (data ?? []) as Consultation[];
      await Promise.all(consultations.map((item) => upsertConsultationInCache(item)));

      return { data: consultations, fromCache: false };
    } catch (error) {
      console.warn('Consultations network fetch failed, using cache:', error);
      const cached = filterConsultations(await readConsultationsForUser(userId), options);
      return { data: cached, fromCache: true };
    }
  }

  const cached = filterConsultations(await readConsultationsForUser(userId), options);
  return { data: cached, fromCache: true };
}

export async function fetchConsultationsByPatientCached(
  userId: string,
  patientId: string
): Promise<CachedFetchResult<Consultation[]>> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('consultations')
        .select(CONSULTATION_SELECT)
        .eq('user_id', userId)
        .eq('patient_id', patientId)
        .order('consultation_date', { ascending: false });

      if (error) throw error;

      const consultations = (data ?? []) as Consultation[];
      await Promise.all(consultations.map((item) => upsertConsultationInCache(item)));
      return { data: consultations, fromCache: false };
    } catch (error) {
      console.warn('Patient consultations fetch failed, using cache:', error);
    }
  }

  const db = await getOfflineDb();
  const cached = await db.getAllFromIndex('consultations', 'by-patient', patientId);
  const filtered = cached
    .filter((item) => item.user_id === userId)
    .sort((a, b) => b.consultation_date.localeCompare(a.consultation_date));

  return { data: filtered, fromCache: true };
}
