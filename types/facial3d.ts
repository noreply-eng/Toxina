import type { RiskType } from '../constants/facialAestheticMap';

export type MeshRole = 'muscle' | 'bone' | 'reference' | 'hidden';
export type MeshSide = 'izq' | 'der' | 'centro';
export type MeshLayer = 'superficial' | 'profundo';
export type SkullVisibilityMode = 'translucent' | 'solid' | 'hidden';
export type CameraViewPreset = 'front' | 'threeQuarter' | 'right' | 'left' | 'top' | 'back';
export type PointSizeMode3D = 'sm' | 'md' | 'lg';

export interface MeshMappingEntry {
  meshName: string;
  muscleId: string | null;
  displayName?: string;
  role: MeshRole;
  side: MeshSide;
  layer: MeshLayer;
  color?: string;
  visible?: boolean;
}

export interface InjectionPin3D {
  id: string;
  meshName: string;
  muscleId: string | null;
  muscleKey?: string;
  label: string;
  position: [number, number, number];
  normal: [number, number, number];
  doseOna: number;
  depth: MeshLayer;
  side: MeshSide;
  risk?: RiskType | null;
  mirrored?: boolean;
  notes?: string;
}

export interface Facial3DModelRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  model_url: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  draco_compressed: boolean;
  is_active: boolean;
  license_name: string;
  attribution_text: string;
  attribution_url: string | null;
  mesh_mappings: Record<string, MeshMappingEntry>;
  injection_pins: InjectionPin3D[];
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DiscoveredMeshInfo {
  name: string;
  vertexCount: number;
  triangleCount: number;
}

export interface SurfaceSample3D {
  position: [number, number, number];
  normal: [number, number, number];
}

export interface MeshSurfaceInfo {
  meshName: string;
  center: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  samples: SurfaceSample3D[];
}

export type MeshSurfaceRegistry = Record<string, MeshSurfaceInfo>;
