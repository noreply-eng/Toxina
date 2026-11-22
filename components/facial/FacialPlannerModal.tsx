import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useFacialPlan, type FacialPlanExport } from '../../hooks/useFacialPlan';
import {
  getFacialPresetForPathology,
  type SideMode,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import FaceCanvas from './FaceCanvas';
import PlanSummaryPanel from './PlanSummaryPanel';

const Facial3DPlannerWorkspace = lazy(() => import('./Facial3DPlannerWorkspace'));

export type FacialPlannerMode = 'aesthetic' | 'asymmetric';
export type FacialPlannerViewMode = '2d' | '3d';

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
  const [viewMode, setViewMode] = useState<FacialPlannerViewMode>('3d');
  const [points3DCount, setPoints3DCount] = useState(0);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const [highlightedMuscleId, setHighlightedMuscleId] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const plan = useFacialPlan({
    initialBrand,
    initialDilution,
    mirrorModeDefault: mode === 'aesthetic',
    pathologyId,
  });

  const hasPoints = viewMode === '3d' ? points3DCount > 0 : plan.points.length > 0;
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

  const matchedPreset = getFacialPresetForPathology(pathologyId);
  const resolvedPresetMuscles = matchedPreset
    ? matchedPreset.muscleIds
    : mode === 'asymmetric'
    ? SINCINESIAS_PRESET
    : AESTHETIC_PRESET;
  const resolvedPresetSide: SideMode =
    matchedPreset?.defaultSideMode ?? (mode === 'asymmetric' ? 'izq' : 'ambos');

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    setConfirmClose(false);
    setHighlightedMuscleId(null);
    if (loadPresetOnOpen) {
      plan.loadPreset(resolvedPresetMuscles, resolvedPresetSide);
    }
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 50);
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
    // Only re-run when modal opens / mode preset changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadPresetOnOpen, mode, pathologyId]);

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

  const handleExport3D = (exported: FacialPlanExport) => {
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
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-surface-dark/95 shrink-0">
        <div className="min-w-0 flex items-center gap-3 flex-wrap">
          <div>
            <h2 id="facial-planner-title" className="text-base font-bold text-white">
              Planificador Facial {viewMode === '3d' ? '3D (Cráneo)' : '2D'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mode === 'asymmetric' ? 'Modo asimétrico' : 'Estética facial'}
              <span className="mx-1.5 text-slate-600">·</span>
              Lateralidad del paciente (I/D)
            </p>
          </div>

          {/* 3D Cráneo / 2D Atlas Mode Switcher */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === '3d'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">view_in_ar</span>
              Cráneo 3D
            </button>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === '2d'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">image</span>
              Atlas 2D
            </button>
          </div>
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

      {viewMode === '3d' ? (
        <Suspense
          fallback={
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              <span className="text-xs font-bold">Cargando modelo craneofacial 3D...</span>
            </div>
          }
        >
          <Facial3DPlannerWorkspace
            initialBrand={initialBrand}
            initialDilution={initialDilution}
            mirrorModeDefault={resolvedPresetSide === 'ambos'}
            pathologyId={pathologyId}
            presetToLoad={loadPresetOnOpen ? resolvedPresetMuscles : undefined}
            presetSideMode={resolvedPresetSide}
            onExportPlan={handleExport3D}
            onPointsCountChange={setPoints3DCount}
            onBeforeNavigate={onClose}
          />
        </Suspense>
      ) : (
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
      )}
    </div>,
    document.body
  );
};

export default FacialPlannerModal;
