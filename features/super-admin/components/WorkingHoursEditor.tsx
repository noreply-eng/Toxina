import React from 'react';
import type { DaySchedule, WorkingHoursMap } from '../types';

const DAYS: { key: keyof WorkingHoursMap; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export const DEFAULT_WORKING_HOURS: WorkingHoursMap = {
  monday: { enabled: true, open: '09:00', close: '19:00', break_start: '14:00', break_end: '15:00' },
  tuesday: { enabled: true, open: '09:00', close: '19:00', break_start: '14:00', break_end: '15:00' },
  wednesday: { enabled: true, open: '09:00', close: '19:00', break_start: '14:00', break_end: '15:00' },
  thursday: { enabled: true, open: '09:00', close: '19:00', break_start: '14:00', break_end: '15:00' },
  friday: { enabled: true, open: '09:00', close: '19:00', break_start: '14:00', break_end: '15:00' },
  saturday: { enabled: true, open: '09:00', close: '14:00' },
  sunday: { enabled: false, open: '09:00', close: '14:00' },
};

const WorkingHoursEditor: React.FC<{ value: WorkingHoursMap; onChange: (next: WorkingHoursMap) => void }> = ({
  value,
  onChange,
}) => {
  const updateDay = (day: keyof WorkingHoursMap, patch: Partial<DaySchedule>) => {
    onChange({
      ...value,
      [day]: { ...(value[day] || DEFAULT_WORKING_HOURS[day]), ...patch },
    });
  };

  const applyPreset = (preset: 'mon_fri' | 'mon_sat' | 'continuous') => {
    if (preset === 'mon_fri') {
      onChange({
        ...DEFAULT_WORKING_HOURS,
        saturday: { enabled: false, open: '09:00', close: '14:00' },
        sunday: { enabled: false, open: '09:00', close: '14:00' },
      });
    } else if (preset === 'mon_sat') {
      onChange({ ...DEFAULT_WORKING_HOURS });
    } else {
      const next = { ...value };
      (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as (keyof WorkingHoursMap)[]).forEach(
        (k) => {
          next[k] = { enabled: true, open: '08:00', close: '18:00' };
        }
      );
      next.saturday = { enabled: true, open: '09:00', close: '14:00' };
      next.sunday = { enabled: false, open: '09:00', close: '14:00' };
      onChange(next);
    }
  };

  const copyMondayToWeekdays = () => {
    const mon = value.monday || DEFAULT_WORKING_HOURS.monday;
    onChange({
      ...value,
      tuesday: { ...mon },
      wednesday: { ...mon },
      thursday: { ...mon },
      friday: { ...mon },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-bold text-slate-400 mr-1">Plantillas rápidas:</span>
        <button
          type="button"
          onClick={() => applyPreset('mon_fri')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/15 hover:text-primary font-bold transition-colors cursor-pointer"
        >
          Lun–Vie 9:00–19:00
        </button>
        <button
          type="button"
          onClick={() => applyPreset('mon_sat')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/15 hover:text-primary font-bold transition-colors cursor-pointer"
        >
          Lun–Sáb (Estándar)
        </button>
        <button
          type="button"
          onClick={() => applyPreset('continuous')}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/15 hover:text-primary font-bold transition-colors cursor-pointer"
        >
          Corrido 8:00–18:00
        </button>
        <button
          type="button"
          onClick={copyMondayToWeekdays}
          className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-bold transition-colors cursor-pointer ml-auto"
        >
          Copiar Lunes a Lun–Vie
        </button>
      </div>

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = value[key] || DEFAULT_WORKING_HOURS[key];
          return (
            <div
              key={key}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 px-3.5 py-2.5"
            >
              <label className="flex items-center gap-2.5 w-32 cursor-pointer">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                  className="size-4 rounded accent-primary"
                />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{label}</span>
              </label>
              {day.enabled ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-400">Horario:</span>
                  <input
                    type="time"
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium"
                  />
                  <span className="text-slate-400">a</span>
                  <input
                    type="time"
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium"
                  />
                  <span className="text-slate-400 ml-2">Descanso:</span>
                  <input
                    type="time"
                    value={day.break_start || ''}
                    onChange={(e) => updateDay(key, { break_start: e.target.value || undefined })}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="time"
                    value={day.break_end || ''}
                    onChange={(e) => updateDay(key, { break_end: e.target.value || undefined })}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                  />
                </div>
              ) : (
                <span className="text-xs italic text-slate-400">Cerrado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkingHoursEditor;
