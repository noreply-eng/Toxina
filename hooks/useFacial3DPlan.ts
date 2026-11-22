import { useCallback, useMemo, useState } from 'react';
import type { MuscleSelection } from './useCalculatorState';
import type { FacialPlanExport, InjectionPoint, MuscleSummary } from './useFacialPlan';
import {
  convertOnaToBrand,
  FACIAL_MUSCLE_BY_ID,
  FACIAL_MUSCLES,
  getVolumeMl,
  mirrorSide,
  RISK_MESSAGES,
  UNITS_PER_VIAL,
  type AnatomyLayerFilter,
  type PointDepth,
  type PointSide,
  type RiskType,
  type SideMode,
  type ToxinBrand,
} from '../constants/facialAestheticMap';
import { getFacialConfigByMuscleId, getMuscleDataById } from '../utils/facial3dAutoMapper';
import {
  computeDynamicDangerZones3D,
  computeNextFreePointOnMesh,
  computePointsOnMeshSurface,
  detectRisk3D,
  findClosestSurfacePoint,
} from '../utils/facial3dGeometry';
import type {
  InjectionPin3D,
  MeshLayer,
  MeshMappingEntry,
  MeshSide,
  MeshSurfaceRegistry,
  PointSizeMode3D,
} from '../types/facial3d';

/** Maps planner IDs (e.g. 'llsan') to clinical muscleData IDs and vice-versa */
export function normalizeToDataMuscleId(id: string): string {
  if (id === 'llsan') return 'levator-labii-superioris-alaeque-nasi';
  if (id === 'sternocleidomastoid-posterior') return 'sternocleidomastoid';
  if (id === 'trapezius-facial') return 'trapezius';
  return id;
}

export function normalizeToPlannerMuscleId(id: string): string {
  if (id === 'levator-labii-superioris-alaeque-nasi') return 'llsan';
  if (id === 'sternocleidomastoid') return 'sternocleidomastoid-posterior';
  if (id === 'trapezius') return 'trapezius-facial';
  return id;
}

let pinCounter = 0;
function nextPinId(prefix: string): string {
  pinCounter += 1;
  return `pin3d-${prefix}-${Date.now()}-${pinCounter}`;
}

export interface UseFacial3DPlanOptions {
  initialBrand?: ToxinBrand;
  initialDilution?: string;
  mirrorModeDefault?: boolean;
  pathologyId?: string;
  mappings: Record<string, MeshMappingEntry>;
  surfaceRegistry: MeshSurfaceRegistry;
}

export function useFacial3DPlan({
  initialBrand = 'Botox',
  initialDilution = '2.5',
  mirrorModeDefault = true,
  pathologyId = 'estetica-facial',
  mappings,
  surfaceRegistry,
}: UseFacial3DPlanOptions) {
  const [brand, setBrand] = useState<ToxinBrand>(initialBrand);
  const [dilution, setDilution] = useState<string>(initialDilution);
  const [activePathologyId, setActivePathologyId] = useState<string>(pathologyId);
  const [sideMode, setSideMode] = useState<SideMode>(mirrorModeDefault ? 'ambos' : 'izq');
  const [mirrorSync, setMirrorSync] = useState<boolean>(mirrorModeDefault);
  const [points, setPoints] = useState<InjectionPin3D[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [movingPointId, setMovingPointId] = useState<string | null>(null);
  const [showDangerZones, setShowDangerZones] = useState<boolean>(true);
  const [anatomyLayerFilter, setAnatomyLayerFilter] = useState<AnatomyLayerFilter>('todos');
  const [pointSize, setPointSize] = useState<PointSizeMode3D>('md');
  const [addPointMode, setAddPointMode] = useState<boolean>(false);
  const [layerVisibility, setLayerVisibility] = useState({
    skull: true,
    muscles: true,
    points: true,
    labels: true,
  });

  const dynamicDangerZones = useMemo(
    () => computeDynamicDangerZones3D(surfaceRegistry),
    [surfaceRegistry]
  );

  /** Finds the best matching 3D mesh name for a given muscleId and anatomical side */
  const findMeshesForMuscle = useCallback(
    (rawMuscleId: string, desiredSide?: SideMode): { meshName: string; entry: MeshMappingEntry }[] => {
      const dataId = normalizeToDataMuscleId(rawMuscleId);
      const matches: { meshName: string; entry: MeshMappingEntry }[] = [];

      Object.values(mappings).forEach((entry) => {
        if (entry.role !== 'muscle' || !entry.muscleId) return;
        if (normalizeToDataMuscleId(entry.muscleId) !== dataId) return;
        if (!surfaceRegistry[entry.meshName]) return;
        if (desiredSide && desiredSide !== 'ambos' && entry.side !== 'centro' && entry.side !== desiredSide) {
          return;
        }
        matches.push({ meshName: entry.meshName, entry });
      });

      // Prefer primary belly when a muscle is split into 2 parts (e.g. Masseter_superficial, Orbicularis_oculi_orbital)
      const bySide = new Map<MeshSide, { meshName: string; entry: MeshMappingEntry }>();
      for (const m of matches) {
        const existing = bySide.get(m.entry.side);
        if (!existing) {
          bySide.set(m.entry.side, m);
        } else {
          // Prefer superficial or orbital over deep/palpebral as default injection target
          const preferNew =
            /superficial|orbital|superior/i.test(m.meshName) &&
            !/superficial|orbital|superior/i.test(existing.meshName);
          if (preferNew) {
            bySide.set(m.entry.side, m);
          }
        }
      }
      return Array.from(bySide.values());
    },
    [mappings, surfaceRegistry]
  );

  /** Finds the contralateral mesh for 3D sagittal mirroring */
  const findContralateralMesh = useCallback(
    (sourceMeshName: string): { meshName: string; entry: MeshMappingEntry } | null => {
      const srcEntry = mappings[sourceMeshName];
      if (!srcEntry || srcEntry.side === 'centro') return null;
      const targetSide = mirrorSide(srcEntry.side);

      // 1. Exact suffix swap (_L <-> _R)
      const swappedName = sourceMeshName.endsWith('_L')
        ? `${sourceMeshName.slice(0, -2)}_R`
        : sourceMeshName.endsWith('_R')
        ? `${sourceMeshName.slice(0, -2)}_L`
        : null;
      if (swappedName && mappings[swappedName] && surfaceRegistry[swappedName]) {
        return { meshName: swappedName, entry: mappings[swappedName] };
      }

      // 2. Fallback: same muscleId & opposite side
      if (srcEntry.muscleId) {
        const targetMode: SideMode = targetSide === 'centro' ? 'ambos' : targetSide;
        const candidates = findMeshesForMuscle(srcEntry.muscleId, targetMode);
        if (candidates.length > 0) return candidates[0];
      }
      return null;
    },
    [mappings, surfaceRegistry, findMeshesForMuscle]
  );

  /** Finds closest mirrored contralateral point in 3D space */
  const findContralateralPointIndex = useCallback(
    (list: InjectionPin3D[], src: InjectionPin3D): number => {
      if (src.side === 'centro') return -1;
      const targetSide = mirrorSide(src.side);
      const targetPos: [number, number, number] = [-src.position[0], src.position[1], src.position[2]];
      const srcDataId = src.muscleId ? normalizeToDataMuscleId(src.muscleId) : null;

      let bestIdx = -1;
      let bestDist = Infinity;

      list.forEach((p, idx) => {
        if (p.id === src.id || p.side !== targetSide) return;
        const pDataId = p.muscleId ? normalizeToDataMuscleId(p.muscleId) : null;
        if (srcDataId && pDataId !== srcDataId) return;
        const d = Math.hypot(
          p.position[0] - targetPos[0],
          p.position[1] - targetPos[1],
          p.position[2] - targetPos[2]
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });

      return bestIdx;
    },
    []
  );

  /** Build default anatomical 3D pins for a muscle on a chosen sideMode */
  const buildDefaultPinsForMuscle = useCallback(
    (rawMuscleId: string, mode: SideMode): InjectionPin3D[] => {
      const dataId = normalizeToDataMuscleId(rawMuscleId);
      const plannerCfg = getFacialConfigByMuscleId(dataId);
      const muscleData = getMuscleDataById(dataId);
      const meshes = findMeshesForMuscle(dataId, mode);
      if (meshes.length === 0) return [];

      const created: InjectionPin3D[] = [];
      for (const { meshName, entry } of meshes) {
        const surface = surfaceRegistry[meshName];
        if (!surface) continue;

        // Count how many points belong on this side according to clinical templates
        const matchingTemplates = plannerCfg
          ? plannerCfg.defaultPoints.filter((t) =>
              entry.side === 'centro' ? true : t.side === entry.side || t.side === 'centro'
            )
          : [];

        const perSideCount =
          matchingTemplates.length > 0
            ? entry.side === 'centro'
              ? matchingTemplates.length
              : Math.max(1, Math.min(4, matchingTemplates.length))
            : 2;

        const baseDose = matchingTemplates[0]?.doseOna ?? 2;
        const baseDepth: MeshLayer = matchingTemplates[0]?.depth ?? entry.layer ?? 'superficial';

        const samples = computePointsOnMeshSurface(surface, perSideCount, entry.side, dataId);
        samples.forEach((sample, idx) => {
          const tpl = matchingTemplates[idx];
          const doseOna = tpl?.doseOna ?? baseDose;
          const depth: MeshLayer = tpl?.depth ?? baseDepth;
          created.push({
            id: nextPinId(dataId),
            meshName,
            muscleId: dataId,
            muscleKey: plannerCfg?.muscleKey ?? muscleData?.latinName ?? entry.displayName ?? meshName,
            label: muscleData?.name ?? plannerCfg?.name ?? entry.displayName ?? meshName,
            position: sample.position,
            normal: sample.normal,
            doseOna,
            depth,
            side: entry.side,
            risk: detectRisk3D(sample.position, dataId, dynamicDangerZones),
          });
        });
      }

      return created;
    },
    [findMeshesForMuscle, surfaceRegistry, dynamicDangerZones]
  );

  /** Toggle all default anatomical 3D points for a muscle (respecting Izq/Ambos/Der) */
  const toggleMuscle = useCallback(
    (rawMuscleId: string, overrideSide?: SideMode) => {
      const dataId = normalizeToDataMuscleId(rawMuscleId);
      const mode = overrideSide ?? sideMode;

      setPoints((prev) => {
        const hasTarget = prev.some((p) => {
          if (!p.muscleId || normalizeToDataMuscleId(p.muscleId) !== dataId) return false;
          if (mode === 'ambos') return true;
          return p.side === mode || p.side === 'centro';
        });

        if (hasTarget) {
          return prev.filter((p) => {
            if (!p.muscleId || normalizeToDataMuscleId(p.muscleId) !== dataId) return true;
            if (mode === 'ambos') return false;
            return p.side !== mode;
          });
        }

        const toAdd = buildDefaultPinsForMuscle(dataId, mode);
        if (toAdd.length === 0) return prev;

        // Avoid duplicating an already-present side when toggling 'ambos'
        const existingSides = new Set(
          prev
            .filter((p) => p.muscleId && normalizeToDataMuscleId(p.muscleId) === dataId)
            .map((p) => p.side)
        );
        const filteredAdd = toAdd.filter((p) => !existingSides.has(p.side));
        return [...prev, ...filteredAdd];
      });
    },
    [sideMode, buildDefaultPinsForMuscle]
  );

  /** Add a custom 3D point directly on a clicked mesh surface (+ sagittal mirror if Espejo ON) */
  const addCustomPoint3D = useCallback(
    (
      meshName: string,
      position: [number, number, number],
      normal: [number, number, number]
    ) => {
      const entry = mappings[meshName];
      const dataId = entry?.muscleId ? normalizeToDataMuscleId(entry.muscleId) : null;
      const plannerCfg = getFacialConfigByMuscleId(dataId);
      const muscleData = getMuscleDataById(dataId);

      const side: MeshSide = entry?.side ?? (position[0] > 0.005 ? 'izq' : position[0] < -0.005 ? 'der' : 'centro');
      const baseDose = plannerCfg?.defaultPoints[0]?.doseOna ?? 2;
      const baseDepth: MeshLayer = plannerCfg?.defaultPoints[0]?.depth ?? entry?.layer ?? 'superficial';

      const primary: InjectionPin3D = {
        id: nextPinId(dataId || meshName),
        meshName,
        muscleId: dataId,
        muscleKey: plannerCfg?.muscleKey ?? muscleData?.latinName ?? entry?.displayName ?? meshName,
        label: muscleData?.name ?? plannerCfg?.name ?? entry?.displayName ?? meshName,
        position: position.map((v) => Math.round(v * 10000) / 10000) as [number, number, number],
        normal: normal.map((v) => Math.round(v * 10000) / 10000) as [number, number, number],
        doseOna: baseDose,
        depth: baseDepth,
        side,
        risk: detectRisk3D(position, dataId, dynamicDangerZones),
      };

      const added: InjectionPin3D[] = [primary];

      if (mirrorSync && sideMode === 'ambos' && side !== 'centro') {
        const contra = findContralateralMesh(meshName);
        if (contra && surfaceRegistry[contra.meshName]) {
          const mirroredTarget: [number, number, number] = [-position[0], position[1], position[2]];
          const mirroredNormalHint: [number, number, number] = [-normal[0], normal[1], normal[2]];
          const snapped = findClosestSurfacePoint(
            surfaceRegistry[contra.meshName],
            mirroredTarget,
            mirroredNormalHint
          );
          added.push({
            ...primary,
            id: nextPinId(`${dataId || meshName}-m`),
            meshName: contra.meshName,
            side: mirrorSide(side),
            position: snapped.position,
            normal: snapped.normal,
            risk: detectRisk3D(snapped.position, dataId, dynamicDangerZones),
            mirrored: true,
          });
        }
      }

      setPoints((prev) => [...prev, ...added]);
      setSelectedPointId(primary.id);
    },
    [mappings, mirrorSync, sideMode, findContralateralMesh, surfaceRegistry, dynamicDangerZones]
  );

  /** Adds a smart non-overlapping extra point on a muscle from the side panel "+ Punto" button */
  const addExtraPointForMuscle = useCallback(
    (rawMuscleId: string) => {
      const dataId = normalizeToDataMuscleId(rawMuscleId);
      const meshes = findMeshesForMuscle(dataId, sideMode);
      if (meshes.length === 0) return;

      const targetMesh = meshes[0];
      const surface = surfaceRegistry[targetMesh.meshName];
      if (!surface) return;

      const existingPos = points
        .filter((p) => p.meshName === targetMesh.meshName)
        .map((p) => p.position);

      const sample = computeNextFreePointOnMesh(
        surface,
        existingPos,
        targetMesh.entry.side,
        dataId
      );
      addCustomPoint3D(targetMesh.meshName, sample.position, sample.normal);
    },
    [findMeshesForMuscle, sideMode, surfaceRegistry, points, addCustomPoint3D]
  );

  /** Relocate a selected 3D point onto a new clicked surface coordinate (with optional mirror) */
  const movePoint3D = useCallback(
    (
      pointId: string,
      meshName: string,
      position: [number, number, number],
      normal: [number, number, number]
    ) => {
      setPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === pointId);
        if (idx < 0) return prev;
        const src = prev[idx];
        const pairIdx = mirrorSync ? findContralateralPointIndex(prev, src) : -1;

        const next = [...prev];
        const entry = mappings[meshName];
        const dataId = entry?.muscleId ? normalizeToDataMuscleId(entry.muscleId) : src.muscleId;
        const newSide: MeshSide = entry?.side ?? src.side;

        next[idx] = {
          ...src,
          meshName,
          muscleId: dataId,
          side: newSide,
          position: position.map((v) => Math.round(v * 10000) / 10000) as [number, number, number],
          normal: normal.map((v) => Math.round(v * 10000) / 10000) as [number, number, number],
          risk: detectRisk3D(position, dataId, dynamicDangerZones),
          mirrored: false,
        };

        if (pairIdx >= 0) {
          const contra = findContralateralMesh(meshName);
          const contraSurface = contra ? surfaceRegistry[contra.meshName] : null;
          if (contra && contraSurface) {
            const snapped = findClosestSurfacePoint(
              contraSurface,
              [-position[0], position[1], position[2]],
              [-normal[0], normal[1], normal[2]]
            );
            next[pairIdx] = {
              ...next[pairIdx],
              meshName: contra.meshName,
              position: snapped.position,
              normal: snapped.normal,
              risk: detectRisk3D(snapped.position, dataId, dynamicDangerZones),
              mirrored: true,
            };
          }
        }
        return next;
      });
      setMovingPointId(null);
    },
    [mirrorSync, findContralateralPointIndex, mappings, findContralateralMesh, surfaceRegistry, dynamicDangerZones]
  );

  /** Adjust dose (Ona units) for a single point (+ contralateral if Espejo ON) */
  const updatePointDose = useCallback(
    (pointId: string, deltaOna: number) => {
      setPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === pointId);
        if (idx < 0) return prev;
        const src = prev[idx];
        const newDose = Math.max(0.5, Math.round((src.doseOna + deltaOna) * 2) / 2);
        const pairIdx = mirrorSync ? findContralateralPointIndex(prev, src) : -1;
        return prev.map((p, i) =>
          i === idx || (pairIdx >= 0 && i === pairIdx) ? { ...p, doseOna: newDose } : p
        );
      });
    },
    [mirrorSync, findContralateralPointIndex]
  );

  /** Set exact dose (Ona units) for a point */
  const setPointExactDose = useCallback(
    (pointId: string, doseOna: number) => {
      const safe = Math.max(0.5, Math.round(doseOna * 2) / 2);
      setPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === pointId);
        if (idx < 0) return prev;
        const src = prev[idx];
        const pairIdx = mirrorSync ? findContralateralPointIndex(prev, src) : -1;
        return prev.map((p, i) =>
          i === idx || (pairIdx >= 0 && i === pairIdx) ? { ...p, doseOna: safe } : p
        );
      });
    },
    [mirrorSync, findContralateralPointIndex]
  );

  /** Set injection depth (superficial / profundo) for a point (+ contralateral if Espejo ON) */
  const setPointDepth = useCallback(
    (pointId: string, depth: PointDepth) => {
      setPoints((prev) => {
        const idx = prev.findIndex((p) => p.id === pointId);
        if (idx < 0) return prev;
        const src = prev[idx];
        const pairIdx = mirrorSync ? findContralateralPointIndex(prev, src) : -1;
        return prev.map((p, i) =>
          i === idx || (pairIdx >= 0 && i === pairIdx) ? { ...p, depth } : p
        );
      });
    },
    [mirrorSync, findContralateralPointIndex]
  );

  const updatePointLabel = useCallback((pointId: string, label: string) => {
    setPoints((prev) => prev.map((p) => (p.id === pointId ? { ...p, label } : p)));
  }, []);

  /** Adjust dose for ALL active points of a muscle */
  const adjustMuscleDose = useCallback((rawMuscleId: string, deltaOnaPerPoint: number) => {
    const dataId = normalizeToDataMuscleId(rawMuscleId);
    setPoints((prev) =>
      prev.map((p) => {
        if (!p.muscleId || normalizeToDataMuscleId(p.muscleId) !== dataId) return p;
        const newDose = Math.max(0.5, Math.round((p.doseOna + deltaOnaPerPoint) * 2) / 2);
        return { ...p, doseOna: newDose };
      })
    );
  }, []);

  /** Symmetrize Left & Right sides of a muscle in 3D (copies dominant side to contralateral mesh) */
  const equalizeMuscleSides = useCallback(
    (rawMuscleId: string) => {
      const dataId = normalizeToDataMuscleId(rawMuscleId);
      setPoints((prev) => {
        const musclePts = prev.filter(
          (p) => p.muscleId && normalizeToDataMuscleId(p.muscleId) === dataId
        );
        const otherPts = prev.filter(
          (p) => !p.muscleId || normalizeToDataMuscleId(p.muscleId) !== dataId
        );
        const izqPts = musclePts.filter((p) => p.side === 'izq');
        const derPts = musclePts.filter((p) => p.side === 'der');
        const centroPts = musclePts.filter((p) => p.side === 'centro');

        const izqSum = izqPts.reduce((s, p) => s + p.doseOna, 0);
        const derSum = derPts.reduce((s, p) => s + p.doseOna, 0);
        const sourcePts = izqSum >= derSum && izqPts.length > 0 ? izqPts : derPts;
        if (sourcePts.length === 0) return prev;

        const mirroredPts: InjectionPin3D[] = [];
        for (const pt of sourcePts) {
          const contra = findContralateralMesh(pt.meshName);
          if (!contra || !surfaceRegistry[contra.meshName]) continue;
          const snapped = findClosestSurfacePoint(
            surfaceRegistry[contra.meshName],
            [-pt.position[0], pt.position[1], pt.position[2]],
            [-pt.normal[0], pt.normal[1], pt.normal[2]]
          );
          mirroredPts.push({
            ...pt,
            id: nextPinId(`${dataId}-eq`),
            meshName: contra.meshName,
            side: mirrorSide(pt.side),
            position: snapped.position,
            normal: snapped.normal,
            risk: detectRisk3D(snapped.position, dataId, dynamicDangerZones),
            mirrored: true,
          });
        }

        return [...otherPts, ...centroPts, ...sourcePts, ...mirroredPts];
      });
    },
    [findContralateralMesh, surfaceRegistry, dynamicDangerZones]
  );

  const removePoint = useCallback((pointId: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== pointId));
    setSelectedPointId((id) => (id === pointId ? null : id));
    setMovingPointId((id) => (id === pointId ? null : id));
  }, []);

  const removeMuscleSide = useCallback((rawMuscleId: string, side: PointSide | 'ambos') => {
    const dataId = normalizeToDataMuscleId(rawMuscleId);
    setPoints((prev) =>
      prev.filter((p) => {
        if (!p.muscleId || normalizeToDataMuscleId(p.muscleId) !== dataId) return true;
        if (side === 'ambos') return false;
        return p.side !== side;
      })
    );
  }, []);

  const clearLaterality = useCallback((side: 'izq' | 'der') => {
    setPoints((prev) => prev.filter((p) => p.side !== side));
    setSelectedPointId(null);
  }, []);

  const clearPlan = useCallback(() => {
    setPoints([]);
    setSelectedPointId(null);
    setMovingPointId(null);
  }, []);

  /** Load a 1-click clinical preset onto the actual 3D craniofacial muscles */
  const loadPreset = useCallback(
    (
      muscleIds: string[],
      presetOpts?: { sideMode?: SideMode; pathologyId?: string }
    ) => {
      const targetSide: SideMode = presetOpts?.sideMode ?? 'ambos';
      const nextPoints: InjectionPin3D[] = [];
      for (const rawId of muscleIds) {
        const created = buildDefaultPinsForMuscle(rawId, targetSide);
        nextPoints.push(...created);
      }
      setPoints(nextPoints);
      setSelectedPointId(null);
      setMovingPointId(null);
      setSideMode(targetSide);
      setMirrorSync(targetSide === 'ambos');
      if (presetOpts?.pathologyId) {
        setActivePathologyId(presetOpts.pathologyId);
      }
    },
    [buildDefaultPinsForMuscle]
  );

  /** Set points externally (e.g. when loading a saved Supabase 3D model) */
  const replaceAllPoints = useCallback((loaded: InjectionPin3D[]) => {
    setPoints(
      loaded.map((p) => ({
        ...p,
        risk: p.risk ?? detectRisk3D(p.position, p.muscleId),
      }))
    );
    setSelectedPointId(null);
    setMovingPointId(null);
  }, []);

  const activeMuscleIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of points) {
      if (p.muscleId) {
        set.add(normalizeToDataMuscleId(p.muscleId));
        set.add(normalizeToPlannerMuscleId(p.muscleId));
      }
    }
    return set;
  }, [points]);

  const muscleSummaries = useMemo((): MuscleSummary[] => {
    const map = new Map<
      string,
      MuscleSummary & { izqOna: number; derOna: number; centroOna: number }
    >();

    for (const p of points) {
      const dataId = p.muscleId ? normalizeToDataMuscleId(p.muscleId) : p.meshName;
      const plannerCfg = getFacialConfigByMuscleId(dataId);
      const muscleData = getMuscleDataById(dataId);
      const maxDose = plannerCfg?.maxDoseAesthetic ?? muscleData?.dosing?.botox?.max ?? 30;
      const name = muscleData?.name ?? plannerCfg?.name ?? p.label;
      const muscleKey = p.muscleKey ?? plannerCfg?.muscleKey ?? muscleData?.latinName ?? p.meshName;
      const risk = p.risk ?? null;

      const existing = map.get(dataId);
      if (existing) {
        existing.totalOna += p.doseOna;
        if (p.side === 'izq') existing.izqOna += p.doseOna;
        else if (p.side === 'der') existing.derOna += p.doseOna;
        else existing.centroOna += p.doseOna;
        existing.pointCount += 1;
        if (risk && !existing.risks.includes(risk)) existing.risks.push(risk);
        if (!existing.sides.includes(p.side)) existing.sides.push(p.side);
      } else {
        map.set(dataId, {
          muscleId: dataId,
          muscleKey,
          name,
          view: plannerCfg?.view ?? 'front',
          totalOna: p.doseOna,
          totalBrand: 0,
          izqOna: p.side === 'izq' ? p.doseOna : 0,
          derOna: p.side === 'der' ? p.doseOna : 0,
          centroOna: p.side === 'centro' ? p.doseOna : 0,
          izqBrand: 0,
          derBrand: 0,
          centroBrand: 0,
          isAsymmetric: false,
          pointCount: 1,
          maxDoseAesthetic: maxDose,
          overDose: false,
          risks: risk ? [risk] : [],
          sides: [p.side],
        });
      }
    }

    return Array.from(map.values()).map((s) => {
      const totalBrand = convertOnaToBrand(s.totalOna, brand);
      const izqBrand = convertOnaToBrand(s.izqOna, brand);
      const derBrand = convertOnaToBrand(s.derOna, brand);
      const centroBrand = convertOnaToBrand(s.centroOna, brand);
      const isBilateral = s.sides.includes('izq') || s.sides.includes('der');
      const isAsymmetric = isBilateral && Math.abs(izqBrand - derBrand) > 0;
      return {
        ...s,
        totalBrand,
        izqBrand,
        derBrand,
        centroBrand,
        isAsymmetric,
        overDose: s.totalOna > s.maxDoseAesthetic,
      };
    });
  }, [points, brand]);

  const totalOna = useMemo(() => points.reduce((s, p) => s + p.doseOna, 0), [points]);
  const totalBrandUnits = useMemo(() => convertOnaToBrand(totalOna, brand), [totalOna, brand]);
  const dilutionNum = parseFloat(dilution) || 0;
  const totalVolumeMl = useMemo(
    () => getVolumeMl(totalBrandUnits, brand, dilutionNum),
    [totalBrandUnits, brand, dilutionNum]
  );

  /** Concentration per 0.1 mL (10 IU on insulin syringe) — clinical helper */
  const unitsPer01Ml = useMemo(() => {
    if (dilutionNum <= 0) return 0;
    return Math.round(((UNITS_PER_VIAL[brand] / dilutionNum) * 0.1) * 10) / 10;
  }, [brand, dilutionNum]);

  const unitsBySide = useMemo(() => {
    let izq = 0;
    let der = 0;
    let centro = 0;
    for (const p of points) {
      const u = convertOnaToBrand(p.doseOna, brand);
      if (p.side === 'izq') izq += u;
      else if (p.side === 'der') der += u;
      else centro += u;
    }
    return { izq, der, centro };
  }, [points, brand]);

  const activeRisks = useMemo(() => {
    const set = new Set<RiskType>();
    points.forEach((p) => {
      if (p.risk) set.add(p.risk);
    });
    return Array.from(set).map((r) => RISK_MESSAGES[r]);
  }, [points]);

  const overDoseMuscles = useMemo(
    () => muscleSummaries.filter((s) => s.overDose).map((s) => s.name),
    [muscleSummaries]
  );

  const asymmetricMuscles = useMemo(
    () => muscleSummaries.filter((s) => s.isAsymmetric).map((s) => s.name),
    [muscleSummaries]
  );

  /** Catalog of muscles actually available in the loaded 3D model (resilient before GLB finishes) */
  const available3DMuscles = useMemo(() => {
    const presentDataIds = new Set<string>();
    const hasRegistry = Object.keys(surfaceRegistry).length > 0;
    Object.values(mappings).forEach((entry) => {
      if (entry.role === 'muscle' && entry.muscleId) {
        if (!hasRegistry || surfaceRegistry[entry.meshName]) {
          presentDataIds.add(normalizeToDataMuscleId(entry.muscleId));
        }
      }
    });

    const useFallbackCatalog = presentDataIds.size === 0;

    // Preserve familiar clinical ordering from FACIAL_MUSCLES first
    const ordered: {
      id: string;
      name: string;
      latinName: string;
      layer: MeshLayer;
      view: 'front' | 'back';
      maxDoseAesthetic: number;
    }[] = [];
    const seen = new Set<string>();

    for (const m of FACIAL_MUSCLES) {
      const dataId = normalizeToDataMuscleId(m.id);
      if ((!useFallbackCatalog && !presentDataIds.has(dataId)) || seen.has(dataId)) continue;
      seen.add(dataId);
      const data = getMuscleDataById(dataId);
      ordered.push({
        id: dataId,
        name: data?.name ?? m.name,
        latinName: data?.latinName ?? m.muscleKey,
        layer: m.layer,
        view: m.view ?? 'front',
        maxDoseAesthetic: m.maxDoseAesthetic,
      });
    }

    // Add any extra mapped 3D muscles not in FACIAL_MUSCLES
    presentDataIds.forEach((dataId) => {
      if (seen.has(dataId)) return;
      seen.add(dataId);
      const data = getMuscleDataById(dataId);
      if (!data) return;
      ordered.push({
        id: dataId,
        name: data.name,
        latinName: data.latinName,
        layer: 'superficial',
        view: 'front',
        maxDoseAesthetic: data.dosing?.botox?.max ?? 30,
      });
    });

    return ordered;
  }, [mappings, surfaceRegistry]);

  /** Export directly into SonoTox's /calculator state format */
  const exportPlan = useCallback((): FacialPlanExport => {
    type SideKey = 'Izquierdo' | 'Derecho' | 'Ambos';
    const grouped = new Map<string, { side: SideKey; doseOna: number }>();

    for (const p of points) {
      let side: SideKey;
      if (p.side === 'centro') side = 'Ambos';
      else if (p.side === 'izq') side = 'Izquierdo';
      else side = 'Derecho';

      const dataId = p.muscleId ? normalizeToDataMuscleId(p.muscleId) : '';
      const plannerCfg = getFacialConfigByMuscleId(dataId);
      const muscleKey = plannerCfg?.muscleKey ?? p.muscleKey ?? p.label;

      const key = `${muscleKey}::${side}`;
      const existing = grouped.get(key);
      if (existing) existing.doseOna += p.doseOna;
      else grouped.set(key, { side, doseOna: p.doseOna });
    }

    const muscles: MuscleSelection[] = [];
    grouped.forEach((val, key) => {
      const muscleKey = key.split('::')[0];
      const customDose = convertOnaToBrand(val.doseOna, brand);
      muscles.push({
        id: `${muscleKey}-${val.side}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: muscleKey,
        side: val.side,
        doseOption: 'max',
        customDose,
      });
    });

    // Convert 3D pins to 2D-compatible summary points for calculator sheet continuity
    const compatPoints: InjectionPoint[] = points.map((p) => {
      const dataId = p.muscleId ? normalizeToDataMuscleId(p.muscleId) : p.meshName;
      const plannerId = normalizeToPlannerMuscleId(dataId);
      const cfg = FACIAL_MUSCLE_BY_ID[plannerId];
      const tpl = cfg?.defaultPoints.find((t) => t.side === p.side) ?? cfg?.defaultPoints[0];
      return {
        id: p.id,
        muscleId: plannerId,
        muscleKey: cfg?.muscleKey ?? p.muscleKey ?? p.label,
        x: tpl?.x ?? Math.round(200 + p.position[0] * 140),
        y: tpl?.y ?? Math.round(230 - p.position[1] * 180),
        doseOna: p.doseOna,
        depth: p.depth,
        side: p.side,
        risk: p.risk ?? null,
        mirrored: p.mirrored,
      };
    });

    return {
      brand,
      dilution,
      pathologyId: activePathologyId,
      muscles,
      points: compatPoints,
    };
  }, [points, brand, dilution, activePathologyId]);

  return {
    brand,
    setBrand,
    dilution,
    setDilution,
    sideMode,
    setSideMode,
    mirrorSync,
    setMirrorSync,
    points,
    selectedPointId,
    setSelectedPointId,
    movingPointId,
    setMovingPointId,
    showDangerZones,
    setShowDangerZones,
    anatomyLayerFilter,
    setAnatomyLayerFilter,
    pointSize,
    setPointSize,
    addPointMode,
    setAddPointMode,
    layerVisibility,
    setLayerVisibility,
    activeMuscleIds,
    available3DMuscles,
    toggleMuscle,
    addCustomPoint3D,
    addExtraPointForMuscle,
    movePoint3D,
    updatePointDose,
    setPointExactDose,
    setPointDepth,
    updatePointLabel,
    adjustMuscleDose,
    equalizeMuscleSides,
    removePoint,
    removeMuscleSide,
    clearLaterality,
    clearPlan,
    loadPreset,
    replaceAllPoints,
    muscleSummaries,
    totalOna,
    totalBrandUnits,
    totalVolumeMl,
    unitsPer01Ml,
    unitsBySide,
    activeRisks,
    overDoseMuscles,
    asymmetricMuscles,
    exportPlan,
  };
}

export type Facial3DPlanController = ReturnType<typeof useFacial3DPlan>;
