import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { getCurrentUserId } from '../hooks/useConsultations';
import {
  DEFAULT_DAILY_NOTES_EXPORT_OPTIONS,
  fetchDailyPatientBriefings,
  type DailyBriefingReport,
  type DailyNotesExportOptions,
} from '../services/dailyNotesExport';
import { VISIT_TYPE_LABELS, type Consultation } from '../types/clinical';
import { CLINICAL_NOTE_TYPE_LABELS } from '../types/patientClinicalNotes';

interface DailyNotesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  consultationsForDay: Consultation[];
  onScheduleNew?: () => void;
}

function formatDateHeading(date: Date): string {
  const raw = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatShortNoteDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('T')[0].split('-').map(Number);
  if (y && m && d) {
    return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return isoDate;
}

function formatAppointmentTime(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '--:--';
  return parsed.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const DailyNotesExportModal: React.FC<DailyNotesExportModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  consultationsForDay,
  onScheduleNew,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [options, setOptions] = useState<DailyNotesExportOptions>(
    DEFAULT_DAILY_NOTES_EXPORT_OPTIONS
  );
  const [report, setReport] = useState<DailyBriefingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccessFile, setExportSuccessFile] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadBriefing = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setExportSuccessFile(null);
    setExportError(null);
    try {
      const userId = await getCurrentUserId();
      const data = await fetchDailyPatientBriefings(userId, selectedDate, {
        consultationsForDay,
        includeCancelledOrNoShow: options.includeCancelledOrNoShow,
      });
      setReport(data);
    } catch (err) {
      console.error(err);
      setLoadError(
        err instanceof Error
          ? err.message
          : 'No se pudo obtener el resumen de notas para este día.'
      );
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, consultationsForDay, options.includeCancelledOrNoShow]);

  // Synchronize native <dialog> top-layer modal open/close state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Native close event + Safari fallback for light-dismiss when closedby is unsupported
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onCloseRef.current();
    };

    dialog.addEventListener('close', handleClose);

    let cleanupFallback: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      let pressedOutside = false;
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupFallback?.();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadBriefing();
    }
  }, [isOpen, loadBriefing]);

  const toggleOption = (key: keyof DailyNotesExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    setExportSuccessFile(null);
  };

  const handleDownloadWord = async () => {
    if (!report || report.items.length === 0) return;
    setExporting(true);
    setExportError(null);
    setExportSuccessFile(null);
    try {
      const { downloadDailyNotesDocx } = await import('../utils/dailyNotesDocx');
      const fileName = await downloadDailyNotesDocx(report, options);
      setExportSuccessFile(fileName);
    } catch (err) {
      console.error(err);
      setExportError('No se pudo generar el documento Word. Intenta nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestClose = () => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      onClose();
    }
  };

  const dayHeading = formatDateHeading(selectedDate);
  const canDownload = Boolean(!loading && report && report.items.length > 0 && !exporting);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="daily-notes-dialog w-[calc(100%-1.5rem)] max-w-2xl rounded-2xl p-0 bg-white dark:bg-surface-dark text-text-main dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xl"
    >
      <div className="flex flex-col max-h-[88dvh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="min-w-0">
            <h1
              id={titleId}
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug"
            >
              Descargar notas del día en Word
            </h1>
            <p className="text-xs text-text-muted mt-0.5">{dayHeading}</p>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            aria-label="Cerrar ventana"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Buscando la última nota de los pacientes agendados...
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Consultando expediente clínico y última aplicación de toxina.
                </p>
              </div>
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-2">
              <p className="text-sm font-bold text-red-700 dark:text-red-300">
                No se pudo preparar la lista del día
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">{loadError}</p>
              <button
                type="button"
                onClick={loadBriefing}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
              >
                Reintentar
              </button>
            </div>
          ) : report ? (
            <>
              {report.notesWarning && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  {report.notesWarning}
                </div>
              )}

              {/* Stats summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/80">
                  <p className="text-[11px] text-text-muted">Pacientes</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                    {report.stats.totalAppointments}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Con nota previa</p>
                  <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 leading-tight mt-0.5">
                    {report.stats.withPreviousNote}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">Sin notas previas</p>
                  <p className="text-lg font-bold text-amber-800 dark:text-amber-300 leading-tight mt-0.5">
                    {report.stats.withoutPreviousNote}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50">
                  <p className="text-[11px] text-red-700 dark:text-red-400">Con alergias</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-300 leading-tight mt-0.5">
                    {report.stats.withAllergies}
                  </p>
                </div>
              </div>

              {/* Export options */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/80 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Contenido del documento Word (.docx)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeLatestTreatment}
                      onChange={() => toggleOption('includeLatestTreatment')}
                      className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs leading-snug">
                      <strong className="block text-slate-800 dark:text-slate-100">
                        Última aplicación de toxina
                      </strong>
                      <span className="text-text-muted">
                        Producto, unidades, dilución y músculos
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeClinicalAlerts}
                      onChange={() => toggleOption('includeClinicalAlerts')}
                      className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs leading-snug">
                      <strong className="block text-slate-800 dark:text-slate-100">
                        Alertas clínicas y resumen
                      </strong>
                      <span className="text-text-muted">
                        Alergias, resumen médico, fármacos y metas GAS
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeWorkSpace}
                      onChange={() => toggleOption('includeWorkSpace')}
                      className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs leading-snug">
                      <strong className="block text-slate-800 dark:text-slate-100">
                        Espacio para notas de hoy
                      </strong>
                      <span className="text-text-muted">
                        Recuadro editable o imprimible bajo cada paciente
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.pageBreakPerPatient}
                      onChange={() => toggleOption('pageBreakPerPatient')}
                      className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs leading-snug">
                      <strong className="block text-slate-800 dark:text-slate-100">
                        Un paciente por página
                      </strong>
                      <span className="text-text-muted">
                        Salto de página individual para impresión
                      </span>
                    </span>
                  </label>
                </div>

                {(report.stats.excludedAppointments > 0 || options.includeCancelledOrNoShow) && (
                  <label className="flex items-center gap-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.includeCancelledOrNoShow}
                      onChange={() => toggleOption('includeCancelledOrNoShow')}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      Incluir citas canceladas o que no asistieron
                      {report.stats.excludedAppointments > 0 && !options.includeCancelledOrNoShow
                        ? ` (${report.stats.excludedAppointments} oculta${
                            report.stats.excludedAppointments === 1 ? '' : 's'
                          })`
                        : ''}
                    </span>
                  </label>
                )}
              </div>

              {/* Preview of scheduled patients */}
              {report.items.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 mb-2">
                    event_note
                  </span>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    No hay pacientes agendados para este día
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Cambia de fecha en la agenda o registra una nueva cita para descargar la hoja de notas.
                  </p>
                  {onScheduleNew && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRequestClose();
                        onScheduleNew();
                      }}
                      className="mt-3 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold"
                    >
                      Agendar cita
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vista previa ({report.items.length}{' '}
                      {report.items.length === 1 ? 'cita' : 'citas'})
                    </p>
                    <span className="text-[11px] text-text-muted">Orden cronológico</span>
                  </div>

                  <ol className="space-y-2.5">
                    {report.items.map((item, idx) => {
                      const hasAllergies = Boolean(item.patient?.allergies?.trim());
                      return (
                        <li
                          key={item.consultation.id}
                          className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900/40 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                  {formatAppointmentTime(item.consultation.consultation_date)}
                                </span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {idx + 1}. {item.patientName}
                                </span>
                                {hasAllergies && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                    Alergia
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted mt-0.5">
                                {VISIT_TYPE_LABELS[item.consultation.visit_type]}
                                {item.consultation.treatment_type
                                  ? ` · ${item.consultation.treatment_type}`
                                  : ''}
                              </p>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            {item.latestNote ? (
                              <>
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  Última nota · {formatShortNoteDate(item.latestNote.note_date)} ·{' '}
                                  {CLINICAL_NOTE_TYPE_LABELS[item.latestNote.note_type] ??
                                    item.latestNote.note_type}
                                </p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                                  {item.latestNote.content}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs italic text-slate-400 dark:text-slate-500">
                                No hay notas previas
                              </p>
                            )}
                          </div>

                          {options.includeLatestTreatment && item.latestTreatment && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Última toxina: {item.latestTreatment.product_name} (
                              {item.latestTreatment.total_units} U) ·{' '}
                              {formatShortNoteDate(item.latestTreatment.date)}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {exportError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                  {exportError}
                </p>
              )}

              {exportSuccessFile && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-lg border border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Descargado: {exportSuccessFile}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={handleRequestClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleDownloadWord}
            disabled={!canDownload}
            autoFocus
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              {exporting ? 'hourglass_top' : 'download'}
            </span>
            {exporting ? 'Generando Word...' : 'Descargar Word (.docx)'}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default DailyNotesExportModal;
