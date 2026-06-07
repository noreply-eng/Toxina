import { supabase } from '../supabaseClient';
import { isOnline } from '../utils/auth';
import { getOfflineDb } from '../utils/offlineDb';
import { upsertConsultationInCache, upsertPatientInCache } from './clinicalCache';
import { enqueueOutboxEntry, syncPendingChanges } from './offlineSync';
import type {
  Consultation,
  CreateConsultationInput,
  UpdateConsultationInput,
} from '../types/clinical';
import type {
  PatientCreatePayload,
  SaveTreatmentInput,
  SaveTreatmentResult,
} from '../types/offlineSync';
import { generateLocalId, isLocalId } from '../types/offlineSync';
import type { PatientRecord } from '../types/patient';

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

async function getCachedPatient(patientId: string): Promise<PatientRecord | undefined> {
  const db = await getOfflineDb();
  return db.get('patients', patientId);
}

async function getPendingPatientCreateEntry(userId: string, localId: string) {
  const db = await getOfflineDb();
  const entries = await db.getAllFromIndex('outbox', 'by-user', userId);
  return entries.find(
    (entry) =>
      entry.operation.type === 'patient.create' &&
      entry.operation.localId === localId &&
      entry.status === 'pending'
  );
}

async function trySyncIfOnline(userId: string): Promise<void> {
  if (isOnline()) {
    await syncPendingChanges(userId);
  }
}

export async function createPatientMutation(
  userId: string,
  payload: PatientCreatePayload
): Promise<PatientRecord> {
  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .insert({ ...payload, user_id: userId })
        .select('*')
        .single();

      if (error) throw error;
      const patient = { ...(data as PatientRecord), offlinePending: false };
      await upsertPatientInCache(patient);
      return patient;
    } catch (error) {
      if (isOnline()) throw error;
    }
  }

  const localId = generateLocalId('patient');
  const now = new Date().toISOString();
  const optimistic: PatientRecord = {
    id: localId,
    user_id: userId,
    ...payload,
    created_at: now,
    offlinePending: true,
  };

  await upsertPatientInCache(optimistic);
  await enqueueOutboxEntry(userId, {
    type: 'patient.create',
    localId,
    payload,
  });

  return optimistic;
}

export async function updatePatientMutation(
  userId: string,
  patientId: string,
  payload: Partial<PatientCreatePayload>
): Promise<PatientRecord> {
  const existing = await getCachedPatient(patientId);

  if (isLocalId(patientId)) {
    const pendingCreate = await getPendingPatientCreateEntry(userId, patientId);
    if (pendingCreate && pendingCreate.operation.type === 'patient.create') {
      const mergedPayload = { ...pendingCreate.operation.payload, ...payload };
      const db = await getOfflineDb();
      await db.put('outbox', {
        ...pendingCreate,
        operation: {
          type: 'patient.create',
          localId: patientId,
          payload: mergedPayload,
        },
      });

      const optimistic = {
        ...(existing ?? { id: patientId, user_id: userId, full_name: payload.full_name ?? '' }),
        ...payload,
        offlinePending: true,
      } as PatientRecord;

      await upsertPatientInCache(optimistic);
      return optimistic;
    }
  }

  if (isOnline()) {
    try {
      const { data, error } = await supabase
        .from('patients')
        .update(payload)
        .eq('user_id', userId)
        .eq('id', patientId)
        .select('*')
        .single();

      if (error) throw error;
      const patient = { ...(data as PatientRecord), offlinePending: false };
      await upsertPatientInCache(patient);
      await trySyncIfOnline(userId);
      return patient;
    } catch (error) {
      if (isOnline()) throw error;
    }
  }

  const optimistic = {
    ...(existing ?? { id: patientId, user_id: userId, full_name: payload.full_name ?? 'Paciente' }),
    ...payload,
    offlinePending: true,
  } as PatientRecord;

  await upsertPatientInCache(optimistic);
  await enqueueOutboxEntry(userId, {
    type: 'patient.update',
    patientId,
    payload,
  });

  return optimistic;
}

function buildOptimisticConsultation(
  userId: string,
  localId: string,
  input: CreateConsultationInput,
  patient?: PatientRecord | null
): Consultation {
  const now = new Date().toISOString();
  return {
    id: localId,
    user_id: userId,
    patient_id: input.patient_id,
    consultation_date: input.consultation_date,
    visit_type: input.visit_type,
    status: input.status ?? 'scheduled',
    treatment_type: input.treatment_type ?? null,
    pathology_id: input.pathology_id ?? null,
    notes: input.notes ?? null,
    linked_treatment_id: input.linked_treatment_id ?? null,
    created_at: now,
    updated_at: now,
    patients: patient
      ? {
          id: patient.id,
          full_name: patient.full_name,
          avatar_url: patient.avatar_url ?? null,
        }
      : undefined,
  };
}

export async function createConsultationMutation(
  userId: string,
  input: CreateConsultationInput
): Promise<Consultation> {
  const mustQueue =
    !isOnline() ||
    isLocalId(input.patient_id) ||
    Boolean(input.linked_treatment_id && isLocalId(input.linked_treatment_id));

  if (!mustQueue) {
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
    const consultation = data as Consultation;
    await upsertConsultationInCache(consultation);
    await trySyncIfOnline(userId);
    return consultation;
  }

  const localId = generateLocalId('consultation');
  const patient = await getCachedPatient(input.patient_id);
  const optimistic = buildOptimisticConsultation(userId, localId, input, patient);

  await upsertConsultationInCache(optimistic);
  await enqueueOutboxEntry(userId, {
    type: 'consultation.create',
    localId,
    payload: input,
  });

  return optimistic;
}

export async function updateConsultationMutation(
  userId: string,
  consultationId: string,
  input: UpdateConsultationInput
): Promise<Consultation> {
  const db = await getOfflineDb();
  const existing =
    (await db.get('consultations', consultationId)) ??
    ({
      id: consultationId,
      user_id: userId,
      patient_id: '',
      consultation_date: new Date().toISOString(),
      visit_type: 'new_application',
      status: 'scheduled',
      treatment_type: null,
      pathology_id: null,
      notes: null,
      linked_treatment_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Consultation);

  const mustQueue =
    !isOnline() ||
    isLocalId(consultationId) ||
    Boolean(input.linked_treatment_id && isLocalId(input.linked_treatment_id));

  if (!mustQueue) {
    const { data, error } = await supabase
      .from('consultations')
      .update(input)
      .eq('user_id', userId)
      .eq('id', consultationId)
      .select(CONSULTATION_SELECT)
      .single();

    if (error) throw error;
    const consultation = data as Consultation;
    await upsertConsultationInCache(consultation);
    await trySyncIfOnline(userId);
    return consultation;
  }

  const optimistic: Consultation = {
    ...existing,
    ...input,
    updated_at: new Date().toISOString(),
  };

  await upsertConsultationInCache(optimistic);
  await enqueueOutboxEntry(userId, {
    type: 'consultation.update',
    consultationId,
    payload: input,
  });

  return optimistic;
}

export async function saveTreatmentMutation(
  userId: string,
  input: SaveTreatmentInput
): Promise<SaveTreatmentResult> {
  let patientId = input.patientId;

  if (!patientId && input.createPatient) {
    const created = await createPatientMutation(userId, input.createPatient);
    patientId = created.id;
  }

  if (!patientId) {
    throw new Error('No se pudo determinar el paciente');
  }

  const mustQueue =
    !isOnline() ||
    isLocalId(patientId) ||
    Boolean(input.treatment.consultation_id && isLocalId(input.treatment.consultation_id)) ||
    Boolean(input.completeConsultationId && isLocalId(input.completeConsultationId));

  if (!mustQueue) {
    const { data: treatment, error: treatmentError } = await supabase
      .from('treatments')
      .insert({
        user_id: userId,
        patient_id: patientId,
        product_name: input.treatment.product_name,
        total_units: input.treatment.total_units,
        dilution: input.treatment.dilution ?? null,
        notes: input.treatment.notes ?? null,
        clinical_summary: input.treatment.clinical_summary ?? null,
        pathology_id: input.treatment.pathology_id ?? null,
        pathology_title: input.treatment.pathology_title ?? null,
        adjustment_factor: input.treatment.adjustment_factor ?? null,
        consultation_id: input.treatment.consultation_id ?? null,
      })
      .select('*')
      .single();

    if (treatmentError) throw treatmentError;

    const detailRows = input.details.map((detail) => ({
      treatment_id: treatment.id,
      muscle_name: detail.muscle_name,
      side: detail.side,
      units: detail.units,
    }));

    const { error: detailsError } = await supabase.from('treatment_details').insert(detailRows);
    if (detailsError) throw detailsError;

    if (input.completeConsultationId) {
      await updateConsultationMutation(userId, input.completeConsultationId, {
        status: 'completed',
        linked_treatment_id: treatment.id,
      });
    }

    await trySyncIfOnline(userId);
    return {
      treatmentId: treatment.id,
      patientId,
      queued: false,
    };
  }

  const localTreatmentId = generateLocalId('treatment');

  await enqueueOutboxEntry(userId, {
    type: 'treatment.create',
    localId: localTreatmentId,
    patientId,
    payload: {
      ...input.treatment,
      consultation_id: input.treatment.consultation_id ?? input.completeConsultationId ?? null,
    },
    details: input.details,
    completeConsultationId: input.completeConsultationId ?? null,
  });

  if (input.completeConsultationId) {
    await updateConsultationMutation(userId, input.completeConsultationId, {
      status: 'completed',
      linked_treatment_id: localTreatmentId,
    });
  }

  return {
    treatmentId: localTreatmentId,
    patientId,
    queued: true,
  };
}
