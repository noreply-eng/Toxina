import {
  fetchPatientByIdCached,
  fetchPatientsCached,
  searchPatientsCached,
  type CachedFetchResult,
} from '../services/clinicalCache';
import type { PatientRecord } from '../types/patient';

export type { CachedFetchResult };

export async function fetchAllPatients(
  userId: string
): Promise<CachedFetchResult<PatientRecord[]>> {
  return fetchPatientsCached(userId);
}

export async function fetchPatientById(
  userId: string,
  patientId: string
): Promise<CachedFetchResult<PatientRecord | null>> {
  return fetchPatientByIdCached(userId, patientId);
}

export async function searchPatients(
  userId: string,
  query: string,
  limit = 10
): Promise<CachedFetchResult<PatientRecord[]>> {
  return searchPatientsCached(userId, query, limit);
}
