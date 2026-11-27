import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { fetchUpcoming } from '../hooks/useConsultations';
import { fetchLatestNotesByPatientIds } from './patientClinicalNotes';
import { resolvePracticeMeta } from './onboardingService';
import { sortConsultationsByDate } from '../utils/consultationHelpers';
import { toQueryFrom, toQueryTo } from '../utils/dateRange';
import type { Consultation } from '../types/clinical';
import type { PatientRecord } from '../types/patient';
import type { PatientClinicalNote } from '../types/patientClinicalNotes';
import type { GasScore } from '../constants/gasScale';

export interface DailyNotesExportOptions {
  includeLatestTreatment: boolean;
  includeClinicalAlerts: boolean;
  includeWorkSpace: boolean;
  includeCancelledOrNoShow: boolean;
  pageBreakPerPatient: boolean;
}

export const DEFAULT_DAILY_NOTES_EXPORT_OPTIONS: DailyNotesExportOptions = {
  includeLatestTreatment: true,
  includeClinicalAlerts: true,
  includeWorkSpace: true,
  includeCancelledOrNoShow: false,
  pageBreakPerPatient: false,
};

export interface LatestTreatmentSummary {
  id: string;
  date: string;
  product_name: string;
  total_units: number;
  dilution: number | null;
  pathology_title: string | null;
  clinical_summary: string | null;
  notes: string | null;
  details: Array<{
    muscle_name: string;
    side: string;
    units: number;
  }>;
}

export interface ActiveGoalSummary {
  id: string;
  title: string;
  current_score: GasScore | null;
  target_date: string | null;
}

export interface DailyPatientBriefing {
  consultation: Consultation;
  patientName: string;
  patient: PatientRecord | null;
  latestNote: PatientClinicalNote | null;
  totalNotesCount: number;
  latestTreatment: LatestTreatmentSummary | null;
  activeGoals: ActiveGoalSummary[];
}

export interface DoctorBriefingMeta {
  fullName: string | null;
  specialty: string | null;
  generalLicense: string | null;
  specialistLicense: string | null;
  clinicName: string | null;
}

export interface DailyBriefingStats {
  totalAppointments: number;
  excludedAppointments: number;
  uniquePatients: number;
  withPreviousNote: number;
  withoutPreviousNote: number;
  withAllergies: number;
  withPreviousTreatment: number;
}

export interface DailyBriefingReport {
  targetDate: Date;
  generatedAt: Date;
  doctor: DoctorBriefingMeta;
  items: DailyPatientBriefing[];
  stats: DailyBriefingStats;
  notesWarning?: string | null;
}

function getFallbackPatientName(consultation: Consultation): string {
  const rel = consultation.patients;
  const p = Array.isArray(rel) ? rel[0] : rel;
  return p?.full_name?.trim() || 'Paciente sin nombre';
}

function isIncludedStatus(status: Consultation['status'], includeCancelledOrNoShow: boolean): boolean {
  if (includeCancelledOrNoShow) return true;
  return status !== 'cancelled' && status !== 'no_show';
}

function parseCleanTreatmentNotes(notes?: string | null): {
  pathology: string | null;
  cleanNotes: string | null;
} {
  if (!notes) return { pathology: null, cleanNotes: null };
  const parts = notes.split(' | ');
  const pathologyPart = parts.find((p) => p.startsWith('Patología:'));
  const cleanNotes = parts
    .filter(
      (p) =>
        !p.startsWith('Patología:') &&
        !p.startsWith('Médico:') &&
        !p.startsWith('Factor')
    )
    .join(' | ')
    .trim();

  return {
    pathology: pathologyPart ? pathologyPart.replace('Patología: ', '').trim() : null,
    cleanNotes: cleanNotes || null,
  };
}

export async function fetchDailyPatientBriefings(
  userId: string,
  targetDate: Date,
  options: {
    consultationsForDay?: Consultation[];
    includeCancelledOrNoShow?: boolean;
  } = {}
): Promise<DailyBriefingReport> {
  const includeCancelledOrNoShow = Boolean(options.includeCancelledOrNoShow);

  let allDayConsultations = options.consultationsForDay;
  if (!allDayConsultations) {
    const result = await fetchUpcoming(userId, {
      from: toQueryFrom(targetDate),
      to: toQueryTo(targetDate),
    });
    allDayConsultations = result.data;
  }

  const sortedAll = sortConsultationsByDate(allDayConsultations);
  const includedConsultations = sortedAll.filter((c) =>
    isIncludedStatus(c.status, includeCancelledOrNoShow)
  );
  const excludedAppointments = sortedAll.length - includedConsultations.length;

  const uniquePatientIds = Array.from(
    new Set(includedConsultations.map((c) => c.patient_id).filter(Boolean))
  );

  const authUser = await getAuthUser();
  const profilePromise = supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (uniquePatientIds.length === 0) {
    const profileRes = await profilePromise;
    const profileRow = profileRes.data;
    const practiceMeta = resolvePracticeMeta(userId, profileRow, authUser?.user_metadata);

    return {
      targetDate,
      generatedAt: new Date(),
      doctor: {
        fullName: profileRow?.full_name || authUser?.user_metadata?.full_name || null,
        specialty: profileRow?.specialty || null,
        generalLicense: profileRow?.general_license || null,
        specialistLicense: profileRow?.specialist_license || null,
        clinicName: practiceMeta.clinic_name || null,
      },
      items: [],
      stats: {
        totalAppointments: 0,
        excludedAppointments,
        uniquePatients: 0,
        withPreviousNote: 0,
        withoutPreviousNote: 0,
        withAllergies: 0,
        withPreviousTreatment: 0,
      },
      notesWarning: null,
    };
  }

  const [profileSettled, patientsSettled, notesSettled, treatmentsSettled, goalsSettled] =
    await Promise.allSettled([
      profilePromise,
      supabase
        .from('patients')
        .select(
          'id, user_id, full_name, birth_date, age, weight, height, gender, phone, email, allergies, medical_summary, medical_history, current_medications, notes'
        )
        .eq('user_id', userId)
        .in('id', uniquePatientIds),
      fetchLatestNotesByPatientIds(userId, uniquePatientIds),
      supabase
        .from('treatments')
        .select(
          'id, patient_id, date, product_name, total_units, dilution, pathology_title, clinical_summary, notes, treatment_details(muscle_name, side, units)'
        )
        .eq('user_id', userId)
        .in('patient_id', uniquePatientIds)
        .order('date', { ascending: false }),
      supabase
        .from('patient_goals')
        .select('id, patient_id, title, current_score, target_date')
        .eq('user_id', userId)
        .in('patient_id', uniquePatientIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    ]);

  const profileRow =
    profileSettled.status === 'fulfilled' && !profileSettled.value.error
      ? profileSettled.value.data
      : null;
  const practiceMeta = resolvePracticeMeta(userId, profileRow, authUser?.user_metadata);

  const patientMap = new Map<string, PatientRecord>();
  if (patientsSettled.status === 'fulfilled' && !patientsSettled.value.error) {
    for (const row of (patientsSettled.value.data ?? []) as PatientRecord[]) {
      patientMap.set(row.id, row);
    }
  }

  let notesWarning: string | null = null;
  let notesMap = new Map<
    string,
    { latestNote: PatientClinicalNote | null; totalNotesCount: number }
  >();
  if (notesSettled.status === 'fulfilled') {
    notesMap = notesSettled.value;
  } else {
    console.warn('No se pudieron consultar patient_clinical_notes:', notesSettled.reason);
    notesWarning =
      'No se pudo consultar la tabla de notas clínicas (verifica tu conexión o migraciones).';
  }

  const latestTreatmentMap = new Map<string, LatestTreatmentSummary>();
  if (treatmentsSettled.status === 'fulfilled' && !treatmentsSettled.value.error) {
    for (const row of (treatmentsSettled.value.data ?? []) as Array<{
      id: string;
      patient_id: string;
      date: string;
      product_name: string;
      total_units: number;
      dilution?: number | null;
      pathology_title?: string | null;
      clinical_summary?: string | null;
      notes?: string | null;
      treatment_details?: Array<{ muscle_name: string; side: string; units: number }> | null;
    }>) {
      if (latestTreatmentMap.has(row.patient_id)) continue;
      const parsed = parseCleanTreatmentNotes(row.notes);
      latestTreatmentMap.set(row.patient_id, {
        id: row.id,
        date: row.date,
        product_name: row.product_name,
        total_units: Number(row.total_units) || 0,
        dilution: row.dilution ?? null,
        pathology_title: row.pathology_title || parsed.pathology || null,
        clinical_summary: row.clinical_summary || null,
        notes: parsed.cleanNotes,
        details: (row.treatment_details ?? []).map((d) => ({
          muscle_name: d.muscle_name,
          side: d.side,
          units: Number(d.units) || 0,
        })),
      });
    }
  }

  const goalsMap = new Map<string, ActiveGoalSummary[]>();
  if (goalsSettled.status === 'fulfilled' && !goalsSettled.value.error) {
    for (const row of (goalsSettled.value.data ?? []) as Array<{
      id: string;
      patient_id: string;
      title: string;
      current_score?: GasScore | null;
      target_date?: string | null;
    }>) {
      const list = goalsMap.get(row.patient_id) ?? [];
      list.push({
        id: row.id,
        title: row.title,
        current_score: row.current_score ?? null,
        target_date: row.target_date ?? null,
      });
      goalsMap.set(row.patient_id, list);
    }
  }

  const items: DailyPatientBriefing[] = includedConsultations.map((consultation) => {
    const patient = patientMap.get(consultation.patient_id) ?? null;
    const noteSummary = notesMap.get(consultation.patient_id);
    const latestTreatment = latestTreatmentMap.get(consultation.patient_id) ?? null;
    const activeGoals = goalsMap.get(consultation.patient_id) ?? [];

    return {
      consultation,
      patientName: patient?.full_name?.trim() || getFallbackPatientName(consultation),
      patient,
      latestNote: noteSummary?.latestNote ?? null,
      totalNotesCount: noteSummary?.totalNotesCount ?? 0,
      latestTreatment,
      activeGoals,
    };
  });

  const uniqueWithNote = new Set<string>();
  const uniqueWithAllergies = new Set<string>();
  const uniqueWithTreatment = new Set<string>();

  for (const item of items) {
    if (item.latestNote) uniqueWithNote.add(item.consultation.patient_id);
    if (item.patient?.allergies?.trim()) uniqueWithAllergies.add(item.consultation.patient_id);
    if (item.latestTreatment) uniqueWithTreatment.add(item.consultation.patient_id);
  }

  return {
    targetDate,
    generatedAt: new Date(),
    doctor: {
      fullName: profileRow?.full_name || authUser?.user_metadata?.full_name || null,
      specialty: profileRow?.specialty || null,
      generalLicense: profileRow?.general_license || null,
      specialistLicense: profileRow?.specialist_license || null,
      clinicName: practiceMeta.clinic_name || null,
    },
    items,
    stats: {
      totalAppointments: items.length,
      excludedAppointments,
      uniquePatients: uniquePatientIds.length,
      withPreviousNote: uniqueWithNote.size,
      withoutPreviousNote: uniquePatientIds.length - uniqueWithNote.size,
      withAllergies: uniqueWithAllergies.size,
      withPreviousTreatment: uniqueWithTreatment.size,
    },
    notesWarning,
  };
}
