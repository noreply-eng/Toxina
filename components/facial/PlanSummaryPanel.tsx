import React, { useState } from 'react';
import type { FacialPlanController } from '../../hooks/useFacialPlan';
import type { PointSide, SideMode, ToxinBrand } from '../../constants/facialAestheticMap';

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
  const [confirmClear, setConfirmClear] = useState(false);

  const {
    brand,
    setBrand,
    dilution,
    setDilution,
    sideMode,
    setSideMode,
    mirrorSync,
    setMirrorSync,
    showDangerZones,
    setShowDangerZones,
    layerVisibility,
    setLayerVisibility,
    muscleSummaries,
    totalBrandUnits,
    totalVolumeMl,
    activeRisks,
    overDoseMuscles,
    points,
    clearPlan,
    musclesCatalog,
    toggleMuscle,
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
    `inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold min-h-[28px] cursor-pointer transition-colors border ${
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

  const tabs: { id: PanelTab; label: string; badge?: number }[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'muscles', label: 'Músculos' },
    {
      id: 'safety',
      label: 'Seguridad',
      badge:
        activeRisks.length + overDoseMuscles.length > 0
          ? activeRisks.length + overDoseMuscles.length
          : undefined,
    },
  ];

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
        <div className="p-3 border-b border-slate-800 space-y-3 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wide">Marca</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value as ToxinBrand)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-2.5 py-2 min-h-[40px] cursor-pointer"
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
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-sm px-2.5 py-2 min-h-[40px]"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5">
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
                  className={`py-2 rounded-lg text-[11px] font-semibold min-h-[36px] cursor-pointer transition-colors ${
                    sideMode === m.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {m.short}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
              {sideMode === 'ambos'
                ? 'Toca un músculo para agregar ambos lados. Toca de nuevo para quitarlo.'
                : 'Toca un músculo para agregar/quitar solo ese lado. El otro se conserva.'}
            </p>
            <p className="text-[10px] text-slate-600 mt-1 leading-snug">
              Izq/Der = lado del paciente (de frente: D a la izq. de pantalla, I a la der.).
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setMirrorSync(!mirrorSync)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[36px] cursor-pointer transition-colors border ${
                mirrorSync
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/35'
                  : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
              }`}
              title="Al mover o cambiar dosis, sincroniza el punto del otro lado"
            >
              Espejo edición {mirrorSync ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setShowDangerZones(!showDangerZones)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[36px] cursor-pointer transition-colors ${
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
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium min-h-[36px] cursor-pointer transition-colors ${
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
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium min-h-[32px] cursor-pointer border transition-colors ${
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

        {/* Tab content — scroll interno en desktop; en móvil scrollea el modal completo */}
        <div
          className="flex-1 overflow-y-auto overscroll-y-contain p-3 space-y-3 min-h-0 touch-pan-y"
          role="tabpanel"
        >
          {tab === 'plan' && (
            <>
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">
                  Por músculo
                </h3>
                {muscleSummaries.length === 0 ? (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Toca un músculo en el mapa para agregar puntos. Usa Izq/Ambos/Der para
                    controlar qué lado se coloca. En cada músculo, toca un chip para quitar ese
                    lado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {muscleSummaries.map((s) => {
                      const hasIzq = s.sides.includes('izq');
                      const hasDer = s.sides.includes('der');
                      const hasCentro = s.sides.includes('centro');
                      const sideButtons: { side: PointSide | 'ambos'; label: string; active: boolean }[] =
                        [
                          { side: 'izq', label: 'Izq', active: hasIzq },
                          { side: 'der', label: 'Der', active: hasDer },
                        ];
                      if (hasCentro && !hasIzq && !hasDer) {
                        sideButtons.length = 0;
                        sideButtons.push({ side: 'centro', label: 'Centro', active: true });
                      }

                      return (
                        <div
                          key={s.muscleId}
                          onMouseEnter={() => onHighlightMuscle?.(s.muscleId)}
                          onMouseLeave={() => onHighlightMuscle?.(null)}
                          className={`rounded-lg border p-3 transition-colors ${
                            highlightedMuscleId === s.muscleId
                              ? 'border-primary/50 bg-primary/10'
                              : s.overDose
                                ? 'border-red-500/45 bg-red-500/5'
                                : 'border-slate-700 bg-slate-800/50'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{s.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {s.pointCount} pts · máx {s.maxDoseAesthetic} U ona
                              </p>
                            </div>
                            <span className="text-sm font-bold text-primary shrink-0">
                              {s.totalBrand} U
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {sideButtons.map((chip) => (
                              <button
                                key={chip.side}
                                type="button"
                                disabled={!chip.active}
                                title={
                                  chip.active
                                    ? `Quitar lado ${chip.label}`
                                    : `${chip.label} no activo`
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!chip.active) return;
                                  removeMuscleSide(s.muscleId, chip.side);
                                }}
                                className={sideChipClass(chip.active)}
                              >
                                {chip.label}
                                {chip.active && (
                                  <span className="material-symbols-outlined text-[12px] opacity-80">
                                    close
                                  </span>
                                )}
                              </button>
                            ))}
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
            <div className="grid grid-cols-2 gap-1.5">
              {musclesCatalog.map((m) => {
                const active = activeMuscleIds.has(m.id);
                const highlighted = highlightedMuscleId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMuscle(m.id)}
                    onMouseEnter={() => onHighlightMuscle?.(m.id)}
                    onMouseLeave={() => onHighlightMuscle?.(null)}
                    onFocus={() => onHighlightMuscle?.(m.id)}
                    onBlur={() => onHighlightMuscle?.(null)}
                    className={`text-left px-2.5 py-2 rounded-lg text-[11px] min-h-[40px] cursor-pointer transition-colors border ${
                      active
                        ? 'bg-primary/20 text-primary border-primary/35'
                        : highlighted
                          ? 'bg-slate-700 text-white border-slate-500'
                          : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'safety' && (
            <div className="space-y-3">
              {activeRisks.length === 0 && overDoseMuscles.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                  <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Sin alertas activas
                  </p>
                  <p className="text-[11px] text-emerald-200/80 mt-1">
                    No hay puntos en zonas de riesgo ni sobredosificación detectada.
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
                </>
              )}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Las zonas de riesgo se muestran en el mapa cuando el interruptor está activo. El
                color no es el único indicador: también hay mensajes y anillos en los puntos.
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
              <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
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
              </p>
            )}
            {(activeRisks.length > 0 || overDoseMuscles.length > 0) && (
              <button
                type="button"
                onClick={() => setTab('safety')}
                className="mt-2 text-[11px] text-red-300 hover:text-red-200 cursor-pointer underline-offset-2 hover:underline"
              >
                Ver {activeRisks.length + overDoseMuscles.length} alerta
                {activeRisks.length + overDoseMuscles.length === 1 ? '' : 's'}
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
