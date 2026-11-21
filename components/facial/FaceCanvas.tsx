import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ANATOMY_IMAGE_FRAME,
  DANGER_REGIONS,
  FACIAL_ANATOMY_IMAGE,
  FACIAL_VIEWBOX,
  FACE_GUIDE_PATHS,
  type AnatomyLayerFilter,
  type FacialMuscleConfig,
  type PointSizeMode,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import type { FacialPlanController } from '../../hooks/useFacialPlan';
import InjectionPointNode from './InjectionPointNode';
import PointPopover from './PointPopover';

interface FaceCanvasProps {
  plan: FacialPlanController;
  highlightedMuscleId?: string | null;
  onHighlightMuscle?: (muscleId: string | null) => void;
}

const ZOOM_MIN = 0.85;
const ZOOM_MAX = 2.0;
const ZOOM_STEP = 0.2;

const POINT_SIZE_ORDER: PointSizeMode[] = ['sm', 'md', 'lg'];
const POINT_SIZE_LABELS: Record<PointSizeMode, string> = {
  sm: 'Pequeño (S)',
  md: 'Normal (M)',
  lg: 'Grande (L)',
};

function screenToSvgCoords(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 200, y: 250 };
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

function getMuscleLabelCoords(muscle: FacialMuscleConfig): { x: number; y: number } {
  const firstDer = muscle.defaultPoints.find((p) => p.side === 'der');
  const firstIzq = muscle.defaultPoints.find((p) => p.side === 'izq');
  const firstCentro = muscle.defaultPoints.find((p) => p.side === 'centro');
  if (firstCentro) {
    return { x: firstCentro.x, y: Math.max(24, muscle.bbox.minY - 8) };
  }
  const refPt = (muscle.view ?? 'front') === 'back' ? firstIzq : firstDer;
  if (refPt) {
    return {
      x: Math.max(58, Math.min(188, refPt.x)),
      y: Math.max(24, muscle.bbox.minY - 7),
    };
  }
  return {
    x: (muscle.bbox.minX + muscle.bbox.maxX) / 2,
    y: Math.max(24, muscle.bbox.minY - 7),
  };
}

interface ToolbarButtonWithTooltipProps {
  onClick: () => void;
  active?: boolean;
  activeColorClass?: string;
  disabled?: boolean;
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
}

const ToolbarButtonWithTooltip: React.FC<ToolbarButtonWithTooltipProps> = ({
  onClick,
  active = false,
  activeColorClass = 'bg-primary border-primary/80 text-white shadow-lg shadow-primary/30',
  disabled = false,
  title,
  description,
  badge,
  children,
}) => {
  return (
    <div className="relative group flex items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        aria-pressed={active}
        className={`relative size-9 rounded-lg border transition-all flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          active
            ? activeColorClass
            : 'bg-slate-800/95 border-slate-600/90 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-500'
        }`}
      >
        {children}
        {badge && (
          <span className="absolute -bottom-1 -right-1 px-1 min-w-[14px] h-[14px] rounded bg-slate-950 border border-slate-600 text-[8px] font-black text-sky-300 flex items-center justify-center leading-none">
            {badge}
          </span>
        )}
      </button>

      {/* Rich Tooltip to the left of the toolbar button */}
      <div
        role="tooltip"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute right-11 top-1/2 -translate-y-1/2 z-30 w-56 rounded-xl bg-slate-950/95 border border-slate-700/90 px-3 py-2 shadow-2xl backdrop-blur-md"
      >
        <p className="text-[11px] font-bold text-white leading-tight flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-sky-400 shrink-0" />
          {title}
        </p>
        <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

const FaceCanvas: React.FC<FaceCanvasProps> = ({
  plan,
  highlightedMuscleId = null,
  onHighlightMuscle,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [popover, setPopover] = useState<{ pointId: string; x: number; y: number } | null>(null);
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [lastClickedMuscleId, setLastClickedMuscleId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const {
    points,
    brand,
    plannerView,
    setPlannerView,
    activeMuscleIds,
    selectedPointId,
    setSelectedPointId,
    showDangerZones,
    anatomyLayerFilter,
    setAnatomyLayerFilter,
    pointSize,
    setPointSize,
    addPointMode,
    setAddPointMode,
    layerVisibility,
    toggleMuscle,
    addCustomPoint,
    movePoint,
    updatePointDose,
    setPointDepth,
    removePoint,
    muscleSummaries,
    musclesCatalog,
    sideMode,
    getMuscleActiveSides,
  } = plan;

  const viewMuscles = useMemo(
    () => musclesCatalog.filter((m) => (m.view ?? 'front') === plannerView),
    [musclesCatalog, plannerView]
  );

  const viewPoints = useMemo(
    () =>
      points.filter((p) => {
        const m = musclesCatalog.find((mc) => mc.id === p.muscleId);
        return (m?.view ?? 'front') === plannerView;
      }),
    [musclesCatalog, plannerView, points]
  );

  const frontPointsCount = useMemo(
    () =>
      points.filter((p) => {
        const m = musclesCatalog.find((mc) => mc.id === p.muscleId);
        return (m?.view ?? 'front') === 'front';
      }).length,
    [musclesCatalog, points]
  );

  const backPointsCount = useMemo(
    () =>
      points.filter((p) => {
        const m = musclesCatalog.find((mc) => mc.id === p.muscleId);
        return (m?.view ?? 'front') === 'back';
      }).length,
    [musclesCatalog, points]
  );

  const totalCount = viewMuscles.length;
  const superficialCount = useMemo(
    () => viewMuscles.filter((m) => m.layer === 'superficial').length,
    [viewMuscles]
  );
  const deepCount = useMemo(
    () => viewMuscles.filter((m) => m.layer === 'profundo').length,
    [viewMuscles]
  );

  // Delete selected point with Delete / Backspace key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selectedPointId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removePoint(selectedPointId);
        setPopover(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removePoint, selectedPointId]);

  const overDoseSet = useMemo(
    () => new Set(muscleSummaries.filter((s) => s.overDose).map((s) => s.muscleId)),
    [muscleSummaries]
  );

  const sortedMuscles = useMemo(() => {
    return [...viewMuscles].sort((a, b) => {
      const areaA = (a.bbox.maxX - a.bbox.minX) * (a.bbox.maxY - a.bbox.minY);
      const areaB = (b.bbox.maxX - b.bbox.minX) * (b.bbox.maxY - b.bbox.minY);
      return areaB - areaA;
    });
  }, [viewMuscles]);

  const selectedPoint = popover ? points.find((p) => p.id === popover.pointId) : null;
  const selectedPointMuscleId = useMemo(() => {
    if (!selectedPointId) return null;
    return points.find((p) => p.id === selectedPointId)?.muscleId ?? null;
  }, [points, selectedPointId]);

  const focusMuscleId =
    hoveredMuscle ??
    highlightedMuscleId ??
    selectedPointMuscleId ??
    (lastClickedMuscleId && activeMuscleIds.has(lastClickedMuscleId) ? lastClickedMuscleId : null);

  const focusMuscle = focusMuscleId
    ? musclesCatalog.find((m) => m.id === focusMuscleId)
    : null;

  const focusMuscleSummary = useMemo(
    () => (focusMuscleId ? muscleSummaries.find((s) => s.muscleId === focusMuscleId) : null),
    [focusMuscleId, muscleSummaries]
  );

  const sideLabel =
    sideMode === 'ambos'
      ? 'Bilateral'
      : sideMode === 'izq'
        ? 'Solo izq. del paciente'
        : 'Solo der. del paciente';

  const contextHint = useMemo(() => {
    if (addPointMode) {
      return focusMuscle
        ? `Modo Agregar Punto · Clic en ${focusMuscle.name} para insertar punto aquí`
        : 'Modo Agregar Punto · Haz clic sobre cualquier músculo para insertar un punto';
    }
    if (focusMuscle) {
      const layerTag = focusMuscle.layer === 'profundo' ? 'Profundo' : 'Superficial';
      if (focusMuscleSummary) {
        return `${focusMuscle.name} (${layerTag}) · ${focusMuscleSummary.totalBrand} U (${focusMuscleSummary.pointCount} pts) · clic para quitar`;
      }
      return `${focusMuscle.name} (${layerTag}) · clic para agregar (${sideLabel.toLowerCase()})`;
    }
    return `${sideLabel} · pasa el cursor o toca cualquier músculo en el mapa`;
  }, [addPointMode, focusMuscle, focusMuscleSummary, sideLabel]);

  const setHover = useCallback(
    (id: string | null) => {
      setHoveredMuscle(id);
      onHighlightMuscle?.(id);
    },
    [onHighlightMuscle]
  );

  const adjustZoom = (delta: number) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));
  };

  const decreasePointSize = () => {
    const idx = POINT_SIZE_ORDER.indexOf(pointSize);
    if (idx > 0) setPointSize(POINT_SIZE_ORDER[idx - 1]);
  };

  const increasePointSize = () => {
    const idx = POINT_SIZE_ORDER.indexOf(pointSize);
    if (idx < POINT_SIZE_ORDER.length - 1) setPointSize(POINT_SIZE_ORDER[idx + 1]);
  };

  const cycleAnatomyLayer = () => {
    const order: AnatomyLayerFilter[] = ['todos', 'superficial', 'profundo'];
    const next = order[(order.indexOf(anatomyLayerFilter) + 1) % order.length];
    setAnatomyLayerFilter(next);
  };

  const handleMuscleClick = (e: React.MouseEvent<SVGGElement>, muscle: FacialMuscleConfig) => {
    e.stopPropagation();
    setLastClickedMuscleId(muscle.id);
    onHighlightMuscle?.(muscle.id);
    if (addPointMode && svgRef.current) {
      const { x, y } = screenToSvgCoords(svgRef.current, e.clientX, e.clientY);
      addCustomPoint(muscle.id, x, y);
      return;
    }
    setSelectedPointId(null);
    toggleMuscle(muscle.id, sideMode);
  };

  /** Exporta el lienzo SVG actual (con la imagen del atlas incrustada) como imagen PNG descargable */
  const handleDownloadMapPng = useCallback(async () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    try {
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', '800');
      clone.setAttribute('height', '1000');

      // Embed base image as data URL if in front view so canvas taint doesn't block export
      const imgEl = clone.querySelector('image');
      if (imgEl && plannerView === 'front') {
        const res = await fetch(FACIAL_ANATOMY_IMAGE);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.readAsDataURL(blob);
        });
        imgEl.setAttribute('href', dataUrl);
      }

      const xml = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1a1520';
          ctx.fillRect(0, 0, 800, 1000);
          ctx.drawImage(image, 0, 0, 800, 1000);
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `Mapa_Facial_SONOTOX_${plannerView === 'front' ? 'Frontal' : 'Posterior'}_${new Date().toISOString().slice(0, 10)}.png`;
          link.click();
        }
        URL.revokeObjectURL(url);
      };
      image.src = url;
    } catch (err) {
      console.warn('No se pudo exportar imagen PNG:', err);
    }
  }, [plannerView]);

  const showAnatomy = layerVisibility.anatomy !== false;
  const showSchematicSkin = layerVisibility.skin && !showAnatomy;
  const showLabels = layerVisibility.labels !== false;

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col">
      <div
        className={`relative flex-1 min-h-0 bg-gradient-to-b from-slate-900/80 to-slate-950/90 rounded-xl lg:rounded-2xl border overflow-hidden shadow-inner transition-colors ${
          addPointMode ? 'border-amber-400/80' : 'border-slate-700/80'
        }`}
      >
        {/* Top Left Column: View Switcher (Frontal / Posterior PREEMPT) + Layer Filter Pills + Spotlight Card */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-2 max-w-[280px] sm:max-w-[320px] pointer-events-none">
          {/* View Switcher: Frontal (Rostro) vs Posterior (Occipital / PREEMPT) */}
          <div className="pointer-events-auto inline-flex items-center bg-slate-950/95 border border-slate-700/90 rounded-xl p-1 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => setPlannerView('front')}
              title="Vista Frontal: Rostro y cuello anterior (mímica, estética, bruxismo)"
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                plannerView === 'front'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">face</span>
              <span>Frontal</span>
              {frontPointsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[9px] font-black">
                  {frontPointsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPlannerView('back')}
              title="Vista Posterior / PREEMPT: Occipital, Paravertebrales Cervicales y Trapecio Superior (Migraña Crónica)"
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                plannerView === 'back'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">psychology</span>
              <span>Posterior · PREEMPT</span>
              {backPointsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[9px] font-black">
                  {backPointsCount}
                </span>
              )}
            </button>
          </div>

          {/* Interactive Layer Selector Pills (Todos / Superficial / Profundo) */}
          <div className="pointer-events-auto inline-flex items-center bg-slate-950/92 border border-slate-700/90 rounded-xl p-1 shadow-lg backdrop-blur-md">
            {(
              [
                {
                  id: 'todos',
                  label: `Todos (${totalCount})`,
                  tip: 'Mostrar todos los músculos superficiales y profundos de esta vista',
                  activeClass: 'bg-slate-700 text-white shadow-xs',
                },
                {
                  id: 'superficial',
                  label: `Superficiales (${superficialCount})`,
                  tip: 'Solo músculos del plano superficial (color coral)',
                  activeClass: 'bg-orange-500 text-white shadow-xs',
                },
                {
                  id: 'profundo',
                  label: `Profundos (${deepCount})`,
                  tip: 'Solo músculos profundos y masticadores (color azul cian)',
                  activeClass: 'bg-sky-500 text-white shadow-xs',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.tip}
                onClick={() => setAnatomyLayerFilter(item.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  anatomyLayerFilter === item.id
                    ? item.activeClass
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Prominent Selected / Hovered Muscle Spotlight Card */}
          {focusMuscle ? (
            <div
              className={`w-full rounded-xl border-2 px-3 py-2.5 shadow-2xl backdrop-blur-md transition-all ${
                activeMuscleIds.has(focusMuscle.id)
                  ? focusMuscle.layer === 'profundo'
                    ? 'bg-sky-950/92 border-sky-400 shadow-sky-500/20'
                    : 'bg-orange-950/92 border-amber-400 shadow-orange-500/20'
                  : 'bg-slate-950/92 border-yellow-400/90 shadow-yellow-500/15'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-yellow-300">
                  <span className="size-2 rounded-full bg-yellow-400 animate-ping" />
                  {activeMuscleIds.has(focusMuscle.id)
                    ? 'Músculo Seleccionado'
                    : 'Apuntando a Músculo'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                    focusMuscle.layer === 'profundo'
                      ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50'
                      : 'bg-orange-500/30 text-orange-200 border border-orange-400/50'
                  }`}
                >
                  {focusMuscle.layer}
                </span>
              </div>

              <p className="text-sm font-black text-white mt-1 leading-tight">
                {focusMuscle.name}
              </p>
              <p className="text-[10px] italic text-slate-300 leading-tight">
                {focusMuscle.muscleKey}
              </p>

              {focusMuscleSummary ? (
                <div className="mt-2 pt-1.5 border-t border-white/15 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-300">
                    Activo:{' '}
                    {getMuscleActiveSides(focusMuscle.id)
                      .map((s) => (s === 'izq' ? 'Izq' : s === 'der' ? 'Der' : 'Centro'))
                      .join(' + ')}
                  </span>
                  <span className="font-black text-white bg-white/15 px-2 py-0.5 rounded-md">
                    {focusMuscleSummary.totalBrand} U ({focusMuscleSummary.pointCount} pts)
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-amber-200/90 mt-1.5 font-medium">
                  {addPointMode
                    ? 'Haz clic para insertar un punto libre aquí'
                    : `Haz clic para activar (${sideLabel.toLowerCase()})`}
                </p>
              )}
            </div>
          ) : (
            <div
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-1.5 shadow-md backdrop-blur-sm ${
                addPointMode
                  ? 'bg-amber-950/90 border-amber-500/70 text-amber-200'
                  : 'bg-slate-950/85 border-slate-700/80 text-slate-300'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[15px] shrink-0 ${
                  addPointMode ? 'text-amber-400' : 'text-primary'
                }`}
              >
                {addPointMode ? 'add_location_alt' : 'touch_app'}
              </span>
              <span className="leading-snug">{contextHint}</span>
            </div>
          )}
        </div>

        {/* Right Floating Clinical Toolbar with Explanatory Hover Tooltips */}
        <div className="absolute top-2.5 right-2.5 z-20 flex flex-col gap-1.5 items-center bg-slate-950/80 p-1.5 rounded-xl border border-slate-800/90 backdrop-blur-md shadow-xl">
          {/* Zoom Controls */}
          <ToolbarButtonWithTooltip
            onClick={() => adjustZoom(ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            title="Acercar vista (Zoom +)"
            description="Amplía el atlas facial para colocar o arrastrar puntos con mayor precisión anatómica."
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </ToolbarButtonWithTooltip>

          <ToolbarButtonWithTooltip
            onClick={() => adjustZoom(-ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            title="Alejar vista (Zoom −)"
            description="Reduce la escala del mapa para visualizar el rostro y cuello completos."
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </ToolbarButtonWithTooltip>

          <ToolbarButtonWithTooltip
            onClick={() => setZoom(1)}
            title="Restablecer escala (100%)"
            description="Devuelve el lienzo facial a su tamaño original centrado."
          >
            <span className="text-[10px] font-bold">{Math.round(zoom * 100)}%</span>
          </ToolbarButtonWithTooltip>

          <div className="w-6 h-px bg-slate-700/80 my-0.5" />

          {/* Point Size Controls: Bigger Circle & Smaller Circle */}
          <ToolbarButtonWithTooltip
            onClick={increasePointSize}
            disabled={pointSize === 'lg'}
            active={pointSize === 'lg'}
            activeColorClass="bg-sky-600 border-sky-400 text-white"
            badge={pointSize.toUpperCase()}
            title={`Aumentar tamaño de punto (${POINT_SIZE_LABELS[pointSize]})`}
            description="Hace más grandes los círculos de aplicación para leer mejor la dosis y facilitar el arrastre táctil."
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={2.2}>
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
            </svg>
          </ToolbarButtonWithTooltip>

          <ToolbarButtonWithTooltip
            onClick={decreasePointSize}
            disabled={pointSize === 'sm'}
            active={pointSize === 'sm'}
            activeColorClass="bg-sky-600 border-sky-400 text-white"
            title={`Reducir tamaño de punto (${POINT_SIZE_LABELS[pointSize]})`}
            description="Hace más pequeños los círculos de aplicación para ver con claridad las fibras musculares en zonas pequeñas (glabela, labios)."
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={2.2}>
              <circle cx="12" cy="12" r="4.2" />
            </svg>
          </ToolbarButtonWithTooltip>

          <div className="w-6 h-px bg-slate-700/80 my-0.5" />

          {/* Free Point Addition Mode */}
          <ToolbarButtonWithTooltip
            onClick={() => setAddPointMode(!addPointMode)}
            active={addPointMode}
            activeColorClass="bg-amber-500 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/35"
            badge={addPointMode ? 'ON' : undefined}
            title={
              addPointMode
                ? 'Modo Agregar Punto: ACTIVO'
                : 'Agregar punto de aplicación libre'
            }
            description="Activa esta herramienta y haz clic sobre cualquier músculo del rostro para añadir un nuevo punto personalizado en ese sitio exacto."
          >
            <span className="material-symbols-outlined text-[19px]">
              {addPointMode ? 'where_to_vote' : 'add_location_alt'}
            </span>
          </ToolbarButtonWithTooltip>

          {/* Deep vs Superficial Layer Toggle Button */}
          <ToolbarButtonWithTooltip
            onClick={cycleAnatomyLayer}
            active={anatomyLayerFilter !== 'todos'}
            activeColorClass={
              anatomyLayerFilter === 'profundo'
                ? 'bg-sky-500 border-sky-300 text-white shadow-lg shadow-sky-500/30'
                : 'bg-orange-500 border-orange-300 text-white shadow-lg shadow-orange-500/30'
            }
            badge={
              anatomyLayerFilter === 'todos'
                ? String(totalCount)
                : anatomyLayerFilter === 'profundo'
                  ? 'PROF'
                  : 'SUP'
            }
            title={`Plano muscular: ${
              anatomyLayerFilter === 'todos'
                ? 'Todos'
                : anatomyLayerFilter === 'profundo'
                  ? 'Profundos y Masticadores'
                  : 'Superficiales'
            }`}
            description="Alterna entre Todos, Plano Superficial y Plano Profundo (Corrugador, Depresor ceja, Canino, Buccinador, DLI, Mentoniano, Temporal, Pterigoideos y Paravertebrales)."
          >
            <span className="material-symbols-outlined text-[18px]">layers</span>
          </ToolbarButtonWithTooltip>

          <div className="w-6 h-px bg-slate-700/80 my-0.5" />

          {/* Download Facial Map as PNG */}
          <ToolbarButtonWithTooltip
            onClick={handleDownloadMapPng}
            title="Descargar imagen del Mapa Facial (PNG)"
            description="Guarda una captura de alta resolución del diagrama facial actual con los músculos, puntos y dosis para anexar al expediente."
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
          </ToolbarButtonWithTooltip>
        </div>

        {/* Bottom Legend */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-slate-950/90 border border-slate-700/70 px-2.5 py-1.5 text-[10px] text-slate-300 pointer-events-none backdrop-blur-sm">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-yellow-400/60 border-2 border-yellow-300" />
            En foco / Seleccionando
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#f97316] border border-white" />
            Punto Superficial
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#0284c7] border border-sky-200" />
            Punto Profundo (IM)
          </span>
          {showDangerZones && plannerView === 'front' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-red-500/20 border border-red-500/60 border-dashed" />
              Riesgo
            </span>
          )}
        </div>

        <div
          className={`absolute inset-0 flex items-center justify-center overflow-hidden transition-transform duration-200 ease-out origin-center ${
            addPointMode ? 'cursor-crosshair' : ''
          }`}
          style={{ transform: `scale(${zoom})` }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${FACIAL_VIEWBOX.width} ${FACIAL_VIEWBOX.height}`}
            className="w-full h-full select-none outline-none"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Mapa facial interactivo"
            onClick={() => {
              setSelectedPointId(null);
            }}
          >
            <defs>
              <clipPath id="face-soft-clip">
                <rect
                  x={0}
                  y={0}
                  width={FACIAL_VIEWBOX.width}
                  height={FACIAL_VIEWBOX.height}
                  rx={8}
                />
              </clipPath>
              <linearGradient id="anatomy-vignette" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.4" />
              </linearGradient>
              <radialGradient id="posterior-head-grad" cx="50%" cy="38%" r="55%">
                <stop offset="0%" stopColor="#332630" />
                <stop offset="70%" stopColor="#231b24" />
                <stop offset="100%" stopColor="#16121b" />
              </radialGradient>
              <filter id="muscle-focus-glow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#fde047" floodOpacity="0.85" />
              </filter>
            </defs>

            <rect width={FACIAL_VIEWBOX.width} height={FACIAL_VIEWBOX.height} fill="#1a1520" />

            {/* ==================== FONDO VISTA FRONTAL (ROSTRO) ==================== */}
            {plannerView === 'front' && (
              <>
                {showAnatomy && (
                  <g clipPath="url(#face-soft-clip)" opacity={0.94}>
                    <image
                      href={FACIAL_ANATOMY_IMAGE}
                      x={ANATOMY_IMAGE_FRAME.x}
                      y={ANATOMY_IMAGE_FRAME.y}
                      width={ANATOMY_IMAGE_FRAME.width}
                      height={ANATOMY_IMAGE_FRAME.height}
                      preserveAspectRatio="xMidYMid slice"
                      style={{ pointerEvents: 'none' }}
                    />
                    <rect
                      width={FACIAL_VIEWBOX.width}
                      height={FACIAL_VIEWBOX.height}
                      fill="url(#anatomy-vignette)"
                      pointerEvents="none"
                    />
                  </g>
                )}

                {showSchematicSkin && (
                  <g id="layer-skin-schematic" opacity={0.85}>
                    <path
                      d={FACE_GUIDE_PATHS.midline}
                      stroke="#475569"
                      strokeWidth={0.75}
                      strokeDasharray="4 4"
                    />
                    <path d={FACE_GUIDE_PATHS.leftBrow} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
                    <path d={FACE_GUIDE_PATHS.rightBrow} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
                    <path d={FACE_GUIDE_PATHS.leftEye} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
                    <path d={FACE_GUIDE_PATHS.rightEye} fill="none" stroke="#cbd5e1" strokeWidth={1.2} />
                    <path d={FACE_GUIDE_PATHS.nose} fill="none" stroke="#94a3b8" strokeWidth={1} />
                    <path d={FACE_GUIDE_PATHS.mouth} fill="none" stroke="#94a3b8" strokeWidth={1} />
                  </g>
                )}

                {showAnatomy && (
                  <path
                    d={FACE_GUIDE_PATHS.midline}
                    stroke="#ffffff"
                    strokeWidth={0.6}
                    strokeDasharray="3 5"
                    strokeOpacity={0.22}
                    pointerEvents="none"
                  />
                )}
              </>
            )}

            {/* ==================== FONDO VISTA POSTERIOR (OCCIPITAL / CERVICAL PREEMPT) ==================== */}
            {plannerView === 'back' && (
              <g id="posterior-preempt-atlas" pointerEvents="none">
                {/* Silueta craneocervical posterior y hombros */}
                <path
                  d="M200,36 C258,36 300,76 302,138 C303,174 294,206 276,232 C264,254 256,284 258,318 C282,348 332,386 374,424 L374,486 L26,486 L26,424 C68,386 118,348 142,318 C144,284 136,254 124,232 C106,206 97,174 98,138 C100,76 142,36 200,36 Z"
                  fill="url(#posterior-head-grad)"
                  stroke="#475569"
                  strokeWidth={1.2}
                />
                {/* Pabellones auriculares posteriores */}
                <path
                  d="M98,148 C86,146 80,164 84,186 C87,202 95,212 106,208 M302,148 C314,146 320,164 316,186 C313,202 305,212 294,208"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth={1.4}
                />
                {/* Galea aponeurótica / Sutura lambdoidea */}
                <path
                  d="M126,146 Q200,118 274,146"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={0.8}
                  strokeDasharray="3 3"
                  opacity={0.45}
                />
                {/* Línea nucal superior y Protuberancia Occipital Externa (Inion) */}
                <path
                  d="M114,204 Q158,186 200,202 Q242,186 286,204"
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={1.1}
                  strokeDasharray="4 3"
                  opacity={0.65}
                />
                <circle cx={200} cy={202} r={3.5} fill="#f8fafc" opacity={0.7} />
                <text x={200} y={214} textAnchor="middle" fontSize={6.5} fill="#cbd5e1" opacity={0.75}>
                  Inion (Protub. Occipital)
                </text>
                {/* Eje vertebral cervical (C1 - C7) */}
                <line
                  x1={200}
                  y1={42}
                  x2={200}
                  y2={480}
                  stroke="#94a3b8"
                  strokeWidth={0.75}
                  strokeDasharray="3 5"
                  opacity={0.4}
                />
                {[235, 255, 275, 295, 315, 335, 355].map((vy, idx) => (
                  <g key={vy} opacity={0.5}>
                    <ellipse cx={200} cy={vy} rx={4.5} ry={2.5} fill="#64748b" />
                    {idx === 6 && (
                      <text x={210} y={vy + 2} fontSize={6.5} fill="#94a3b8">
                        C7
                      </text>
                    )}
                  </g>
                ))}
              </g>
            )}

            {/* Atenuación hemilado inactivo */}
            {((plannerView === 'front' && sideMode === 'izq') ||
              (plannerView === 'back' && sideMode === 'der')) && (
              <rect
                x={0}
                y={0}
                width={FACIAL_VIEWBOX.width / 2}
                height={FACIAL_VIEWBOX.height}
                fill="#0f172a"
                opacity={0.45}
                pointerEvents="none"
              />
            )}
            {((plannerView === 'front' && sideMode === 'der') ||
              (plannerView === 'back' && sideMode === 'izq')) && (
              <rect
                x={FACIAL_VIEWBOX.width / 2}
                y={0}
                width={FACIAL_VIEWBOX.width / 2}
                height={FACIAL_VIEWBOX.height}
                fill="#0f172a"
                opacity={0.45}
                pointerEvents="none"
              />
            )}

            {/* Indicadores laterales de paciente:
                En Frontal: Izq pantalla = D pac., Der pantalla = I pac.
                En Posterior: Izq pantalla = I pac., Der pantalla = D pac. */}
            <text
              x={44}
              y={88}
              fill={plannerView === 'front' ? '#f87171' : '#38bdf8'}
              fontSize={13}
              fontWeight={700}
              pointerEvents="none"
            >
              {plannerView === 'front' ? 'D' : 'I'}
            </text>
            <text x={44} y={100} fill="#94a3b8" fontSize={8} pointerEvents="none">
              pac.
            </text>
            <text
              x={FACIAL_VIEWBOX.width - 44}
              y={88}
              fill={plannerView === 'front' ? '#38bdf8' : '#f87171'}
              fontSize={13}
              fontWeight={700}
              textAnchor="end"
              pointerEvents="none"
            >
              {plannerView === 'front' ? 'I' : 'D'}
            </text>
            <text
              x={FACIAL_VIEWBOX.width - 44}
              y={100}
              fill="#94a3b8"
              fontSize={8}
              textAnchor="end"
              pointerEvents="none"
            >
              pac.
            </text>

            {showDangerZones &&
              plannerView === 'front' &&
              DANGER_REGIONS.map((region) => {
                const isNearFocus =
                  !!focusMuscleId &&
                  points.some((p) => p.muscleId === focusMuscleId && p.risk != null);
                return (
                  <polygon
                    key={region.id}
                    points={region.polygon
                      .reduce<string[]>((acc, v, i) => {
                        if (i % 2 === 0) acc.push(`${v},${region.polygon[i + 1]}`);
                        return acc;
                      }, [])
                      .join(' ')}
                    fill={isNearFocus ? 'rgba(239,68,68,0.16)' : 'rgba(239,68,68,0.06)'}
                    stroke={isNearFocus ? '#f87171' : '#ef4444'}
                    strokeWidth={isNearFocus ? 1.3 : 0.85}
                    strokeDasharray="5 4"
                    strokeOpacity={isNearFocus ? 0.9 : 0.45}
                    pointerEvents="none"
                  />
                );
              })}

            {/* Capas de selección muscular */}
            {layerVisibility.muscles && (
              <g id="layer-muscles">
                {sortedMuscles.map((muscle) => {
                  const isDeepMuscle = muscle.layer === 'profundo';
                  const matchesFilter =
                    anatomyLayerFilter === 'todos' || muscle.layer === anatomyLayerFilter;
                  const isActive = activeMuscleIds.has(muscle.id);
                  const isFocused = focusMuscleId === muscle.id;
                  const isOver = overDoseSet.has(muscle.id);
                  const hasOtherFocus = !!focusMuscleId && !isFocused;

                  if (!matchesFilter && !isActive && !isFocused) {
                    return null;
                  }

                  const baseFill = isOver
                    ? '#ef4444'
                    : isFocused
                      ? isDeepMuscle
                        ? '#38bdf8'
                        : '#fb923c'
                      : isDeepMuscle
                        ? '#0284c7'
                        : '#e06d53';

                  const fillOpacity = !matchesFilter
                    ? 0.05
                    : isFocused
                      ? 0.48
                      : isActive
                        ? hasOtherFocus
                          ? 0.14
                          : 0.28
                        : plannerView === 'back'
                          ? 0.22
                          : anatomyLayerFilter !== 'todos'
                            ? 0.12
                            : 0.04;

                  const stroke = isOver
                    ? '#f87171'
                    : isFocused
                      ? '#fde047'
                      : isDeepMuscle
                        ? isActive
                          ? '#38bdf8'
                          : '#7dd3fc'
                        : isActive
                          ? '#fb923c'
                          : '#ffffff';

                  const strokeWidth = isFocused ? 2.6 : isActive || isOver ? 1.5 : 0.8;
                  const strokeOpacity = isFocused
                    ? 1
                    : isActive || isOver
                      ? hasOtherFocus
                        ? 0.55
                        : 0.9
                      : plannerView === 'back'
                        ? 0.45
                        : anatomyLayerFilter !== 'todos'
                          ? 0.4
                          : 0.16;

                  return (
                    <g
                      key={muscle.id}
                      className={`outline-none focus:outline-none ${
                        !matchesFilter
                          ? 'pointer-events-none'
                          : addPointMode
                            ? 'cursor-crosshair'
                            : 'cursor-pointer'
                      }`}
                      style={{ outline: 'none' }}
                      onMouseEnter={() => setHover(muscle.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(muscle.id)}
                      onBlur={() => setHover(null)}
                      onClick={(e) => handleMuscleClick(e, muscle)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setLastClickedMuscleId(muscle.id);
                          toggleMuscle(muscle.id, sideMode);
                        }
                      }}
                      tabIndex={matchesFilter ? 0 : -1}
                      role="button"
                      aria-label={`${muscle.name} (${muscle.layer}), modo ${sideLabel}`}
                      aria-pressed={isActive}
                    >
                      {isFocused && (
                        <path
                          d={muscle.svgPath}
                          fill="none"
                          stroke={isDeepMuscle ? '#38bdf8' : '#f97316'}
                          strokeWidth={6}
                          strokeOpacity={0.42}
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />
                      )}

                      <path
                        d={muscle.svgPath}
                        fill={baseFill}
                        fillOpacity={isOver ? 0.32 : fillOpacity}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        strokeLinejoin="round"
                        filter={isFocused ? 'url(#muscle-focus-glow)' : undefined}
                        strokeDasharray={
                          isDeepMuscle && !isActive && !isFocused ? '3 2' : undefined
                        }
                        className="transition-[fill-opacity,stroke,stroke-width] duration-150"
                        pointerEvents="none"
                      />

                      {matchesFilter && (
                        <path
                          d={muscle.svgPath}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth={9}
                          strokeLinejoin="round"
                          style={{ pointerEvents: 'all', outline: 'none' }}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Etiqueta flotante directa en el rostro para el músculo en foco y/o músculos activos */}
            {showLabels && (
              <g id="layer-muscle-labels" pointerEvents="none">
                {viewMuscles.map((muscle) => {
                  const isFocused = focusMuscleId === muscle.id;
                  const isActive = activeMuscleIds.has(muscle.id);
                  if (!isFocused && !isActive && plannerView !== 'back') return null;
                  if (!isFocused && focusMuscleId) return null;

                  const summary = muscleSummaries.find((s) => s.muscleId === muscle.id);
                  const pos = getMuscleLabelCoords(muscle);
                  const labelText = summary
                    ? `${muscle.name} · ${summary.totalBrand}U`
                    : muscle.name;
                  const pillW = Math.max(66, Math.min(180, labelText.length * 4.8 + 16));
                  const pillH = isFocused ? 17 : 14;
                  const pillX = Math.max(8, Math.min(FACIAL_VIEWBOX.width - pillW - 8, pos.x - pillW / 2));
                  const pillY = Math.max(8, pos.y - pillH / 2);

                  return (
                    <g key={`lbl-${muscle.id}`}>
                      <rect
                        x={pillX}
                        y={pillY}
                        width={pillW}
                        height={pillH}
                        rx={pillH / 2}
                        fill={isFocused ? '#0f172a' : 'rgba(15, 23, 42, 0.85)'}
                        stroke={
                          isFocused
                            ? '#fde047'
                            : muscle.layer === 'profundo'
                              ? '#38bdf8'
                              : '#fb923c'
                        }
                        strokeWidth={isFocused ? 1.5 : 0.9}
                      />
                      <text
                        x={pillX + pillW / 2}
                        y={pillY + pillH / 2 + 2.8}
                        textAnchor="middle"
                        fontSize={isFocused ? 8.2 : 7.2}
                        fontWeight={800}
                        fill={isFocused ? '#fef08a' : '#f8fafc'}
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {layerVisibility.points &&
              viewPoints.map((point) => (
                <InjectionPointNode
                  key={point.id}
                  point={point}
                  brand={brand}
                  pointSize={pointSize}
                  isSelected={selectedPointId === point.id}
                  dimmed={
                    !!focusMuscleId &&
                    point.muscleId !== focusMuscleId &&
                    selectedPointId !== point.id
                  }
                  onSelect={(ptId) => {
                    setSelectedPointId(ptId);
                    const pt = points.find((p) => p.id === ptId);
                    if (pt) {
                      setLastClickedMuscleId(pt.muscleId);
                      onHighlightMuscle?.(pt.muscleId);
                    }
                  }}
                  onMove={movePoint}
                  onOpenPopover={(id, cx, cy) => setPopover({ pointId: id, x: cx, y: cy })}
                  svgRef={svgRef}
                />
              ))}
          </svg>
        </div>
      </div>

      {selectedPoint && popover && (
        <PointPopover
          point={selectedPoint}
          brand={brand as ToxinBrand}
          muscleName={
            musclesCatalog.find((m) => m.id === selectedPoint.muscleId)?.name ??
            selectedPoint.muscleKey
          }
          anchor={{ x: popover.x, y: popover.y }}
          onClose={() => setPopover(null)}
          onUpdateDose={updatePointDose}
          onSetDepth={setPointDepth}
          onRemove={removePoint}
        />
      )}
    </div>
  );
};

export default FaceCanvas;
