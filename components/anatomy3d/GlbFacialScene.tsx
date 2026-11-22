import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { extractSurfaceSamplesFromMesh } from '../../utils/facial3dGeometry';
import { normalizeToDataMuscleId } from '../../hooks/useFacial3DPlan';
import type {
  DiscoveredMeshInfo,
  MeshMappingEntry,
  MeshSurfaceRegistry,
  SkullVisibilityMode,
} from '../../types/facial3d';

interface GlbFacialSceneProps {
  modelUrl: string;
  mappings: Record<string, MeshMappingEntry>;
  selectedMeshName: string | null;
  hoveredMeshName: string | null;
  highlightedMuscleIds: string[];
  activeMuscleIds?: Set<string>;
  musclesVisible?: boolean;
  superficialOpacity: number;
  skullMode: SkullVisibilityMode;
  isolateSelected: boolean;
  layerFilter: 'todos' | 'superficial' | 'profundo';
  pinPlacementMode: boolean;
  onMeshClick: (
    meshName: string,
    point: [number, number, number],
    normal: [number, number, number]
  ) => void;
  onHoverMesh: (meshName: string | null) => void;
  onMeshesDiscovered: (meshes: DiscoveredMeshInfo[]) => void;
  onSurfaceRegistryReady?: (registry: MeshSurfaceRegistry) => void;
  onLoadStatus?: (status: { loading: boolean; error: string | null }) => void;
}

const MUSCLE_PALETTE: Record<string, string> = {
  frontalis: '#c44b52',
  corrugator: '#972e40',
  procerus: '#cf575e',
  'depressor-supercilii': '#a13447',
  'orbicularis-oculi': '#c85058',
  nasalis: '#d45e66',
  'levator-labii-superioris-alaeque-nasi': '#c74c55',
  'levator-labii-superioris': '#b9414a',
  'zygomaticus-minor': '#cf585e',
  'zygomaticus-major': '#be434c',
  'levator-anguli-oris': '#942c3e',
  buccinator: '#8d2a3b',
  risorius: '#d6646a',
  'orbicularis-oris': '#c94c57',
  'depressor-anguli-oris': '#b83e48',
  'depressor-labii-inferioris': '#983042',
  mentalis: '#a33548',
  masseter: '#b33b45',
  temporalis: '#963142',
  'medial-pterygoid': '#842436',
  'lateral-pterygoid': '#8c283b',
  platysma: '#c95a62',
  occipitalis: '#b5454e',
  sternocleidomastoid: '#ae3c47',
  'splenius-capitis': '#8f2c3d',
  trapezius: '#b9444e',
  'cervical-paraspinals': '#8c2b3c',
  'levator-scapulae': '#983244',
};

const DEFAULT_MUSCLE_SUPERFICIAL_COLOR = new THREE.Color('#c24951');
const DEFAULT_MUSCLE_DEEP_COLOR = new THREE.Color('#922c3e');
const SUBMENTAL_REF_COLOR = new THREE.Color('#8f3844');
const BONE_COLOR = new THREE.Color('#ebe3d4');
const TOOTH_COLOR = new THREE.Color('#f7f4ec');
const CARTILAGE_COLOR = new THREE.Color('#cbd5e1');
const LARYNX_CARTILAGE_COLOR = new THREE.Color('#bcd0e6');
const APONEUROSIS_COLOR = new THREE.Color('#e2dcd4');
const SELECTED_COLOR = new THREE.Color('#0ea5e9');
const HOVERED_COLOR = new THREE.Color('#fb923c');
const PRESET_COLOR = new THREE.Color('#f59e0b');
const ACTIVE_PLAN_COLOR = new THREE.Color('#dc2646');

const SELECTED_EMISSIVE = new THREE.Color('#0369a1');
const HOVERED_EMISSIVE = new THREE.Color('#9a3412');
const PRESET_EMISSIVE = new THREE.Color('#b45309');
const ACTIVE_PLAN_EMISSIVE = new THREE.Color('#7f1d1d');
const IDLE_EMISSIVE = new THREE.Color('#1a0508');

const TOOTH_REGEX = /incisor|canine|premolar|molar|tooth|teeth/i;
const CARTILAGE_REGEX = /cartilage|septal/i;
const LARYNX_REGEX = /thyroid|cricoid/i;
const SUBMENTAL_REF_REGEX = /digastric|mylohyoid/i;

function createMuscleFiberTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 2) {
    const shade = 112 + Math.floor(Math.sin(y * 0.55) * 18 + (Math.random() - 0.5) * 14);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, 128, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

const GlbFacialScene: React.FC<GlbFacialSceneProps> = ({
  modelUrl,
  mappings,
  selectedMeshName,
  hoveredMeshName,
  highlightedMuscleIds,
  activeMuscleIds,
  musclesVisible = true,
  superficialOpacity,
  skullMode,
  isolateSelected,
  layerFilter,
  pinPlacementMode,
  onMeshClick,
  onHoverMesh,
  onMeshesDiscovered,
  onSurfaceRegistryReady,
  onLoadStatus,
}) => {
  const [sceneRoot, setSceneRoot] = useState<THREE.Group | null>(null);
  const meshLookupRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const discoveredRef = useRef<DiscoveredMeshInfo[]>([]);
  const registryRef = useRef<MeshSurfaceRegistry>({});
  const highlightSet = useMemo(
    () => new Set(highlightedMuscleIds.map((id) => normalizeToDataMuscleId(id))),
    [highlightedMuscleIds]
  );
  const fiberBumpMap = useMemo(() => createMuscleFiberTexture(), []);

  // Re-emit discovered meshes & surface registry after HMR or parent remounts
  useEffect(() => {
    if (!sceneRoot) return;
    if (discoveredRef.current.length > 0) {
      onMeshesDiscovered(discoveredRef.current);
    }
    if (Object.keys(registryRef.current).length > 0) {
      onSurfaceRegistryReady?.(registryRef.current);
    }
  }, [sceneRoot, onMeshesDiscovered, onSurfaceRegistryReady]);

  useEffect(() => {
    return () => {
      fiberBumpMap?.dispose();
    };
  }, [fiberBumpMap]);

  useEffect(() => {
    let cancelled = false;
    let loadedRoot: THREE.Group | null = null;

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);

    onLoadStatus?.({ loading: true, error: null });

    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) {
          draco.dispose();
          return;
        }

        const root = gltf.scene.clone(true);
        const discovered: DiscoveredMeshInfo[] = [];
        const lookup = new Map<string, THREE.Mesh>();
        const seenNames = new Map<string, number>();

        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            let baseName = (mesh.name || 'Mesh').trim();
            const count = seenNames.get(baseName) ?? 0;
            seenNames.set(baseName, count + 1);
            if (count > 0) {
              baseName = `${baseName}_${count + 1}`;
              mesh.name = baseName;
            }

            if (!mesh.geometry.getAttribute('normal')) {
              mesh.geometry.computeVertexNormals();
            }

            const sourceMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const stdMat = new THREE.MeshStandardMaterial({
              color:
                sourceMat && 'color' in sourceMat && (sourceMat as any).color
                  ? (sourceMat as any).color.clone()
                  : DEFAULT_MUSCLE_SUPERFICIAL_COLOR.clone(),
              roughness: 0.44,
              metalness: 0.04,
              side: THREE.DoubleSide,
              normalMap: sourceMat && 'normalMap' in sourceMat ? (sourceMat as any).normalMap : null,
            });
            mesh.material = stdMat;
            mesh.userData.__sonotoxOriginalColor = stdMat.color.clone();

            const posAttr = mesh.geometry.getAttribute('position');
            const vertexCount = posAttr ? posAttr.count : 0;
            const index = mesh.geometry.getIndex();
            const triangleCount = index ? Math.floor(index.count / 3) : Math.floor(vertexCount / 3);

            discovered.push({ name: baseName, vertexCount, triangleCount });
            lookup.set(baseName, mesh);
          }
        });

        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const targetSize = 2.15;
        const scaleFactor = targetSize / maxDim;

        const wrapper = new THREE.Group();
        wrapper.name = 'NormalizedGLBWrapper';
        root.position.sub(center);
        wrapper.add(root);
        wrapper.scale.setScalar(scaleFactor);
        wrapper.updateMatrixWorld(true);

        // Extract world-space 3D surface registry for accurate automatic pin placement & sagittal mirroring
        const registry: MeshSurfaceRegistry = {};
        lookup.forEach((mesh, name) => {
          registry[name] = extractSurfaceSamplesFromMesh(mesh);
        });

        loadedRoot = wrapper;
        meshLookupRef.current = lookup;
        discoveredRef.current = discovered;
        registryRef.current = registry;
        setSceneRoot(wrapper);
        onMeshesDiscovered(discovered);
        onSurfaceRegistryReady?.(registry);
        onLoadStatus?.({ loading: false, error: null });
        draco.dispose();
      },
      undefined,
      (err) => {
        if (cancelled) return;
        console.error('Error loading GLB model:', err);
        onLoadStatus?.({
          loading: false,
          error:
            'No se pudo cargar el archivo 3D (.glb). Verifica que sea un glTF 2.0 válido y accesible.',
        });
        draco.dispose();
      }
    );

    return () => {
      cancelled = true;
      if (loadedRoot) {
        loadedRoot.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => m?.dispose());
          }
        });
      }
    };
  }, [modelUrl, onMeshesDiscovered, onSurfaceRegistryReady, onLoadStatus]);

  useEffect(() => {
    if (!sceneRoot) return;

    meshLookupRef.current.forEach((mesh, meshName) => {
      const mapping = mappings[meshName];
      const role = mapping?.role ?? 'muscle';
      const layer = mapping?.layer ?? 'superficial';
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (role === 'hidden' || mapping?.visible === false) {
        mesh.visible = false;
        return;
      }

      if (role === 'bone') {
        mesh.visible = skullMode !== 'hidden';
        const isSolid = skullMode === 'solid';
        const isTooth = TOOTH_REGEX.test(meshName);
        const isCartilage = CARTILAGE_REGEX.test(meshName);

        mat.bumpMap = null;
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;

        if (isTooth) {
          mat.color.copy(TOOTH_COLOR);
          mat.roughness = 0.24;
          mat.metalness = 0.05;
          mat.transparent = !isSolid;
          mat.opacity = isSolid ? 1 : 0.45;
          mat.depthWrite = isSolid;
        } else if (isCartilage) {
          mat.color.copy(LARYNX_REGEX.test(meshName) ? LARYNX_CARTILAGE_COLOR : CARTILAGE_COLOR);
          mat.roughness = 0.42;
          mat.metalness = 0.02;
          mat.transparent = true;
          mat.opacity = isSolid ? 0.82 : 0.34;
          mat.depthWrite = isSolid;
        } else {
          mat.color.copy(BONE_COLOR);
          mat.roughness = 0.56;
          mat.metalness = 0.02;
          mat.transparent = !isSolid;
          mat.opacity = isSolid ? 1 : 0.3;
          mat.depthWrite = isSolid;
        }
        mat.needsUpdate = true;
        return;
      }

      if (role === 'reference') {
        const isSubmental = SUBMENTAL_REF_REGEX.test(meshName);
        mesh.visible = musclesVisible && (isSubmental ? true : skullMode !== 'hidden');
        mat.bumpMap = isSubmental ? fiberBumpMap : null;
        mat.color.copy(isSubmental ? SUBMENTAL_REF_COLOR : APONEUROSIS_COLOR);
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0;
        mat.roughness = isSubmental ? 0.5 : 0.55;
        mat.transparent = !isSubmental;
        mat.opacity = isSubmental ? 1 : Math.min(0.42, superficialOpacity * 0.5);
        mat.depthWrite = isSubmental;
        mat.needsUpdate = true;
        return;
      }

      // Role === 'muscle'
      if (!musclesVisible || (layerFilter !== 'todos' && layer !== layerFilter)) {
        mesh.visible = false;
        return;
      }

      const normMuscleId = mapping?.muscleId ? normalizeToDataMuscleId(mapping.muscleId) : null;
      const isSelected = selectedMeshName === meshName;
      const isHovered = hoveredMeshName === meshName;
      const isInHighlight = highlightSet.size > 0 && !!normMuscleId && highlightSet.has(normMuscleId);
      const isInActivePlan = !!normMuscleId && !!activeMuscleIds?.has(normMuscleId);

      // Only turn non-selected muscles translucent when explicitly Isolating or peeling Superficial slider
      let opacity = layer === 'superficial' ? superficialOpacity : 1;
      if (isolateSelected && selectedMeshName && !isSelected) {
        opacity = Math.min(opacity, 0.12);
      }

      mesh.visible = opacity > 0.03;
      if (!mesh.visible) return;

      mat.bumpMap = fiberBumpMap;
      mat.bumpScale = 0.0025;
      mat.roughness = 0.42;
      mat.metalness = 0.05;

      if (isSelected) {
        mat.color.copy(SELECTED_COLOR);
        mat.emissive.copy(SELECTED_EMISSIVE);
        mat.emissiveIntensity = 0.52;
      } else if (isHovered) {
        mat.color.copy(HOVERED_COLOR);
        mat.emissive.copy(HOVERED_EMISSIVE);
        mat.emissiveIntensity = 0.36;
      } else if (isInHighlight) {
        mat.color.copy(PRESET_COLOR);
        mat.emissive.copy(PRESET_EMISSIVE);
        mat.emissiveIntensity = 0.34;
      } else if (isInActivePlan) {
        mat.color.copy(ACTIVE_PLAN_COLOR);
        mat.emissive.copy(ACTIVE_PLAN_EMISSIVE);
        mat.emissiveIntensity = 0.24;
      } else {
        if (mapping?.color) {
          mat.color.set(mapping.color);
        } else if (normMuscleId && MUSCLE_PALETTE[normMuscleId]) {
          mat.color.set(MUSCLE_PALETTE[normMuscleId]);
        } else {
          mat.color.copy(
            layer === 'profundo' ? DEFAULT_MUSCLE_DEEP_COLOR : DEFAULT_MUSCLE_SUPERFICIAL_COLOR
          );
        }
        mat.emissive.copy(IDLE_EMISSIVE);
        mat.emissiveIntensity = 0.08;
      }

      mat.transparent = opacity < 0.99;
      mat.opacity = opacity;
      mat.depthWrite = opacity >= 0.99;
      mat.needsUpdate = true;
    });
  }, [
    sceneRoot,
    mappings,
    selectedMeshName,
    hoveredMeshName,
    highlightSet,
    activeMuscleIds,
    musclesVisible,
    superficialOpacity,
    skullMode,
    isolateSelected,
    layerFilter,
    fiberBumpMap,
  ]);

  const isMeshInteractive = (meshName: string): boolean => {
    const mapping = mappings[meshName];
    const role = mapping?.role ?? 'muscle';
    if (role !== 'muscle') return false;
    const layer = mapping?.layer ?? 'superficial';
    if (layer === 'superficial' && superficialOpacity <= 0.12) return false;
    return true;
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const meshName = e.object?.name;
    if (!meshName || !isMeshInteractive(meshName)) return;
    e.stopPropagation();
    const p = e.point;
    const n = e.face?.normal
      ? e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize()
      : p.clone().normalize();
    onMeshClick(meshName, [p.x, p.y, p.z], [n.x, n.y, n.z]);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    const meshName = e.object?.name;
    if (!meshName || !isMeshInteractive(meshName)) return;
    e.stopPropagation();
    if (hoveredMeshName !== meshName) {
      onHoverMesh(meshName);
    }
    document.body.style.cursor = pinPlacementMode ? 'crosshair' : 'pointer';
  };

  const handlePointerOut = () => {
    onHoverMesh(null);
    document.body.style.cursor = 'auto';
  };

  if (!sceneRoot) return null;

  return (
    <primitive
      object={sceneRoot}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    />
  );
};

export default GlbFacialScene;
