import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ANATOMY_IMAGE_FRAME,
  DANGER_REGIONS,
  FACIAL_ANATOMY_IMAGE,
  FACIAL_VIEWBOX,
  FACE_GUIDE_PATHS,
  muscleHasLateralPoints,
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
const ZOOM_MAX = 1.75;
const ZOOM_STEP = 0.15;

const FaceCanvas: React.FC<FaceCanvasProps> = ({
  plan,
  highlightedMuscleId = null,
  onHighlightMuscle,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [popover, setPopover] = useState<{ pointId: string; x: number; y: number } | null>(null);
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const {
    points,
    brand,
    activeMuscleIds,
    selectedPointId,
    setSelectedPointId,
    showDangerZones,
    layerVisibility,
    toggleMuscle,
    movePoint,
    updatePointDose,
    setPointDepth,
    removePoint,
    muscleSummaries,
    musclesCatalog,
    sideMode,
    getMuscleActiveSides,
  } = plan;

  const overDoseSet = useMemo(
    () => new Set(muscleSummaries.filter((s) => s.overDose).map((s) => s.muscleId)),
    [muscleSummaries]
  );

  const selectedPoint = popover ? points.find((p) => p.id === popover.pointId) : null;
  const focusMuscleId = hoveredMuscle ?? highlightedMuscleId;
  const focusMuscle = focusMuscleId
    ? musclesCatalog.find((m) => m.id === focusMuscleId)
    : null;

  const sideLabel =
    sideMode === 'ambos'
      ? 'Bilateral'
      : sideMode === 'izq'
        ? 'Solo izq. del paciente'
        : 'Solo der. del paciente';

  const contextHint = useMemo(() => {
    if (selectedPointId) {
      const pt = points.find((p) => p.id === selectedPointId);
      if (pt) {
        const muscle = musclesCatalog.find((m) => m.id === pt.muscleId);
        const sideTxt =
          pt.side === 'centro'
            ? 'centro'
            : pt.side === 'izq'
              ? 'izq. paciente'
              : 'der. paciente';
        return `${muscle?.name ?? pt.muscleKey} (${sideTxt}) · arrastra · doble toque para editar`;
      }
    }
    if (activeMuscleIds.size === 0) {
      return `${sideLabel} · toca un músculo para agregar · toca de nuevo para quitar`;
    }
    if (focusMuscle) {
      const summary = muscleSummaries.find((s) => s.muscleId === focusMuscle.id);
      const sides = getMuscleActiveSides(focusMuscle.id)
        .filter((s) => s !== 'centro')
        .map((s) => (s === 'izq' ? 'I' : 'D'))
        .join('+');
      if (summary) {
        return `${focusMuscle.name}${sides ? ` [${sides}]` : ''}: ${summary.totalBrand} U · toca de nuevo para quitar`;
      }
      return `${focusMuscle.name} · toca para agregar (${sideLabel.toLowerCase()})`;
    }
    return `${sideLabel} · toca músculo para agregar/quitar ese lado`;
  }, [
    activeMuscleIds.size,
    focusMuscle,
    getMuscleActiveSides,
    muscleSummaries,
    musclesCatalog,
    points,
    selectedPointId,
    sideLabel,
  ]);

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

  const showAnatomy = layerVisibility.anatomy !== false;
  const showSchematicSkin = layerVisibility.skin && !showAnatomy;

  return (
    <div className="relative w-full h-full min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0 bg-gradient-to-b from-slate-900/80 to-slate-950/90 rounded-xl lg:rounded-2xl border border-slate-700/80 overflow-hidden shadow-inner">
        {/* Hint overlay — no consume altura del atlas */}
        <div className="absolute top-2 left-2 right-14 z-10 px-2.5 py-1.5 rounded-lg bg-slate-950/85 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-1.5 pointer-events-none max-w-[min(100%,420px)]">
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
            touch_app
          </span>
          <span className="leading-snug line-clamp-2">{contextHint}</span>
        </div>

        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => adjustZoom(ZOOM_STEP)}
            className="size-9 rounded-lg bg-slate-800/95 border border-slate-600 text-white hover:bg-slate-700 cursor-pointer flex items-center justify-center"
            aria-label="Acercar"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(-ZOOM_STEP)}
            className="size-9 rounded-lg bg-slate-800/95 border border-slate-600 text-white hover:bg-slate-700 cursor-pointer flex items-center justify-center"
            aria-label="Alejar"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="size-9 rounded-lg bg-slate-800/95 border border-slate-600 text-slate-300 hover:bg-slate-700 cursor-pointer flex items-center justify-center text-[10px] font-bold"
            aria-label="Restablecer zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>

        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-slate-950/85 border border-slate-700/70 px-2.5 py-1.5 text-[10px] text-slate-300 pointer-events-none">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#e8a090]/70 border border-[#c47868]" />
            Atlas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#e06d53]/50 border border-[#e06d53]" />
            Activo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#f97316] border border-white" />
            Punto
          </span>
          {showDangerZones && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-red-500/20 border border-red-500/60 border-dashed" />
              Riesgo
            </span>
          )}
        </div>

        {focusMuscle && (
          <div className="absolute top-12 left-2 z-10 max-w-[200px] rounded-lg bg-slate-950/90 border border-slate-600 px-2.5 py-1.5 pointer-events-none">
            <p className="text-xs font-semibold text-white truncate">{focusMuscle.name}</p>
            {activeMuscleIds.has(focusMuscle.id) ? (
              <p className="text-[10px] text-primary">
                Activo:{' '}
                {getMuscleActiveSides(focusMuscle.id)
                  .map((s) => (s === 'izq' ? 'Izq' : s === 'der' ? 'Der' : 'Centro'))
                  .join(' · ')}
              </p>
            ) : (
              <p className="text-[10px] text-slate-400">Toca para agregar · {sideLabel}</p>
            )}
          </div>
        )}

        <div
          className="absolute inset-0 flex items-center justify-center overflow-hidden transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${FACIAL_VIEWBOX.width} ${FACIAL_VIEWBOX.height}`}
            className="w-full h-full select-none"
            preserveAspectRatio="xMidYMid meet"
            aria-label="Mapa facial interactivo"
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
                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.45" />
              </linearGradient>
            </defs>

            <rect width={FACIAL_VIEWBOX.width} height={FACIAL_VIEWBOX.height} fill="#1a1520" />

            {/* Atlas anatómico de fondo */}
            {showAnatomy && (
              <g clipPath="url(#face-soft-clip)" opacity={0.92}>
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

            {/* Esquema lineal solo si atlas apagado */}
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

            {/* Línea media sutil sobre atlas */}
            {showAnatomy && (
              <path
                d={FACE_GUIDE_PATHS.midline}
                stroke="#ffffff"
                strokeWidth={0.6}
                strokeDasharray="3 5"
                strokeOpacity={0.25}
                pointerEvents="none"
              />
            )}

            {/* Atenuación hemilado inactivo — convención paciente de frente */}
            {sideMode === 'izq' && (
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
            {sideMode === 'der' && (
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

            {/* D = der. paciente (izq. pantalla) · I = izq. paciente (der. pantalla) */}
            <text x={48} y={52} fill="#f87171" fontSize={13} fontWeight={700} pointerEvents="none">
              D
            </text>
            <text x={48} y={64} fill="#94a3b8" fontSize={8} pointerEvents="none">
              pac.
            </text>
            <text
              x={FACIAL_VIEWBOX.width - 48}
              y={52}
              fill="#38bdf8"
              fontSize={13}
              fontWeight={700}
              textAnchor="end"
              pointerEvents="none"
            >
              I
            </text>
            <text
              x={FACIAL_VIEWBOX.width - 48}
              y={64}
              fill="#94a3b8"
              fontSize={8}
              textAnchor="end"
              pointerEvents="none"
            >
              pac.
            </text>

            {showDangerZones &&
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
                    fill={isNearFocus ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.06)'}
                    stroke={isNearFocus ? '#f87171' : '#ef4444'}
                    strokeWidth={isNearFocus ? 1.3 : 0.85}
                    strokeDasharray="5 4"
                    strokeOpacity={isNearFocus ? 0.9 : 0.45}
                    pointerEvents="none"
                  />
                );
              })}

            {/* Capas de selección muscular (semi-transparentes sobre atlas) */}
            {layerVisibility.muscles && (
              <g id="layer-muscles">
                {musclesCatalog.map((muscle) => {
                  const isActive = activeMuscleIds.has(muscle.id);
                  const isFocused = focusMuscleId === muscle.id;
                  const isOver = overDoseSet.has(muscle.id);
                  const activeSides = getMuscleActiveSides(muscle.id);
                  const hasLeft = activeSides.includes('izq');
                  const hasRight = activeSides.includes('der');
                  const hasCenter = activeSides.includes('centro');
                  const fillOpacity = isActive
                    ? isFocused
                      ? 0.28
                      : 0.16
                    : isFocused
                      ? 0.2
                      : 0.04;
                  const stroke = isOver
                    ? '#f87171'
                    : isActive
                      ? '#fb923c'
                      : isFocused
                        ? '#93c5fd'
                        : '#ffffff';
                  const strokeWidth = isFocused || isActive || isOver ? 1.8 : 0.5;
                  const strokeOpacity = isActive || isFocused || isOver ? 0.95 : 0.15;

                  return (
                    <g
                      key={muscle.id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHover(muscle.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(muscle.id)}
                      onBlur={() => setHover(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMuscle(muscle.id, sideMode);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleMuscle(muscle.id, sideMode);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${muscle.name}, modo ${sideLabel}`}
                      aria-pressed={isActive}
                    >
                      <path
                        d={muscle.svgPath}
                        fill={isOver ? '#ef4444' : isActive ? '#e06d53' : '#f0a090'}
                        fillOpacity={isOver ? 0.22 : fillOpacity}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeOpacity={strokeOpacity}
                        strokeLinejoin="round"
                        strokeDasharray={isFocused && !isActive ? '5 3' : undefined}
                        className="transition-[fill-opacity,stroke] duration-150"
                        pointerEvents="none"
                      />

                      {/* Indicadores: der. paciente = pantalla izq; izq. paciente = pantalla der */}
                      {isActive && muscleHasLateralPoints(muscle) && (
                        <>
                          {hasRight && (
                            <circle
                              cx={muscle.bbox.minX + 6}
                              cy={(muscle.bbox.minY + muscle.bbox.maxY) / 2}
                              r={3.5}
                              fill="#f87171"
                              stroke="#fff"
                              strokeWidth={0.8}
                              pointerEvents="none"
                            />
                          )}
                          {hasLeft && (
                            <circle
                              cx={muscle.bbox.maxX - 6}
                              cy={(muscle.bbox.minY + muscle.bbox.maxY) / 2}
                              r={3.5}
                              fill="#38bdf8"
                              stroke="#fff"
                              strokeWidth={0.8}
                              pointerEvents="none"
                            />
                          )}
                          {hasCenter && !hasLeft && !hasRight && (
                            <circle
                              cx={(muscle.bbox.minX + muscle.bbox.maxX) / 2}
                              cy={(muscle.bbox.minY + muscle.bbox.maxY) / 2}
                              r={3.5}
                              fill="#38bdf8"
                              stroke="#fff"
                              strokeWidth={0.8}
                              pointerEvents="none"
                            />
                          )}
                        </>
                      )}

                      <path
                        d={muscle.svgPath}
                        fill="transparent"
                        stroke="transparent"
                        strokeWidth={18}
                        strokeLinejoin="round"
                        style={{ pointerEvents: 'all' }}
                      />
                    </g>
                  );
                })}
              </g>
            )}

            {layerVisibility.points &&
              points.map((point) => (
                <InjectionPointNode
                  key={point.id}
                  point={point}
                  brand={brand}
                  isSelected={selectedPointId === point.id}
                  dimmed={
                    !!focusMuscleId &&
                    point.muscleId !== focusMuscleId &&
                    selectedPointId !== point.id
                  }
                  onSelect={setSelectedPointId}
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
