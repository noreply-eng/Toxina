import React, { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type {
  DiscoveredMeshInfo,
  MeshLayer,
  MeshMappingEntry,
  MeshSide,
  SkullVisibilityMode,
} from '../../types/facial3d';

interface ProceduralMuscleSpec {
  meshName: string;
  muscleId: string;
  side: MeshSide;
  layer: MeshLayer;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
  shape?: 'ellipsoid' | 'capsule' | 'torus' | 'box';
  baseColor: string;
}

/**
 * Anatomically organized 3D procedural rig of facial expression & masticatory muscles
 * over a reference cranium + mandible.
 * Patient anatomical convention (facing +Z):
 *  - Patient's Left  = +X (right side of screen when viewing anteriorly)
 *  - Patient's Right = -X (left side of screen when viewing anteriorly)
 */
const BILATERAL_MUSCLE_TEMPLATES: Omit<ProceduralMuscleSpec, 'meshName' | 'side'>[] = [
  // Upper third
  {
    muscleId: 'frontalis',
    layer: 'superficial',
    position: [0.27, 0.78, 0.66],
    rotation: [-0.26, 0.22, -0.04],
    scale: [0.26, 0.28, 0.045],
    shape: 'ellipsoid',
    baseColor: '#c85258',
  },
  {
    muscleId: 'corrugator',
    layer: 'profundo',
    position: [0.16, 0.44, 0.72],
    rotation: [0, 0.14, 0.34],
    scale: [0.15, 0.042, 0.036],
    shape: 'capsule',
    baseColor: '#9e3247',
  },
  {
    muscleId: 'depressor-supercilii',
    layer: 'profundo',
    position: [0.09, 0.37, 0.74],
    rotation: [0, 0.08, -0.22],
    scale: [0.042, 0.09, 0.03],
    shape: 'ellipsoid',
    baseColor: '#a6384e',
  },
  {
    muscleId: 'orbicularis-oculi',
    layer: 'superficial',
    position: [0.33, 0.28, 0.71],
    rotation: [0.05, 0.32, 0],
    scale: [0.22, 0.17, 0.08],
    shape: 'torus',
    baseColor: '#d15a60',
  },
  {
    muscleId: 'temporalis',
    layer: 'profundo',
    position: [0.68, 0.46, 0.05],
    rotation: [0.08, 0.12, -0.14],
    scale: [0.09, 0.38, 0.34],
    shape: 'ellipsoid',
    baseColor: '#9b3648',
  },
  // Midface & nose
  {
    muscleId: 'nasalis',
    layer: 'superficial',
    position: [0.1, 0.06, 0.85],
    rotation: [0.1, 0.45, -0.15],
    scale: [0.07, 0.11, 0.035],
    shape: 'ellipsoid',
    baseColor: '#cb565c',
  },
  {
    muscleId: 'levator-labii-superioris-alaeque-nasi',
    layer: 'superficial',
    position: [0.17, 0.04, 0.77],
    rotation: [0.05, 0.25, -0.08],
    scale: [0.042, 0.2, 0.035],
    shape: 'capsule',
    baseColor: '#d25e64',
  },
  {
    muscleId: 'levator-labii-superioris',
    layer: 'superficial',
    position: [0.27, -0.03, 0.74],
    rotation: [0.08, 0.36, -0.12],
    scale: [0.075, 0.16, 0.038],
    shape: 'ellipsoid',
    baseColor: '#c9545a',
  },
  {
    muscleId: 'zygomaticus-minor',
    layer: 'superficial',
    position: [0.38, -0.05, 0.68],
    rotation: [0.08, 0.48, -0.42],
    scale: [0.04, 0.21, 0.032],
    shape: 'capsule',
    baseColor: '#d45e62',
  },
  {
    muscleId: 'zygomaticus-major',
    layer: 'superficial',
    position: [0.45, -0.12, 0.62],
    rotation: [0.05, 0.58, -0.58],
    scale: [0.048, 0.26, 0.036],
    shape: 'capsule',
    baseColor: '#cf5359',
  },
  {
    muscleId: 'levator-anguli-oris',
    layer: 'profundo',
    position: [0.28, -0.14, 0.66],
    rotation: [0.05, 0.36, -0.16],
    scale: [0.055, 0.13, 0.035],
    shape: 'ellipsoid',
    baseColor: '#9c2f44',
  },
  {
    muscleId: 'buccinator',
    layer: 'profundo',
    position: [0.46, -0.26, 0.45],
    rotation: [0, 0.92, 0],
    scale: [0.18, 0.14, 0.045],
    shape: 'ellipsoid',
    baseColor: '#942e42',
  },
  {
    muscleId: 'risorius',
    layer: 'superficial',
    position: [0.43, -0.34, 0.58],
    rotation: [0, 0.68, 1.48],
    scale: [0.032, 0.17, 0.025],
    shape: 'capsule',
    baseColor: '#d9696d',
  },
  // Lower third & masticators
  {
    muscleId: 'depressor-anguli-oris',
    layer: 'superficial',
    position: [0.3, -0.5, 0.66],
    rotation: [0.15, 0.42, 0.22],
    scale: [0.08, 0.15, 0.038],
    shape: 'ellipsoid',
    baseColor: '#c95057',
  },
  {
    muscleId: 'depressor-labii-inferioris',
    layer: 'profundo',
    position: [0.18, -0.52, 0.68],
    rotation: [0.16, 0.22, -0.14],
    scale: [0.08, 0.12, 0.035],
    shape: 'ellipsoid',
    baseColor: '#9c3246',
  },
  {
    muscleId: 'mentalis',
    layer: 'profundo',
    position: [0.075, -0.59, 0.72],
    rotation: [0.22, 0.08, 0.08],
    scale: [0.055, 0.1, 0.04],
    shape: 'ellipsoid',
    baseColor: '#a2354a',
  },
  {
    muscleId: 'masseter',
    layer: 'superficial',
    position: [0.62, -0.26, 0.24],
    rotation: [0.04, 0.22, 0.1],
    scale: [0.1, 0.28, 0.2],
    shape: 'ellipsoid',
    baseColor: '#bd454e',
  },
  {
    muscleId: 'lateral-pterygoid',
    layer: 'profundo',
    position: [0.46, -0.05, 0.08],
    rotation: [0, 0.35, 1.38],
    scale: [0.06, 0.16, 0.08],
    shape: 'capsule',
    baseColor: '#8d2a3d',
  },
  {
    muscleId: 'medial-pterygoid',
    layer: 'profundo',
    position: [0.48, -0.34, 0.12],
    rotation: [0.05, 0.2, -0.25],
    scale: [0.065, 0.2, 0.12],
    shape: 'ellipsoid',
    baseColor: '#88273a',
  },
  {
    muscleId: 'platysma',
    layer: 'superficial',
    position: [0.32, -0.92, 0.42],
    rotation: [0.18, 0.44, -0.18],
    scale: [0.22, 0.34, 0.035],
    shape: 'ellipsoid',
    baseColor: '#c95c64',
  },
  {
    muscleId: 'occipitalis',
    layer: 'superficial',
    position: [0.26, 0.26, -0.78],
    rotation: [0.2, -0.28, 0],
    scale: [0.24, 0.2, 0.045],
    shape: 'ellipsoid',
    baseColor: '#bf4c55',
  },
];

const MIDLINE_MUSCLES: ProceduralMuscleSpec[] = [
  {
    meshName: 'Procerus',
    muscleId: 'procerus',
    side: 'centro',
    layer: 'superficial',
    position: [0, 0.34, 0.81],
    rotation: [0.06, 0, 0],
    scale: [0.055, 0.13, 0.035],
    shape: 'ellipsoid',
    baseColor: '#d05960',
  },
  {
    meshName: 'Orbicularis_oris',
    muscleId: 'orbicularis-oris',
    side: 'centro',
    layer: 'superficial',
    position: [0, -0.33, 0.77],
    rotation: [0.1, 0, 0],
    scale: [0.25, 0.13, 0.09],
    shape: 'torus',
    baseColor: '#d45a63',
  },
];

function buildProceduralSpecs(): ProceduralMuscleSpec[] {
  const list: ProceduralMuscleSpec[] = [...MIDLINE_MUSCLES];
  for (const tpl of BILATERAL_MUSCLE_TEMPLATES) {
    const baseName = tpl.muscleId
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('_');

    // Patient Left (+X)
    list.push({
      ...tpl,
      meshName: `${baseName}_L`,
      side: 'izq',
    });

    // Patient Right (-X)
    const [px, py, pz] = tpl.position;
    const [rx, ry, rz] = tpl.rotation ?? [0, 0, 0];
    list.push({
      ...tpl,
      meshName: `${baseName}_R`,
      side: 'der',
      position: [-px, py, pz],
      rotation: [rx, -ry, -rz],
    });
  }
  return list;
}

export const PROCEDURAL_MUSCLE_SPECS: ProceduralMuscleSpec[] = buildProceduralSpecs();

export const PROCEDURAL_BONE_NAMES = [
  'Skull_Cranium',
  'Skull_Maxilla',
  'Skull_Mandible',
  'Skull_Zygomatic_Arch_L',
  'Skull_Zygomatic_Arch_R',
  'Skull_Nasal_Bridge',
  'Skull_Cervical_Spine',
];

export const PROCEDURAL_ALL_MESH_INFO: DiscoveredMeshInfo[] = [
  ...PROCEDURAL_BONE_NAMES.map((name) => ({ name, vertexCount: 640, triangleCount: 1200 })),
  ...PROCEDURAL_MUSCLE_SPECS.map((m) => ({ name: m.meshName, vertexCount: 384, triangleCount: 720 })),
];

interface ProceduralFacialRigProps {
  mappings: Record<string, MeshMappingEntry>;
  selectedMeshName: string | null;
  hoveredMeshName: string | null;
  highlightedMuscleIds: string[];
  superficialOpacity: number;
  skullMode: SkullVisibilityMode;
  isolateSelected: boolean;
  layerFilter: 'todos' | 'superficial' | 'profundo';
  pinPlacementMode: boolean;
  onSelectMesh: (meshName: string) => void;
  onHoverMesh: (meshName: string | null) => void;
  onPlacePin: (meshName: string, point: [number, number, number], normal: [number, number, number]) => void;
  onMeshesDiscovered: (meshes: DiscoveredMeshInfo[]) => void;
}

const ProceduralFacialRig: React.FC<ProceduralFacialRigProps> = ({
  mappings,
  selectedMeshName,
  hoveredMeshName,
  highlightedMuscleIds,
  superficialOpacity,
  skullMode,
  isolateSelected,
  layerFilter,
  pinPlacementMode,
  onSelectMesh,
  onHoverMesh,
  onPlacePin,
  onMeshesDiscovered,
}) => {
  useEffect(() => {
    onMeshesDiscovered(PROCEDURAL_ALL_MESH_INFO);
  }, [onMeshesDiscovered]);

  const highlightSet = useMemo(() => new Set(highlightedMuscleIds), [highlightedMuscleIds]);

  const skullVisible = skullMode !== 'hidden';
  const skullOpacity = skullMode === 'solid' ? 1 : 0.34;
  const skullTransparent = skullMode !== 'solid';

  const handleMuscleClick = (meshName: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectMesh(meshName);
    if (pinPlacementMode) {
      const p = e.point;
      const n = e.face?.normal
        ? e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize()
        : p.clone().normalize();
      onPlacePin(meshName, [p.x, p.y, p.z], [n.x, n.y, n.z]);
    }
  };

  return (
    <group name="ProceduralFacialAnatomyRoot" position={[0, 0.08, 0]}>
      {/* Non-interactive cranium, maxilla, orbital cavities & mandible reference */}
      {skullVisible && (
        <group name="Skull_Reference_Group">
          {/* Cranial vault */}
          <mesh name="Skull_Cranium" position={[0, 0.42, -0.05]} scale={[0.72, 0.88, 0.82]}>
            <sphereGeometry args={[1, 36, 28]} />
            <meshStandardMaterial
              color="#e6dfd3"
              roughness={0.58}
              metalness={0.04}
              transparent={skullTransparent}
              opacity={skullOpacity}
              depthWrite={!skullTransparent}
            />
          </mesh>

          {/* Maxilla / midface bone block */}
          <mesh name="Skull_Maxilla" position={[0, -0.06, 0.38]} scale={[0.52, 0.42, 0.44]}>
            <sphereGeometry args={[1, 28, 22]} />
            <meshStandardMaterial
              color="#e4dccf"
              roughness={0.6}
              transparent={skullTransparent}
              opacity={skullOpacity}
              depthWrite={!skullTransparent}
            />
          </mesh>

          {/* Orbital cavities (dark landmarks for immediate visual orientation) */}
          {[-0.3, 0.3].map((x, idx) => (
            <mesh key={idx} position={[x, 0.27, 0.62]} scale={[0.16, 0.13, 0.1]}>
              <sphereGeometry args={[1, 20, 16]} />
              <meshStandardMaterial
                color="#2c3342"
                roughness={0.85}
                transparent={skullTransparent}
                opacity={skullTransparent ? 0.52 : 0.92}
              />
            </mesh>
          ))}

          {/* Nasal bridge */}
          <mesh name="Skull_Nasal_Bridge" position={[0, 0.1, 0.78]} rotation={[-0.25, 0, 0]} scale={[0.09, 0.22, 0.12]}>
            <coneGeometry args={[1, 1.5, 14]} />
            <meshStandardMaterial
              color="#dfd6c7"
              roughness={0.62}
              transparent={skullTransparent}
              opacity={skullOpacity}
              depthWrite={!skullTransparent}
            />
          </mesh>

          {/* Zygomatic arches */}
          <mesh name="Skull_Zygomatic_Arch_L" position={[0.54, 0.08, 0.38]} rotation={[0, 0.45, -0.08]} scale={[0.14, 0.09, 0.3]}>
            <sphereGeometry args={[1, 18, 14]} />
            <meshStandardMaterial
              color="#e4dccf"
              roughness={0.58}
              transparent={skullTransparent}
              opacity={skullOpacity}
              depthWrite={!skullTransparent}
            />
          </mesh>
          <mesh name="Skull_Zygomatic_Arch_R" position={[-0.54, 0.08, 0.38]} rotation={[0, -0.45, 0.08]} scale={[0.14, 0.09, 0.3]}>
            <sphereGeometry args={[1, 18, 14]} />
            <meshStandardMaterial
              color="#e4dccf"
              roughness={0.58}
              transparent={skullTransparent}
              opacity={skullOpacity}
              depthWrite={!skullTransparent}
            />
          </mesh>

          {/* Mandible / jaw */}
          <mesh name="Skull_Mandible" position={[0, -0.46, 0.35]} scale={[0.48, 0.32, 0.42]}>
            <sphereGeometry args={[1, 26, 20]} />
            <meshStandardMaterial
              color="#dfd7c8"
              roughness={0.58}
              transparent={skullTransparent}
              opacity={skullOpacity}
              depthWrite={!skullTransparent}
            />
          </mesh>

          {/* Cervical spine column reference */}
          <mesh name="Skull_Cervical_Spine" position={[0, -0.96, -0.08]} scale={[0.24, 0.46, 0.24]}>
            <cylinderGeometry args={[0.92, 1.05, 1.4, 20]} />
            <meshStandardMaterial
              color="#d6cec0"
              roughness={0.65}
              transparent={skullTransparent}
              opacity={skullOpacity * 0.85}
              depthWrite={!skullTransparent}
            />
          </mesh>
        </group>
      )}

      {/* Interactive facial & masticatory muscles */}
      {PROCEDURAL_MUSCLE_SPECS.map((spec) => {
        const mapping = mappings[spec.meshName];
        const role = mapping?.role ?? 'muscle';
        if (role === 'hidden' || mapping?.visible === false) return null;

        const layer = mapping?.layer ?? spec.layer;
        if (layerFilter !== 'todos' && layer !== layerFilter) return null;

        const muscleId = mapping?.muscleId ?? spec.muscleId;
        const isSelected = selectedMeshName === spec.meshName;
        const isHovered = hoveredMeshName === spec.meshName;
        const isInPreset = highlightSet.size > 0 && !!muscleId && highlightSet.has(muscleId);

        let opacity = layer === 'superficial' ? superficialOpacity : 1;
        if (isolateSelected && selectedMeshName && !isSelected) {
          opacity = Math.min(opacity, 0.1);
        } else if (highlightSet.size > 0 && !isInPreset && !isSelected) {
          opacity = Math.min(opacity, 0.22);
        }

        // Completely hidden superficial muscles stop blocking clicks to deep muscles!
        if (opacity <= 0.03) return null;

        const baseColor = mapping?.color || spec.baseColor;
        const color = isSelected
          ? '#0ea5e9'
          : isHovered
          ? '#fb923c'
          : isInPreset
          ? '#f43f5e'
          : baseColor;

        const emissive = isSelected
          ? '#0369a1'
          : isHovered
          ? '#9a3412'
          : isInPreset
          ? '#881337'
          : '#1a0608';
        const emissiveIntensity = isSelected ? 0.55 : isHovered ? 0.35 : isInPreset ? 0.28 : 0.08;

        const isInteractive = role === 'muscle' && opacity > 0.12;
        const isTransparent = opacity < 0.99;

        return (
          <mesh
            key={spec.meshName}
            name={spec.meshName}
            position={spec.position}
            rotation={spec.rotation ?? [0, 0, 0]}
            scale={spec.scale}
            onClick={isInteractive ? (e) => handleMuscleClick(spec.meshName, e) : undefined}
            onPointerOver={
              isInteractive
                ? (e) => {
                    e.stopPropagation();
                    onHoverMesh(spec.meshName);
                    document.body.style.cursor = pinPlacementMode ? 'crosshair' : 'pointer';
                  }
                : undefined
            }
            onPointerOut={
              isInteractive
                ? () => {
                    onHoverMesh(null);
                    document.body.style.cursor = 'auto';
                  }
                : undefined
            }
          >
            {spec.shape === 'torus' ? (
              <torusGeometry args={[0.78, 0.36, 18, 36]} />
            ) : spec.shape === 'capsule' ? (
              <capsuleGeometry args={[0.62, 1.1, 10, 18]} />
            ) : (
              <sphereGeometry args={[1, 24, 18]} />
            )}
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
              roughness={0.44}
              metalness={0.05}
              transparent={isTransparent}
              opacity={opacity}
              depthWrite={!isTransparent}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export default ProceduralFacialRig;
