import { supabase } from '../supabaseClient';
import { isOnline } from '../utils/auth';
import { getOfflineDb } from '../utils/offlineDb';
import {
  removeConsultationFromCache,
  removePatientFromCache,
  upsertConsultationInCache,
  upsertPatientInCache,
} from './clinicalCache';
import type { Consultation } from '../types/clinical';
import {
  isLocalId,
  SYNC_CHANGED_EVENT,
  type IdMapping,
  type OutboxEntry,
  type OutboxOperation,
  type SyncResult,
} from '../types/offlineSync';
import type { PatientRecord } from '../types/patient';

import { CONSULTATION_SELECT } from '../constants/consultationSelect';
import { DEFAULT_APPOINTMENT_DURATION } from '../utils/consultationHelpers';

let syncInProgress = false;

export function emitSyncChanged(): void {
  window.dispatchEvent(new CustomEvent(SYNC_CHANGED_EVENT));
}

export async function enqueueOutboxEntry(
  userId: string,
  operation: OutboxOperation
): Promise<OutboxEntry> {
  const db = await getOfflineDb();
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    userId,
    operation,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  await db.put('outbox', entry);
  emitSyncChanged();
  return entry;
}

export async function getPendingOutboxCount(userId: string): Promise<number> {
  const db = await getOfflineDb();
  const entries = await db.getAllFromIndex('outbox', 'by-user', userId);
  return entries.filter((entry) => entry.status === 'pending' || entry.status === 'failed').length;
}

export async function getPendingOutboxEntries(userId: string): Promise<OutboxEntry[]> {
  const db = await getOfflineDb();
  const entries = await db.getAllFromIndex('outbox', 'by-user', userId);
  return entries
    .filter((entry) => entry.status === 'pending' || entry.status === 'failed')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function clearOutboxForUser(userId: string): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction(['outbox', 'idMappings'], 'readwrite');

  const outboxEntries = await tx.objectStore('outbox').index('by-user').getAll(userId);
  const mappings = await tx.objectStore('idMappings').index('by-user').getAll(userId);

  await Promise.all([
    ...outboxEntries.map((entry) => tx.objectStore('outbox').delete(entry.id)),
    ...mappings.map((mapping) => tx.objectStore('idMappings').delete(mapping.localId)),
  ]);

  await tx.done;
  emitSyncChanged();
}

async function saveIdMapping(userId: string, localId: string, serverId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put('idMappings', { localId, serverId, userId });
}

async function getIdMapping(localId: string): Promise<IdMapping | undefined> {
  const db = await getOfflineDb();
  return db.get('idMappings', localId);
}

export async function resolveEntityId(id: string): Promise<string> {
  if (!isLocalId(id)) return id;

  const mapping = await getIdMapping(id);
  if (!mapping) {
    throw new Error(`Registro pendiente de sincronizar: ${id}`);
  }
  return mapping.serverId;
}

async function replacePatientIdInCache(
  userId: string,
  localId: string,
  serverPatient: PatientRecord
): Promise<void> {
  await removePatientFromCache(localId);
  await upsertPatientInCache({ ...serverPatient, user_id: userId, offlinePending: false });

  const db = await getOfflineDb();
  const consultations = await db.getAllFromIndex('consultations', 'by-patient', localId);
  for (const consultation of consultations) {
    await upsertConsultationInCache({
      ...consultation,
      patient_id: serverPatient.id,
      patients: {
        id: serverPatient.id,
        full_name: serverPatient.full_name,
        avatar_url: serverPatient.avatar_url ?? null,
      },
    });
  }
}

async function replaceConsultationIdInCache(
  localId: string,
  serverConsultation: Consultation
): Promise<void> {
  await removeConsultationFromCache(localId);
  await upsertConsultationInCache(serverConsultation);
}

async function markOutboxFailed(entry: OutboxEntry, error: string): Promise<void> {
  const db = await getOfflineDb();
  await db.put('outbox', {
    ...entry,
    status: 'failed',
    error,
    retryCount: entry.retryCount + 1,
  });
  emitSyncChanged();
}

async function removeOutboxEntry(entryId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete('outbox', entryId);
  emitSyncChanged();
}

async function processOutboxEntry(userId: string, entry: OutboxEntry): Promise<void> {
  switch (entry.operation.type) {
    case 'patient.create': {
      const { localId, payload } = entry.operation;
      const { data, error } = await supabase
        .from('patients')
        .insert({ ...payload, user_id: userId })
        .select('*')
        .single();

      if (error) throw error;

      await saveIdMapping(userId, localId, data.id);
      await replacePatientIdInCache(userId, localId, data as PatientRecord);
      break;
    }

    case 'patient.update': {
      const patientId = await resolveEntityId(entry.operation.patientId);
      const { error } = await supabase
        .from('patients')
        .update(entry.operation.payload)
        .eq('user_id', userId)
        .eq('id', patientId);

      if (error) throw error;

      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', userId)
        .eq('id', patientId)
        .single();

      if (data) {
        await upsertPatientInCache({ ...(data as PatientRecord), offlinePending: false });
      }
      break;
    }

    case 'consultation.create': {
      const { localId, payload } = entry.operation;
      const patientId = await resolveEntityId(payload.patient_id);
      let linkedTreatmentId = payload.linked_treatment_id ?? null;
      if (linkedTreatmentId) {
        linkedTreatmentId = await resolveEntityId(linkedTreatmentId);
      }

      const { data, error } = await supabase
        .from('consultations')
        .insert({
          user_id: userId,
          patient_id: patientId,
          consultation_date: payload.consultation_date,
          visit_type: payload.visit_type,
          treatment_type: payload.treatment_type ?? null,
          pathology_id: payload.pathology_id ?? null,
          notes: payload.notes ?? null,
          linked_treatment_id: linkedTreatmentId,
          status: payload.status ?? 'scheduled',
          duration_minutes: payload.duration_minutes ?? DEFAULT_APPOINTMENT_DURATION,
          source: payload.source ?? 'manual',
        })
        .select(CONSULTATION_SELECT)
        .single();

      if (error) throw error;

      await saveIdMapping(userId, localId, data.id);
      await replaceConsultationIdInCache(localId, data as Consultation);
      break;
    }

    case 'consultation.update': {
      const consultationId = await resolveEntityId(entry.operation.consultationId);
      const payload = { ...entry.operation.payload };

      if (payload.linked_treatment_id) {
        payload.linked_treatment_id = await resolveEntityId(payload.linked_treatment_id);
      }

      const { data, error } = await supabase
        .from('consultations')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', consultationId)
        .select(CONSULTATION_SELECT)
        .single();

      if (error) throw error;
      await upsertConsultationInCache(data as Consultation);
      break;
    }

    case 'treatment.create': {
      const { localId, patientId, payload, details, completeConsultationId } = entry.operation;
      const resolvedPatientId = await resolveEntityId(patientId);

      let consultationId = payload.consultation_id ?? null;
      if (consultationId) {
        consultationId = await resolveEntityId(consultationId);
      }

      const { data: treatment, error: treatmentError } = await supabase
        .from('treatments')
        .insert({
          user_id: userId,
          patient_id: resolvedPatientId,
          product_name: payload.product_name,
          total_units: payload.total_units,
          dilution: payload.dilution ?? null,
          notes: payload.notes ?? null,
          clinical_summary: payload.clinical_summary ?? null,
          pathology_id: payload.pathology_id ?? null,
          pathology_title: payload.pathology_title ?? null,
          adjustment_factor: payload.adjustment_factor ?? null,
          consultation_id: consultationId,
        })
        .select('*')
        .single();

      if (treatmentError) throw treatmentError;

      const detailRows = details.map((detail) => ({
        treatment_id: treatment.id,
        muscle_name: detail.muscle_name,
        side: detail.side,
        units: detail.units,
      }));

      const { error: detailsError } = await supabase.from('treatment_details').insert(detailRows);
      if (detailsError) throw detailsError;

      await saveIdMapping(userId, localId, treatment.id);

      if (completeConsultationId) {
        const resolvedConsultationId = await resolveEntityId(completeConsultationId);
        const { data: consultation, error: consultationError } = await supabase
          .from('consultations')
          .update({
            status: 'completed',
            linked_treatment_id: treatment.id,
          })
          .eq('user_id', userId)
          .eq('id', resolvedConsultationId)
          .select(CONSULTATION_SELECT)
          .single();

        if (consultationError) throw consultationError;
        await upsertConsultationInCache(consultation as Consultation);
      }
      break;
    }

    default:
      throw new Error('Operación de sincronización desconocida');
  }
}

export async function syncPendingChanges(userId: string): Promise<SyncResult> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, errors: ['Sin conexión'] };
  }

  if (syncInProgress) {
    return { synced: 0, failed: 0, errors: [] };
  }

  syncInProgress = true;
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  try {
    const entries = await getPendingOutboxEntries(userId);

    for (const entry of entries) {
      try {
        await processOutboxEntry(userId, entry);
        await removeOutboxEntry(entry.id);
        result.synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error de sincronización';
        await markOutboxFailed(entry, message);
        result.failed += 1;
        result.errors.push(message);
        break;
      }
    }
  } finally {
    syncInProgress = false;
    emitSyncChanged();
  }

  return result;
}

export async function retryFailedSync(userId: string): Promise<SyncResult> {
  const db = await getOfflineDb();
  const entries = await db.getAllFromIndex('outbox', 'by-user', userId);

  for (const entry of entries) {
    if (entry.status === 'failed') {
      await db.put('outbox', { ...entry, status: 'pending', error: undefined });
    }
  }

  emitSyncChanged();
  return syncPendingChanges(userId);
}

export { SYNC_CHANGED_EVENT };
