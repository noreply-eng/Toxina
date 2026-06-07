import type { Consultation } from '../types/clinical';
import {
  getMinutesUntilConsultation,
  isActiveConsultationStatus,
} from '../utils/consultationHelpers';

function getPatientName(consultation: Consultation): string | undefined {
  const patients = consultation.patients;
  if (!patients) return undefined;
  const patient = Array.isArray(patients) ? patients[0] : patients;
  return patient?.full_name;
}

const REMINDER_STORAGE_KEY = 'toxina_appointment_reminders_sent';

interface ReminderRecord {
  consultationId: string;
  type: '24h' | '1h';
  sentAt: string;
}

function loadSentReminders(): ReminderRecord[] {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReminderRecord[]) : [];
  } catch {
    return [];
  }
}

function saveSentReminder(record: ReminderRecord): void {
  const existing = loadSentReminders().filter(
    (r) => !(r.consultationId === record.consultationId && r.type === record.type)
  );
  existing.push(record);
  const trimmed = existing.slice(-200);
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(trimmed));
}

function wasReminderSent(consultationId: string, type: '24h' | '1h'): boolean {
  return loadSentReminders().some(
    (r) => r.consultationId === consultationId && r.type === type
  );
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function showAppointmentNotification(consultation: Consultation, type: '24h' | '1h'): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const patientName = getPatientName(consultation);
  const time = new Date(consultation.consultation_date).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const when = type === '24h' ? 'mañana' : 'en 1 hora';

  new Notification('Recordatorio de cita — Toxina DLM', {
    body: `${patientName ?? 'Paciente'} — ${consultation.treatment_type ?? 'Consulta'} a las ${time} (${when})`,
    icon: '/icons/icon-192.png',
    tag: `appointment-${consultation.id}-${type}`,
  });

  saveSentReminder({
    consultationId: consultation.id,
    type,
    sentAt: new Date().toISOString(),
  });
}

export async function updateAppBadge(count: number): Promise<void> {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
      } else {
        await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
      }
    } catch {
      // Badge API not supported or failed
    }
  }
}

export function processAppointmentReminders(
  consultations: Consultation[],
  remindersEnabled: boolean
): void {
  if (!remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const now = new Date();
  const todayActive = consultations.filter(
    (c) => isActiveConsultationStatus(c.status)
  );

  for (const consultation of todayActive) {
    const minutesUntil = getMinutesUntilConsultation(consultation.consultation_date, now);

    if (minutesUntil > 0 && minutesUntil <= 60 && !wasReminderSent(consultation.id, '1h')) {
      showAppointmentNotification(consultation, '1h');
    } else if (
      minutesUntil > 60 &&
      minutesUntil <= 24 * 60 &&
      !wasReminderSent(consultation.id, '24h')
    ) {
      showAppointmentNotification(consultation, '24h');
    }
  }
}
