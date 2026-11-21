/**
 * Configuración del planificador facial estético y clínico: músculos superficiales y profundos,
 * puntos por defecto alineados al atlas (viewBox 0 0 400 500), zonas de riesgo y presets clínicos.
 */

export const FACIAL_VIEWBOX = { width: 400, height: 500 } as const;

export type AestheticZone =
  | 'frente'
  | 'sien'
  | 'glabela'
  | 'periocular'
  | 'nariz'
  | 'tercioMedio'
  | 'perioral'
  | 'menton'
  | 'mandibula'
  | 'cuello'
  | 'occipital';

export type FacialPlannerView = 'front' | 'back';
export type MuscleLayer = 'superficial' | 'profundo';
export type AnatomyLayerFilter = 'todos' | 'superficial' | 'profundo';
export type PointSizeMode = 'sm' | 'md' | 'lg';

export type PointSide = 'izq' | 'der' | 'centro';
/** Modo de selección lateral al activar un músculo */
export type SideMode = 'izq' | 'ambos' | 'der';
export type PointDepth = 'superficial' | 'profundo';
export type RiskType = 'ptosisCeja' | 'sonrisa' | 'disfagia';

/** Imagen de atlas anatómico (fondo del planificador) */
export const FACIAL_ANATOMY_IMAGE = '/facial/anatomy-base.png';

/** Región de la imagen dentro del viewBox (ajusta alineación atlas ↔ paths) */
export const ANATOMY_IMAGE_FRAME = {
  x: 20,
  y: 4,
  width: 360,
  height: 492,
} as const;

export interface DefaultPointTemplate {
  x: number;
  y: number;
  doseOna: number;
  depth: PointDepth;
  side: PointSide;
}

export interface MuscleBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FacialMuscleConfig {
  id: string;
  muscleKey: string;
  name: string;
  zone: AestheticZone;
  /** Vista anatómica en el planificador ('front' por defecto o 'back' para PREEMPT occipital/cervical) */
  view?: FacialPlannerView;
  /** Plano anatómico principal para filtrado y codificación visual */
  layer: MuscleLayer;
  maxDoseAesthetic: number;
  svgPath: string;
  bbox: MuscleBBox;
  defaultPoints: DefaultPointTemplate[];
}

export interface ClinicalFacialPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  muscleIds: string[];
}

export const CLINICAL_FACIAL_PRESETS: ClinicalFacialPreset[] = [
  {
    id: 'tercio-superior',
    name: 'Tercio Superior',
    description: 'Frente, entrecejo (glabela) y patas de gallo',
    icon: 'visibility',
    muscleIds: ['frontalis', 'corrugator', 'procerus', 'orbicularis-oculi'],
  },
  {
    id: 'sonrisa-gingival',
    name: 'Sonrisa Gingival / Nariz',
    description: 'LLSAN, elevador del labio superior y bunny lines / punta nasal',
    icon: 'sentiment_satisfied',
    muscleIds: ['llsan', 'levator-labii-superioris', 'nasalis'],
  },
  {
    id: 'tercio-inferior',
    name: 'Nefertiti / Tercio Inf.',
    description: 'Comisuras (DAO), mentón adoquinado y bandas platismales',
    icon: 'face_retouching_natural',
    muscleIds: ['depressor-anguli-oris', 'mentalis', 'platysma'],
  },
  {
    id: 'bruxismo-atm',
    name: 'Bruxismo y ATM',
    description: 'Masetero, temporal y complejo pterigoideo profundo',
    icon: 'dentistry',
    muscleIds: ['masseter', 'temporalis', 'medial-pterygoid', 'lateral-pterygoid'],
  },
  {
    id: 'migrana-preempt',
    name: 'Migraña PREEMPT (155U)',
    description: 'Protocolo PREEMPT completo: Frontal, Corrugador, Prócer, Temporal, Occipital, Paravertebrales y Trapecio',
    icon: 'psychology',
    muscleIds: [
      'frontalis',
      'corrugator',
      'procerus',
      'temporalis',
      'occipitalis',
      'cervical-paraspinals',
      'trapezius-facial',
    ],
  },
  {
    id: 'sincinesias',
    name: 'Sincinesias Faciales',
    description: 'Control periocular, cigomático, perioral, mentón y platisma',
    icon: 'neurology',
    muscleIds: ['orbicularis-oculi', 'zygomaticus-major', 'orbicularis-oris', 'mentalis', 'platysma'],
  },
];

export interface DangerRegion {
  id: string;
  risk: RiskType;
  /** Flat polygon [x1,y1,x2,y2,...] in viewBox coords */
  polygon: number[];
  label: string;
}

export const RISK_MESSAGES: Record<RiskType, string> = {
  ptosisCeja: 'Riesgo alto de ptosis de ceja o palpebral (<1.5 cm del reborde orbitario)',
  sonrisa: 'Riesgo de asimetría o caída de la sonrisa (fascículos cigomáticos)',
  disfagia: 'Riesgo de disfagia o debilidad cervical anterior por difusión profunda',
};

export const DANGER_REGIONS: DangerRegion[] = [
  {
    id: 'orbital-rim-upper',
    risk: 'ptosisCeja',
    polygon: [108, 122, 292, 122, 292, 146, 108, 146],
    label: 'Reborde orbitario superior (zona de seguridad frontal)',
  },
  {
    id: 'zygomatic-patient-right',
    risk: 'sonrisa',
    polygon: [94, 216, 120, 218, 144, 286, 126, 290],
    label: 'Trayecto cigomático (der. paciente)',
  },
  {
    id: 'zygomatic-patient-left',
    risk: 'sonrisa',
    polygon: [306, 216, 280, 218, 256, 286, 274, 290],
    label: 'Trayecto cigomático (izq. paciente)',
  },
  {
    id: 'deep-neck',
    risk: 'disfagia',
    polygon: [148, 410, 252, 410, 246, 488, 154, 488],
    label: 'Región laríngea / cuello anterior profundo',
  },
];

/** Contorno del cuello (capa cutánea, se dibuja detrás del rostro) */
export const NECK_OUTLINE_PATH =
  'M150,408 C146,438 148,466 156,488 L244,488 C252,466 254,438 250,408 C232,420 168,420 150,408 Z';

/** Contorno facial base (capa cutánea): frente, sienes, pómulos, mandíbula y mentón */
export const FACE_OUTLINE_PATH =
  'M200,44 C156,44 120,56 104,90 C92,116 90,156 92,196 C94,250 104,300 124,342 C144,370 172,380 200,382 C228,380 256,370 276,342 C296,300 306,250 308,196 C310,156 308,116 296,90 C280,56 244,44 200,44 Z';

export const FACE_GUIDE_PATHS = {
  midline: 'M200,40 L200,490',
  leftBrow: 'M108,136 Q148,124 188,134',
  rightBrow: 'M212,134 Q252,124 292,136',
  leftEye: 'M116,176 Q146,162 176,176 Q146,190 116,176',
  rightEye: 'M224,176 Q254,162 284,176 Q254,190 224,176',
  nose: 'M200,150 L200,236 Q200,248 186,252 Q200,258 214,252 Q200,248 200,236',
  mouth: 'M152,294 Q200,304 248,294 M158,300 Q200,312 242,300',
  foreheadWrinkles: 'M118,80 Q200,74 282,80 M122,102 Q200,96 278,102',
  glabellarLines: 'M188,148 Q192,138 194,130 M212,148 Q208,138 206,130',
  crowFeetLeft: 'M98,162 Q88,172 90,184 M98,174 Q89,184 92,196',
  crowFeetRight: 'M302,162 Q312,172 310,184 M302,174 Q311,184 308,196',
  platysmaBands: 'M152,370 Q144,425 130,480 M200,375 L200,485 M248,370 Q256,425 270,480',
};

/**
 * Catálogo completo de 21 músculos craneofaciales y cervicales calibrados con anatomy-base.png
 * Convención radiológica (paciente de frente):
 * - Izquierda de pantalla (X < 200) = Derecha del paciente (side: 'der')
 * - Derecha de pantalla (X > 200) = Izquierda del paciente (side: 'izq')
 */
export const FACIAL_MUSCLES: FacialMuscleConfig[] = [
  // ==================== TERCIO SUPERIOR & SIEN ====================
  {
    id: 'frontalis',
    muscleKey: 'Frontalis',
    name: 'Frontal',
    zone: 'frente',
    layer: 'superficial',
    maxDoseAesthetic: 20,
    svgPath:
      'M106,68 C118,46 156,42 195,48 C198,74 198,104 195,130 C174,124 140,122 106,134 C102,112 102,88 106,68 Z M294,68 C282,46 244,42 205,48 C202,74 202,104 205,130 C226,124 260,122 294,134 C298,112 298,88 294,68 Z',
    bbox: { minX: 102, minY: 42, maxX: 298, maxY: 134 },
    defaultPoints: [
      { x: 136, y: 78, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 170, y: 74, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 154, y: 104, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 264, y: 78, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 230, y: 74, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 246, y: 104, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'temporalis',
    muscleKey: 'Temporalis',
    name: 'Temporal',
    zone: 'sien',
    layer: 'profundo',
    maxDoseAesthetic: 40,
    svgPath:
      'M86,96 C94,86 102,94 104,114 C105,138 101,164 94,182 C86,178 82,158 82,134 C82,116 83,102 86,96 Z M314,96 C306,86 298,94 296,114 C295,138 299,164 306,182 C314,178 318,158 318,134 C318,116 317,102 314,96 Z',
    bbox: { minX: 82, minY: 86, maxX: 318, maxY: 182 },
    defaultPoints: [
      { x: 93, y: 114, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 91, y: 146, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 307, y: 114, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 309, y: 146, doseOna: 5, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'corrugator',
    muscleKey: 'Corrugator',
    name: 'Corrugador',
    zone: 'glabela',
    layer: 'profundo',
    maxDoseAesthetic: 12,
    svgPath:
      'M190,148 C180,151 162,144 148,136 C150,128 168,127 188,135 C192,138 193,144 190,148 Z M210,148 C220,151 238,144 252,136 C250,128 232,127 212,135 C208,138 207,144 210,148 Z',
    bbox: { minX: 148, minY: 127, maxX: 252, maxY: 151 },
    defaultPoints: [
      { x: 182, y: 141, doseOna: 4, depth: 'profundo', side: 'der' },
      { x: 162, y: 135, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 218, y: 141, doseOna: 4, depth: 'profundo', side: 'izq' },
      { x: 238, y: 135, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'procerus',
    muscleKey: 'Procerus',
    name: 'Prócer',
    zone: 'glabela',
    layer: 'superficial',
    maxDoseAesthetic: 5,
    svgPath:
      'M190,134 C196,131 204,131 210,134 C209,150 206,164 200,172 C194,164 191,150 190,134 Z',
    bbox: { minX: 190, minY: 131, maxX: 210, maxY: 172 },
    defaultPoints: [{ x: 200, y: 150, doseOna: 4, depth: 'profundo', side: 'centro' }],
  },
  {
    id: 'depressor-supercilii',
    muscleKey: 'Depressor supercilii',
    name: 'Depresor de la Ceja',
    zone: 'glabela',
    layer: 'profundo',
    maxDoseAesthetic: 8,
    svgPath:
      'M178,150 C185,148 191,154 190,168 C183,172 175,167 174,158 C174,153 175,151 178,150 Z M222,150 C215,148 209,154 210,168 C217,172 225,167 226,158 C226,153 225,151 222,150 Z',
    bbox: { minX: 174, minY: 148, maxX: 226, maxY: 172 },
    defaultPoints: [
      { x: 182, y: 159, doseOna: 2, depth: 'profundo', side: 'der' },
      { x: 218, y: 159, doseOna: 2, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'orbicularis-oculi',
    muscleKey: 'Orbicularis oculi',
    name: 'Orbicular de los Ojos',
    zone: 'periocular',
    layer: 'superficial',
    maxDoseAesthetic: 12,
    svgPath:
      'M96,176 C96,146 120,130 148,130 C172,130 184,148 184,174 C184,202 166,224 140,224 C112,224 96,204 96,176 Z M304,176 C304,146 280,130 252,130 C228,130 216,148 216,174 C216,202 234,224 260,224 C288,224 304,204 304,176 Z',
    bbox: { minX: 96, minY: 130, maxX: 304, maxY: 224 },
    defaultPoints: [
      { x: 104, y: 158, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 102, y: 178, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 108, y: 198, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 296, y: 158, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 298, y: 178, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 292, y: 198, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },

  // ==================== NARIZ Y TERCIO MEDIO ====================
  {
    id: 'nasalis',
    muscleKey: 'Nasalis',
    name: 'Nasal (Bunny Lines y Septo)',
    zone: 'nariz',
    layer: 'superficial',
    maxDoseAesthetic: 6,
    svgPath:
      'M186,174 C194,172 198,184 198,204 C198,220 194,230 184,232 C175,226 173,210 176,192 C178,180 182,175 186,174 Z M214,174 C206,172 202,184 202,204 C202,220 206,230 216,232 C225,226 227,210 224,192 C222,180 218,175 214,174 Z M193,248 C197,246 203,246 207,248 C208,255 205,261 200,262 C195,261 192,255 193,248 Z',
    bbox: { minX: 173, minY: 172, maxX: 227, maxY: 262 },
    defaultPoints: [
      { x: 186, y: 202, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 214, y: 202, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'llsan',
    muscleKey: 'Levator labii superioris alaeque nasi',
    name: 'Elevador LLSAN (Sonrisa Gingival)',
    zone: 'tercioMedio',
    layer: 'superficial',
    maxDoseAesthetic: 4,
    svgPath:
      'M174,182 C179,182 181,196 178,216 C175,236 172,254 166,264 C160,260 159,244 163,222 C166,202 169,184 174,182 Z M226,182 C221,182 219,196 222,216 C225,236 228,254 234,264 C240,260 241,244 237,222 C234,202 231,184 226,182 Z',
    bbox: { minX: 159, minY: 182, maxX: 241, maxY: 264 },
    defaultPoints: [
      { x: 169, y: 228, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 231, y: 228, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'levator-labii-superioris',
    muscleKey: 'Levator labii superioris',
    name: 'Elevador Labio Sup.',
    zone: 'tercioMedio',
    layer: 'superficial',
    maxDoseAesthetic: 6,
    svgPath:
      'M138,222 C146,220 156,220 160,224 C162,240 162,256 160,268 C154,270 148,266 146,256 C142,244 137,230 138,222 Z M262,222 C254,220 244,220 240,224 C238,240 238,256 240,268 C246,270 252,266 254,256 C258,244 263,230 262,222 Z',
    bbox: { minX: 137, minY: 220, maxX: 263, maxY: 270 },
    defaultPoints: [
      { x: 151, y: 244, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 249, y: 244, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'zygomaticus-minor',
    muscleKey: 'Zygomaticus minor',
    name: 'Cigomático Menor',
    zone: 'tercioMedio',
    layer: 'superficial',
    maxDoseAesthetic: 4,
    svgPath:
      'M116,222 C122,219 129,222 134,230 C144,246 152,260 156,274 C151,278 145,276 140,266 C130,250 120,236 114,226 C113,224 114,222 116,222 Z M284,222 C278,219 271,222 266,230 C256,246 248,260 244,274 C249,278 255,276 260,266 C270,250 280,236 286,226 C287,224 286,222 284,222 Z',
    bbox: { minX: 113, minY: 219, maxX: 287, maxY: 278 },
    defaultPoints: [
      { x: 135, y: 248, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 265, y: 248, doseOna: 1, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'zygomaticus-major',
    muscleKey: 'Zygomaticus major',
    name: 'Cigomático Mayor',
    zone: 'tercioMedio',
    layer: 'superficial',
    maxDoseAesthetic: 6,
    // Nace alto y lateral en el arco/hueso cigomático (X≈96, Y≈218) y baja en diagonal al modiolo (X≈146, Y≈292)
    svgPath:
      'M96,218 C102,215 110,220 116,230 C128,250 140,270 148,288 C144,295 137,294 131,284 C119,264 106,242 94,224 C93,221 94,219 96,218 Z M304,218 C298,215 290,220 284,230 C272,250 260,270 252,288 C256,295 263,294 269,284 C281,264 294,242 306,224 C307,221 306,219 304,218 Z',
    bbox: { minX: 93, minY: 215, maxX: 307, maxY: 295 },
    defaultPoints: [
      { x: 122, y: 256, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 278, y: 256, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'levator-anguli-oris',
    muscleKey: 'Levator anguli oris',
    name: 'Elevador Ángulo Boca (Canino)',
    zone: 'tercioMedio',
    layer: 'profundo',
    maxDoseAesthetic: 4,
    svgPath:
      'M136,246 C143,244 149,248 150,260 C151,274 149,284 144,288 C138,285 134,272 134,258 C134,250 134,247 136,246 Z M264,246 C257,244 251,248 250,260 C249,274 251,284 256,288 C262,285 266,272 266,258 C266,250 266,247 264,246 Z',
    bbox: { minX: 134, minY: 244, maxX: 266, maxY: 288 },
    defaultPoints: [
      { x: 142, y: 268, doseOna: 2, depth: 'profundo', side: 'der' },
      { x: 258, y: 268, doseOna: 2, depth: 'profundo', side: 'izq' },
    ],
  },

  // ==================== REGIÓN PERIORAL Y MEJILLA ====================
  {
    id: 'buccinator',
    muscleKey: 'Buccinator',
    name: 'Buccinador',
    zone: 'perioral',
    layer: 'profundo',
    maxDoseAesthetic: 15,
    svgPath:
      'M120,262 C130,262 140,270 144,282 C142,292 132,294 122,290 C116,282 116,270 120,262 Z M280,262 C270,262 260,270 256,282 C258,292 268,294 278,290 C284,282 284,270 280,262 Z',
    bbox: { minX: 116, minY: 262, maxX: 284, maxY: 294 },
    defaultPoints: [
      { x: 130, y: 278, doseOna: 3, depth: 'profundo', side: 'der' },
      { x: 270, y: 278, doseOna: 3, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'risorius',
    muscleKey: 'Risorius',
    name: 'Risorio',
    zone: 'perioral',
    layer: 'superficial',
    maxDoseAesthetic: 4,
    svgPath:
      'M116,292 C126,288 138,290 146,295 C142,303 128,305 118,302 C114,300 114,295 116,292 Z M284,292 C274,288 262,290 254,295 C258,303 272,305 282,302 C286,300 286,295 284,292 Z',
    bbox: { minX: 114, minY: 288, maxX: 286, maxY: 305 },
    defaultPoints: [
      { x: 130, y: 296, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 270, y: 296, doseOna: 1, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'orbicularis-oris',
    muscleKey: 'Orbicularis oris',
    name: 'Orbicular de los Labios',
    zone: 'perioral',
    layer: 'superficial',
    maxDoseAesthetic: 10,
    svgPath:
      'M146,294 C146,274 170,264 200,264 C230,264 254,274 254,294 C254,314 230,324 200,324 C170,324 146,314 146,294 Z',
    bbox: { minX: 146, minY: 264, maxX: 254, maxY: 324 },
    defaultPoints: [
      { x: 176, y: 276, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 224, y: 276, doseOna: 1, depth: 'superficial', side: 'izq' },
      { x: 178, y: 314, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 222, y: 314, doseOna: 1, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'depressor-anguli-oris',
    muscleKey: 'Depressor anguli oris',
    name: 'Depresor Ángulo Boca (DAO)',
    zone: 'perioral',
    layer: 'superficial',
    maxDoseAesthetic: 10,
    svgPath:
      'M146,296 C152,302 154,322 150,342 C138,344 126,338 122,328 C126,312 136,300 146,296 Z M254,296 C248,302 246,322 250,342 C262,344 274,338 278,328 C274,312 264,300 254,296 Z',
    bbox: { minX: 122, minY: 296, maxX: 278, maxY: 344 },
    defaultPoints: [
      { x: 138, y: 324, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 262, y: 324, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'depressor-labii-inferioris',
    muscleKey: 'Depressor labii inferioris',
    name: 'Depresor Labio Inf. (DLI)',
    zone: 'perioral',
    layer: 'profundo',
    maxDoseAesthetic: 6,
    svgPath:
      'M154,316 C164,314 174,316 178,324 C178,336 172,348 162,350 C152,346 150,330 154,316 Z M246,316 C236,314 226,316 222,324 C222,336 228,348 238,350 C248,346 250,330 246,316 Z',
    bbox: { minX: 150, minY: 314, maxX: 250, maxY: 350 },
    defaultPoints: [
      { x: 165, y: 332, doseOna: 2, depth: 'profundo', side: 'der' },
      { x: 235, y: 332, doseOna: 2, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'mentalis',
    muscleKey: 'Mentalis',
    name: 'Mentoniano',
    zone: 'menton',
    layer: 'profundo',
    maxDoseAesthetic: 8,
    svgPath:
      'M178,326 C188,323 197,325 198,334 C199,348 197,360 190,364 C180,362 175,346 178,326 Z M222,326 C212,323 203,325 202,334 C201,348 203,360 210,364 C220,362 225,346 222,326 Z',
    bbox: { minX: 175, minY: 323, maxX: 225, maxY: 364 },
    defaultPoints: [
      { x: 190, y: 346, doseOna: 3, depth: 'profundo', side: 'der' },
      { x: 210, y: 346, doseOna: 3, depth: 'profundo', side: 'izq' },
    ],
  },

  // ==================== MANDÍBULA / MASTICADORES ====================
  {
    id: 'masseter',
    muscleKey: 'Masseter',
    name: 'Masetero',
    zone: 'mandibula',
    layer: 'superficial',
    maxDoseAesthetic: 50,
    svgPath:
      'M98,234 C108,232 118,244 122,266 C125,290 124,316 118,334 C108,334 100,318 96,294 C94,272 95,248 98,234 Z M302,234 C292,232 282,244 278,266 C275,290 276,316 282,334 C292,334 300,318 304,294 C306,272 305,248 302,234 Z',
    bbox: { minX: 94, minY: 232, maxX: 306, maxY: 334 },
    defaultPoints: [
      { x: 108, y: 274, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 114, y: 300, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 104, y: 316, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 292, y: 274, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 286, y: 300, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 296, y: 316, doseOna: 5, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'lateral-pterygoid',
    muscleKey: 'Lateral pterygoid',
    name: 'Pterigoideo Lateral',
    zone: 'mandibula',
    layer: 'profundo',
    maxDoseAesthetic: 15,
    svgPath:
      'M88,198 C96,194 106,198 108,208 C108,218 100,224 92,222 C86,218 85,206 88,198 Z M312,198 C304,194 294,198 292,208 C292,218 300,224 308,222 C314,218 315,206 312,198 Z',
    bbox: { minX: 85, minY: 194, maxX: 315, maxY: 224 },
    defaultPoints: [
      { x: 96, y: 210, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 304, y: 210, doseOna: 5, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'medial-pterygoid',
    muscleKey: 'Medial pterygoid',
    name: 'Pterigoideo Medial',
    zone: 'mandibula',
    layer: 'profundo',
    maxDoseAesthetic: 30,
    svgPath:
      'M106,314 C114,312 122,318 122,330 C120,342 112,346 104,342 C100,334 101,320 106,314 Z M294,314 C286,312 278,318 278,330 C280,342 288,346 296,342 C300,334 299,320 294,314 Z',
    bbox: { minX: 100, minY: 312, maxX: 300, maxY: 346 },
    defaultPoints: [
      { x: 112, y: 330, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 288, y: 330, doseOna: 5, depth: 'profundo', side: 'izq' },
    ],
  },

  // ==================== CUELLO ====================
  {
    id: 'platysma',
    muscleKey: 'Platysma',
    name: 'Platisma',
    zone: 'cuello',
    view: 'front',
    layer: 'superficial',
    maxDoseAesthetic: 30,
    svgPath:
      'M114,344 C136,356 164,364 186,366 C188,408 188,452 186,490 C156,480 108,464 68,452 C96,426 110,388 114,344 Z M286,344 C264,356 236,364 214,366 C212,408 212,452 214,490 C244,480 292,464 332,452 C304,426 290,388 286,344 Z',
    bbox: { minX: 68, minY: 344, maxX: 332, maxY: 490 },
    defaultPoints: [
      { x: 132, y: 362, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 162, y: 396, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 132, y: 420, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 158, y: 448, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 268, y: 362, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 238, y: 396, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 268, y: 420, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 242, y: 448, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },

  // ==================== VISTA POSTERIOR / PREEMPT (OCCIPITAL, PARAVERTEBRALES, TRAPECIO) ====================
  // En vista posterior: Izquierda de pantalla (X < 200) = Izquierda del paciente (side: 'izq')
  //                     Derecha de pantalla (X > 200) = Derecha del paciente (side: 'der')
  {
    id: 'occipitalis',
    muscleKey: 'Occipitalis',
    name: 'Occipital (PREEMPT)',
    zone: 'occipital',
    view: 'back',
    layer: 'superficial',
    maxDoseAesthetic: 60,
    svgPath:
      'M118,162 C136,144 172,140 194,154 C196,178 194,202 186,216 C162,220 132,212 116,196 C110,184 112,170 118,162 Z M282,162 C264,144 228,140 206,154 C204,178 206,202 214,216 C238,220 268,212 284,196 C290,184 288,170 282,162 Z',
    bbox: { minX: 112, minY: 142, maxX: 288, maxY: 220 },
    defaultPoints: [
      { x: 174, y: 196, doseOna: 5, depth: 'superficial', side: 'izq' },
      { x: 152, y: 178, doseOna: 5, depth: 'superficial', side: 'izq' },
      { x: 134, y: 194, doseOna: 5, depth: 'superficial', side: 'izq' },
      { x: 226, y: 196, doseOna: 5, depth: 'superficial', side: 'der' },
      { x: 248, y: 178, doseOna: 5, depth: 'superficial', side: 'der' },
      { x: 266, y: 194, doseOna: 5, depth: 'superficial', side: 'der' },
    ],
  },
  {
    id: 'cervical-paraspinals',
    muscleKey: 'Cervical Paraspinals',
    name: 'Paravertebrales Cervicales (PREEMPT)',
    zone: 'cuello',
    view: 'back',
    layer: 'profundo',
    maxDoseAesthetic: 40,
    svgPath:
      'M162,232 C174,226 190,228 194,240 C196,276 194,316 188,344 C174,346 162,336 160,316 C158,286 158,252 162,232 Z M238,232 C226,226 210,228 206,240 C204,276 206,316 212,344 C226,346 238,336 240,316 C242,286 242,252 238,232 Z',
    bbox: { minX: 158, minY: 226, maxX: 242, maxY: 346 },
    defaultPoints: [
      { x: 178, y: 264, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 176, y: 304, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 222, y: 264, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 224, y: 304, doseOna: 5, depth: 'profundo', side: 'der' },
    ],
  },
  {
    id: 'trapezius-facial',
    muscleKey: 'Trapezius',
    name: 'Trapecio Superior (PREEMPT)',
    zone: 'cuello',
    view: 'back',
    layer: 'superficial',
    maxDoseAesthetic: 60,
    svgPath:
      'M154,320 C168,336 186,356 194,380 C194,412 192,444 188,468 C144,456 92,442 46,424 C74,394 122,356 154,320 Z M246,320 C232,336 214,356 206,380 C206,412 208,444 212,468 C256,456 308,442 354,424 C326,394 278,356 246,320 Z',
    bbox: { minX: 46, minY: 320, maxX: 354, maxY: 468 },
    defaultPoints: [
      { x: 148, y: 374, doseOna: 5, depth: 'superficial', side: 'izq' },
      { x: 116, y: 396, doseOna: 5, depth: 'superficial', side: 'izq' },
      { x: 84, y: 416, doseOna: 5, depth: 'superficial', side: 'izq' },
      { x: 252, y: 374, doseOna: 5, depth: 'superficial', side: 'der' },
      { x: 284, y: 396, doseOna: 5, depth: 'superficial', side: 'der' },
      { x: 316, y: 416, doseOna: 5, depth: 'superficial', side: 'der' },
    ],
  },
];

export const FACIAL_MUSCLE_BY_ID = Object.fromEntries(
  FACIAL_MUSCLES.map((m) => [m.id, m])
) as Record<string, FacialMuscleConfig>;

export type ToxinBrand = 'Botox' | 'Dysport' | 'Xeomin';

export const BRAND_FACTOR: Record<ToxinBrand, number> = {
  Botox: 1,
  Xeomin: 1,
  Dysport: 2.5,
};

export const UNITS_PER_VIAL: Record<ToxinBrand, number> = {
  Botox: 100,
  Xeomin: 100,
  Dysport: 500,
};

export function mirrorX(x: number): number {
  return FACIAL_VIEWBOX.width - x;
}

export function mirrorSide(side: PointSide): PointSide {
  if (side === 'centro') return 'centro';
  return side === 'izq' ? 'der' : 'izq';
}

/** Ray-casting point-in-polygon */
export function pointInPolygon(x: number, y: number, polygon: number[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const xi = polygon[i];
    const yi = polygon[i + 1];
    const xj = polygon[j];
    const yj = polygon[j + 1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function detectRiskAt(x: number, y: number): RiskType | null {
  for (const region of DANGER_REGIONS) {
    if (pointInPolygon(x, y, region.polygon)) return region.risk;
  }
  return null;
}

export function clampToBBox(x: number, y: number, bbox: MuscleBBox): { x: number; y: number } {
  return {
    x: Math.round(Math.min(Math.max(x, bbox.minX), bbox.maxX) * 10) / 10,
    y: Math.round(Math.min(Math.max(y, bbox.minY), bbox.maxY) * 10) / 10,
  };
}

/** ¿El músculo tiene puntos laterales (no solo centro)? */
export function muscleHasLateralPoints(muscle: FacialMuscleConfig): boolean {
  return muscle.defaultPoints.some((p) => p.side !== 'centro');
}

/** Filtra plantillas de puntos según modo izq / ambos / der */
export function filterTemplatesBySideMode(
  templates: DefaultPointTemplate[],
  mode: SideMode
): DefaultPointTemplate[] {
  if (mode === 'ambos') return templates;
  if (mode === 'izq') {
    return templates.filter((t) => t.side === 'izq' || t.side === 'centro');
  }
  return templates.filter((t) => t.side === 'der' || t.side === 'centro');
}

/** Lados que aporta un modo de selección */
export function sidesForMode(mode: SideMode): PointSide[] {
  if (mode === 'ambos') return ['izq', 'der', 'centro'];
  if (mode === 'izq') return ['izq', 'centro'];
  return ['der', 'centro'];
}

/**
 * Inferir lado del PACIENTE a partir de X en el viewBox.
 * Convención radiológica (paciente de frente):
 * - x baja (izquierda de pantalla) = derecha del paciente
 * - x alta (derecha de pantalla) = izquierda del paciente
 */
export function sideFromClickX(x: number, midlineTolerance = 10): PointSide {
  const mid = FACIAL_VIEWBOX.width / 2;
  if (Math.abs(x - mid) <= midlineTolerance) return 'centro';
  return x < mid ? 'der' : 'izq';
}

/** Mitad de pantalla que corresponde al lado del paciente */
export function screenHalfForPatientSide(side: 'izq' | 'der'): 'left' | 'right' {
  return side === 'der' ? 'left' : 'right';
}

export function convertOnaToBrand(doseOna: number, brand: ToxinBrand): number {
  return Math.round(doseOna * BRAND_FACTOR[brand]);
}

export function convertBrandToOna(doseBrand: number, brand: ToxinBrand): number {
  return Math.round(doseBrand / BRAND_FACTOR[brand]);
}

export function getVolumeMl(totalUnits: number, brand: ToxinBrand, dilution: number): number {
  if (!dilution || totalUnits <= 0) return 0;
  return (totalUnits / UNITS_PER_VIAL[brand]) * dilution;
}
