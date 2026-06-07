import React, { useMemo } from 'react';
import type { Consultation } from '../types/clinical';
import ConsultationCard, { getTimelinePosition } from './ConsultationCard';
import { getPatientFromConsultation } from '../hooks/useConsultations';
import {
  formatTimelineHour,
  getConsultationsForDay,
  getMinutesFromMidnight,
  isSameDay,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  TIMELINE_SLOT_MINUTES,
} from '../utils/consultationHelpers';
import { startOfDay, startOfWeek, addDays } from '../utils/dateRange';

interface WeekTimelineViewProps {
  selectedDate: Date;
  consultations: Consultation[];
  onSelectConsultation: (consultation: Consultation) => void;
  onSlotClick: (date: Date) => void;
}

const WeekTimelineView: React.FC<WeekTimelineViewProps> = ({
  selectedDate,
  consultations,
  onSelectConsultation,
  onSlotClick,
}) => {
  const weekStart = startOfWeek(selectedDate);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart.getTime()]
  );

  const now = new Date();
  const showNowLine = weekDays.some((d) => isSameDay(d, now));
  const nowMinutes = getMinutesFromMidnight(now);
  const timelineStart = TIMELINE_START_HOUR * 60;
  const timelineEnd = TIMELINE_END_HOUR * 60;
  const totalMinutes = timelineEnd - timelineStart;
  const nowTopPercent =
    showNowLine && nowMinutes >= timelineStart && nowMinutes <= timelineEnd
      ? ((nowMinutes - timelineStart) / totalMinutes) * 100
      : null;

  const hourLabels = useMemo(() => {
    const labels: number[] = [];
    for (let h = TIMELINE_START_HOUR; h < TIMELINE_END_HOUR; h++) {
      labels.push(h * 60);
    }
    return labels;
  }, []);

  return (
    <div className="overflow-x-auto -mx-1">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-1 mb-2">
          <div />
          {weekDays.map((day) => {
            const isToday = isSameDay(day, now);
            const isSelected = isSameDay(day, selectedDate);
            return (
              <div
                key={day.toISOString()}
                className={`text-center py-1 rounded-lg ${
                  isToday
                    ? 'bg-primary/10 text-primary'
                    : isSelected
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : ''
                }`}
              >
                <p className="text-[10px] uppercase font-bold text-text-muted">
                  {day.toLocaleDateString('es-MX', { weekday: 'short' })}
                </p>
                <p className="text-sm font-bold">{day.getDate()}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[48px_repeat(7,1fr)] gap-1">
          <div className="relative">
            {hourLabels.map((minutes) => (
              <div
                key={minutes}
                className="h-16 text-[10px] text-slate-400 pr-1 text-right -mt-2"
              >
                {formatTimelineHour(minutes)}
              </div>
            ))}
          </div>

          {weekDays.map((day) => {
            const dayConsultations = getConsultationsForDay(consultations, day);
            const isToday = isSameDay(day, now);

            return (
              <div
                key={day.toISOString()}
                className="relative border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 min-h-[896px]"
              >
                {hourLabels.map((minutes, idx) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      const slotDate = new Date(day);
                      slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
                      onSlotClick(slotDate);
                    }}
                    className={`absolute left-0 right-0 h-16 border-t border-slate-100 dark:border-slate-800/80 hover:bg-primary/5 transition-colors ${
                      idx === 0 ? 'border-t-0' : ''
                    }`}
                    style={{ top: `${(idx / hourLabels.length) * 100}%` }}
                    aria-label={`Agendar ${formatTimelineHour(minutes)}`}
                  />
                ))}

                {isToday && nowTopPercent !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: `${nowTopPercent}%` }}
                  >
                    <div className="h-0.5 bg-red-500 relative">
                      <span className="absolute -left-1 -top-1 size-2 rounded-full bg-red-500" />
                    </div>
                  </div>
                )}

                {dayConsultations.map((consultation) => {
                  const { topPercent, heightPercent } = getTimelinePosition(consultation);
                  const patient = getPatientFromConsultation(consultation);
                  return (
                    <button
                      key={consultation.id}
                      type="button"
                      onClick={() => onSelectConsultation(consultation)}
                      className={`absolute left-0.5 right-0.5 z-10 rounded-md px-1 py-0.5 text-left overflow-hidden shadow-sm border ${
                        consultation.visit_type === 'new_application'
                          ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700'
                          : 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700'
                      }`}
                      style={{
                        top: `${topPercent}%`,
                        height: `${heightPercent}%`,
                        minHeight: '28px',
                      }}
                    >
                      <p className="text-[10px] font-bold truncate text-slate-800 dark:text-white">
                        {patient?.full_name ?? 'Paciente'}
                      </p>
                      <p className="text-[9px] truncate text-slate-600 dark:text-slate-300">
                        {new Date(consultation.consultation_date).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekTimelineView;

interface DayTimelineViewProps {
  selectedDate: Date;
  consultations: Consultation[];
  onSelectConsultation: (consultation: Consultation) => void;
  onSlotClick: (date: Date) => void;
}

export const DayTimelineView: React.FC<DayTimelineViewProps> = ({
  selectedDate,
  consultations,
  onSelectConsultation,
  onSlotClick,
}) => {
  const dayConsultations = getConsultationsForDay(consultations, selectedDate);
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  return (
    <div className="space-y-4">
      <WeekTimelineView
        selectedDate={selectedDate}
        consultations={consultations.filter((c) => {
          const d = new Date(c.consultation_date);
          return isSameDay(d, selectedDate);
        })}
        onSelectConsultation={onSelectConsultation}
        onSlotClick={onSlotClick}
      />

      {dayConsultations.length > 0 && (
        <div className="space-y-3 lg:hidden">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Lista del día
          </h3>
          {dayConsultations.map((consultation) => (
            <ConsultationCard
              key={consultation.id}
              consultation={consultation}
              onMore={() => onSelectConsultation(consultation)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { TIMELINE_SLOT_MINUTES };
