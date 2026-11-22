import { musclesData, type MuscleData } from '../data/muscleData';
import { FACIAL_MUSCLE_BY_ID, type FacialMuscleConfig } from '../constants/facialAestheticMap';
import type { MeshLayer, MeshMappingEntry, MeshRole, MeshSide } from '../types/facial3d';

const EXTRA_HEAD_NECK_IDS = new Set([
  'sternocleidomastoid',
  'splenius-capitis',
  'trapezius',
  'cervical-paraspinals',
  'levator-scapulae',
]);

/** All facial & craniocervical muscles available in SonoTox's clinical catalog */
export const FACIAL_CATALOG_MUSCLES: MuscleData[] = musclesData.filter(
  (m) => m.category === 'face' || EXTRA_HEAD_NECK_IDS.has(m.id)
);

/** Map from facialAestheticMap ID (e.g. 'llsan') to data/muscleData ID */
const PLANNER_TO_DATA_ID: Record<string, string> = {
  llsan: 'levator-labii-superioris-alaeque-nasi',
  'sternocleidomastoid-posterior': 'sternocleidomastoid',
  'trapezius-facial': 'trapezius',
};

const DATA_TO_PLANNER_ID: Record<string, string> = {
  'levator-labii-superioris-alaeque-nasi': 'llsan',
  sternocleidomastoid: 'sternocleidomastoid-posterior',
  trapezius: 'trapezius-facial',
};

export function getMuscleDataById(muscleId: string | null | undefined): MuscleData | null {
  if (!muscleId) return null;
  const normalized = PLANNER_TO_DATA_ID[muscleId] ?? muscleId;
  return musclesData.find((m) => m.id === normalized) ?? null;
}

export function getFacialConfigByMuscleId(
  muscleId: string | null | undefined
): FacialMuscleConfig | null {
  if (!muscleId) return null;
  const plannerId = DATA_TO_PLANNER_ID[muscleId] ?? muscleId;
  return FACIAL_MUSCLE_BY_ID[plannerId] ?? FACIAL_MUSCLE_BY_ID[muscleId] ?? null;
}

const BONE_PATTERNS: RegExp[] = [
  /^skull_/i,
  /skull/i,
  /crani(um|o)/i,
  /mandib(le|ula)/i,
  /maxill(a|ar)/i,
  /bone/i,
  /hueso/i,
  /os[_\s.-]/i,
  /teeth|tooth|diente|incisor|canine|premolar|molar/i,
  /zygomatic[_\s.-]*(bone|arch)/i,
  /frontal[_\s.-]*bone/i,
  /temporal[_\s.-]*bone/i,
  /occipital[_\s.-]*bone/i,
  /parietal(?!is)/i,
  /sphenoid|ethmoid|lacrimal|vomer|palatine|hyoid|vertebra|atlas|axis|cervical[_\s.-]*spine/i,
  /cartilage|cartilago|septum|nasal[_\s.-]*bone|concha/i,
];

const REFERENCE_PATTERNS: RegExp[] = [
  /^ref_/i,
  /eye(ball|s)?|cornea|pupil|iris|sclera|globe|tarsus/i,
  /skin|piel|head[_\s.-]*shell|face[_\s.-]*shell|galea|aponeurosis|parotid|gland|nerve|artery|vein|fascia/i,
];

interface MuscleMatchRule {
  muscleId: string;
  patterns: RegExp[];
  layer: MeshLayer;
}

const MUSCLE_MATCH_RULES: MuscleMatchRule[] = [
  {
    muscleId: 'levator-labii-superioris-alaeque-nasi',
    patterns: [
      /alaeque/i,
      /\bllsan\b/i,
      /labii[_\s.-]*superioris[_\s.-]*ala/i,
      /levator[_\s.-]*nasolabialis/i,
    ],
    layer: 'superficial',
  },
  {
    muscleId: 'levator-labii-superioris',
    patterns: [/levator[_\s.-]*labii[_\s.-]*superior/i, /elevador[_\s.-]*labio[_\s.-]*sup/i],
    layer: 'superficial',
  },
  {
    muscleId: 'levator-anguli-oris',
    patterns: [/levator[_\s.-]*anguli/i, /caninus/i, /elevador[_\s.-]*angulo/i],
    layer: 'profundo',
  },
  {
    muscleId: 'depressor-anguli-oris',
    patterns: [/depressor[_\s.-]*anguli/i, /\bdao\b/i, /triangularis/i, /depresor[_\s.-]*angulo/i],
    layer: 'superficial',
  },
  {
    muscleId: 'depressor-labii-inferioris',
    patterns: [/depressor[_\s.-]*labii/i, /\bdli\b/i, /depresor[_\s.-]*labio/i],
    layer: 'profundo',
  },
  {
    muscleId: 'depressor-supercilii',
    patterns: [/depressor[_\s.-]*supercil/i, /depresor[_\s.-]*(de[_\s.-]*la[_\s.-]*)?ceja/i],
    layer: 'profundo',
  },
  {
    muscleId: 'corrugator',
    patterns: [/corrugat/i],
    layer: 'profundo',
  },
  {
    muscleId: 'procerus',
    patterns: [/procer(us|o)?/i, /piramidal[_\s.-]*nasal/i],
    layer: 'superficial',
  },
  {
    muscleId: 'frontalis',
    patterns: [
      /frontal(is)?(?!.*bone)/i,
      /occipitofrontalis[_\s.-]*frontal/i,
      /epicranius[_\s.-]*frontal/i,
    ],
    layer: 'superficial',
  },
  {
    muscleId: 'occipitalis',
    patterns: [/occipital(is)?(?!.*bone)/i],
    layer: 'superficial',
  },
  {
    muscleId: 'orbicularis-oculi',
    patterns: [/orbicular(is)?[_\s.-]*(ocul|ojo|eye)/i],
    layer: 'superficial',
  },
  {
    muscleId: 'orbicularis-oris',
    patterns: [/orbicular(is)?[_\s.-]*(oris|labio|mouth|boca)/i],
    layer: 'superficial',
  },
  {
    muscleId: 'nasalis',
    patterns: [
      /nasalis/i,
      /transverse[_\s.-]*nasal/i,
      /alar[_\s.-]*nasal/i,
      /depressor[_\s.-]*septi/i,
    ],
    layer: 'superficial',
  },
  {
    muscleId: 'zygomaticus-major',
    patterns: [/zygomatic(us)?[_\s.-]*major/i, /cigomatico[_\s.-]*mayor/i],
    layer: 'superficial',
  },
  {
    muscleId: 'zygomaticus-minor',
    patterns: [/zygomatic(us)?[_\s.-]*minor/i, /cigomatico[_\s.-]*menor/i],
    layer: 'superficial',
  },
  {
    muscleId: 'risorius',
    patterns: [/risori(us|o)/i],
    layer: 'superficial',
  },
  {
    muscleId: 'buccinator',
    patterns: [/buccin?at/i, /bucinad/i],
    layer: 'profundo',
  },
  {
    muscleId: 'mentalis',
    patterns: [/mentalis|mentonian/i],
    layer: 'profundo',
  },
  {
    muscleId: 'masseter',
    patterns: [/masseter[_\s.-]*deep|deep[_\s.-]*part[_\s.-]*of[_\s.-]*masseter/i],
    layer: 'profundo',
  },
  {
    muscleId: 'masseter',
    patterns: [/masseter|maseter/i],
    layer: 'superficial',
  },
  {
    muscleId: 'temporalis',
    patterns: [/temporoparietalis/i],
    layer: 'superficial',
  },
  {
    muscleId: 'temporalis',
    patterns: [/temporalis(?!.*bone)/i, /temporal[_\s.-]*(muscle|musculo)/i],
    layer: 'profundo',
  },
  {
    muscleId: 'medial-pterygoid',
    patterns: [
      /medial[_\s.-]*pterygoid/i,
      /pterygoid(eus)?[_\s.-]*medial/i,
      /pterigoideo[_\s.-]*medial/i,
    ],
    layer: 'profundo',
  },
  {
    muscleId: 'lateral-pterygoid',
    patterns: [
      /lateral[_\s.-]*pterygoid/i,
      /pterygoid(eus)?[_\s.-]*lateral/i,
      /pterigoideo[_\s.-]*lateral/i,
    ],
    layer: 'profundo',
  },
  {
    muscleId: 'platysma',
    patterns: [/platysma|platisma/i],
    layer: 'superficial',
  },
  {
    muscleId: 'sternocleidomastoid',
    patterns: [/sternocleidomastoid|esternocleidomastoideo/i],
    layer: 'superficial',
  },
  {
    muscleId: 'splenius-capitis',
    patterns: [/splenius[_\s.-]*capitis|esplenio/i],
    layer: 'profundo',
  },
  {
    muscleId: 'trapezius',
    patterns: [/trapezius|trapecio/i],
    layer: 'superficial',
  },
  {
    muscleId: 'cervical-paraspinals',
    patterns: [/cervical[_\s.-]*paraspinals|spinalis[_\s.-]*capitis|longissimus[_\s.-]*capitis/i],
    layer: 'profundo',
  },
  {
    muscleId: 'levator-scapulae',
    patterns: [/levator[_\s.-]*scapulae|elevador[_\s.-]*escapula/i],
    layer: 'profundo',
  },
];

export function detectSideFromMeshName(meshName: string): MeshSide {
  const cleaned = meshName.replace(/\.\d{3}$/, '');
  if (/(^|[_\s.-])(l|lt|left|izq|izquierdo|sinister)($|[_\s.-])/i.test(cleaned)) {
    return 'izq';
  }
  if (/(^|[_\s.-])(r|rt|right|der|derecho|dexter)($|[_\s.-])/i.test(cleaned)) {
    return 'der';
  }
  return 'centro';
}

export function autoMapMeshName(meshName: string): MeshMappingEntry {
  const cleanName = meshName.trim();

  if (REFERENCE_PATTERNS.some((rx) => rx.test(cleanName))) {
    return {
      meshName: cleanName,
      muscleId: null,
      displayName: cleanName.replace(/^Ref_/i, '').replace(/[_.-]+/g, ' '),
      role: 'reference',
      side: detectSideFromMeshName(cleanName),
      layer: 'superficial',
      visible: true,
    };
  }

  if (BONE_PATTERNS.some((rx) => rx.test(cleanName))) {
    return {
      meshName: cleanName,
      muscleId: null,
      displayName: cleanName.replace(/^Skull_/i, '').replace(/[_.-]+/g, ' '),
      role: 'bone',
      side: detectSideFromMeshName(cleanName),
      layer: 'profundo',
      visible: true,
    };
  }

  for (const rule of MUSCLE_MATCH_RULES) {
    if (rule.patterns.some((rx) => rx.test(cleanName))) {
      const clinical = getMuscleDataById(rule.muscleId);
      const side = detectSideFromMeshName(cleanName);
      return {
        meshName: cleanName,
        muscleId: rule.muscleId,
        displayName: clinical?.name ?? cleanName,
        role: 'muscle',
        side,
        layer: rule.layer,
        visible: true,
      };
    }
  }

  return {
    meshName: cleanName,
    muscleId: null,
    displayName: cleanName.replace(/[_.-]+/g, ' '),
    role: 'muscle',
    side: detectSideFromMeshName(cleanName),
    layer: 'superficial',
    visible: true,
  };
}

export function autoMapAllMeshes(
  meshNames: string[],
  existing?: Record<string, MeshMappingEntry>
): Record<string, MeshMappingEntry> {
  const result: Record<string, MeshMappingEntry> = {};
  for (const name of meshNames) {
    if (existing && existing[name]) {
      result[name] = existing[name];
    } else {
      result[name] = autoMapMeshName(name);
    }
  }
  return result;
}

export function formatSideLabel(side: MeshSide): string {
  if (side === 'izq') return 'Izquierdo (Paciente)';
  if (side === 'der') return 'Derecho (Paciente)';
  return 'Línea Media / Bilateral';
}

export function formatRoleLabel(role: MeshRole): string {
  switch (role) {
    case 'muscle':
      return 'Músculo seleccionable';
    case 'bone':
      return 'Hueso / Cráneo (referencia)';
    case 'reference':
      return 'Tejido de referencia';
    case 'hidden':
      return 'Oculto';
  }
}
