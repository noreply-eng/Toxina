import React, { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import ProceduralFacialRig from './ProceduralFacialRig';
import GlbFacialScene from './GlbFacialScene';
import Point3DPopover from './Point3DPopover';
import { formatSideLabel, getMuscleDataById } from '../../utils/facial3dAutoMapper';
import {
  computeDynamicDangerZones3D,
  computeEyeballSpecs,
  type DangerZone3DSpec,
  type Eyeball3DSpec,
} from '../../utils/facial3dGeometry';
import {
  convertOnaToBrand,
  type PointDepth,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import type {
  CameraViewPreset,
  DiscoveredMeshInfo,
  InjectionPin3D,
  MeshMappingEntry,
  MeshSurfaceRegistry,
  PointSizeMode3D,
  SkullVisibilityMode,
} from '../../types/facial3d';

const CAMERA_PRESETS: Record<
  CameraViewPreset,
  { position: [number, number, number]; target: [number, number, number]; label: string }
> = {
  front: { position: [0, 0.06, 3.15], target: [0, 0.04, 0], label: 'Frontal' },
  threeQuarter: { position: [1.85, 0.22, 2.55], target: [0, 0.04, 0], label: '3/4' },
  right: { position: [-3.05, 0.08, 0.15], target: [0, 0.04, 0], label: 'Perfil Der.' },
  left: { position: [3.05, 0.08, 0.15], target: [0, 0.04, 0], label: 'Perfil Izq.' },
  top: { position: [0, 3.05, 0.6], target: [0, 0.04, 0], label: 'Superior' },
  back: { position: [0, 0.08, -3.15], target: [0, 0.04, 0], label: 'Posterior' },
};

const PIN_RADIUS_BY_SIZE: Record<PointSizeMode3D, number> = {
  sm: 0.019,
  md: 0.026,
  lg: 0.035,
};

interface CameraRigProps {
  preset: CameraViewPreset;
  presetNonce: number;
  zoomDelta: number;
  zoomNonce: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

const CameraRig: React.FC<CameraRigProps> = ({
  preset,
  presetNonce,
  zoomDelta,
  zoomNonce,
  controlsRef,
}) => {
  const { camera } = useThree();
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const cfg = CAMERA_PRESETS[preset];
    targetPos.current = new THREE.Vector3(...cfg.position);
    targetLook.current = new THREE.Vector3(...cfg.target);
  }, [preset, presetNonce]);

  useEffect(() => {
    if (zoomNonce === 0 || zoomDelta === 0) return;
    const look = controlsRef.current?.target ?? new THREE.Vector3(0, 0.04, 0);
    const offset = camera.position.clone().sub(look);
    const nextLen = Math.max(1.15, Math.min(6.2, offset.length() * (1 + zoomDelta)));
    offset.setLength(nextLen);
    targetPos.current = look.clone().add(offset);
    targetLook.current = look.clone();
  }, [zoomDelta, zoomNonce, camera, controlsRef]);

  useFrame((_, delta) => {
    if (!targetPos.current || !targetLook.current) return;
    const step = Math.min(1, delta * 7.5);
    camera.position.lerp(targetPos.current, step);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLook.current, step);
      controlsRef.current.update();
    }
    if (camera.position.distanceTo(targetPos.current) < 0.015) {
      targetPos.current = null;
      targetLook.current = null;
    }
  });

  return null;
};

/** Curved tube mesh hugging the real 3D anatomy surface for a danger corridor */
const DangerTubeMesh: React.FC<{
  zone: DangerZone3DSpec;
  onHover: (label: string | null) => void;
}> = ({ zone, onHover }) => {
  const geometry = useMemo(() => {
    if (!zone.curvePoints || zone.curvePoints.length < 2) return null;
    const pts = zone.curvePoints.map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 28, zone.radius ?? 0.022, 14, false);
  }, [zone.curvePoints, zone.radius]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <group>
      {/* Translucent crimson inner safety corridor */}
      <mesh
        geometry={geometry}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(zone.label);
        }}
        onPointerOut={() => onHover(null)}
      >
        <meshStandardMaterial
          color="#ef4444"
          emissive="#dc2626"
          emissiveIntensity={0.6}
          transparent
          opacity={0.34}
          roughness={0.3}
          depthWrite={false}
        />
      </mesh>
      {/* Crisp subtle wireframe warning contour */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#fca5a5"
          wireframe
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

/** Dynamic surface-hugging 3D anatomical danger zones */
const DangerZones3DLayer: React.FC<{
  visible: boolean;
  zones: DangerZone3DSpec[];
  onHoverZone: (label: string | null) => void;
}> = ({ visible, zones, onHoverZone }) => {
  if (!visible || zones.length === 0) return null;
  return (
    <group name="DangerZones3D">
      {zones.map((zone) => {
        if (zone.kind === 'tube') {
          return <DangerTubeMesh key={zone.id} zone={zone} onHover={onHoverZone} />;
        }
        if (zone.kind === 'ellipsoid' && zone.center && zone.radii) {
          return (
            <group key={zone.id} position={zone.center} scale={zone.radii}>
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation();
                  onHoverZone(zone.label);
                }}
                onPointerOut={() => onHoverZone(null)}
              >
                <sphereGeometry args={[1, 24, 18]} />
                <meshStandardMaterial
                  color="#ef4444"
                  emissive="#dc2626"
                  emissiveIntensity={0.55}
                  transparent
                  opacity={0.26}
                  depthWrite={false}
                />
              </mesh>
              <mesh>
                <sphereGeometry args={[1.015, 16, 12]} />
                <meshBasicMaterial
                  color="#fca5a5"
                  wireframe
                  transparent
                  opacity={0.18}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        }
        return null;
      })}
    </group>
  );
};

/** Realistic anatomical eyeballs tucked dynamically inside the bony orbital sockets */
const AnatomicalEyeballsLayer: React.FC<{
  eyeballs: Eyeball3DSpec[];
  visible: boolean;
  translucent: boolean;
}> = ({ eyeballs, visible, translucent }) => {
  if (!visible || eyeballs.length === 0) return null;
  return (
    <group name="AnatomicalEyeballs">
      {eyeballs.map((eye) => (
        <group key={eye.side} position={eye.position}>
          {/* Sclera globe */}
          <mesh>
            <sphereGeometry args={[eye.radius, 24, 18]} />
            <meshStandardMaterial
              color="#eceae2"
              roughness={0.22}
              metalness={0.05}
              transparent={translucent}
              opacity={translucent ? 0.35 : 1}
              depthWrite={!translucent}
            />
          </mesh>
          {/* Iris */}
          <mesh position={[0, 0, eye.radius * 0.88]} rotation={[0, 0, 0]}>
            <sphereGeometry args={[eye.radius * 0.44, 20, 14]} />
            <meshStandardMaterial
              color="#3b5169"
              roughness={0.18}
              metalness={0.1}
              transparent={translucent}
              opacity={translucent ? 0.35 : 1}
              depthWrite={!translucent}
            />
          </mesh>
          {/* Pupil */}
          <mesh position={[0, 0, eye.radius * 1.09]}>
            <sphereGeometry args={[eye.radius * 0.21, 16, 12]} />
            <meshStandardMaterial
              color="#0f172a"
              roughness={0.08}
              metalness={0.15}
              transparent={translucent}
              opacity={translucent ? 0.35 : 1}
              depthWrite={!translucent}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

interface InjectionPinsLayerProps {
  pins: InjectionPin3D[];
  brand: ToxinBrand;
  visible: boolean;
  showLabels: boolean;
  pointSize: PointSizeMode3D;
  selectedPinId: string | null;
  movingPinId: string | null;
  onPinClick: (pinId: string, clientX: number, clientY: number) => void;
}

const InjectionPinsLayer: React.FC<InjectionPinsLayerProps> = ({
  pins,
  brand,
  visible,
  showLabels,
  pointSize,
  selectedPinId,
  movingPinId,
  onPinClick,
}) => {
  if (!visible || pins.length === 0) return null;
  const baseRadius = PIN_RADIUS_BY_SIZE[pointSize];

  return (
    <group name="InjectionPins3D">
      {pins.map((pin) => {
        const isSelected = selectedPinId === pin.id;
        const isMoving = movingPinId === pin.id;
        const hasRisk = !!pin.risk;
        const pos = new THREE.Vector3(...pin.position);
        const norm = new THREE.Vector3(...pin.normal).normalize();
        const elevated = pos.clone().addScaledVector(norm, baseRadius * 0.9);
        const labelPos = pos.clone().addScaledVector(norm, baseRadius * 2.5);

        // Matches 2D planner color semantics exactly
        const pinColor = isSelected || isMoving
          ? '#facc15'
          : hasRisk
          ? '#ef4444'
          : pin.depth === 'profundo'
          ? '#38bdf8'
          : '#f97316';

        const displayDose = convertOnaToBrand(pin.doseOna, brand);

        return (
          <group key={pin.id}>
            {/* Core injection point sphere */}
            <mesh
              position={[elevated.x, elevated.y, elevated.z]}
              onClick={(e) => {
                e.stopPropagation();
                onPinClick(pin.id, e.clientX, e.clientY);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[isSelected ? baseRadius * 1.25 : baseRadius, 18, 18]} />
              <meshStandardMaterial
                color={pinColor}
                emissive={pinColor}
                emissiveIntensity={isSelected ? 0.85 : 0.5}
                roughness={0.22}
                metalness={0.1}
              />
            </mesh>

            {/* Outer halo ring for deep (IM), risk, or selected points */}
            {(pin.depth === 'profundo' || hasRisk || isSelected) && (
              <mesh
                position={[elevated.x, elevated.y, elevated.z]}
                onClick={(e) => {
                  e.stopPropagation();
                  onPinClick(pin.id, e.clientX, e.clientY);
                }}
              >
                <sphereGeometry args={[baseRadius * (isSelected ? 1.65 : 1.38), 16, 16]} />
                <meshBasicMaterial
                  color={hasRisk ? '#ef4444' : isSelected ? '#facc15' : '#38bdf8'}
                  transparent
                  opacity={isSelected ? 0.34 : 0.24}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Floating crisp dose badge in 3D */}
            {showLabels && (
              <Html
                position={[labelPos.x, labelPos.y, labelPos.z]}
                center
                distanceFactor={3.4}
                zIndexRange={[10, 0]}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinClick(pin.id, e.clientX, e.clientY);
                  }}
                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none shadow-md border whitespace-nowrap cursor-pointer transition-transform hover:scale-110 ${
                    isSelected
                      ? 'bg-yellow-400 text-slate-950 border-yellow-200'
                      : hasRisk
                      ? 'bg-red-600 text-white border-red-300'
                      : pin.depth === 'profundo'
                      ? 'bg-sky-500/95 text-slate-950 border-sky-200'
                      : 'bg-orange-500/95 text-slate-950 border-orange-200'
                  }`}
                >
                  {displayDose}U
                </button>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class CanvasErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || 'Error al inicializar WebGL.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-slate-950 text-slate-200 rounded-2xl">
          <span className="material-symbols-outlined text-4xl text-amber-400 mb-2">
            warning
          </span>
          <p className="font-bold text-sm">No se pudo renderizar el visor 3D (WebGL)</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface Facial3DViewportProps {
  modelUrl: string | null;
  mappings: Record<string, MeshMappingEntry>;
  pins: InjectionPin3D[];
  brand: ToxinBrand;
  mirrorSync: boolean;
  selectedMeshName: string | null;
  selectedPinId: string | null;
  movingPinId?: string | null;
  highlightedMuscleIds: string[];
  activeMuscleIds?: Set<string>;
  musclesVisible?: boolean;
  showPoints?: boolean;
  showLabels?: boolean;
  showDangerZones?: boolean;
  onToggleDangerZones?: () => void;
  pointSize?: PointSizeMode3D;
  onCyclePointSize?: () => void;
  superficialOpacity: number;
  onSuperficialOpacityChange: (val: number) => void;
  skullMode: SkullVisibilityMode;
  onSkullModeChange: (mode: SkullVisibilityMode) => void;
  isolateSelected: boolean;
  onToggleIsolate: () => void;
  layerFilter: 'todos' | 'superficial' | 'profundo';
  onLayerFilterChange: (filter: 'todos' | 'superficial' | 'profundo') => void;
  interactionMode?: 'plan' | 'inspect';
  onInteractionModeChange?: (mode: 'plan' | 'inspect') => void;
  pinPlacementMode: boolean;
  onTogglePinPlacementMode: () => void;
  externalCameraPreset?: { preset: CameraViewPreset; nonce: number } | null;
  isDemoModel: boolean;
  onMeshClick: (
    meshName: string,
    point: [number, number, number],
    normal: [number, number, number]
  ) => void;
  onDeselectMesh?: () => void;
  onSelectPin: (pinId: string | null) => void;
  onUpdatePinDose?: (pinId: string, deltaOna: number) => void;
  onSetPinExactDose?: (pinId: string, doseOna: number) => void;
  onSetPinDepth?: (pinId: string, depth: PointDepth) => void;
  onStartMovePin?: (pinId: string) => void;
  onCancelMovePin?: () => void;
  onRemovePin?: (pinId: string) => void;
  onMeshesDiscovered: (meshes: DiscoveredMeshInfo[]) => void;
  onSurfaceRegistryReady?: (registry: MeshSurfaceRegistry) => void;
  heightClassName?: string;
}

const Facial3DViewport: React.FC<Facial3DViewportProps> = ({
  modelUrl,
  mappings,
  pins,
  brand,
  mirrorSync,
  selectedMeshName,
  selectedPinId,
  movingPinId = null,
  highlightedMuscleIds,
  activeMuscleIds,
  musclesVisible = true,
  showPoints = true,
  showLabels = true,
  showDangerZones = true,
  onToggleDangerZones,
  pointSize = 'md',
  onCyclePointSize,
  superficialOpacity,
  onSuperficialOpacityChange,
  skullMode,
  onSkullModeChange,
  isolateSelected,
  onToggleIsolate,
  layerFilter,
  onLayerFilterChange,
  interactionMode = 'plan',
  onInteractionModeChange,
  pinPlacementMode,
  onTogglePinPlacementMode,
  externalCameraPreset,
  isDemoModel,
  onMeshClick,
  onDeselectMesh,
  onSelectPin,
  onUpdatePinDose,
  onSetPinExactDose,
  onSetPinDepth,
  onStartMovePin,
  onCancelMovePin,
  onRemovePin,
  onMeshesDiscovered,
  onSurfaceRegistryReady,
  heightClassName = 'h-[540px] lg:h-[640px]',
}) => {
  const [hoveredMeshName, setHoveredMeshName] = useState<string | null>(null);
  const [hoveredDangerLabel, setHoveredDangerLabel] = useState<string | null>(null);
  const [localSurfaceRegistry, setLocalSurfaceRegistry] = useState<MeshSurfaceRegistry>({});
  const [cameraPreset, setCameraPreset] = useState<CameraViewPreset>('front');
  const [presetNonce, setPresetNonce] = useState(0);
  const [zoomState, setZoomState] = useState<{ delta: number; nonce: number }>({
    delta: 0,
    nonce: 0,
  });
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [glbStatus, setGlbStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSurfaceRegistryReady = useCallback(
    (registry: MeshSurfaceRegistry) => {
      setLocalSurfaceRegistry(registry);
      onSurfaceRegistryReady?.(registry);
    },
    [onSurfaceRegistryReady]
  );

  const dynamicDangerZones = useMemo(
    () => computeDynamicDangerZones3D(localSurfaceRegistry),
    [localSurfaceRegistry]
  );

  const eyeballSpecs = useMemo(
    () => computeEyeballSpecs(localSurfaceRegistry),
    [localSurfaceRegistry]
  );

  useEffect(() => {
    if (!externalCameraPreset) return;
    setCameraPreset(externalCameraPreset.preset);
    setPresetNonce((n) => n + 1);
  }, [externalCameraPreset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (movingPinId) {
          onCancelMovePin?.();
        } else if (pinPlacementMode) {
          onTogglePinPlacementMode();
        } else {
          setPopoverAnchor(null);
          onSelectPin(null);
          onDeselectMesh?.();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    movingPinId,
    pinPlacementMode,
    onCancelMovePin,
    onTogglePinPlacementMode,
    onSelectPin,
    onDeselectMesh,
  ]);

  const triggerCamera = (preset: CameraViewPreset) => {
    setCameraPreset(preset);
    setPresetNonce((n) => n + 1);
  };

  const handleCapturePng = () => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `sonotox-plan-facial-3d-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.warn('No se pudo exportar captura PNG 3D:', err);
    }
  };

  const hoveredMapping = hoveredMeshName ? mappings[hoveredMeshName] : null;
  const hoveredMuscle = getMuscleDataById(hoveredMapping?.muscleId);
  const selectedMapping = selectedMeshName ? mappings[selectedMeshName] : null;
  const selectedMuscle = getMuscleDataById(selectedMapping?.muscleId);
  const selectedPin = selectedPinId ? pins.find((p) => p.id === selectedPinId) ?? null : null;

  const isPosteriorView = cameraPreset === 'back';

  return (
    <div
      className={`relative w-full ${heightClassName} rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-inner select-none`}
    >
      {/* Top-Left Camera Presets Bar */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1 max-w-[65%]">
        {(Object.keys(CAMERA_PRESETS) as CameraViewPreset[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => triggerCamera(key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold backdrop-blur-md transition-colors cursor-pointer ${
              cameraPreset === key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-900/75 text-slate-300 hover:bg-slate-800 border border-slate-700/70'
            }`}
          >
            {CAMERA_PRESETS[key].label}
          </button>
        ))}
      </div>

      {/* Top-Right Mode Switch + Add Point Button */}
      <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end gap-1.5">
        {onInteractionModeChange && (
          <div className="flex items-center rounded-lg bg-slate-900/85 border border-slate-700/80 p-0.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => onInteractionModeChange('plan')}
              className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                interactionMode === 'plan'
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Al hacer clic en un músculo activa/desactiva sus puntos de toxina"
            >
              Planificar
            </button>
            <button
              type="button"
              onClick={() => onInteractionModeChange('inspect')}
              className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer transition-colors ${
                interactionMode === 'inspect'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Al hacer clic en un músculo solo inspecciona su anatomía y mallas"
            >
              Inspeccionar
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onTogglePinPlacementMode}
          title="Clic directo en cualquier punto de un músculo 3D para insertar un punto de aplicación"
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 backdrop-blur-md transition-all cursor-pointer ${
            pinPlacementMode
              ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30'
              : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800 border border-slate-700/70'
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">add_location_alt</span>
          {pinPlacementMode ? '+ Punto ON' : '+ Punto'}
        </button>
      </div>

      {/* Patient Laterality Orientation Indicators (D / I like 2D FaceCanvas) */}
      {(cameraPreset === 'front' || cameraPreset === 'back') && (
        <>
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <span
              className={`text-sm font-black tracking-tight ${
                isPosteriorView ? 'text-sky-400/70' : 'text-rose-400/70'
              }`}
            >
              {isPosteriorView ? 'I' : 'D'}
            </span>
            <span className="text-[9px] font-bold uppercase text-slate-500">pac.</span>
          </div>
          <div className="pointer-events-none absolute right-14 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
            <span
              className={`text-sm font-black tracking-tight ${
                isPosteriorView ? 'text-rose-400/70' : 'text-sky-400/70'
              }`}
            >
              {isPosteriorView ? 'D' : 'I'}
            </span>
            <span className="text-[9px] font-bold uppercase text-slate-500">pac.</span>
          </div>
        </>
      )}

      {/* Right Vertical Clinical Tool Strip (Zoom, Point Size, Danger Zones, PNG Snapshot) */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl">
        <button
          type="button"
          onClick={() => setZoomState((z) => ({ delta: -0.18, nonce: z.nonce + 1 }))}
          className="size-8 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer"
          title="Acercar"
        >
          <span className="material-symbols-outlined text-base">add</span>
        </button>
        <button
          type="button"
          onClick={() => setZoomState((z) => ({ delta: 0.22, nonce: z.nonce + 1 }))}
          className="size-8 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer"
          title="Alejar"
        >
          <span className="material-symbols-outlined text-base">remove</span>
        </button>
        <button
          type="button"
          onClick={() => triggerCamera(cameraPreset)}
          className="size-8 rounded-lg hover:bg-slate-800 text-slate-300 text-[10px] font-black flex items-center justify-center cursor-pointer"
          title="Restablecer encuadre 100%"
        >
          100%
        </button>

        <div className="h-px bg-slate-800 my-0.5" />

        {onCyclePointSize && (
          <button
            type="button"
            onClick={onCyclePointSize}
            className="size-8 rounded-lg hover:bg-slate-800 text-slate-200 text-[10px] font-black uppercase flex items-center justify-center cursor-pointer"
            title={`Tamaño de puntos 3D (${pointSize.toUpperCase()})`}
          >
            {pointSize}
          </button>
        )}

        {onToggleDangerZones && (
          <button
            type="button"
            onClick={onToggleDangerZones}
            className={`size-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              showDangerZones
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'hover:bg-slate-800 text-slate-400'
            }`}
            title="Mostrar / ocultar zonas de riesgo 3D"
          >
            <span className="material-symbols-outlined text-base">gpp_maybe</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleCapturePng}
          className="size-8 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-center cursor-pointer"
          title="Descargar captura PNG del plan 3D"
        >
          <span className="material-symbols-outlined text-base">download</span>
        </button>
      </div>

      {/* Moving-point active instruction banner */}
      {movingPinId && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-base">open_with</span>
          <span>Haz clic en la nueva posición sobre el músculo 3D</span>
          <button
            type="button"
            onClick={onCancelMovePin}
            className="ml-1 px-2 py-0.5 rounded-full bg-slate-950/15 hover:bg-slate-950/25 text-[10px] cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Hover Danger Zone Tooltip HUD */}
      {hoveredDangerLabel && !movingPinId && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-red-950/95 border border-red-500/60 text-red-100 shadow-xl backdrop-blur-md flex items-center gap-2">
          <span className="material-symbols-outlined text-[15px] text-red-400">warning</span>
          <span className="text-xs font-bold">{hoveredDangerLabel}</span>
        </div>
      )}

      {/* Hover Tooltip HUD */}
      {hoveredMeshName && !hoveredDangerLabel && !movingPinId && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-950/90 border border-primary/50 text-white shadow-xl backdrop-blur-md flex items-center gap-2">
          <span className="size-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-xs font-black">
            {hoveredMuscle?.name || hoveredMapping?.displayName || hoveredMeshName}
          </span>
          {hoveredMuscle?.latinName && (
            <span className="text-[11px] italic text-slate-400">
              ({hoveredMuscle.latinName})
            </span>
          )}
          {hoveredMapping && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
              {formatSideLabel(hoveredMapping.side).split(' ')[0]} ·{' '}
              {hoveredMapping.layer === 'profundo' ? 'Profundo' : 'Superficial'}
            </span>
          )}
        </div>
      )}

      {/* Selected Muscle Active HUD (with 1-click Deselect) */}
      {selectedMeshName && !hoveredMeshName && !hoveredDangerLabel && !movingPinId && (
        <div className="pointer-events-auto absolute top-14 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-950/92 border border-sky-400/60 text-white shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in zoom-in-95">
          <span className="size-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse" />
          <span className="text-xs font-black">
            {selectedMuscle?.name || selectedMapping?.displayName || selectedMeshName}
          </span>
          {selectedMuscle?.latinName && (
            <span className="hidden sm:inline text-[11px] italic text-slate-400">
              ({selectedMuscle.latinName})
            </span>
          )}
          {selectedMapping && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
              {formatSideLabel(selectedMapping.side).split(' ')[0]}
            </span>
          )}
          {onDeselectMesh && (
            <button
              type="button"
              onClick={onDeselectMesh}
              className="ml-1 px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600/70 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              title="Deseleccionar músculo (o haz clic en el fondo oscuro / presiona Esc)"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
              <span>Deseleccionar</span>
            </button>
          )}
        </div>
      )}

      {/* Loading / Error overlay for GLB */}
      {glbStatus.loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3" />
          <p className="text-xs font-bold text-slate-200">
            Cargando anatomía craneofacial 3D...
          </p>
        </div>
      )}
      {glbStatus.error && (
        <div className="absolute inset-x-4 top-16 z-30 rounded-xl bg-red-950/90 border border-red-500/50 p-3 text-xs text-red-200 font-bold">
          {glbStatus.error}
        </div>
      )}

      {/* Three.js Canvas */}
      <CanvasErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0.06, 3.15], fov: 38, near: 0.05, far: 100 }}
          gl={{
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.06,
          }}
          onCreated={({ gl }) => {
            glCanvasRef.current = gl.domElement;
          }}
          onPointerMissed={() => {
            setPopoverAnchor(null);
            if (!pinPlacementMode && !movingPinId) {
              setHoveredMeshName(null);
              onSelectPin(null);
              onDeselectMesh?.();
            }
          }}
        >
          <hemisphereLight args={['#f8fafc', '#1e293b', 0.85]} />
          <directionalLight position={[2.8, 3.8, 4.2]} intensity={1.55} color="#fff6ec" />
          <directionalLight position={[-3.4, 1.8, 2.6]} intensity={0.85} color="#dbeafe" />
          <directionalLight position={[0.4, 2.2, -3.8]} intensity={0.9} color="#bae6fd" />
          <pointLight position={[0, -2.2, 2.2]} intensity={0.4} color="#ffe4e6" />

          <Suspense fallback={null}>
            {modelUrl && !isDemoModel ? (
              <GlbFacialScene
                modelUrl={modelUrl}
                mappings={mappings}
                selectedMeshName={selectedMeshName}
                hoveredMeshName={hoveredMeshName}
                highlightedMuscleIds={highlightedMuscleIds}
                activeMuscleIds={activeMuscleIds}
                musclesVisible={musclesVisible}
                superficialOpacity={superficialOpacity}
                skullMode={skullMode}
                isolateSelected={isolateSelected}
                layerFilter={layerFilter}
                pinPlacementMode={pinPlacementMode || !!movingPinId}
                onMeshClick={onMeshClick}
                onHoverMesh={setHoveredMeshName}
                onMeshesDiscovered={onMeshesDiscovered}
                onSurfaceRegistryReady={handleSurfaceRegistryReady}
                onLoadStatus={setGlbStatus}
              />
            ) : (
              <ProceduralFacialRig
                mappings={mappings}
                selectedMeshName={selectedMeshName}
                hoveredMeshName={hoveredMeshName}
                highlightedMuscleIds={highlightedMuscleIds}
                superficialOpacity={superficialOpacity}
                skullMode={skullMode}
                isolateSelected={isolateSelected}
                layerFilter={layerFilter}
                pinPlacementMode={pinPlacementMode || !!movingPinId}
                onSelectMesh={(name) => onMeshClick(name, [0, 0, 0.7], [0, 0, 1])}
                onHoverMesh={setHoveredMeshName}
                onPlacePin={onMeshClick}
                onMeshesDiscovered={onMeshesDiscovered}
              />
            )}

            <AnatomicalEyeballsLayer
              eyeballs={eyeballSpecs}
              visible={!isDemoModel && skullMode !== 'hidden'}
              translucent={skullMode === 'translucent'}
            />

            <DangerZones3DLayer
              visible={showDangerZones}
              zones={dynamicDangerZones}
              onHoverZone={setHoveredDangerLabel}
            />

            <InjectionPinsLayer
              pins={pins}
              brand={brand}
              visible={showPoints}
              showLabels={showLabels}
              pointSize={pointSize}
              selectedPinId={selectedPinId}
              movingPinId={movingPinId}
              onPinClick={(pinId, cx, cy) => {
                onSelectPin(pinId);
                setPopoverAnchor({ x: cx, y: cy });
              }}
            />

            <ContactShadows
              position={[0, -1.28, 0]}
              opacity={0.4}
              scale={4.2}
              blur={2.4}
              far={2.6}
            />
          </Suspense>

          <CameraRig
            preset={cameraPreset}
            presetNonce={presetNonce}
            zoomDelta={zoomState.delta}
            zoomNonce={zoomState.nonce}
            controlsRef={controlsRef}
          />
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.08}
            enablePan
            enableZoom
            minDistance={1.1}
            maxDistance={6.5}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Interactive Floating Point Popover (exact 2D ergonomics + 3D Relocate) */}
      {selectedPin &&
        popoverAnchor &&
        onUpdatePinDose &&
        onSetPinExactDose &&
        onSetPinDepth &&
        onStartMovePin &&
        onRemovePin && (
          <Point3DPopover
            point={selectedPin}
            brand={brand}
            mirrorSync={mirrorSync}
            anchor={popoverAnchor}
            onClose={() => setPopoverAnchor(null)}
            onUpdateDose={onUpdatePinDose}
            onSetExactDose={onSetPinExactDose}
            onSetDepth={onSetPinDepth}
            onStartMove={onStartMovePin}
            onRemove={onRemovePin}
          />
        )}

      {/* Bottom Dissection Controls & Legend HUD */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-200 shadow-lg">
          {/* Layer filter */}
          <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            {(['todos', 'superficial', 'profundo'] as const).map((lf) => (
              <button
                key={lf}
                type="button"
                onClick={() => onLayerFilterChange(lf)}
                className={`px-2 py-0.5 rounded-md font-bold capitalize cursor-pointer transition-colors ${
                  layerFilter === lf
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lf}
              </button>
            ))}
          </div>

          {/* Superficial opacity peel slider */}
          <label className="flex items-center gap-1.5 font-bold text-slate-300">
            <span className="material-symbols-outlined text-[15px] text-rose-400">layers</span>
            <span className="hidden sm:inline">Superficial</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(superficialOpacity * 100)}
              onChange={(e) => onSuperficialOpacityChange(Number(e.target.value) / 100)}
              className="w-20 accent-primary cursor-pointer"
            />
            <span className="w-7 text-right tabular-nums text-[10px] text-slate-400">
              {Math.round(superficialOpacity * 100)}%
            </span>
          </label>

          {/* Skull mode toggle */}
          <button
            type="button"
            onClick={() =>
              onSkullModeChange(
                skullMode === 'translucent'
                  ? 'solid'
                  : skullMode === 'solid'
                  ? 'hidden'
                  : 'translucent'
              )
            }
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 font-bold flex items-center gap-1 cursor-pointer"
            title="Cambiar visualización del cráneo de referencia"
          >
            <span className="material-symbols-outlined text-[15px] text-amber-300">skull</span>
            <span>
              Cráneo:{' '}
              {skullMode === 'translucent'
                ? 'Rayos X'
                : skullMode === 'solid'
                ? 'Sólido'
                : 'Oculto'}
            </span>
          </button>

          {/* Isolate selected muscle */}
          <button
            type="button"
            disabled={!selectedMeshName}
            onClick={onToggleIsolate}
            className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors ${
              isolateSelected
                ? 'bg-sky-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">center_focus_strong</span>
            Aislar
          </button>

          {/* Direct Deselect button when a muscle is active */}
          {selectedMeshName && onDeselectMesh && (
            <button
              type="button"
              onClick={onDeselectMesh}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-sky-500/50 text-sky-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Deseleccionar músculo (o haz clic en el fondo oscuro / presiona Esc)"
            >
              <span className="material-symbols-outlined text-[15px] text-sky-400">close</span>
              Deseleccionar
            </button>
          )}
        </div>

        {/* Clinical Color Legend (matches 2D planner) */}
        <div className="pointer-events-auto hidden md:flex items-center gap-2.5 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-orange-500" />
            Superficial
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-sky-400" />
            Profundo (IM)
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" />
            Riesgo
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-yellow-400" />
            Foco
          </span>
        </div>
      </div>
    </div>
  );
};

export default Facial3DViewport;
