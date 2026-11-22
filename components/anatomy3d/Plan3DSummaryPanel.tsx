import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Facial3DPlanController } from '../../hooks/useFacial3DPlan';
import {
  CLINICAL_FACIAL_PRESETS,
  type AnatomyLayerFilter,
  type ClinicalFacialPreset,
  type PointSide,
  type SideMode,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import {
  autoMapMeshName,
  FACIAL_CATALOG_MUSCLES,
  formatRoleLabel,
  formatSideLabel,
  getMuscleDataById,
} from '../../utils/facial3dAutoMapper';
import { fetchMuscleMedia } from '../../services/muscleMedia';
import type { MuscleMedia } from '../../types/muscleMedia';
import type {
  DiscoveredMeshInfo,
  MeshLayer,
  MeshMappingEntry,
  MeshRole,
  MeshSide,
  SkullVisibilityMode,
} from '../../types/facial3d';

export type Panel3DTab = 'plan' | 'muscles' | 'safety' | 'clinical' | 'mapping';

interface Plan3DSummaryPanelProps {
  plan: Facial3DPlanController;
  onExportToCalculator: () => void;
  exportLabel?: string;
  adminMode?: boolean;
  interactionMode?: 'plan' | 'inspect';
  skullMode: SkullVisibilityMode;
  onSkullModeChange: (mode: SkullVisibilityMode) => void;
  selectedMeshName: string | null;
  onSelectMeshName: (meshName: string | null) => void;
  highlightedMuscleId: string | null;
  onHighlightMuscle: (muscleId: string | null) => void;
  onFocusMuscleCamera?: (muscleId: string) => void;
  onBeforeNavigate?: () => void;
  // Admin & clinical mapping props
  mappings?: Record<string, MeshMappingEntry>;
  discoveredMeshes?: DiscoveredMeshInfo[];
  onUpdateSelectedMapping?: (patch: Partial<MeshMappingEntry>) => void;
  onRunAutoMap?: () => void;
}

const BRANDS: ToxinBrand[] = ['Botox', 'Dysport', 'Xeomin'];

const Plan3DSummaryPanel: React.FC<Plan3DSummaryPanelProps> = ({
  plan,
  onExportToCalculator,
  exportLabel = 'Usar en calculadora',
  adminMode = false,
  interactionMode = 'plan',
  skullMode,
  onSkullModeChange,
  selectedMeshName,
  onSelectMeshName,
  highlightedMuscleId,
  onHighlightMuscle,
  onFocusMuscleCamera,
  onBeforeNavigate,
  mappings = {},
  discoveredMeshes = [],
  onUpdateSelectedMapping,
  onRunAutoMap,
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Panel3DTab>('plan');
  const [presetFilter, setPresetFilter] = useState<'all' | 'aesthetic' | 'neurological'>('all');
  const [pendingSidePreset, setPendingSidePreset] = useState<ClinicalFacialPreset | null>(null);
  const [manualClinicalMuscleId, setManualClinicalMuscleId] = useState<string | null>(null);
  const [muscleMedia, setMuscleMedia] = useState<MuscleMedia | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmClearSide, setConfirmClearSide] = useState<'izq' | 'der' | null>(null);
  const [muscleQuery, setMuscleQuery] = useState('');
  const [meshSearch, setMeshSearch] = useState('');
  const [meshRoleFilter, setMeshRoleFilter] = useState<'all' | 'muscle' | 'bone' | 'unmapped'>('all');

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
    anatomyLayerFilter,
    setAnatomyLayerFilter,
    addPointMode,
    setAddPointMode,
    layerVisibility,
    setLayerVisibility,
    muscleSummaries,
    totalBrandUnits,
    totalVolumeMl,
    unitsPer01Ml,
    activeRisks,
    overDoseMuscles,
    asymmetricMuscles,
    points,
    clearPlan,
    loadPreset,
    available3DMuscles,
    toggleMuscle,
    addExtraPointForMuscle,
    adjustMuscleDose,
    equalizeMuscleSides,
    removeMuscleSide,
    clearLaterality,
    activeMuscleIds,
    unitsBySide,
  } = plan;

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

  const tabs: { id: Panel3DTab; label: string; badge?: number }[] = [
    { id: 'plan', label: 'Plan' },
    { id: 'muscles', label: `Músculos (${available3DMuscles.length})` },
    {
      id: 'safety',
      label: 'Seguridad',
      badge: alertCount > 0 ? alertCount : undefined,
    },
    { id: 'clinical', label: 'Clínica' },
    ...(adminMode ? [{ id: 'mapping' as const, label: 'Mallas' }] : []),
  ];

  const superficialTotal = useMemo(
    () => available3DMuscles.filter((m) => m.layer === 'superficial').length,
    [available3DMuscles]
  );
  const deepTotal = useMemo(
    () => available3DMuscles.filter((m) => m.layer === 'profundo').length,
    [available3DMuscles]
  );

  const filteredMuscles = useMemo(() => {
    const q = muscleQuery.trim().toLowerCase();
    return available3DMuscles.filter((m) => {
      if (anatomyLayerFilter !== 'todos' && m.layer !== anatomyLayerFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.latinName.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
      );
    });
  }, [available3DMuscles, anatomyLayerFilter, muscleQuery]);

  const selectedMapping = useMemo(() => {
    if (!selectedMeshName) return null;
    return mappings[selectedMeshName] ?? autoMapMeshName(selectedMeshName);
  }, [selectedMeshName, mappings]);

  const selectedPinMuscleId = useMemo(() => {
    if (!plan.selectedPointId) return null;
    return points.find((p) => p.id === plan.selectedPointId)?.muscleId ?? null;
  }, [plan.selectedPointId, points]);

  const activeClinicalMuscleId =
    selectedMapping?.muscleId ??
    selectedPinMuscleId ??
    highlightedMuscleId ??
    manualClinicalMuscleId ??
    muscleSummaries[0]?.muscleId ??
    null;

  const selectedMuscleData = useMemo(
    () => getMuscleDataById(activeClinicalMuscleId),
    [activeClinicalMuscleId]
  );

  // When clicking a mesh in Inspect mode, jump straight to the Clínica tab
  useEffect(() => {
    if (selectedMeshName && interactionMode === 'inspect' && tab !== 'mapping') {
      setTab('clinical');
    }
  }, [selectedMeshName, interactionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear manual dropdown override whenever user clicks a new 3D mesh
  useEffect(() => {
    if (selectedMeshName) {
      setManualClinicalMuscleId(null);
    }
  }, [selectedMeshName]);

  // Load admin-curated motor point / USG media from Supabase for the active muscle
  useEffect(() => {
    const id = selectedMuscleData?.id;
    if (!id) {
      setMuscleMedia(null);
      return;
    }
    let mounted = true;
    fetchMuscleMedia(id)
      .then((row) => {
        if (mounted) setMuscleMedia(row);
      })
      .catch(() => {
        if (mounted) setMuscleMedia(null);
      });
    return () => {
      mounted = false;
    };
  }, [selectedMuscleData?.id]);

  const meshStats = useMemo(() => {
    let muscles = 0;
    let mapped = 0;
    let bones = 0;
    for (const m of discoveredMeshes) {
      const entry = mappings[m.name];
      if (!entry) continue;
      if (entry.role === 'bone') bones++;
      else if (entry.role === 'muscle') {
        muscles++;
        if (entry.muscleId) mapped++;
      }
    }
    return { total: discoveredMeshes.length, muscles, mapped, bones };
  }, [discoveredMeshes, mappings]);

  const filteredMeshes = useMemo(() => {
    const q = meshSearch.trim().toLowerCase();
    return discoveredMeshes.filter((mesh) => {
      const entry = mappings[mesh.name];
      if (meshRoleFilter === 'muscle' && entry?.role !== 'muscle') return false;
      if (meshRoleFilter === 'bone' && entry?.role !== 'bone') return false;
      if (meshRoleFilter === 'unmapped' && !(entry?.role === 'muscle' && !entry.muscleId)) {
        return false;
      }
      if (!q) return true;
      const muscle = getMuscleDataById(entry?.muscleId);
      return (
        mesh.name.toLowerCase().includes(q) ||
        (entry?.displayName || '').toLowerCase().includes(q) ||
        (muscle?.name || '').toLowerCase().includes(q) ||
        (muscle?.latinName || '').toLowerCase().includes(q)
      );
    });
  }, [discoveredMeshes, mappings, meshRoleFilter, meshSearch]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Compact Clinical Toxin Controls (mirrors 2D PlanSummaryPanel) */}
      <div className="p-3 border-b border-slate-800 space-y-2.5 shrink-0 bg-slate-950/40">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Marca
            </label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as ToxinBrand)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-bold px-2.5 py-2 cursor-pointer"
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Dilución (mL)
              </label>
              {unitsPer01Ml > 0 && (
                <span className="text-[9px] font-bold text-sky-400 tabular-nums">
                  {unitsPer01Ml} U / 0.1mL
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.1"
              min="0.5"
              value={dilution}
              onChange={(e) => setDilution(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-bold px-2.5 py-2"
            />
          </div>
        </div>

        {/* Laterality selector */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Lado a colocar (Paciente)
          </p>
          <div
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800"
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
                className={`py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  sideMode === m.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {m.short}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Controls Row */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMirrorSync(!mirrorSync)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border ${
              mirrorSync
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
            }`}
            title="Sincroniza automáticamente el punto simétrico contralateral en 3D"
          >
            Espejo 3D {mirrorSync ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setAddPointMode(!addPointMode)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border flex items-center gap-1 ${
              addPointMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/45'
                : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">add_location_alt</span>
            + Punto
          </button>

          <button
            type="button"
            onClick={() => setShowDangerZones(!showDangerZones)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors border ${
              showDangerZones
                ? 'bg-red-500/15 text-red-300 border-red-500/40'
                : 'bg-slate-800 text-slate-300 border-transparent hover:bg-slate-700'
            }`}
          >
            Zonas riesgo
          </button>

          <button
            type="button"
            onClick={handleClear}
            onBlur={() => setConfirmClear(false)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
              confirmClear
                ? 'bg-red-500/25 text-red-300 border border-red-400/50'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {confirmClear ? '¿Confirmar?' : 'Limpiar'}
          </button>
        </div>

        {/* Clear Side buttons when active */}
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
                  className={`flex-1 px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${
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

        {/* Layer Visibility Checkboxes */}
        <div className="flex flex-wrap gap-3 text-[11px]">
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={skullMode !== 'hidden'}
              onChange={(e) => onSkullModeChange(e.target.checked ? 'solid' : 'hidden')}
              className="rounded accent-primary cursor-pointer"
            />
            Cráneo
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={layerVisibility.muscles}
              onChange={(e) =>
                setLayerVisibility({ ...layerVisibility, muscles: e.target.checked })
              }
              className="rounded accent-primary cursor-pointer"
            />
            Músculos
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={layerVisibility.points}
              onChange={(e) =>
                setLayerVisibility({ ...layerVisibility, points: e.target.checked })
              }
              className="rounded accent-primary cursor-pointer"
            />
            Puntos
          </label>
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={layerVisibility.labels}
              onChange={(e) =>
                setLayerVisibility({ ...layerVisibility, labels: e.target.checked })
              }
              className="rounded accent-primary cursor-pointer"
            />
            Dosis 3D
          </label>
        </div>
      </div>

      {/* Panel Tabs */}
      <div
        className="flex border-b border-slate-800 shrink-0 bg-slate-950/60 overflow-x-auto no-scrollbar"
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 px-2 text-[11px] font-bold cursor-pointer transition-colors relative whitespace-nowrap ${
              tab === t.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              {t.label}
              {t.badge ? (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                  {t.badge}
                </span>
              ) : null}
            </span>
            {tab === t.id && (
              <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 text-xs">
        {/* TAB 1: PLAN (Presets + Per-Muscle Breakdown) */}
        {tab === 'plan' && (
          <>
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  Protocolos 3D (1 clic)
                </h3>
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[9px] font-bold">
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'aesthetic', label: 'Estética' },
                      { id: 'neurological', label: 'Neuro' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPresetFilter(f.id)}
                      className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ${
                        presetFilter === f.id
                          ? 'bg-primary text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CLINICAL_FACIAL_PRESETS.filter(
                  (p) => presetFilter === 'all' || p.category === presetFilter
                ).map((preset) => {
                  const isNeuro = preset.category === 'neurological';
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
                        loadPreset(preset.muscleIds, {
                          sideMode: preset.defaultSideMode ?? 'ambos',
                          pathologyId: preset.pathologyId,
                        });
                        if (preset.id === 'migrana-preempt' || preset.id === 'distonia-cervical') {
                          setAnatomyLayerFilter('todos');
                        }
                      }}
                      title={preset.description}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors border ${
                        isPending
                          ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 ring-1 ring-amber-400/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[13px] ${
                          isNeuro ? 'text-purple-400' : 'text-sky-400'
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

              {/* Inline side prompt for unilateral ("1 lado") protocols */}
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
                          ? 'Elige el lado sano hiperactivo del paciente (o ambos si requieres balance bilateral).'
                          : 'Elige la hemicara afectada del paciente (o ambos lados si aplica).'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingSidePreset(null)}
                      className="size-5 rounded-md bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                      aria-label="Cancelar selección de lado"
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
                          loadPreset(pendingSidePreset.muscleIds, {
                            sideMode: opt.side,
                            pathologyId: pendingSidePreset.pathologyId,
                          });
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
              <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-wide mb-2">
                Por músculo ({muscleSummaries.length})
              </h3>
              {muscleSummaries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center space-y-1.5">
                  <span className="material-symbols-outlined text-2xl text-slate-500">
                    view_in_ar
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Toca un músculo en el cráneo 3D, activa{' '}
                    <strong className="text-amber-300">+ Punto</strong> para colocar dosis exactas,
                    o elige un protocolo rápido arriba.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {muscleSummaries.map((s) => {
                    const hasIzq = s.sides.includes('izq');
                    const hasDer = s.sides.includes('der');
                    const hasCentro = s.sides.includes('centro');
                    const sideButtons: {
                      side: PointSide;
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

                    const isFocused = highlightedMuscleId === s.muscleId;

                    return (
                      <div
                        key={s.muscleId}
                        onClick={() => {
                          onHighlightMuscle(isFocused ? null : s.muscleId);
                          onFocusMuscleCamera?.(s.muscleId);
                        }}
                        onMouseEnter={() => onHighlightMuscle(s.muscleId)}
                        onMouseLeave={() => onHighlightMuscle(null)}
                        className={`rounded-xl border p-2.5 transition-all cursor-pointer ${
                          isFocused
                            ? 'border-yellow-400 bg-yellow-400/10 ring-1 ring-yellow-400/40'
                            : s.overDose
                            ? 'border-red-500/45 bg-red-500/5'
                            : 'border-slate-700/80 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {s.pointCount} pts · máx {s.maxDoseAesthetic} U ona
                            </p>
                          </div>

                          {/* Direct Dose Stepper */}
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
                            <span className="text-xs font-black text-primary min-w-[42px] text-center tabular-nums">
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

                          <button
                            type="button"
                            title="Agregar un punto 3D adicional sobre este músculo"
                            onClick={(e) => {
                              e.stopPropagation();
                              addExtraPointForMuscle(s.muscleId);
                            }}
                            className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold min-h-[26px] cursor-pointer transition-colors border bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25"
                          >
                            <span className="material-symbols-outlined text-[12px]">add</span>
                            Punto
                          </button>

                          <button
                            type="button"
                            title="Quitar todo el músculo"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMuscleSide(s.muscleId, 'ambos');
                            }}
                            className="ml-auto text-[10px] text-slate-500 hover:text-red-300 cursor-pointer px-1 py-1"
                          >
                            Quitar
                          </button>
                        </div>

                        {s.isAsymmetric && (
                          <div
                            className="mt-2 pt-1.5 border-t border-slate-700/80 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] text-amber-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">balance</span>
                              Izq {s.izqBrand}U ≠ Der {s.derBrand}U
                            </span>
                            <button
                              type="button"
                              onClick={() => equalizeMuscleSides(s.muscleId)}
                              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-[10px] font-bold cursor-pointer"
                            >
                              Igualar lados
                            </button>
                          </div>
                        )}

                        {s.risks.length > 0 && (
                          <p className="text-[10px] text-red-300 mt-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">warning</span>
                            Punto en zona de riesgo 3D
                          </p>
                        )}
                        {s.overDose && (
                          <p className="text-[10px] text-amber-300 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">error</span>
                            Supera dosis estética sugerida ({s.maxDoseAesthetic} U ona)
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

        {/* TAB 2: MUSCLES CATALOG */}
        {tab === 'muscles' && (
          <div className="space-y-2.5">
            <input
              value={muscleQuery}
              onChange={(e) => setMuscleQuery(e.target.value)}
              placeholder="Buscar músculo (ej. masetero, frontal, corrugador)..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white"
            />
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
              {(
                [
                  { id: 'todos', label: `Todos (${available3DMuscles.length})` },
                  { id: 'superficial', label: `Superf. (${superficialTotal})` },
                  { id: 'profundo', label: `Prof. (${deepTotal})` },
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
              {filteredMuscles.map((m) => {
                const active = activeMuscleIds.has(m.id);
                const isDeep = m.layer === 'profundo';
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      toggleMuscle(m.id);
                      onFocusMuscleCamera?.(m.id);
                    }}
                    onMouseEnter={() => onHighlightMuscle(m.id)}
                    onMouseLeave={() => onHighlightMuscle(null)}
                    className={`text-left px-2.5 py-2 rounded-lg text-[11px] min-h-[46px] cursor-pointer transition-colors border flex flex-col justify-between ${
                      active
                        ? isDeep
                          ? 'bg-sky-500/20 text-sky-200 border-sky-500/45'
                          : 'bg-primary/20 text-sky-100 border-primary/50'
                        : 'bg-slate-800/80 text-slate-300 border-transparent hover:bg-slate-700'
                    }`}
                  >
                    <span className="font-bold leading-tight line-clamp-1">{m.name}</span>
                    <span
                      className={`text-[9px] mt-0.5 ${
                        isDeep ? 'text-sky-400/90' : 'text-orange-300/80'
                      }`}
                    >
                      {isDeep ? 'Profundo' : 'Superficial'} · máx {m.maxDoseAesthetic} U
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SAFETY */}
        {tab === 'safety' && (
          <div className="space-y-3">
            {alertCount === 0 ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Sin alertas clínicas activas
                </p>
                <p className="text-[11px] text-emerald-200/80 mt-1">
                  Ningún punto 3D se encuentra en zonas de riesgo, con sobredosificación ni con
                  asimetría involuntaria.
                </p>
              </div>
            ) : (
              <>
                {activeRisks.length > 0 && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/35 p-3">
                    <p className="text-xs font-bold text-red-300 mb-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">gpp_maybe</span>
                      Alertas de Zona de Riesgo 3D
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
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 p-3">
                    <p className="text-xs font-bold text-amber-300 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">warning</span>
                      Sobredosificación sugerida
                    </p>
                    <p className="text-[11px] text-amber-100/90">{overDoseMuscles.join(', ')}</p>
                  </div>
                )}

                {asymmetricMuscles.length > 0 && (
                  <div className="rounded-xl bg-sky-500/10 border border-sky-500/35 p-3">
                    <p className="text-xs font-bold text-sky-300 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">balance</span>
                      Asimetría Izq vs. Der
                    </p>
                    <p className="text-[11px] text-sky-100/90">
                      {asymmetricMuscles.join(', ')} tienen dosis distintas por lado. Puedes usar{' '}
                      <strong>Igualar lados</strong> en la pestaña Plan.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5 text-[11px] text-slate-400">
              <p className="font-bold text-slate-200">Referencia visual de profundidad 3D:</p>
              <p>
                <span className="text-orange-400 font-bold">● Naranja:</span> Inyección superficial
                (intradérmica / subcutánea).
              </p>
              <p>
                <span className="text-sky-400 font-bold">● Azul Cian (con halo):</span> Inyección
                profunda (intramuscular / periostio).
              </p>
              <p>
                <span className="text-red-400 font-bold">● Rojo:</span> Punto dentro de zona de
                riesgo anatómico 3D.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: CLINICAL REFERENCE SHEET */}
        {tab === 'clinical' && (
          <div className="space-y-3">
            {/* Quick selector so doctor can inspect any facial muscle directly */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMuscleData?.id || ''}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  setManualClinicalMuscleId(nextId);
                  onHighlightMuscle(nextId);
                  if (!nextId) {
                    onSelectMeshName(null);
                  } else {
                    onFocusMuscleCamera?.(nextId);
                  }
                }}
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-bold text-white cursor-pointer"
              >
                <option value="">— Selecciona un músculo para consultar —</option>
                {FACIAL_CATALOG_MUSCLES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.latinName})
                  </option>
                ))}
              </select>
              {selectedMuscleData && (
                <button
                  type="button"
                  onClick={() => {
                    setManualClinicalMuscleId(null);
                    onHighlightMuscle(null);
                    onSelectMeshName(null);
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-700/60"
                  title="Deseleccionar y limpiar ficha"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  <span className="hidden sm:inline">Limpiar</span>
                </button>
              )}
            </div>

            {!selectedMuscleData ? (
              <div className="py-8 text-center space-y-2">
                <span className="material-symbols-outlined text-4xl text-slate-700">
                  clinical_notes
                </span>
                <p className="font-bold text-sm text-slate-200">Ficha anatómica clínica</p>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  Haz clic sobre cualquier músculo en el visor 3D (o elígelo en el selector arriba)
                  para consultar función, origen, inserción, inervación, dosificación y técnica de
                  punto motor.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {selectedMeshName && selectedMapping?.muscleId === selectedMuscleData.id && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {selectedMeshName}
                      </span>
                    )}
                    <h3 className="text-base font-black text-white mt-1">
                      {selectedMuscleData.name}
                    </h3>
                    <p className="text-[11px] italic text-slate-400">
                      {selectedMuscleData.latinName} · {selectedMuscleData.region}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setManualClinicalMuscleId(null);
                        onHighlightMuscle(null);
                        onSelectMeshName(null);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-slate-700/70"
                      title="Deseleccionar músculo actual"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                      Deseleccionar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onBeforeNavigate?.();
                        navigate(`/motor-points/${selectedMuscleData.id}`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Abrir ficha completa del músculo"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      Ficha completa
                    </button>
                  </div>
                </div>

                {selectedMapping && selectedMapping.muscleId === selectedMuscleData.id && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-bold text-[10px]">
                      {formatSideLabel(selectedMapping.side)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        selectedMapping.layer === 'profundo'
                          ? 'bg-purple-500/15 text-purple-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      Plano {selectedMapping.layer === 'profundo' ? 'Profundo' : 'Superficial'}
                    </span>
                  </div>
                )}

                {/* Primary Function & Anatomy */}
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">
                      Función Primaria
                    </p>
                    <p className="text-slate-200 mt-0.5 leading-relaxed">
                      {selectedMuscleData.anatomy.function}
                    </p>
                  </div>
                  <div className="pt-1.5 border-t border-slate-800">
                    <p className="text-[10px] font-black uppercase text-slate-500">Inervación</p>
                    <p className="text-sky-400 font-semibold mt-0.5">
                      {selectedMuscleData.anatomy.innervation}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500">Origen</p>
                      <p className="text-slate-300 mt-0.5">{selectedMuscleData.anatomy.origin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500">Inserción</p>
                      <p className="text-slate-300 mt-0.5">
                        {selectedMuscleData.anatomy.insertion}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dosing Table */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Botox', range: selectedMuscleData.dosing.botox },
                    { label: 'Dysport', range: selectedMuscleData.dosing.dysport },
                    { label: 'Xeomin', range: selectedMuscleData.dosing.xeomin },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg bg-slate-950 border border-slate-800 p-2"
                    >
                      <p className="text-[10px] font-bold text-slate-400">{item.label}</p>
                      <p className="font-black text-xs text-sky-300 mt-0.5 tabular-nums">
                        {item.range ? `${item.range.min}–${item.range.max} U` : '—'}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Motor Point & Technique */}
                <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">
                    Punto Motor y Técnica
                  </p>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedMuscleData.motorPoint.description}
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    {selectedMuscleData.motorPoint.techniqueNotes.map((n, idx) => (
                      <li key={idx}>{n}</li>
                    ))}
                  </ul>
                  {(muscleMedia?.motor_point_image_url || selectedMuscleData.motorPoint.imageUrl) && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-800 mt-2">
                      <img
                        src={
                          muscleMedia?.motor_point_image_url ||
                          selectedMuscleData.motorPoint.imageUrl
                        }
                        alt={`Punto motor ${selectedMuscleData.name}`}
                        className="w-full max-h-40 object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* USG Guidance if available */}
                {(selectedMuscleData.usgGuidance || muscleMedia?.usg_image_url) && (
                  <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-1.5">
                    <p className="text-[10px] font-black uppercase text-cyan-400">
                      Guía Ecográfica (USG)
                    </p>
                    {selectedMuscleData.usgGuidance && (
                      <p className="text-[11px] text-slate-300">
                        <strong>Transductor:</strong> {selectedMuscleData.usgGuidance.transducerType}{' '}
                        · <strong>Vista:</strong>{' '}
                        {muscleMedia?.usg_view || selectedMuscleData.usgGuidance.view}
                      </p>
                    )}
                    {(muscleMedia?.usg_image_url || selectedMuscleData.usgGuidance?.imageUrl) && (
                      <img
                        src={muscleMedia?.usg_image_url || selectedMuscleData.usgGuidance?.imageUrl}
                        alt={`USG ${selectedMuscleData.name}`}
                        className="w-full max-h-40 object-cover rounded-lg border border-slate-800 mt-1"
                      />
                    )}
                  </div>
                )}

                {/* Clinical Indications */}
                {selectedMuscleData.indications.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMuscleData.indications.map((ind) => (
                      <span
                        key={ind}
                        className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                )}

                {/* Related / Synergist Muscles */}
                {selectedMuscleData.relatedMuscles && selectedMuscleData.relatedMuscles.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-500">
                      Músculos Sinergistas / Relacionados
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedMuscleData.relatedMuscles.map((relId) => {
                        const rel = getMuscleDataById(relId);
                        if (!rel) return null;
                        return (
                          <button
                            key={relId}
                            type="button"
                            onClick={() => {
                              setManualClinicalMuscleId(rel.id);
                              onHighlightMuscle(rel.id);
                              onFocusMuscleCamera?.(rel.id);
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer"
                          >
                            {rel.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleMuscle(selectedMuscleData.id)}
                    className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold cursor-pointer"
                  >
                    {activeMuscleIds.has(selectedMuscleData.id)
                      ? 'Quitar del Plan 3D'
                      : 'Añadir al Plan 3D'}
                  </button>
                  {adminMode && (
                    <button
                      type="button"
                      onClick={() => {
                        onBeforeNavigate?.();
                        navigate(`/admin/media/${selectedMuscleData.id}`);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                    >
                      Editar USG
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ADMIN MESH MAPPING (only when adminMode === true) */}
        {adminMode && tab === 'mapping' && onUpdateSelectedMapping && (
          <div className="space-y-3">
            {selectedMeshName && selectedMapping && (
              <div className="rounded-xl bg-primary/10 border border-primary/35 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-black text-sky-300 truncate">
                    {selectedMeshName}
                  </span>
                  <span className="text-[10px] text-slate-400">Malla activa</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Rol</label>
                    <select
                      value={selectedMapping.role}
                      onChange={(e) =>
                        onUpdateSelectedMapping({ role: e.target.value as MeshRole })
                      }
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 font-bold"
                    >
                      <option value="muscle">Músculo</option>
                      <option value="bone">Hueso / Cráneo</option>
                      <option value="reference">Referencia</option>
                      <option value="hidden">Oculto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Lado</label>
                    <select
                      value={selectedMapping.side}
                      onChange={(e) =>
                        onUpdateSelectedMapping({ side: e.target.value as MeshSide })
                      }
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 font-bold"
                    >
                      <option value="izq">Izq (Pac.)</option>
                      <option value="der">Der (Pac.)</option>
                      <option value="centro">Centro</option>
                    </select>
                  </div>
                </div>

                {selectedMapping.role === 'muscle' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Músculo Clínico
                      </label>
                      <select
                        value={selectedMapping.muscleId || ''}
                        onChange={(e) => {
                          const nextId = e.target.value || null;
                          const info = getMuscleDataById(nextId);
                          onUpdateSelectedMapping({
                            muscleId: nextId,
                            displayName: info?.name ?? selectedMapping.displayName,
                          });
                        }}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 font-bold"
                      >
                        <option value="">— Sin vincular —</option>
                        {FACIAL_CATALOG_MUSCLES.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.latinName})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Plano
                        </label>
                        <select
                          value={selectedMapping.layer}
                          onChange={(e) =>
                            onUpdateSelectedMapping({ layer: e.target.value as MeshLayer })
                          }
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 font-bold"
                        >
                          <option value="superficial">Superficial</option>
                          <option value="profundo">Profundo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={selectedMapping.color || '#c44b52'}
                            onChange={(e) => onUpdateSelectedMapping({ color: e.target.value })}
                            className="h-7 w-9 rounded border border-slate-700 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => onUpdateSelectedMapping({ color: undefined })}
                            className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={meshSearch}
                onChange={(e) => setMeshSearch(e.target.value)}
                placeholder="Buscar malla..."
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5"
              />
              {onRunAutoMap && (
                <button
                  type="button"
                  onClick={onRunAutoMap}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold shrink-0 cursor-pointer"
                >
                  Auto-mapear
                </button>
              )}
            </div>

            <div className="flex gap-1 flex-wrap">
              {[
                { id: 'all', label: `Todas (${meshStats.total})` },
                { id: 'muscle', label: `Músculos (${meshStats.muscles})` },
                { id: 'bone', label: `Huesos (${meshStats.bones})` },
                { id: 'unmapped', label: `Sin mapear (${meshStats.muscles - meshStats.mapped})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMeshRoleFilter(f.id as any)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    meshRoleFilter === f.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl max-h-[260px] overflow-y-auto">
              {filteredMeshes.map((mesh) => {
                const entry = mappings[mesh.name];
                const muscle = getMuscleDataById(entry?.muscleId);
                const isSel = selectedMeshName === mesh.name;
                return (
                  <button
                    key={mesh.name}
                    type="button"
                    onClick={() => onSelectMeshName(isSel ? null : mesh.name)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 cursor-pointer ${
                      isSel ? 'bg-primary/15 text-sky-300' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold truncate">
                        {muscle?.name || entry?.displayName || mesh.name}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500 truncate">{mesh.name}</p>
                    </div>
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                      {entry?.role === 'bone'
                        ? 'Hueso'
                        : entry?.muscleId
                        ? entry.side.toUpperCase()
                        : formatRoleLabel(entry?.role || 'muscle').split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Total Units / Volume / Calculator CTA Footer */}
      <div className="shrink-0 border-t border-slate-800 p-3 space-y-2.5 bg-slate-950/90">
        <div className="rounded-xl bg-slate-900 p-2.5 border border-slate-800">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] font-bold text-slate-400">Total ({brand})</span>
            <span className="text-2xl font-black text-white tabular-nums">
              {totalBrandUnits}{' '}
              <span className="text-xs font-normal text-slate-400">U</span>
            </span>
          </div>
          <div className="flex justify-between mt-1 text-[11px] text-slate-400">
            <span>
              Volumen:{' '}
              <span className="text-white font-bold tabular-nums">
                {totalVolumeMl.toFixed(2)} mL
              </span>
            </span>
            <span className="tabular-nums font-semibold">{points.length} pts</span>
          </div>
          {(unitsBySide.izq > 0 || unitsBySide.der > 0 || unitsBySide.centro > 0) && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center gap-3 text-[10px] text-slate-400 tabular-nums">
              {unitsBySide.izq > 0 && (
                <span>
                  Izq <strong className="text-sky-300">{unitsBySide.izq} U</strong>
                </span>
              )}
              {unitsBySide.der > 0 && (
                <span>
                  Der <strong className="text-rose-300">{unitsBySide.der} U</strong>
                </span>
              )}
              {unitsBySide.centro > 0 && (
                <span>
                  Centro <strong className="text-white">{unitsBySide.centro} U</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={points.length === 0}
          onClick={onExportToCalculator}
          className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-xs shadow-lg shadow-primary/25 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
        >
          <span className="material-symbols-outlined text-base">calculate</span>
          {exportLabel}
        </button>
      </div>
    </div>
  );
};

export default Plan3DSummaryPanel;
