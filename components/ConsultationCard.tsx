import React from 'react';
import VisitTypeBadge from './VisitTypeBadge';
import type { Consultation } from '../types/clinical';
import { CONSULTATION_STATUS_LABELS } from '../types/clinical';
import { getPatientFromConsultation } from '../hooks/useConsultations';
import {
  getConsultationDuration,
  getMinutesFromMidnight,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
} from '../utils/consultationHelpers';

interface ConsultationCardProps {
  consultation: Consultation;
  showDate?: boolean;
  compact?: boolean;
  onViewPatient?: () => void;
  onStart?: () => void;
  onMore?: () => void;
  onEdit?: () => void;
}

const ConsultationCard: React.FC<ConsultationCardProps> = ({
  consultation,
  showDate = false,
  compact = false,
  onViewPatient,
  onStart,
  onMore,
  onEdit,
}) => {
  const patient = getPatientFromConsultation(consultation);
  const date = new Date(consultation.consultation_date);
  const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = date.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const duration = getConsultationDuration(consultation);
  const borderAccent =
    consultation.visit_type === 'new_application'
      ? 'border-l-blue-500'
      : 'border-l-purple-500';

  return (
    <div
      className={`bg-white dark:bg-surface-dark rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 ${borderAccent} ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-text-main dark:text-white truncate">
            {patient?.full_name ?? 'Paciente'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {consultation.treatment_type || 'Sin motivo especificado'}
          </p>
        </div>
        <div className="text-right shrink-0">
          {showDate && (
            <p className="text-[10px] font-bold text-slate-500 capitalize">{dateLabel}</p>
          )}
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
            {time}
          </span>
          {!compact && (
            <p className="text-[10px] text-slate-400 mt-0.5">{duration} min</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <VisitTypeBadge visitType={consultation.visit_type} />
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
          {CONSULTATION_STATUS_LABELS[consultation.status]}
        </span>
      </div>

      {!compact && consultation.notes && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{consultation.notes}</p>
      )}

      {(onViewPatient || onStart || onMore || onEdit) && (
        <div className="flex flex-wrap gap-2">
          {onViewPatient && (
            <button
              onClick={onViewPatient}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              Ver paciente
            </button>
          )}
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              Editar
            </button>
          )}
          {onStart &&
            (consultation.status === 'scheduled' || consultation.status === 'in_progress') && (
              <button
                onClick={onStart}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white"
              >
                {consultation.status === 'in_progress' ? 'Continuar' : 'Iniciar'}
              </button>
            )}
          {onMore && (
            <button
              onClick={onMore}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500"
            >
              Más
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export function getTimelinePosition(consultation: Consultation): {
  topPercent: number;
  heightPercent: number;
} {
  const startMinutes = getMinutesFromMidnight(new Date(consultation.consultation_date));
  const duration = getConsultationDuration(consultation);
  const timelineStart = TIMELINE_START_HOUR * 60;
  const timelineEnd = TIMELINE_END_HOUR * 60;
  const totalMinutes = timelineEnd - timelineStart;

  const topPercent = Math.max(0, ((startMinutes - timelineStart) / totalMinutes) * 100);
  const heightPercent = Math.min(
    100 - topPercent,
    (duration / totalMinutes) * 100
  );

  return { topPercent, heightPercent: Math.max(heightPercent, 4) };
}

export default ConsultationCard;
