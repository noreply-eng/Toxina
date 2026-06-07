import type { Consultation, ConsultationStatus, VisitType } from '../types/clinical';
import { startOfDay, endOfDay } from './dateRange';

export const ACTIVE_CONSULTATION_STATUSES: ConsultationStatus[] = ['scheduled', 'in_progress'];

export const DEFAULT_APPOINTMENT_DURATION = 30;

export function isActiveConsultationStatus(status: ConsultationStatus): boolean {
  return ACTIVE_CONSULTATION_STATUSES.includes(status);
}

export function getConsultationDuration(consultation: Consultation): number {
  return consultation.duration_minutes ?? DEFAULT_APPOINTMENT_DURATION;
}

export function getConsultationEndDate(consultation: Consultation): Date {
  const start = new Date(consultation.consultation_date);
  return new Date(start.getTime() + getConsultationDuration(consultation) * 60_000);
}

export function consultationsOverlap(
  aStart: Date,
  aDurationMinutes: number,
  bStart: Date,
  bDurationMinutes: number
): boolean {
  const aEnd = new Date(aStart.getTime() + aDurationMinutes * 60_000);
  const bEnd = new Date(bStart.getTime() + bDurationMinutes * 60_000);
  return aStart < bEnd && bStart < aEnd;
}

export interface OverlapWarning {
  consultation: Consultation;
  patientName?: string;
}

export function findOverlappingConsultations(
  consultations: Consultation[],
  startDate: Date,
  durationMinutes: number,
  excludeId?: string
): OverlapWarning[] {
  return consultations
    .filter((c) => c.id !== excludeId && isActiveConsultationStatus(c.status))
    .filter((c) =>
      consultationsOverlap(
        startDate,
        durationMinutes,
        new Date(c.consultation_date),
        getConsultationDuration(c)
      )
    )
    .map((consultation) => ({
      consultation,
      patientName: Array.isArray(consultation.patients)
        ? consultation.patients[0]?.full_name
        : consultation.patients?.full_name,
    }));
}

export function sortConsultationsByDate(consultations: Consultation[]): Consultation[] {
  return [...consultations].sort((a, b) =>
    a.consultation_date.localeCompare(b.consultation_date)
  );
}

export function filterConsultationsBySearch(
  consultations: Consultation[],
  query: string
): Consultation[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return consultations;

  return consultations.filter((c) => {
    const patient = Array.isArray(c.patients) ? c.patients[0] : c.patients;
    const name = patient?.full_name?.toLowerCase() ?? '';
    const treatment = c.treatment_type?.toLowerCase() ?? '';
    const notes = c.notes?.toLowerCase() ?? '';
    return name.includes(normalized) || treatment.includes(normalized) || notes.includes(normalized);
  });
}

export function filterConsultationsByVisitType(
  consultations: Consultation[],
  visitType: VisitType | 'all'
): Consultation[] {
  if (visitType === 'all') return consultations;
  return consultations.filter((c) => c.visit_type === visitType);
}

export function filterConsultationsByStatus(
  consultations: Consultation[],
  status: ConsultationStatus | 'active' | 'all'
): Consultation[] {
  if (status === 'all') return consultations;
  if (status === 'active') {
    return consultations.filter((c) => isActiveConsultationStatus(c.status));
  }
  return consultations.filter((c) => c.status === status);
}

export function isConsultationInPast(consultationDate: string): boolean {
  return new Date(consultationDate) < new Date();
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export const TIMELINE_START_HOUR = 7;
export const TIMELINE_END_HOUR = 21;
export const TIMELINE_SLOT_MINUTES = 30;

export function getTimelineSlots(): number[] {
  const slots: number[] = [];
  for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
    slots.push(h * 60);
    slots.push(h * 60 + TIMELINE_SLOT_MINUTES);
  }
  return slots;
}

export function formatTimelineHour(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getConsultationsForDay(
  consultations: Consultation[],
  day: Date
): Consultation[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return sortConsultationsByDate(
    consultations.filter((c) => {
      const d = new Date(c.consultation_date);
      return d >= dayStart && d <= dayEnd;
    })
  );
}

export function getNextActiveConsultation(
  consultations: Consultation[],
  from: Date = new Date()
): Consultation | null {
  return (
    sortConsultationsByDate(
      consultations.filter(
        (c) =>
          isActiveConsultationStatus(c.status) && new Date(c.consultation_date) >= from
      )
    )[0] ?? null
  );
}

export function getMinutesUntilConsultation(consultationDate: string, from: Date = new Date()): number {
  return Math.round((new Date(consultationDate).getTime() - from.getTime()) / 60_000);
}
