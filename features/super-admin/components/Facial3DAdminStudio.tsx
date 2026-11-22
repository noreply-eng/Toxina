import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Facial3DViewport from '../../../components/anatomy3d/Facial3DViewport';
import Plan3DSummaryPanel from '../../../components/anatomy3d/Plan3DSummaryPanel';
import { useFacial3DPlan } from '../../../hooks/useFacial3DPlan';
import { getAuthUser } from '../../../utils/auth';
import { autoMapAllMeshes } from '../../../utils/facial3dAutoMapper';
import { suggestedCameraForMuscle } from '../../../utils/facial3dGeometry';
import {
  deleteFacial3DModel,
  listFacial3DModels,
  saveFacial3DModel,
  setActiveFacial3DModel,
  uploadFacial3DGlb,
} from '../../../services/facial3dService';
import type {
  CameraViewPreset,
  DiscoveredMeshInfo,
  Facial3DModelRecord,
  MeshLayer,
  MeshMappingEntry,
  MeshRole,
  MeshSide,
  MeshSurfaceRegistry,
  PointSizeMode3D,
  SkullVisibilityMode,
} from '../../../types/facial3d';

const BUILTIN_ZANATOMY_ID = '__builtin_z_anatomy__';
const BUILTIN_ZANATOMY_URL = '/models/z-anatomy-facial.glb';
const DEMO_MODEL_ID = '__procedural_demo__';

const DEFAULT_ATTRIBUTION =
  'Z-Anatomy (Lluis V.) / BodyParts3D (DBCLS) — Licencia CC BY-SA 4.0';

interface Facial3DAdminStudioProps {
  fullscreen?: boolean;
}

const Facial3DAdminStudio: React.FC<Facial3DAdminStudioProps> = ({ fullscreen = false }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedModels, setSavedModels] = useState<Facial3DModelRecord[]>([]);
  const [migrationPending, setMigrationPending] = useState(false);
  const [storageSource, setStorageSource] = useState<'supabase' | 'local'>('supabase');
  const [loadingModels, setLoadingModels] = useState(true);

  const [activeModelKey, setActiveModelKey] = useState<string>(BUILTIN_ZANATOMY_ID);
  const [modelName, setModelName] = useState('Atlas Facial 3D (Z-Anatomy Real)');
  const [modelSlug, setModelSlug] = useState('z-anatomy-facial-v1');
  const [modelDescription, setModelDescription] = useState(
    'Sistema 3D craneofacial para planificación y dosificación de toxina botulínica.'
  );
  const [licenseName, setLicenseName] = useState('CC BY-SA 4.0');
  const [attributionText, setAttributionText] = useState(DEFAULT_ATTRIBUTION);
  const [attributionUrl, setAttributionUrl] = useState(
    'https://creativecommons.org/licenses/by-sa/4.0/'
  );

  const [activeGlbUrl, setActiveGlbUrl] = useState<string | null>(BUILTIN_ZANATOMY_URL);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [activeStoragePath, setActiveStoragePath] = useState<string | null>(null);
  const [activeFileSize, setActiveFileSize] = useState<number | null>(null);
  const localObjectUrlRef = useRef<string | null>(null);

  const [discoveredMeshes, setDiscoveredMeshes] = useState<DiscoveredMeshInfo[]>([]);
  const [mappings, setMappings] = useState<Record<string, MeshMappingEntry>>({});
  const [surfaceRegistry, setSurfaceRegistry] = useState<MeshSurfaceRegistry>({});

  // Viewport & interaction states
  const [selectedMeshName, setSelectedMeshName] = useState<string | null>(null);
  const [highlightedMuscleId, setHighlightedMuscleId] = useState<string | null>(null);
  const [superficialOpacity, setSuperficialOpacity] = useState<number>(1);
  const [skullMode, setSkullMode] = useState<SkullVisibilityMode>('solid');
  const [isolateSelected, setIsolateSelected] = useState<boolean>(false);
  const [interactionMode, setInteractionMode] = useState<'plan' | 'inspect'>('plan');
  const [externalCamera, setExternalCamera] = useState<{
    preset: CameraViewPreset;
    nonce: number;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Unified 3D Toxin Clinical Planning Controller
  const plan = useFacial3DPlan({
    initialBrand: 'Botox',
    initialDilution: '2.5',
    mirrorModeDefault: true,
    pathologyId: 'estetica-facial',
    mappings,
    surfaceRegistry,
  });

  const loadSavedModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await listFacial3DModels();
      setSavedModels(res.models);
      setStorageSource(res.source);
      setMigrationPending(res.migrationPending);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron consultar los modelos 3D.');
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    loadSavedModels();
    return () => {
      if (localObjectUrlRef.current) {
        URL.revokeObjectURL(localObjectUrlRef.current);
      }
    };
  }, [loadSavedModels]);

  const handleMeshesDiscovered = useCallback((meshes: DiscoveredMeshInfo[]) => {
    setDiscoveredMeshes(meshes);
    setMappings((prev) => autoMapAllMeshes(meshes.map((m) => m.name), prev));
  }, []);

  const handleSurfaceRegistryReady = useCallback((registry: MeshSurfaceRegistry) => {
    setSurfaceRegistry(registry);
  }, []);

  const handleSelectSavedModel = (key: string) => {
    setError(null);
    setFeedback(null);
    setSelectedMeshName(null);
    setHighlightedMuscleId(null);
    setIsolateSelected(false);
    setPendingUploadFile(null);

    if (localObjectUrlRef.current) {
      URL.revokeObjectURL(localObjectUrlRef.current);
      localObjectUrlRef.current = null;
    }

    setActiveModelKey(key);
    if (key === BUILTIN_ZANATOMY_ID) {
      setActiveGlbUrl(BUILTIN_ZANATOMY_URL);
      setActiveStoragePath(null);
      setActiveFileSize(null);
      setModelName('Atlas Facial 3D (Z-Anatomy Real)');
      setModelSlug('z-anatomy-facial-v1');
      setLicenseName('CC BY-SA 4.0');
      setAttributionText(DEFAULT_ATTRIBUTION);
      setAttributionUrl('https://creativecommons.org/licenses/by-sa/4.0/');
      setSkullMode('solid');
      setMappings({});
      plan.clearPlan();
      return;
    }

    if (key === DEMO_MODEL_ID) {
      setActiveGlbUrl(null);
      setActiveStoragePath(null);
      setActiveFileSize(null);
      setModelName('Atlas Facial 3D (Demo Procedural)');
      setModelSlug('procedural-facial-demo');
      setSkullMode('translucent');
      setMappings({});
      plan.clearPlan();
      return;
    }

    const found = savedModels.find((m) => m.id === key);
    if (!found) return;
    setModelName(found.name);
    setModelSlug(found.slug);
    setModelDescription(found.description || '');
    setLicenseName(found.license_name || 'CC BY-SA 4.0');
    setAttributionText(found.attribution_text || DEFAULT_ATTRIBUTION);
    setAttributionUrl(found.attribution_url || '');
    setActiveGlbUrl(found.model_url);
    setActiveStoragePath(found.storage_path);
    setActiveFileSize(found.file_size_bytes);
    setMappings(found.mesh_mappings || {});
    plan.replaceAllPoints(found.injection_pins || []);
  };

  const handleLocalGlbFile = (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
      setError('Selecciona un archivo glTF 2.0 válido (.glb o .gltf).');
      return;
    }
    setError(null);
    setFeedback(
      `Vista previa cargada: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB). Pulsa "Guardar en Admin" para subirlo a Supabase Storage.`
    );

    if (localObjectUrlRef.current) {
      URL.revokeObjectURL(localObjectUrlRef.current);
    }
    const objUrl = URL.createObjectURL(file);
    localObjectUrlRef.current = objUrl;

    const cleanSlug = file.name
      .replace(/\.(glb|gltf)$/i, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    setPendingUploadFile(file);
    setActiveGlbUrl(objUrl);
    setActiveFileSize(file.size);
    setActiveModelKey('__new_upload__');
    setModelName(file.name.replace(/\.(glb|gltf)$/i, '').replace(/[_-]+/g, ' '));
    setModelSlug(cleanSlug || `facial-3d-${Date.now()}`);
    setMappings({});
    plan.clearPlan();
    setSelectedMeshName(null);
  };

  const handleSaveModel = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const user = await getAuthUser();
      let modelUrlToSave = activeGlbUrl;
      let storagePathToSave = activeStoragePath;
      let fileSizeToSave = activeFileSize;

      if (pendingUploadFile) {
        try {
          const uploaded = await uploadFacial3DGlb(pendingUploadFile, modelSlug);
          modelUrlToSave = uploaded.publicUrl;
          storagePathToSave = uploaded.storagePath;
          fileSizeToSave = uploaded.fileSizeBytes;
        } catch (uploadErr: any) {
          if (migrationPending) {
            modelUrlToSave = null;
          } else {
            throw uploadErr;
          }
        }
      }

      if (modelUrlToSave && modelUrlToSave.startsWith('blob:')) {
        modelUrlToSave = null;
      }

      const res = await saveFacial3DModel(
        {
          slug: modelSlug.trim() || `facial-3d-${Date.now()}`,
          name: modelName.trim() || 'Modelo Facial 3D',
          description: modelDescription.trim() || null,
          model_url: modelUrlToSave,
          storage_path: storagePathToSave,
          file_size_bytes: fileSizeToSave,
          draco_compressed: true,
          is_active: savedModels.length === 0,
          license_name: licenseName.trim() || 'CC BY-SA 4.0',
          attribution_text: attributionText.trim() || DEFAULT_ATTRIBUTION,
          attribution_url: attributionUrl.trim() || null,
          mesh_mappings: mappings,
          injection_pins: plan.points,
        },
        user?.id
      );

      setPendingUploadFile(null);
      setActiveStoragePath(res.record.storage_path);
      if (res.record.model_url) {
        setActiveGlbUrl(res.record.model_url);
      }
      setActiveModelKey(res.record.id);
      await loadSavedModels();

      setFeedback(
        res.source === 'supabase'
          ? 'Modelo 3D, mapeo de mallas y plan de puntos guardados en Supabase.'
          : 'Configuración guardada localmente (aplica la migración SQL 20261122120000_facial_3d_anatomy_studio.sql en Supabase para habilitar Storage cloud).'
      );
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el modelo 3D.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeselectMesh = useCallback(() => {
    setSelectedMeshName(null);
    setHighlightedMuscleId(null);
    setIsolateSelected(false);
  }, []);

  /** Unified 3D Mesh Click Handler (Relocate -> Add Custom Point -> Toggle Muscle -> Inspect) */
  const handleMeshClick = useCallback(
    (meshName: string, point: [number, number, number], normal: [number, number, number]) => {
      if (interactionMode === 'inspect' && selectedMeshName === meshName) {
        handleDeselectMesh();
        return;
      }
      setSelectedMeshName(meshName);
      const entry = mappings[meshName];
      if (entry?.muscleId) {
        setHighlightedMuscleId(entry.muscleId);
      }

      // 1. Relocating an existing 3D point
      if (plan.movingPointId) {
        plan.movePoint3D(plan.movingPointId, meshName, point, normal);
        return;
      }

      // 2. Explicit "+ Punto" placement mode
      if (plan.addPointMode) {
        plan.addCustomPoint3D(meshName, point, normal);
        return;
      }

      // 3. Plan mode: clicking a muscle toggles its anatomical preset points on the 3D head
      if (interactionMode === 'plan' && entry?.muscleId) {
        plan.toggleMuscle(entry.muscleId);
      }
    },
    [mappings, plan, interactionMode, selectedMeshName, handleDeselectMesh]
  );

  const updateSelectedMapping = (patch: Partial<MeshMappingEntry>) => {
    if (!selectedMeshName) return;
    setMappings((prev) => {
      const current = prev[selectedMeshName] ?? {
        meshName: selectedMeshName,
        muscleId: null,
        role: 'muscle' as MeshRole,
        side: 'centro' as MeshSide,
        layer: 'superficial' as MeshLayer,
        visible: true,
      };
      return {
        ...prev,
        [selectedMeshName]: { ...current, ...patch },
      };
    });
  };

  const handleRunAutoMap = () => {
    const fresh = autoMapAllMeshes(discoveredMeshes.map((m) => m.name));
    setMappings(fresh);
    setFeedback(`Auto-mapeo ejecutado sobre ${discoveredMeshes.length} mallas.`);
  };

  const handleExportJson = () => {
    const payload = {
      slug: modelSlug,
      name: modelName,
      brand: plan.brand,
      dilution: plan.dilution,
      totalUnits: plan.totalBrandUnits,
      totalVolumeMl: Number(plan.totalVolumeMl.toFixed(2)),
      exportedAt: new Date().toISOString(),
      meshCount: discoveredMeshes.length,
      mappings,
      injectionPins: plan.points,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modelSlug || 'facial-3d'}-plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportToCalculator = () => {
    const exported = plan.exportPlan();
    navigate('/calculator', {
      state: {
        importPlan: exported,
      },
    });
  };

  const handleFocusMuscleCamera = useCallback((muscleId: string) => {
    const preset = suggestedCameraForMuscle(muscleId);
    setExternalCamera((prev) => ({ preset, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const cyclePointSize = () => {
    const order: PointSizeMode3D[] = ['sm', 'md', 'lg'];
    const idx = order.indexOf(plan.pointSize);
    plan.setPointSize(order[(idx + 1) % order.length]);
  };

  const highlightedMuscleIds = useMemo(
    () => (highlightedMuscleId ? [highlightedMuscleId] : []),
    [highlightedMuscleId]
  );

  const activeSavedRecord = savedModels.find((m) => m.id === activeModelKey) ?? null;

  return (
    <div className="space-y-4">
      {/* Top Studio Header & Admin Asset Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="size-8 rounded-xl bg-gradient-to-br from-primary to-cyan-500 text-white flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
            </span>
            <h2 className="text-base font-black tracking-tight">
              Planificador y Studio Craneofacial 3D
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-primary/10 text-primary">
              Toxina 3D · Cráneo
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {plan.totalBrandUnits} U ({plan.brand}) · {plan.points.length} pts ·{' '}
              {plan.totalVolumeMl.toFixed(2)} mL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Calcula dosis, aplica protocolos 1-clic, coloca y reubica puntos con espejo 3D y envía
            el plan directo a la Calculadora Clínica.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeModelKey}
            onChange={(e) => handleSelectSavedModel(e.target.value)}
            disabled={loadingModels}
            className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold max-w-[220px]"
          >
            <option value={BUILTIN_ZANATOMY_ID}>★ Cráneo Facial 3D Real</option>
            {savedModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.is_active ? '● ' : ''}
                {m.name}
              </option>
            ))}
            {activeModelKey === '__new_upload__' && (
              <option value="__new_upload__">Vista previa: {modelName}</option>
            )}
            <option value={DEMO_MODEL_ID}>Fallback Demo Procedural</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLocalGlbFile(file);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            Subir .GLB
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveModel}
            className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            {saving ? 'Guardando...' : 'Guardar Admin'}
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Exportar plan y mapeo en JSON"
          >
            <span className="material-symbols-outlined text-base">download</span>
            JSON
          </button>

          {!fullscreen && (
            <button
              type="button"
              onClick={() => navigate('/admin/facial-3d')}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Abrir en pantalla completa"
            >
              <span className="material-symbols-outlined text-base">open_in_full</span>
            </button>
          )}
        </div>
      </div>

      {/* Notices */}
      {migrationPending && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
          <strong>Modo Local ({storageSource}):</strong> Aplica{' '}
          <code className="font-mono">
            supabase/migrations/20261122120000_facial_3d_anatomy_studio.sql
          </code>{' '}
          en Supabase para persistir modelos `.glb` y presets en la nube.
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {/* Main Split: 3D Craniofacial Viewport + Unified Clinical & Admin Control Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div
          className="xl:col-span-8 space-y-3 flex flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleLocalGlbFile(file);
          }}
        >
          <Facial3DViewport
            modelUrl={activeGlbUrl}
            mappings={mappings}
            pins={plan.points}
            brand={plan.brand}
            mirrorSync={plan.mirrorSync}
            selectedMeshName={selectedMeshName}
            selectedPinId={plan.selectedPointId}
            movingPinId={plan.movingPointId}
            highlightedMuscleIds={highlightedMuscleIds}
            activeMuscleIds={plan.activeMuscleIds}
            musclesVisible={plan.layerVisibility.muscles}
            showPoints={plan.layerVisibility.points}
            showLabels={plan.layerVisibility.labels}
            showDangerZones={plan.showDangerZones}
            onToggleDangerZones={() => plan.setShowDangerZones(!plan.showDangerZones)}
            pointSize={plan.pointSize}
            onCyclePointSize={cyclePointSize}
            superficialOpacity={superficialOpacity}
            onSuperficialOpacityChange={setSuperficialOpacity}
            skullMode={skullMode}
            onSkullModeChange={setSkullMode}
            isolateSelected={isolateSelected}
            onToggleIsolate={() => setIsolateSelected((v) => !v)}
            layerFilter={plan.anatomyLayerFilter}
            onLayerFilterChange={plan.setAnatomyLayerFilter}
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            pinPlacementMode={plan.addPointMode}
            onTogglePinPlacementMode={() => plan.setAddPointMode(!plan.addPointMode)}
            externalCameraPreset={externalCamera}
            isDemoModel={!activeGlbUrl}
            onMeshClick={handleMeshClick}
            onDeselectMesh={handleDeselectMesh}
            onSelectPin={plan.setSelectedPointId}
            onUpdatePinDose={plan.updatePointDose}
            onSetPinExactDose={plan.setPointExactDose}
            onSetPinDepth={plan.setPointDepth}
            onStartMovePin={plan.setMovingPointId}
            onCancelMovePin={() => plan.setMovingPointId(null)}
            onRemovePin={plan.removePoint}
            onMeshesDiscovered={handleMeshesDiscovered}
            onSurfaceRegistryReady={handleSurfaceRegistryReady}
            heightClassName={fullscreen ? 'h-[72vh] min-h-[580px]' : 'h-[580px] lg:h-[680px]'}
          />

          {activeSavedRecord && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-black">{activeSavedRecord.name}</span>
                <span className="font-mono text-[11px] text-slate-400">
                  ({activeSavedRecord.slug})
                </span>
                {activeSavedRecord.is_active && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-black">
                    Activo en Producción
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!activeSavedRecord.is_active && (
                  <button
                    type="button"
                    onClick={async () => {
                      await setActiveFacial3DModel(activeSavedRecord.id);
                      await loadSavedModels();
                      setFeedback(`"${activeSavedRecord.name}" marcado como modelo 3D activo.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    Activar Modelo
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await deleteFacial3DModel(activeSavedRecord);
                    handleSelectSavedModel(BUILTIN_ZANATOMY_ID);
                    await loadSavedModels();
                    setFeedback('Modelo eliminado.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Unified Clinical Toxin + Admin Panel */}
        <aside className="xl:col-span-4 xl:h-[680px]">
          <Plan3DSummaryPanel
            plan={plan}
            onExportToCalculator={handleExportToCalculator}
            adminMode
            interactionMode={interactionMode}
            skullMode={skullMode}
            onSkullModeChange={setSkullMode}
            selectedMeshName={selectedMeshName}
            onSelectMeshName={(name) => {
              setSelectedMeshName(name);
              if (!name) {
                setHighlightedMuscleId(null);
                setIsolateSelected(false);
              }
            }}
            highlightedMuscleId={highlightedMuscleId}
            onHighlightMuscle={setHighlightedMuscleId}
            onFocusMuscleCamera={handleFocusMuscleCamera}
            mappings={mappings}
            discoveredMeshes={discoveredMeshes}
            onUpdateSelectedMapping={updateSelectedMapping}
            onRunAutoMap={handleRunAutoMap}
          />
        </aside>
      </div>
    </div>
  );
};

export default Facial3DAdminStudio;
