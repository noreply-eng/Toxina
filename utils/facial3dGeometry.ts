import * as THREE from 'three';
import type { RiskType } from '../constants/facialAestheticMap';
import type {
  CameraViewPreset,
  MeshSide,
  MeshSurfaceInfo,
  MeshSurfaceRegistry,
  SurfaceSample3D,
} from '../types/facial3d';

export interface DangerZone3DSpec {
  id: string;
  risk: RiskType;
  label: string;
  kind: 'tube' | 'ellipsoid';
  /** For 'tube': 3D CatmullRom control points hugging the real anatomy surface */
  curvePoints?: [number, number, number][];
  radius?: number;
  /** For 'ellipsoid': center + radii */
  center?: [number, number, number];
  radii?: [number, number, number];
}

export interface Eyeball3DSpec {
  side: 'izq' | 'der';
  position: [number, number, number];
  radius: number;
}

/**
 * Fallback danger zones calibrated directly to normalized Z-Anatomy coordinates
 * (used only before surfaceRegistry finishes loading).
 */
export const FALLBACK_DANGER_ZONES_3D: DangerZone3DSpec[] = [
  {
    id: 'orbital-rim-upper-l',
    risk: 'ptosisCeja',
    label: 'Reborde orbitario superior izq. (<1.5 cm · riesgo ptosis)',
    kind: 'tube',
    curvePoints: [
      [0.075, 0.485, 0.49],
      [0.195, 0.515, 0.478],
      [0.315, 0.472, 0.39],
    ],
    radius: 0.026,
  },
  {
    id: 'orbital-rim-upper-r',
    risk: 'ptosisCeja',
    label: 'Reborde orbitario superior der. (<1.5 cm · riesgo ptosis)',
    kind: 'tube',
    curvePoints: [
      [-0.075, 0.485, 0.49],
      [-0.195, 0.515, 0.478],
      [-0.315, 0.472, 0.39],
    ],
    radius: 0.026,
  },
  {
    id: 'zygomatic-smile-l',
    risk: 'sonrisa',
    label: 'Trayecto cigomático izq. (riesgo asimetría sonrisa)',
    kind: 'tube',
    curvePoints: [
      [0.325, 0.245, 0.315],
      [0.265, 0.115, 0.395],
      [0.195, -0.015, 0.428],
    ],
    radius: 0.024,
  },
  {
    id: 'zygomatic-smile-r',
    risk: 'sonrisa',
    label: 'Trayecto cigomático der. (riesgo asimetría sonrisa)',
    kind: 'tube',
    curvePoints: [
      [-0.325, 0.245, 0.315],
      [-0.265, 0.115, 0.395],
      [-0.195, -0.015, 0.428],
    ],
    radius: 0.024,
  },
  {
    id: 'anterior-neck-larynx',
    risk: 'disfagia',
    label: 'Región laríngea / cuello anterior profundo (riesgo disfagia)',
    kind: 'ellipsoid',
    center: [0, -0.32, 0.095],
    radii: [0.13, 0.14, 0.1],
  },
];

/**
 * Helper to snap a desired (x, y) point onto the anterior-most surface vertex
 * of a reference mesh, nudged slightly outward along normal so the danger ribbon
 * sits flush on the anatomy without floating or Z-fighting.
 */
function snapRibbonAnchor(
  surface: MeshSurfaceInfo | undefined,
  target: [number, number, number],
  outwardBias: [number, number, number],
  nudge = 0.01
): [number, number, number] {
  if (!surface || surface.samples.length === 0) return target;
  const closest = findClosestSurfacePoint(surface, target, outwardBias);
  return [
    round4(closest.position[0] + closest.normal[0] * nudge),
    round4(closest.position[1] + closest.normal[1] * nudge),
    round4(closest.position[2] + closest.normal[2] * nudge),
  ];
}

/**
 * Dynamically computes 3D anatomical danger zones anchored directly to the real
 * loaded mesh coordinates in `surfaceRegistry`.
 */
export function computeDynamicDangerZones3D(
  registry: MeshSurfaceRegistry
): DangerZone3DSpec[] {
  if (!registry || Object.keys(registry).length === 0) {
    return FALLBACK_DANGER_ZONES_3D;
  }

  const zones: DangerZone3DSpec[] = [];

  // 1. Superior Orbital Rim (Ptosis safety arch) — hugged directly onto Orbicularis_oculi_orbital & Frontalis
  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? 1 : -1;
    const orb = registry[`Orbicularis_oculi_orbital_${side}`];
    const front = registry[`Frontalis_${side}`];

    if (orb) {
      const topY = orb.max[1] - (orb.max[1] - orb.min[1]) * 0.08;
      const midY = orb.max[1] + 0.01;
      const innerX = sign * (Math.abs(orb.min[0]) < Math.abs(orb.max[0]) ? Math.abs(orb.min[0]) : Math.abs(orb.max[0])) + sign * 0.025;
      const outerX = sign * Math.max(Math.abs(orb.min[0]), Math.abs(orb.max[0])) - sign * 0.015;
      const midX = (innerX + outerX) * 0.5;
      const frontZ = orb.max[2];

      const p1 = snapRibbonAnchor(front || orb, [innerX, topY, frontZ], [0, 0, 1], 0.012);
      const p2 = snapRibbonAnchor(front || orb, [midX, midY, frontZ], [sign * 0.15, 0.05, 0.98], 0.012);
      const p3 = snapRibbonAnchor(orb, [outerX, topY - 0.035, orb.center[2] + 0.04], [sign * 0.65, 0, 0.75], 0.012);

      zones.push({
        id: `orbital-rim-upper-${side.toLowerCase()}`,
        risk: 'ptosisCeja',
        label: `Reborde orbitario superior ${side === 'L' ? 'izq.' : 'der.'} (<1.5 cm · riesgo ptosis)`,
        kind: 'tube',
        curvePoints: [p1, p2, p3],
        radius: 0.022,
      });
    }
  }

  // 2. Zygomatic / Smile-Asymmetry Corridor — hugged directly along Zygomaticus_major surface
  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? 1 : -1;
    const zyg = registry[`Zygomaticus_major_${side}`];
    if (zyg) {
      const outerX = sign * Math.max(Math.abs(zyg.min[0]), Math.abs(zyg.max[0]));
      const innerX = sign * Math.min(Math.abs(zyg.min[0]), Math.abs(zyg.max[0]));
      const pTop = snapRibbonAnchor(
        zyg,
        [outerX, zyg.max[1] - 0.02, zyg.min[2] + 0.04],
        [sign * 0.7, 0, 0.7],
        0.01
      );
      const pMid = snapRibbonAnchor(
        zyg,
        [zyg.center[0], zyg.center[1], zyg.max[2]],
        [sign * 0.55, 0, 0.82],
        0.01
      );
      const pBot = snapRibbonAnchor(
        zyg,
        [innerX, zyg.min[1] + 0.02, zyg.max[2]],
        [sign * 0.35, 0, 0.92],
        0.01
      );

      zones.push({
        id: `zygomatic-smile-${side.toLowerCase()}`,
        risk: 'sonrisa',
        label: `Trayecto cigomático ${side === 'L' ? 'izq.' : 'der.'} (riesgo asimetría sonrisa)`,
        kind: 'tube',
        curvePoints: [pTop, pMid, pBot],
        radius: 0.02,
      });
    }
  }

  // 3. Anterior Neck / Larynx (Dysphagia danger zone) — anchored right on Thyroid cartilage + Hyoid
  const thyroid = registry['Skull_Thyroid_cartilage'];
  const hyoid = registry['Skull_Hyoid_bone'];
  if (thyroid) {
    const topY = hyoid ? hyoid.max[1] : thyroid.max[1] + 0.04;
    const botY = thyroid.min[1] - 0.03;
    const cy = (topY + botY) * 0.5;
    const cz = (thyroid.min[2] + thyroid.max[2]) * 0.5 + 0.02;
    zones.push({
      id: 'anterior-neck-larynx',
      risk: 'disfagia',
      label: 'Región laríngea / cuello anterior profundo (riesgo disfagia)',
      kind: 'ellipsoid',
      center: [0, round4(cy), round4(cz)],
      radii: [
        round4(Math.max(0.11, (thyroid.max[0] - thyroid.min[0]) * 0.56)),
        round4(Math.max(0.12, (topY - botY) * 0.52)),
        round4(Math.max(0.085, (thyroid.max[2] - thyroid.min[2]) * 0.58)),
      ],
    });
  } else {
    zones.push(FALLBACK_DANGER_ZONES_3D[FALLBACK_DANGER_ZONES_3D.length - 1]);
  }

  return zones.length > 0 ? zones : FALLBACK_DANGER_ZONES_3D;
}

/**
 * Computes anatomically positioned eyeball spheres tucked directly inside the
 * real palpebral/orbital sockets of the loaded Z-Anatomy GLB.
 */
export function computeEyeballSpecs(registry: MeshSurfaceRegistry): Eyeball3DSpec[] {
  const specs: Eyeball3DSpec[] = [];
  for (const side of ['L', 'R'] as const) {
    const palp = registry[`Orbicularis_oculi_palpebral_${side}`];
    const orb = registry[`Orbicularis_oculi_orbital_${side}`];
    const ref = palp || orb;
    if (!ref) continue;

    const width = ref.max[0] - ref.min[0];
    const height = ref.max[1] - ref.min[1];
    const radius = Math.min(0.086, Math.max(0.058, Math.min(width, height) * 0.44));
    const cx = ref.center[0];
    const cy = ref.center[1] - height * 0.02;
    // Tuck eyeball slightly posterior to the palpebral eyelid surface
    const cz = ref.max[2] - radius * 1.05;

    specs.push({
      side: side === 'L' ? 'izq' : 'der',
      position: [round4(cx), round4(cy), round4(cz)],
      radius: round4(radius),
    });
  }
  return specs;
}

function pointToSegmentDistSq(
  p: [number, number, number],
  a: [number, number, number],
  b: [number, number, number]
): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const apz = p[2] - a[2];
  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t = abLenSq > 1e-8 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq)) : 0;
  const cx = a[0] + abx * t;
  const cy = a[1] + aby * t;
  const cz = a[2] + abz * t;
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  const dz = p[2] - cz;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Evaluates whether a 3D injection point lies inside any dynamic anatomical danger zone.
 */
export function detectRisk3D(
  position: [number, number, number],
  muscleId?: string | null,
  zones: DangerZone3DSpec[] = FALLBACK_DANGER_ZONES_3D
): RiskType | null {
  if (position[2] < -0.15) return null;

  for (const zone of zones) {
    if (zone.kind === 'tube' && zone.curvePoints && zone.curvePoints.length >= 2) {
      const thresh = (zone.radius ?? 0.022) + 0.028;
      const threshSq = thresh * thresh;
      let hit = false;
      for (let i = 0; i < zone.curvePoints.length - 1; i++) {
        if (pointToSegmentDistSq(position, zone.curvePoints[i], zone.curvePoints[i + 1]) <= threshSq) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;

      if (zone.risk === 'ptosisCeja') {
        if (
          !muscleId ||
          muscleId === 'frontalis' ||
          muscleId === 'corrugator' ||
          muscleId === 'orbicularis-oculi' ||
          muscleId === 'procerus'
        ) {
          return 'ptosisCeja';
        }
      } else if (zone.risk === 'sonrisa') {
        if (
          !muscleId ||
          muscleId === 'zygomaticus-major' ||
          muscleId === 'zygomaticus-minor' ||
          muscleId === 'masseter' ||
          muscleId === 'risorius' ||
          muscleId === 'levator-labii-superioris'
        ) {
          return 'sonrisa';
        }
      }
    } else if (zone.kind === 'ellipsoid' && zone.center && zone.radii) {
      const dx = (position[0] - zone.center[0]) / (zone.radii[0] + 0.02);
      const dy = (position[1] - zone.center[1]) / (zone.radii[1] + 0.02);
      const dz = (position[2] - zone.center[2]) / (zone.radii[2] + 0.03);
      if (dx * dx + dy * dy + dz * dz <= 1) {
        return zone.risk;
      }
    }
  }

  return null;
}

/**
 * Extracts evenly distributed world-space surface samples + outward normals from a Three.js Mesh.
 */
export function extractSurfaceSamplesFromMesh(
  mesh: THREE.Mesh,
  maxSamples = 160
): MeshSurfaceInfo {
  mesh.updateWorldMatrix(true, false);
  const geom = mesh.geometry;
  const posAttr = geom.getAttribute('position');
  const normAttr = geom.getAttribute('normal');

  const box = new THREE.Box3().setFromObject(mesh);
  const centerVec = new THREE.Vector3();
  box.getCenter(centerVec);

  const samples: SurfaceSample3D[] = [];
  if (posAttr && posAttr.count > 0) {
    const stride = Math.max(1, Math.floor(posAttr.count / maxSamples));
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

    for (let i = 0; i < posAttr.count; i += stride) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      if (normAttr) {
        n.fromBufferAttribute(normAttr, i).applyMatrix3(normalMatrix).normalize();
      } else {
        n.copy(v).sub(centerVec).normalize();
      }
      const radial = new THREE.Vector3(v.x, 0, v.z);
      if (radial.lengthSq() > 0.0001 && n.dot(radial) < -0.25) {
        n.negate();
      }
      samples.push({
        position: [round4(v.x), round4(v.y), round4(v.z)],
        normal: [round4(n.x), round4(n.y), round4(n.z)],
      });
    }
  }

  if (samples.length === 0) {
    const fallbackNormal = new THREE.Vector3(centerVec.x, 0, centerVec.z).normalize();
    if (fallbackNormal.lengthSq() < 0.01) fallbackNormal.set(0, 0, 1);
    samples.push({
      position: [round4(centerVec.x), round4(centerVec.y), round4(centerVec.z)],
      normal: [round4(fallbackNormal.x), round4(fallbackNormal.y), round4(fallbackNormal.z)],
    });
  }

  return {
    meshName: mesh.name,
    center: [round4(centerVec.x), round4(centerVec.y), round4(centerVec.z)],
    min: [round4(box.min.x), round4(box.min.y), round4(box.min.z)],
    max: [round4(box.max.x), round4(box.max.y), round4(box.max.z)],
    samples,
  };
}

export function findClosestSurfacePoint(
  surface: MeshSurfaceInfo,
  target: [number, number, number],
  preferOutward?: [number, number, number]
): SurfaceSample3D {
  let best = surface.samples[0];
  let bestScore = Infinity;

  for (const s of surface.samples) {
    const dx = s.position[0] - target[0];
    const dy = s.position[1] - target[1];
    const dz = s.position[2] - target[2];
    let score = dx * dx + dy * dy + dz * dz;

    if (preferOutward) {
      const dot =
        s.normal[0] * preferOutward[0] +
        s.normal[1] * preferOutward[1] +
        s.normal[2] * preferOutward[2];
      score -= dot * 0.0025;
    }

    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return best;
}

function getOutwardDirectionForMuscle(
  muscleId: string | null,
  side: MeshSide
): [number, number, number] {
  if (
    muscleId === 'occipitalis' ||
    muscleId === 'splenius-capitis' ||
    muscleId === 'cervical-paraspinals' ||
    muscleId === 'trapezius' ||
    muscleId === 'levator-scapulae'
  ) {
    return [side === 'izq' ? 0.25 : side === 'der' ? -0.25 : 0, 0.15, -0.95];
  }
  if (
    muscleId === 'masseter' ||
    muscleId === 'temporalis' ||
    muscleId === 'sternocleidomastoid' ||
    muscleId === 'buccinator'
  ) {
    return [side === 'izq' ? 0.9 : side === 'der' ? -0.9 : 0, 0.05, 0.35];
  }
  return [side === 'izq' ? 0.25 : side === 'der' ? -0.25 : 0, 0.05, 0.95];
}

export function computePointsOnMeshSurface(
  surface: MeshSurfaceInfo,
  count: number,
  side: MeshSide,
  muscleId: string | null
): SurfaceSample3D[] {
  const safeCount = Math.max(1, count);
  const outward = getOutwardDirectionForMuscle(muscleId, side);

  const outerSamples = surface.samples.filter((s) => {
    const dot = s.normal[0] * outward[0] + s.normal[1] * outward[1] + s.normal[2] * outward[2];
    return dot > 0.15;
  });
  const pool = outerSamples.length >= safeCount ? outerSamples : surface.samples;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const s of pool) {
    cx += s.position[0];
    cy += s.position[1];
    cz += s.position[2];
  }
  cx /= pool.length;
  cy /= pool.length;
  cz /= pool.length;

  const sizeX = surface.max[0] - surface.min[0];
  const sizeY = surface.max[1] - surface.min[1];
  const sizeZ = surface.max[2] - surface.min[2];

  if (safeCount === 1) {
    return [findClosestSurfacePoint(surface, [cx, cy, cz], outward)];
  }

  const chosen: SurfaceSample3D[] = [];
  const tempSurface: MeshSurfaceInfo = { ...surface, samples: pool };

  if (muscleId === 'orbicularis-oculi') {
    const lateralX = side === 'izq' ? surface.max[0] - sizeX * 0.12 : surface.min[0] + sizeX * 0.12;
    for (let i = 0; i < safeCount; i++) {
      const t = safeCount === 1 ? 0.5 : i / (safeCount - 1);
      const ty = surface.min[1] + sizeY * (0.22 + t * 0.56);
      chosen.push(findClosestSurfacePoint(tempSurface, [lateralX, ty, surface.max[2]], outward));
    }
    return chosen;
  }

  if (muscleId === 'frontalis') {
    for (let i = 0; i < safeCount; i++) {
      const col = i % Math.ceil(safeCount / 2);
      const row = Math.floor(i / Math.ceil(safeCount / 2));
      const cols = Math.max(1, Math.ceil(safeCount / 2));
      const tx = surface.min[0] + sizeX * (0.24 + (cols === 1 ? 0.26 : (col / (cols - 1)) * 0.52));
      // Stay safely above the supraorbital rim (0.46 to 0.78 of Frontalis height)
      const ty = surface.min[1] + sizeY * (row === 0 ? 0.46 : 0.76);
      chosen.push(findClosestSurfacePoint(tempSurface, [tx, ty, surface.max[2]], outward));
    }
    return chosen;
  }

  for (let i = 0; i < safeCount; i++) {
    const t = (i + 0.5) / safeCount;
    let tx = cx;
    let ty = cy;
    let tz = cz;

    if (sizeY >= sizeX && sizeY >= sizeZ) {
      ty = surface.min[1] + sizeY * (0.2 + t * 0.6);
      tx = cx + (i % 2 === 0 ? -1 : 1) * sizeX * 0.12;
    } else if (sizeX >= sizeY && sizeX >= sizeZ) {
      tx = surface.min[0] + sizeX * (0.2 + t * 0.6);
      ty = cy + (i % 2 === 0 ? -1 : 1) * sizeY * 0.08;
    } else {
      tz = surface.min[2] + sizeZ * (0.2 + t * 0.6);
      ty = cy + (i % 2 === 0 ? -1 : 1) * sizeY * 0.12;
    }

    chosen.push(findClosestSurfacePoint(tempSurface, [tx, ty, tz], outward));
  }

  return chosen;
}

export function computeNextFreePointOnMesh(
  surface: MeshSurfaceInfo,
  existingPositions: [number, number, number][],
  side: MeshSide,
  muscleId: string | null
): SurfaceSample3D {
  const outward = getOutwardDirectionForMuscle(muscleId, side);
  const outer = surface.samples.filter((s) => {
    const dot = s.normal[0] * outward[0] + s.normal[1] * outward[1] + s.normal[2] * outward[2];
    return dot > 0.1;
  });
  const pool = outer.length > 0 ? outer : surface.samples;

  if (existingPositions.length === 0) {
    return computePointsOnMeshSurface(surface, 1, side, muscleId)[0];
  }

  let best = pool[0];
  let bestDist = -1;
  for (const s of pool) {
    let minD = Infinity;
    for (const ep of existingPositions) {
      const d = Math.hypot(
        s.position[0] - ep[0],
        s.position[1] - ep[1],
        s.position[2] - ep[2]
      );
      if (d < minD) minD = d;
    }
    const distFromCenter = Math.hypot(
      s.position[0] - surface.center[0],
      s.position[1] - surface.center[1],
      s.position[2] - surface.center[2]
    );
    const score = minD - distFromCenter * 0.25;
    if (score > bestDist) {
      bestDist = score;
      best = s;
    }
  }
  return best;
}

export function suggestedCameraForMuscle(muscleId: string | null, side?: MeshSide): CameraViewPreset {
  if (!muscleId) return 'front';
  if (
    muscleId === 'occipitalis' ||
    muscleId === 'splenius-capitis' ||
    muscleId === 'cervical-paraspinals' ||
    muscleId === 'trapezius' ||
    muscleId === 'levator-scapulae'
  ) {
    return 'back';
  }
  if (
    muscleId === 'masseter' ||
    muscleId === 'temporalis' ||
    muscleId === 'lateral-pterygoid' ||
    muscleId === 'medial-pterygoid' ||
    muscleId === 'buccinator' ||
    muscleId === 'sternocleidomastoid'
  ) {
    if (side === 'der') return 'right';
    if (side === 'izq') return 'left';
    return 'threeQuarter';
  }
  return 'front';
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
