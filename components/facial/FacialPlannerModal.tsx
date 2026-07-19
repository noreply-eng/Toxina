import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFacialPlan } from '../../hooks/useFacialPlan';
import type { ToxinBrand } from '../../constants/facialAestheticMap';
import FaceCanvas from './FaceCanvas';
import PlanSummaryPanel from './PlanSummaryPanel';

export type FacialPlannerMode = 'aesthetic' | 'asymmetric';

const AESTHETIC_PRESET = [
  'frontalis',
  'corrugator',
  'procerus',
  'orbicularis-oculi',
];

const SINCINESIAS_PRESET = ['orbicularis-oculi', 'platysma'];

export interface FacialPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: FacialPlannerMode;
  pathologyId?: string;
  initialBrand?: ToxinBrand;
  initialDilution?: string;
  loadPresetOnOpen?: boolean;
}

const FacialPlannerModal: React.FC<FacialPlannerModalProps> = ({
  isOpen,
  onClose,
  mode = 'aesthetic',
  pathologyId = 'estetica-facial',
  initialBrand = 'Botox' as ToxinBrand,
  initialDilution = '2.5',
  loadPresetOnOpen = false,
}) => {
  const navigate = useNavigate();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [highlightedMuscleId, setHighlightedMuscleId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const plan = useFacialPlan({
    initialBrand,
    initialDilution,
    mirrorModeDefault: mode === 'aesthetic',
    pathologyId,
  });

  const hasPoints = plan.points.length > 0;
  const clearPlan = plan.clearPlan;

  const requestClose = useCallback(() => {
    if (hasPoints && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    clearPlan();
    setConfirmClose(false);
    setHighlightedMuscleId(null);
    onClose();
  }, [clearPlan, confirmClose, hasPoints, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    setConfirmClose(false);
    setHighlightedMuscleId(null);
    if (loadPresetOnOpen) {
      const preset = mode === 'asymmetric' ? SINCINESIAS_PRESET : AESTHETIC_PRESET;
      plan.loadPreset(preset);
    }
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
    // Only re-run when modal opens / mode preset changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadPresetOnOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, requestClose]);

  useEffect(() => {
    if (!confirmClose) return;
    const t = window.setTimeout(() => setConfirmClose(false), 3500);
    return () => window.clearTimeout(t);
  }, [confirmClose]);

  if (!isOpen) return null;

  const handleExport = () => {
    const exported = plan.exportPlan();
    plan.clearPlan();
    setConfirmClose(false);
    setHighlightedMuscleId(null);
    onClose();
    navigate('/calculator', {
      state: {
        importPlan: exported,
      },
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background-dark/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="facial-planner-title"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-surface-dark/95 shrink-0">
        <div className="min-w-0">
          <h2 id="facial-planner-title" className="text-base font-bold text-white">
            Planificador Facial
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'asymmetric' ? 'Modo asimétrico' : 'Estética facial'}
            <span className="mx-1.5 text-slate-600">·</span>
            Atlas · Lateralidad del paciente (I/D)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {confirmClose && (
            <span className="hidden sm:inline text-[11px] text-amber-300 max-w-[160px] text-right leading-snug">
              Hay un plan sin guardar. Pulsa otra vez para cerrar.
            </span>
          )}
          <button
            ref={closeBtnRef}
            type="button"
            onClick={requestClose}
            className={`size-11 rounded-full flex items-center justify-center text-white cursor-pointer transition-colors ${
              confirmClose
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-slate-800 hover:bg-slate-700'
            }`}
            aria-label={confirmClose ? 'Confirmar cierre' : 'Cerrar'}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </header>

      {/* Móvil: scroll vertical de mapa + panel. Desktop: panel lateral con scroll interno. */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto overscroll-y-contain lg:overflow-hidden">
        <div className="h-[min(52vh,440px)] lg:h-auto lg:flex-1 lg:min-h-0 shrink-0 p-1 sm:p-2 lg:p-3 flex flex-col overflow-hidden">
          <FaceCanvas
            plan={plan}
            highlightedMuscleId={highlightedMuscleId}
            onHighlightMuscle={setHighlightedMuscleId}
          />
        </div>

        <div className="lg:w-[340px] xl:w-[380px] shrink-0 flex flex-col min-h-0 lg:h-full lg:overflow-hidden">
          <PlanSummaryPanel
            plan={plan}
            onExport={handleExport}
            collapsed={summaryCollapsed}
            onToggleCollapse={() => setSummaryCollapsed(!summaryCollapsed)}
            highlightedMuscleId={highlightedMuscleId}
            onHighlightMuscle={setHighlightedMuscleId}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FacialPlannerModal;
