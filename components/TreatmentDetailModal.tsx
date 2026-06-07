import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, FileText } from 'lucide-react';
import { usePrintPreferences } from '../hooks/usePrintPreferences';
import TreatmentSessionPrintSheet from './TreatmentSessionPrintSheet';
import {
  exportTreatmentToCsv,
  getTreatmentSummaryStats,
  getVolumeMl,
  sortTreatmentDetails,
  type TreatmentReportData,
} from '../utils/treatmentReport';

interface TreatmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: TreatmentReportData | null;
}

const TreatmentDetailModal: React.FC<TreatmentDetailModalProps> = ({ isOpen, onClose, report }) => {
  const { preferences } = usePrintPreferences();

  const sortedDetails = useMemo(
    () => (report ? sortTreatmentDetails(report.details) : []),
    [report]
  );

  const stats = useMemo(
    () =>
      report
        ? getTreatmentSummaryStats(report.details, report.totalUnits)
        : {
            muscleCount: 0,
            bilateralCount: 0,
            maxEntry: { muscle_name: '—', side: '—', units: 0 },
            totalUnits: 0,
          },
    [report]
  );

  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('treatment-print-active');
      return;
    }
    document.body.classList.add('treatment-print-active');
    return () => {
      document.body.classList.remove('treatment-print-active');
    };
  }, [isOpen]);

  if (!isOpen || !report) return null;

  const sessionDateLabel = new Date(report.sessionDate).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const totalVolume = getVolumeMl(report.totalUnits, report.productName, report.dilution);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    exportTreatmentToCsv(report);
  };

  return (
    <>
      {createPortal(
        <TreatmentSessionPrintSheet report={report} preferences={preferences} />,
        document.body
      )}

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-primary/5 p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-primary">Detalle de Aplicación</h3>
                <p className="text-xs text-text-muted mt-1 capitalize">{sessionDateLabel}</p>
                {report.doctorName && (
                  <p className="text-xs text-text-muted mt-0.5">{report.doctorName}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors"
                  title="Imprimir sesión"
                >
                  <Printer size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-green-500 hover:text-green-600 transition-colors"
                  title="Exportar a Excel (CSV)"
                >
                  <FileText size={18} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-text-muted uppercase font-bold">Dosis total</p>
                <p className="text-xl font-bold text-primary">{report.totalUnits} U</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-text-muted uppercase font-bold">Volumen</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{totalVolume}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-text-muted uppercase font-bold">Músculos</p>
                <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.muscleCount}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-text-muted uppercase font-bold">Producto</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                  {report.productName}
                </p>
                {report.dilution && (
                  <p className="text-[10px] text-slate-500">{report.dilution} ml dilución</p>
                )}
              </div>
            </div>

            {report.pathologyTitle && (
              <div className="mb-4 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30 flex items-start gap-2">
                <span className="material-symbols-outlined text-purple-500">medical_services</span>
                <div>
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase">
                    Patología
                  </p>
                  <p className="text-sm font-medium">{report.pathologyTitle}</p>
                </div>
              </div>
            )}

            {report.clinicalSummary && (
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1">Resumen clínico</p>
                <p className="text-sm whitespace-pre-wrap">{report.clinicalSummary}</p>
              </div>
            )}

            {report.notes && (
              <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-100 dark:border-yellow-900/30">
                <p className="text-xs font-bold text-yellow-700 dark:text-yellow-500 mb-1">Notas</p>
                <p className="text-sm italic">{report.notes}</p>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">fitness_center</span>
                Detalle por músculo
              </h4>
              {stats.maxEntry.units > 0 && (
                <span className="text-[10px] text-slate-500">
                  Mayor dosis: {stats.maxEntry.muscle_name} ({stats.maxEntry.units} U)
                </span>
              )}
            </div>

            {sortedDetails.length > 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="hidden sm:grid grid-cols-[1fr_80px_72px_72px_48px] gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500">
                  <span>Músculo</span>
                  <span>Lado</span>
                  <span className="text-right">Dosis</span>
                  <span className="text-right">Volumen</span>
                  <span className="text-right">%</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sortedDetails.map((detail, idx) => {
                    const pct =
                      report.totalUnits > 0 ? (detail.units / report.totalUnits) * 100 : 0;
                    return (
                      <div
                        key={`${detail.muscle_name}-${detail.side}-${idx}`}
                        className="px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize truncate">
                              {detail.muscle_name}
                            </p>
                            <p className="text-[10px] text-slate-500 uppercase sm:hidden">
                              {detail.side}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-right">
                            <span className="hidden sm:inline text-xs text-slate-500">
                              {detail.side}
                            </span>
                            <span className="font-bold font-mono text-sm text-primary">
                              {detail.units} U
                            </span>
                            <span className="hidden sm:inline text-xs text-slate-500 w-14">
                              {getVolumeMl(detail.units, report.productName, report.dilution)}
                            </span>
                            <span className="hidden sm:inline text-[10px] text-slate-400 w-10">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 py-3 bg-primary/5 dark:bg-primary/10 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-slate-600">Total sesión</span>
                  <div className="text-right">
                    <span className="font-bold text-primary">{report.totalUnits} U</span>
                    <span className="text-xs text-slate-500 ml-2">{totalVolume}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                No hay detalles de músculos registrados para esta sesión.
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              <FileText size={16} />
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold"
            >
              <Printer size={16} />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TreatmentDetailModal;
