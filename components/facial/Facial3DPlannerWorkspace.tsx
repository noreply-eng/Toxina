import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Facial3DViewport from '../anatomy3d/Facial3DViewport';
import Plan3DSummaryPanel from '../anatomy3d/Plan3DSummaryPanel';
import { useFacial3DPlan } from '../../hooks/useFacial3DPlan';
import type { FacialPlanExport } from '../../hooks/useFacialPlan';
import type { SideMode, ToxinBrand } from '../../constants/facialAestheticMap';
import { autoMapAllMeshes } from '../../utils/facial3dAutoMapper';
import { suggestedCameraForMuscle } from '../../utils/facial3dGeometry';
import type {
  CameraViewPreset,
  DiscoveredMeshInfo,
  MeshMappingEntry,
  MeshSurfaceRegistry,
  PointSizeMode3D,
  SkullVisibilityMode,
} from '../../types/facial3d';

const BUILTIN_ZANATOMY_URL = '/models/z-anatomy-facial.glb';

export interface Facial3DPlannerWorkspaceProps {
  initialBrand: ToxinBrand;
  initialDilution: string;
  mirrorModeDefault: boolean;
  pathologyId: string;
  presetToLoad?: string[];
  presetSideMode?: SideMode;
  onExportPlan: (exported: FacialPlanExport) => void;
  onPointsCountChange?: (count: number) => void;
  onBeforeNavigate?: () => void;
}

const Facial3DPlannerWorkspace: React.FC<Facial3DPlannerWorkspaceProps> = ({
  initialBrand,
  initialDilution,
  mirrorModeDefault,
  pathologyId,
  presetToLoad,
  presetSideMode,
  onExportPlan,
  onPointsCountChange,
  onBeforeNavigate,
}) => {
  const [mappings, setMappings] = useState<Record<string, MeshMappingEntry>>({});
  const [surfaceRegistry, setSurfaceRegistry] = useState<MeshSurfaceRegistry>({});
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
  const presetAppliedRef = useRef(false);

  const plan = useFacial3DPlan({
    initialBrand,
    initialDilution,
    mirrorModeDefault,
    pathologyId,
    mappings,
    surfaceRegistry,
  });

  useEffect(() => {
    onPointsCountChange?.(plan.points.length);
  }, [plan.points.length, onPointsCountChange]);

  // Apply initial preset once 3D surface registry is ready
  useEffect(() => {
    if (
      presetAppliedRef.current ||
      !presetToLoad ||
      presetToLoad.length === 0 ||
      Object.keys(surfaceRegistry).length === 0
    ) {
      return;
    }
    presetAppliedRef.current = true;
    plan.loadPreset(presetToLoad, { sideMode: presetSideMode, pathologyId });
  }, [presetToLoad, presetSideMode, pathologyId, surfaceRegistry, plan]);

  const handleMeshesDiscovered = useCallback((meshes: DiscoveredMeshInfo[]) => {
    setMappings((prev) => autoMapAllMeshes(meshes.map((m) => m.name), prev));
  }, []);

  const handleDeselectMesh = useCallback(() => {
    setSelectedMeshName(null);
    setHighlightedMuscleId(null);
    setIsolateSelected(false);
  }, []);

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
      if (plan.movingPointId) {
        plan.movePoint3D(plan.movingPointId, meshName, point, normal);
        return;
      }
      if (plan.addPointMode) {
        plan.addCustomPoint3D(meshName, point, normal);
        return;
      }
      if (interactionMode === 'plan' && entry?.muscleId) {
        plan.toggleMuscle(entry.muscleId);
      }
    },
    [mappings, plan, interactionMode, selectedMeshName, handleDeselectMesh]
  );

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto overscroll-y-contain lg:overflow-hidden">
      <div className="h-[min(56vh,480px)] lg:h-full lg:flex-1 lg:min-h-0 shrink-0 p-2 lg:p-3 flex flex-col overflow-hidden">
        <Facial3DViewport
          modelUrl={BUILTIN_ZANATOMY_URL}
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
          isDemoModel={false}
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
          onSurfaceRegistryReady={setSurfaceRegistry}
          heightClassName="h-full"
        />
      </div>

      <div className="lg:w-[360px] xl:w-[400px] shrink-0 flex flex-col min-h-0 lg:h-full p-2 lg:p-3 lg:pl-0">
        <Plan3DSummaryPanel
          plan={plan}
          onExportToCalculator={() => onExportPlan(plan.exportPlan())}
          adminMode={false}
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
          onBeforeNavigate={onBeforeNavigate}
        />
      </div>
    </div>
  );
};

export default Facial3DPlannerWorkspace;
