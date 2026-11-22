import React, { useMemo, useState } from 'react';
import type { FacialPlanController } from '../../hooks/useFacialPlan';
import {
  CLINICAL_FACIAL_PRESETS,
  FACIAL_MUSCLE_BY_ID,
  type AnatomyLayerFilter,
  type ClinicalFacialPreset,
  type PointSide,
  type SideMode,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';

type PanelTab = 'plan' | 'muscles' | 'safety';

interface PlanSummaryPanelProps {
  plan: FacialPlanController;
  onExport: () => void;
  exportLabel?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  highlightedMuscleId?: string | null;
  onHighlightMuscle?: (muscleId: string | null) => void;
}

const BRANDS: ToxinBrand[] = ['Botox', 'Dysport', 'Xeomin'];

const PlanSummaryPanel: React.FC<PlanSummaryPanelProps> = ({
  plan,
  onExport,
  exportLabel = 'Usar en calculadora',
  collapsed,
  onToggleCollapse,
  highlightedMuscleId = null,
  onHighlightMuscle,
}) => {
  const [tab, setTab] = useState<PanelTab>('plan');
  const [pendingSidePreset, setPendingSidePreset] = useState<ClinicalFacialPreset | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const {
    brand,
    setBrand,
    dilution,
    setDilution,
    plannerView,
    setPlannerView,
    sideMode,
    setSideMode,
    mirrorSync,
    setMirrorSync,
    showDangerZones,
    setShowDangerZones,
    anatomyLayerFilter,
    setAnatomyLayerFilter,
    addPointMode,
    setAddPointMode,
    layerVisibility,
    setLayerVisibility,
    muscleSummaries,
    totalBrandUnits,
    totalVolumeMl,
    activeRisks,
    overDoseMuscles,
    asymmetricMuscles,
    points,
    clearPlan,
    loadPreset,
    musclesCatalog,
    toggleMuscle,
    addCustomPoint,
    adjustMuscleDose,
    equalizeMuscleSides,
    removeMuscleSide,
    clearLaterality,
    activeMuscleIds,
    unitsBySide,
  } = plan;

  const [confirmClearSide, setConfirmClearSide] = useState<'izq' | 'der' | null>(null);

  const sideModes: { id: SideMode; label: string; short: string }[] = [
    { id: 'izq', label: 'Izquierda', short: 'Izq' },
    { id: 'ambos', label: 'Bilateral', short: 'Ambos' },
    { id: 'der', label: 'Derecha', short: 'Der' },
  ];

  const sideChipClass = (active: boolean) =>
    `inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold min-h-[26px] cursor-pointer transition-colors border ${
      active
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-400/40'
        : 'bg-slate-900/60 text-slate-600 border-slate-700/60 cursor-default'
    }`;

  const handleClear = () => {
    if (points.length === 0) {
      clearPlan();
      setConfirmClear(false);
      return;
    }
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearPlan();
    setConfirmClear(false);
  };

  const alertCount = activeRisks.length + overDoseMuscles.length + asymmetricMuscles.length;

  const tabs: { id: PanelTab; label: string; badge?: number }[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'muscles', label: `Músculos (${musclesCatalog.length})` },
    {
      id: 'safety',
      label: 'Seguridad',
      badge: alertCount > 0 ? alertCount : undefined,
    },
  ];

  const superficialTotal = useMemo(
    () => musclesCatalog.filter((m) => m.layer === 'superficial').length,
    [musclesCatalog]
  );
  const deepTotal = useMemo(
    () => musclesCatalog.filter((m) => m.layer === 'profundo').length,
    [musclesCatalog]
  );

  const filteredCatalog = musclesCatalog.filter(
    (m) => anatomyLayerFilter === 'todos' || m.layer === anatomyLayerFilter
  );

  return (
    <div className="flex flex-col lg:h-full bg-surface-dark border-t lg:border-t-0 lg:border-l border-slate-800">
      {onToggleCollapse && (
        <button
          type="button"
          className="lg:hidden flex items-center justify-center py-2 text-slate-400 border-b border-slate-800 cursor-pointer shrink-0"
          onClick={onToggleCollapse}
        >
          <span className="material-symbols-outlined">
            {collapsed ? 'expand_less' : 'expand_more'}
          </span>
          <span className="text-xs ml-1">{collapsed ? 'Ver panel' : 'Ocultar panel'}</span>
        </button>
      )}

      <div
        className={`flex flex-col flex-1 min-h-0 lg:overflow-hidden ${collapsed ? 'hidden lg:flex' : ''}`}
      >
        {/* Compact config */}
        <div className="p-3 border-b border-slate-800 space-y-2.5 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wide">Marca</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as ToxinBrand)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-2.5 py-2 min-h-[38px] cursor-pointer"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wide">
                Dilución (mL)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={dilution}
                onChange={(e) => setDilution(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-2.5 py-2 min-h-[38px]"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">
              Lado a colocar
            </p>
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700"
              role="radiogroup"
              aria-label="Lado a colocar"
            >
              {sideModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={sideMode === m.id}
                  onClick={() => setSideMode(m.id)}
                  title={`Colocar puntos en: ${m.label} del paciente`}
                  className={`py-1.5 rounded-lg text-[11px] font-semibold min-h-[34px] cursor-pointer transition-colors ${
                    sideMode === m.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.short}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
              Izq/Der = lado del paciente (D a la izq. de pantalla en vista frontal).
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMirrorSync(!mirrorSync)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[34px] cursor-pointer transition-colors border ${
                mirrorSync
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/35'
                  : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
              }`}
              title="Al mover, cambiar dosis o agregar puntos libres, sincroniza el punto simétrico del otro lado"
            >
              Espejo edición {mirrorSync ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setAddPointMode(!addPointMode)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[34px] cursor-pointer transition-colors border flex items-center gap-1 ${
                addPointMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                  : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
              }`}
              title="Permite hacer clic en cualquier parte de un músculo en el mapa para insertar un punto extra"
            >
              <span className="material-symbols-outlined text-[14px]">add_location_alt</span>
              + Punto
            </button>
            <button
              type="button"
              onClick={() => setShowDangerZones(!showDangerZones)}
              title="Mostrar u ocultar polígonos de advertencia anatómica en el mapa"
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[34px] cursor-pointer transition-colors ${
                showDangerZones
                  ? 'bg-red-500/15 text-red-300 border border-red-500/35'
                  : 'bg-slate-800 text-slate-300 border border-transparent hover:bg-slate-700'
              }`}
            >
              Zonas riesgo
            </button>
            <button
              type="button"
              onClick={handleClear}
              onBlur={() => setConfirmClear(false)}
              title="Borrar todos los puntos del plan actual"
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[34px] cursor-pointer transition-colors ${
                confirmClear
                  ? 'bg-red-500/25 text-red-300 border border-red-400/50'
                  : 'bg-slate-800 text-slate-300 border border-transparent hover:bg-slate-700'
              }`}
            >
              {confirmClear ? '¿Confirmar?' : 'Limpiar'}
            </button>
          </div>

          {points.length > 0 && (
            <div className="flex gap-1.5">
              {(['izq', 'der'] as const).map((side) => {
                const count = points.filter((p) => p.side === side).length;
                if (count === 0) return null;
                const confirming = confirmClearSide === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => {
                      if (!confirming) {
                        setConfirmClearSide(side);
                        return;
                      }
                      clearLaterality(side);
                      setConfirmClearSide(null);
                    }}
                    onBlur={() => setConfirmClearSide((c) => (c === side ? null : c))}
                    className={`flex-1 px-2 py-1 rounded-lg text-[10px] font-medium min-h-[30px] cursor-pointer border transition-colors ${
                      confirming
                        ? 'bg-red-500/25 text-red-300 border-red-400/50'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {confirming
                      ? `¿Vaciar ${side === 'izq' ? 'Izq' : 'Der'}?`
                      : `Vaciar ${side === 'izq' ? 'Izq' : 'Der'} (${count})`}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-[11px]">
            {(
              [
                ['anatomy', 'Atlas'],
                ['muscles', 'Zonas'],
                ['points', 'Puntos'],
                ['labels', 'Nombres'],
              ] as const
            ).map(([layer, label]) => (
              <label
                key={layer}
                className="flex items-center gap-1.5 text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={layerVisibility[layer] !== false}
                  onChange={() =>
                    setLayerVisibility({
                      ...layerVisibility,
                      [layer]: !(layerVisibility[layer] !== false),
                    })
                  }
                  className="rounded cursor-pointer"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex border-b border-slate-800 shrink-0"
          role="tablist"
          aria-label="Secciones del plan"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold cursor-pointer transition-colors relative ${
                tab === t.id
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1">
                {t.label}
                {t.badge ? (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500/90 text-[10px] text-white flex items-center justify-center">
                    {t.badge}
                  </span>
                ) : null}
              </span>
              {tab === t.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          className="flex-1 overflow-y-auto overscroll-y-contain p-3 space-y-3 min-h-0 touch-pan-y"
          role="tabpanel"
        >
          {tab === 'plan' && (
            <>
              {/* Protocolos Clínicos Rápidos */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  Protocolos rápidos (1 clic)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {CLINICAL_FACIAL_PRESETS.map((preset) => {
                    const asksSide = !!preset.defaultSideMode && preset.defaultSideMode !== 'ambos';
                    const isPending = pendingSidePreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          if (asksSide) {
                            setPendingSidePreset(isPending ? null : preset);
                            return;
                          }
                          setPendingSidePreset(null);
                          loadPreset(preset.muscleIds, preset.defaultSideMode ?? 'ambos');
                          if (preset.id === 'migrana-preempt' || preset.id === 'distonia-cervical') {
                            setAnatomyLayerFilter('todos');
                          }
                        }}
                        title={preset.description}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors border ${
                          isPending
                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 ring-1 ring-amber-400/40'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[13px] ${
                            preset.category === 'neurological' ? 'text-purple-400' : 'text-sky-400'
                          }`}
                        >
                          {preset.icon}
                        </span>
                        <span>{preset.name}</span>
                        {asksSide && (
                          <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-black uppercase">
                            1 lado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {pendingSidePreset && (
                  <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-black text-amber-200 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-amber-400">
                            swap_horiz
                          </span>
                          ¿En qué lado aplicar {pendingSidePreset.name}?
                        </p>
                        <p className="text-[10px] text-amber-100/75 mt-0.5 leading-snug">
                          {pendingSidePreset.id === 'asimetria-facial'
                            ? 'Elige el lado sano hiperactivo del paciente (o ambos si requieres balance).'
                            : 'Elige la hemicara afectada del paciente (o ambos lados si aplica).'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingSidePreset(null)}
                        className="size-5 rounded-md bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                        aria-label="Cancelar"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { side: 'izq', label: 'Izquierdo', sub: 'Der. pantalla', cls: 'bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border-sky-400/40' },
                          { side: 'der', label: 'Derecho', sub: 'Izq. pantalla', cls: 'bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border-rose-400/40' },
                          { side: 'ambos', label: 'Ambos', sub: 'Bilateral', cls: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600' },
                        ] as { side: SideMode; label: string; sub: string; cls: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.side}
                          type="button"
                          onClick={() => {
                            loadPreset(pendingSidePreset.muscleIds, opt.side);
                            setPendingSidePreset(null);
                          }}
                          className={`py-1.5 px-2 rounded-lg border text-center cursor-pointer transition-colors ${opt.cls}`}
                        >
                          <p className="text-[11px] font-black leading-tight">{opt.label}</p>
                          <p className="text-[9px] opacity-75">{opt.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">
                  Por músculo
                </h3>
                {muscleSummaries.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Toca un músculo en el mapa o elige un protocolo rápido arriba. Usa los botones{' '}
                    <strong className="text-slate-300">Superficiales / Profundos</strong> o cambia a{' '}
                    <strong className="text-purple-300">Posterior · PREEMPT</strong> para occipital y
                    cuello.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {muscleSummaries.map((s) => {
                      const muscleCfg = FACIAL_MUSCLE_BY_ID[s.muscleId];
                      const hasIzq = s.sides.includes('izq');
                      const hasDer = s.sides.includes('der');
                      const hasCentro = s.sides.includes('centro');
                      const sideButtons: {
                        side: PointSide | 'ambos';
                        label: string;
                        units: number;
                        active: boolean;
                      }[] = [
                        { side: 'izq', label: 'Izq', units: s.izqBrand, active: hasIzq },
                        { side: 'der', label: 'Der', units: s.derBrand, active: hasDer },
                      ];
                      if (hasCentro && !hasIzq && !hasDer) {
                        sideButtons.length = 0;
                        sideButtons.push({
                          side: 'centro',
                          label: 'Centro',
                          units: s.centroBrand,
                          active: true,
                        });
                      }

                      return (
                        <div
                          key={s.muscleId}
                          onClick={() => {
                            if (muscleCfg && (muscleCfg.view ?? 'front') !== plannerView) {
                              setPlannerView(muscleCfg.view ?? 'front');
                            }
                            onHighlightMuscle?.(
                              highlightedMuscleId === s.muscleId ? null : s.muscleId
                            );
                          }}
                          onMouseEnter={() => onHighlightMuscle?.(s.muscleId)}
                          onMouseLeave={() => onHighlightMuscle?.(null)}
                          className={`rounded-lg border p-3 transition-all cursor-pointer ${
                            highlightedMuscleId === s.muscleId
                              ? 'border-yellow-400 bg-yellow-400/10 shadow-md shadow-yellow-500/10 ring-1 ring-yellow-400/50'
                              : s.overDose
                                ? 'border-red-500/45 bg-red-500/5'
                                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {highlightedMuscleId === s.muscleId && (
                                  <span className="size-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                                )}
                                <p className="text-xs font-bold text-white truncate">{s.name}</p>
                                {muscleCfg && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                      muscleCfg.layer === 'profundo'
                                        ? 'bg-sky-500/15 text-sky-300'
                                        : 'bg-orange-500/15 text-orange-300'
                                    }`}
                                  >
                                    {muscleCfg.layer === 'profundo' ? 'Prof.' : 'Sup.'}
                                  </span>
                                )}
                                {s.view === 'back' && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300">
                                    Post.
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {s.pointCount} pts · máx {s.maxDoseAesthetic} U ona
                              </p>
                            </div>

                            {/* Direct Dose Stepper (- / +) for the whole muscle */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                title="Reducir dosis en todos los puntos de este músculo"
                                onClick={() => adjustMuscleDose(s.muscleId, -0.5)}
                                className="size-6 rounded-md bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer"
                              >
                                −
                              </button>
                              <span className="text-sm font-bold text-primary min-w-[40px] text-center tabular-nums">
                                {s.totalBrand} U
                              </span>
                              <button
                                type="button"
                                title="Aumentar dosis en todos los puntos de este músculo"
                                onClick={() => adjustMuscleDose(s.muscleId, 0.5)}
                                className="size-6 rounded-md bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {sideButtons.map((chip) => (
                              <button
                                key={chip.side}
                                type="button"
                                disabled={!chip.active}
                                title={
                                  chip.active
                                    ? `Quitar lado ${chip.label} (${chip.units} U)`
                                    : `${chip.label} no activo`
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!chip.active) return;
                                  removeMuscleSide(s.muscleId, chip.side);
                                }}
                                className={sideChipClass(chip.active)}
                              >
                                <span>
                                  {chip.label}
                                  {chip.active ? ` ${chip.units}U` : ''}
                                </span>
                                {chip.active && (
                                  <span className="material-symbols-outlined text-[12px] opacity-80">
                                    close
                                  </span>
                                )}
                              </button>
                            ))}

                            {/* Botón directo para sumar un punto extra en este músculo sin encimarlos */}
                            {muscleCfg && (
                              <button
                                type="button"
                                title="Agregar un punto de aplicación adicional en este músculo (desplazado automáticamente)"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if ((muscleCfg.view ?? 'front') !== plannerView) {
                                    setPlannerView(muscleCfg.view ?? 'front');
                                  }
                                  const tpl = muscleCfg.defaultPoints[0];
                                  const baseX = tpl
                                    ? tpl.x
                                    : Math.round((muscleCfg.bbox.minX + muscleCfg.bbox.maxX) / 2);
                                  const baseY = tpl
                                    ? tpl.y
                                    : Math.round((muscleCfg.bbox.minY + muscleCfg.bbox.maxY) / 2);
                                  const step = Math.floor(s.pointCount / 2) + 1;
                                  const angle = step * 1.35;
                                  const radius = Math.min(18, 6 + step * 3);
                                  const nextX = baseX + Math.round(Math.cos(angle) * radius);
                                  const nextY = baseY + Math.round(Math.sin(angle) * radius);
                                  addCustomPoint(s.muscleId, nextX, nextY);
                                }}
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold min-h-[26px] cursor-pointer transition-colors border bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25"
                              >
                                <span className="material-symbols-outlined text-[12px]">add</span>
                                Punto
                              </button>
                            )}

                            {(hasIzq || hasDer) && (
                              <button
                                type="button"
                                title="Quitar todo el músculo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMuscleSide(s.muscleId, 'ambos');
                                }}
                                className="ml-auto text-[10px] text-slate-500 hover:text-red-300 cursor-pointer px-1.5 py-1"
                              >
                                Quitar todo
                              </button>
                            )}
                          </div>

                          {/* Alerta de Asimetría Izq vs Der con botón Igualar Lados en 1 clic */}
                          {s.isAsymmetric && (
                            <div
                              className="mt-2 pt-1.5 border-t border-slate-700/80 flex items-center justify-between gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[10px] text-amber-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">
                                  balance
                                </span>
                                Asimetría: Izq {s.izqBrand}U ≠ Der {s.derBrand}U
                              </span>
                              <button
                                type="button"
                                onClick={() => equalizeMuscleSides(s.muscleId)}
                                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-[10px] font-bold cursor-pointer transition-colors"
                                title="Igualar ambos lados con la misma cantidad de puntos y dosis"
                              >
                                Igualar lados
                              </button>
                            </div>
                          )}

                          {s.risks.length > 0 && (
                            <p className="text-[11px] text-red-300 mt-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">warning</span>
                              Zona de riesgo activa
                            </p>
                          )}
                          {s.overDose && (
                            <p className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">error</span>
                              Sobredosificación
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'muscles' && (
            <div className="space-y-2.5">
              {/* Filtro por plano anatómico */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-700">
                {(
                  [
                    { id: 'todos', label: `Todos (${musclesCatalog.length})` },
                    { id: 'superficial', label: `Superficial (${superficialTotal})` },
                    { id: 'profundo', label: `Profundo (${deepTotal})` },
                  ] as { id: AnatomyLayerFilter; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setAnatomyLayerFilter(f.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                      anatomyLayerFilter === f.id
                        ? f.id === 'profundo'
                          ? 'bg-sky-600 text-white'
                          : f.id === 'superficial'
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {filteredCatalog.map((m) => {
                  const active = activeMuscleIds.has(m.id);
                  const highlighted = highlightedMuscleId === m.id;
                  const isDeep = m.layer === 'profundo';
                  const isBack = (m.view ?? 'front') === 'back';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        if ((m.view ?? 'front') !== plannerView) {
                          setPlannerView(m.view ?? 'front');
                        }
                        toggleMuscle(m.id);
                      }}
                      onMouseEnter={() => onHighlightMuscle?.(m.id)}
                      onMouseLeave={() => onHighlightMuscle?.(null)}
                      onFocus={() => onHighlightMuscle?.(m.id)}
                      onBlur={() => onHighlightMuscle?.(null)}
                      className={`text-left px-2.5 py-2 rounded-lg text-[11px] min-h-[44px] cursor-pointer transition-colors border flex flex-col justify-between ${
                        active
                          ? isDeep
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/45'
                            : 'bg-primary/20 text-primary border-primary/40'
                          : highlighted
                            ? 'bg-slate-700 text-white border-slate-500'
                            : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-semibold leading-tight line-clamp-1">{m.name}</span>
                      <span
                        className={`text-[9px] mt-0.5 ${
                          isDeep ? 'text-sky-400/80' : 'text-orange-300/75'
                        }`}
                      >
                        {isBack ? 'Posterior · ' : ''}
                        {isDeep ? 'Profundo' : 'Superficial'} · máx {m.maxDoseAesthetic} U
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'safety' && (
            <div className="space-y-3">
              {alertCount === 0 ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                  <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Sin alertas activas
                  </p>
                  <p className="text-[11px] text-emerald-200/80 mt-1">
                    No hay puntos en zonas de riesgo, sobredosificación ni asimetrías involuntarias.
                  </p>
                </div>
              ) : (
                <>
                  {activeRisks.length > 0 && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                      <p className="text-xs font-bold text-red-300 mb-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">gpp_maybe</span>
                        Alertas de seguridad
                      </p>
                      <ul className="text-[11px] text-red-200/90 space-y-1.5">
                        {activeRisks.map((msg) => (
                          <li key={msg} className="flex gap-1.5">
                            <span className="text-red-400 shrink-0">•</span>
                            <span>{msg}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {overDoseMuscles.length > 0 && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
                      <p className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">warning</span>
                        Sobredosificación
                      </p>
                      <p className="text-[11px] text-amber-100/90">{overDoseMuscles.join(', ')}</p>
                    </div>
                  )}
                  {asymmetricMuscles.length > 0 && (
                    <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 p-3">
                      <p className="text-xs font-bold text-sky-300 mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px]">balance</span>
                        Asimetría de dosis Izq vs. Der
                      </p>
                      <p className="text-[11px] text-sky-100/90">
                        {asymmetricMuscles.join(', ')} tienen unidades distintas entre lado
                        izquierdo y derecho. Puedes simetrizarlos con el botón &ldquo;Igualar
                        lados&rdquo; en la pestaña Plan.
                      </p>
                    </div>
                  )}
                </>
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Los puntos superficiales se muestran en naranja y los profundos (intramusculares) en
                azul cian con anillo punteado interno.
              </p>
            </div>
          )}
        </div>

        {/* Sticky summary + CTA */}
        <div className="shrink-0 border-t border-slate-800 p-3 space-y-3 bg-surface-dark">
          <div className="rounded-xl bg-slate-800/90 p-3 border border-slate-700">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">Total</span>
              <span className="text-2xl font-bold text-white tabular-nums">
                {totalBrandUnits}{' '}
                <span className="text-sm font-normal text-slate-400">U</span>
              </span>
            </div>
            <div className="flex justify-between mt-1 text-xs text-slate-400">
              <span>
                Volumen:{' '}
                <span className="text-white font-medium tabular-nums">
                  {totalVolumeMl.toFixed(2)} mL
                </span>
              </span>
              <span className="tabular-nums">{points.length} pts</span>
            </div>
            {(unitsBySide.izq > 0 || unitsBySide.der > 0 || unitsBySide.centro > 0) && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                <div>
                  {unitsBySide.izq > 0 && (
                    <span className="mr-2">
                      Izq <span className="text-white font-medium">{unitsBySide.izq} U</span>
                    </span>
                  )}
                  {unitsBySide.der > 0 && (
                    <span className="mr-2">
                      Der <span className="text-white font-medium">{unitsBySide.der} U</span>
                    </span>
                  )}
                  {unitsBySide.centro > 0 && (
                    <span>
                      Centro <span className="text-white font-medium">{unitsBySide.centro} U</span>
                    </span>
                  )}
                </div>
                {unitsBySide.izq > 0 && unitsBySide.der > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      unitsBySide.izq === unitsBySide.der
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {unitsBySide.izq === unitsBySide.der ? 'Simétrico' : 'Asimétrico'}
                  </span>
                )}
              </div>
            )}
            {alertCount > 0 && (
              <button
                type="button"
                onClick={() => setTab('safety')}
                className="mt-2 text-[11px] text-red-300 hover:text-red-200 cursor-pointer underline-offset-2 hover:underline"
              >
                Ver {alertCount} alerta{alertCount === 1 ? '' : 's'}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onExport}
            disabled={points.length === 0}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px] active:scale-[0.98] transition-transform cursor-pointer"
          >
            {exportLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanSummaryPanel;
