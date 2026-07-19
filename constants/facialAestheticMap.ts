/**
 * Configuración del planificador facial estético: músculos, puntos por defecto,
 * zonas de riesgo y geometría SVG (viewBox 0 0 400 500).
 */

export const FACIAL_VIEWBOX = { width: 400, height: 500 } as const;

export type AestheticZone =
  | 'frente'
  | 'glabela'
  | 'periocular'
  | 'nariz'
  | 'tercioMedio'
  | 'perioral'
  | 'menton'
  | 'mandibula'
  | 'cuello';

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
  maxDoseAesthetic: number;
  svgPath: string;
  bbox: MuscleBBox;
  defaultPoints: DefaultPointTemplate[];
}

export interface DangerRegion {
  id: string;
  risk: RiskType;
  /** Flat polygon [x1,y1,x2,y2,...] in viewBox coords */
  polygon: number[];
  label: string;
}

export const RISK_MESSAGES: Record<RiskType, string> = {
  ptosisCeja: 'Riesgo alto de ptosis de ceja',
  sonrisa: 'Riesgo de compromiso de la sonrisa',
  disfagia: 'Riesgo de disfagia o disfonía',
};

export const DANGER_REGIONS: DangerRegion[] = [
  {
    id: 'orbital-rim-upper',
    risk: 'ptosisCeja',
    polygon: [108, 124, 292, 124, 292, 152, 108, 152],
    label: 'Reborde orbitario superior',
  },
  {
    id: 'zygomatic-patient-right',
    risk: 'sonrisa',
    polygon: [120, 205, 182, 205, 178, 262, 124, 256],
    label: 'Región cigomática (der. paciente)',
  },
  {
    id: 'zygomatic-patient-left',
    risk: 'sonrisa',
    polygon: [280, 205, 218, 205, 222, 262, 276, 256],
    label: 'Región cigomática (izq. paciente)',
  },
  {
    id: 'deep-neck',
    risk: 'disfagia',
    polygon: [134, 414, 266, 414, 258, 486, 142, 486],
    label: 'Cuello profundo',
  },
];

/** Contorno del cuello (capa cutánea, se dibuja detrás del rostro) */
export const NECK_OUTLINE_PATH =
  'M150,408 C146,438 148,466 156,488 L244,488 C252,466 254,438 250,408 C232,420 168,420 150,408 Z';

/** Contorno facial base (capa cutánea): frente, sienes, pómulos, mandíbula y mentón */
export const FACE_OUTLINE_PATH =
  'M200,58 C160,58 128,66 112,96 C100,120 96,158 98,196 C100,250 108,300 128,345 C146,388 168,418 200,432 C232,418 254,388 272,345 C292,300 300,250 302,196 C304,158 300,120 288,96 C272,66 240,58 200,58 Z';

export const FACE_GUIDE_PATHS = {
  midline: 'M200,60 L200,486',
  leftBrow: 'M116,134 Q150,126 186,132',
  rightBrow: 'M214,132 Q250,126 284,134',
  leftEye: 'M112,168 Q150,156 190,168 Q150,182 112,168',
  rightEye: 'M210,168 Q250,156 292,168 Q250,182 210,168',
  nose: 'M200,150 L200,232 Q200,242 190,246 Q200,250 210,246 Q200,242 200,232',
  mouth: 'M158,300 Q200,312 242,300 M164,306 Q200,318 236,306',
  foreheadWrinkles: 'M124,90 Q200,84 276,90 M128,104 Q200,98 272,104',
  glabellarLines: 'M188,150 Q192,140 194,132 M212,150 Q208,140 206,132',
  crowFeetLeft: 'M104,164 Q94,172 96,184 M104,172 Q95,180 98,190',
  crowFeetRight: 'M296,164 Q306,172 304,184 M296,172 Q305,180 302,190',
  platysmaBands: 'M160,410 Q158,445 166,478 M200,410 L200,480 M240,410 Q242,445 234,478',
};

export const FACIAL_MUSCLES: FacialMuscleConfig[] = [
  {
    id: 'frontalis',
    muscleKey: 'Frontalis',
    name: 'Frontal',
    zone: 'frente',
    maxDoseAesthetic: 20,
    svgPath:
      'M116,66 C150,60 250,60 284,66 C288,90 288,112 282,128 C256,122 236,120 214,127 C210,112 207,106 200,106 C193,106 190,112 186,127 C164,120 144,122 118,128 C112,112 112,90 116,66 Z',
    bbox: { minX: 112, minY: 60, maxX: 288, maxY: 128 },
    defaultPoints: [
      { x: 155, y: 90, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 245, y: 90, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 178, y: 112, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 222, y: 112, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'corrugator',
    muscleKey: 'Corrugator',
    name: 'Corrugador',
    zone: 'glabela',
    maxDoseAesthetic: 12,
    svgPath:
      'M164,142 C176,138 190,146 194,158 C186,164 174,164 165,157 C160,150 159,145 164,142 Z M236,142 C224,138 210,146 206,158 C214,164 226,164 235,157 C240,150 241,145 236,142 Z',
    bbox: { minX: 159, minY: 138, maxX: 241, maxY: 164 },
    defaultPoints: [
      { x: 180, y: 152, doseOna: 4, depth: 'profundo', side: 'der' },
      { x: 220, y: 152, doseOna: 4, depth: 'profundo', side: 'izq' },
      { x: 168, y: 148, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 232, y: 148, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'procerus',
    muscleKey: 'Procerus',
    name: 'Prócer',
    zone: 'glabela',
    maxDoseAesthetic: 5,
    svgPath: 'M190,150 C196,148 204,148 210,150 C211,166 208,180 200,186 C192,180 189,166 190,150 Z',
    bbox: { minX: 189, minY: 148, maxX: 211, maxY: 186 },
    defaultPoints: [{ x: 200, y: 166, doseOna: 4, depth: 'profundo', side: 'centro' }],
  },
  {
    id: 'depressor-supercilii',
    muscleKey: 'Depressor supercilii',
    name: 'Depresor de la Ceja',
    zone: 'glabela',
    maxDoseAesthetic: 8,
    svgPath:
      'M176,160 C184,158 190,166 189,176 C182,180 174,175 173,168 C172,163 173,161 176,160 Z M224,160 C216,158 210,166 211,176 C218,180 226,175 227,168 C228,163 227,161 224,160 Z',
    bbox: { minX: 172, minY: 158, maxX: 228, maxY: 180 },
    defaultPoints: [
      { x: 180, y: 168, doseOna: 2, depth: 'profundo', side: 'der' },
      { x: 220, y: 168, doseOna: 2, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'orbicularis-oculi',
    muscleKey: 'Orbicularis oculi',
    name: 'Orbicular de los Ojos',
    zone: 'periocular',
    maxDoseAesthetic: 12,
    svgPath:
      'M108,168 C108,154 128,144 150,144 C172,144 192,154 192,168 C192,182 172,192 150,192 C128,192 108,182 108,168 Z M292,168 C292,154 272,144 250,144 C228,144 208,154 208,168 C208,182 228,192 250,192 C272,192 292,182 292,168 Z',
    bbox: { minX: 108, minY: 144, maxX: 292, maxY: 192 },
    defaultPoints: [
      { x: 118, y: 170, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 138, y: 186, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 162, y: 178, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 282, y: 170, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 262, y: 186, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 238, y: 178, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'nasalis',
    muscleKey: 'Nasalis',
    name: 'Nasal',
    zone: 'nariz',
    maxDoseAesthetic: 4,
    svgPath:
      'M184,196 C190,194 195,200 196,210 C196,220 193,226 186,226 C182,220 181,208 182,200 C182,198 183,197 184,196 Z M216,196 C210,194 205,200 204,210 C204,220 207,226 214,226 C218,220 219,208 218,200 C218,198 217,197 216,196 Z',
    bbox: { minX: 181, minY: 194, maxX: 219, maxY: 226 },
    defaultPoints: [
      { x: 190, y: 208, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 210, y: 208, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'llsan',
    muscleKey: 'Levator labii superioris alaeque nasi',
    name: 'Elevador LLSAN',
    zone: 'tercioMedio',
    maxDoseAesthetic: 4,
    svgPath:
      'M176,196 C181,196 186,202 187,214 C188,234 185,250 179,255 C173,250 171,232 172,212 C172,202 173,198 176,196 Z M224,196 C219,196 214,202 213,214 C212,234 215,250 221,255 C227,250 229,232 228,212 C228,202 227,198 224,196 Z',
    bbox: { minX: 171, minY: 196, maxX: 229, maxY: 255 },
    defaultPoints: [
      { x: 180, y: 226, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 220, y: 226, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'levator-labii-superioris',
    muscleKey: 'Levator labii superioris',
    name: 'Elevador Labio Sup.',
    zone: 'tercioMedio',
    maxDoseAesthetic: 6,
    svgPath:
      'M166,222 C171,220 177,224 179,238 C181,258 179,272 173,278 C167,274 164,256 165,238 C165,228 164,225 166,222 Z M234,222 C229,220 223,224 221,238 C219,258 221,272 227,278 C233,274 236,256 235,238 C235,228 236,225 234,222 Z',
    bbox: { minX: 164, minY: 220, maxX: 236, maxY: 278 },
    defaultPoints: [
      { x: 172, y: 250, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 228, y: 250, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'zygomaticus-major',
    muscleKey: 'Zygomaticus major',
    name: 'Cigomático Mayor',
    zone: 'tercioMedio',
    maxDoseAesthetic: 6,
    svgPath:
      'M134,206 C144,204 151,211 150,222 C166,248 175,270 180,288 C173,293 163,289 157,279 C145,258 135,236 128,216 C127,210 130,207 134,206 Z M266,206 C256,204 249,211 250,222 C234,248 225,270 220,288 C227,293 237,289 243,279 C255,258 265,236 272,216 C273,210 270,207 266,206 Z',
    bbox: { minX: 127, minY: 204, maxX: 273, maxY: 293 },
    defaultPoints: [
      { x: 150, y: 240, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 250, y: 240, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'zygomaticus-minor',
    muscleKey: 'Zygomaticus minor',
    name: 'Cigomático Menor',
    zone: 'tercioMedio',
    maxDoseAesthetic: 4,
    svgPath:
      'M164,214 C170,212 175,218 175,230 C175,252 172,268 168,274 C162,270 160,252 161,232 C161,222 160,217 164,214 Z M236,214 C230,212 225,218 225,230 C225,252 228,268 232,274 C238,270 240,252 239,232 C239,222 240,217 236,214 Z',
    bbox: { minX: 160, minY: 212, maxX: 240, maxY: 274 },
    defaultPoints: [
      { x: 168, y: 244, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 232, y: 244, doseOna: 1, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'levator-anguli-oris',
    muscleKey: 'Levator anguli oris',
    name: 'Elevador Ángulo Boca',
    zone: 'tercioMedio',
    maxDoseAesthetic: 4,
    svgPath:
      'M168,250 C174,248 179,254 179,268 C179,286 176,296 170,300 C164,296 162,282 163,266 C163,256 163,252 168,250 Z M232,250 C226,248 221,254 221,268 C221,286 224,296 230,300 C236,296 238,282 237,266 C237,256 237,252 232,250 Z',
    bbox: { minX: 162, minY: 248, maxX: 238, maxY: 300 },
    defaultPoints: [
      { x: 170, y: 272, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 230, y: 272, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'orbicularis-oris',
    muscleKey: 'Orbicularis oris',
    name: 'Orbicular Labios',
    zone: 'perioral',
    maxDoseAesthetic: 10,
    svgPath:
      'M148,300 C148,287 172,280 200,280 C228,280 252,287 252,300 C252,313 228,320 200,320 C172,320 148,313 148,300 Z',
    bbox: { minX: 148, minY: 280, maxX: 252, maxY: 320 },
    defaultPoints: [
      { x: 176, y: 300, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 224, y: 300, doseOna: 1, depth: 'superficial', side: 'izq' },
      { x: 200, y: 314, doseOna: 1, depth: 'superficial', side: 'centro' },
    ],
  },
  {
    id: 'depressor-anguli-oris',
    muscleKey: 'Depressor anguli oris',
    name: 'Depresor Ángulo Boca',
    zone: 'perioral',
    maxDoseAesthetic: 10,
    svgPath:
      'M164,298 C170,297 175,303 176,313 C175,325 168,335 158,337 C152,331 150,318 153,308 C156,301 160,299 164,298 Z M236,298 C230,297 225,303 224,313 C225,325 232,335 242,337 C248,331 250,318 247,308 C244,301 240,299 236,298 Z',
    bbox: { minX: 150, minY: 297, maxX: 250, maxY: 337 },
    defaultPoints: [
      { x: 160, y: 316, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 240, y: 316, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'risorius',
    muscleKey: 'Risorius',
    name: 'Risorio',
    zone: 'perioral',
    maxDoseAesthetic: 4,
    svgPath:
      'M130,300 C142,296 156,298 168,302 C160,309 148,311 138,310 C133,309 130,305 130,300 Z M270,300 C258,296 244,298 232,302 C240,309 252,311 262,310 C267,309 270,305 270,300 Z',
    bbox: { minX: 130, minY: 296, maxX: 270, maxY: 311 },
    defaultPoints: [
      { x: 140, y: 304, doseOna: 1, depth: 'superficial', side: 'der' },
      { x: 260, y: 304, doseOna: 1, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'depressor-labii-inferioris',
    muscleKey: 'Depressor labii inferioris',
    name: 'Depresor Labio Inf.',
    zone: 'perioral',
    maxDoseAesthetic: 6,
    svgPath:
      'M180,314 C186,312 193,316 195,326 C196,338 193,347 187,349 C181,345 179,332 180,322 C180,318 179,316 180,314 Z M220,314 C214,312 207,316 205,326 C204,338 207,347 213,349 C219,345 221,332 220,322 C220,318 221,316 220,314 Z',
    bbox: { minX: 179, minY: 312, maxX: 221, maxY: 349 },
    defaultPoints: [
      { x: 186, y: 330, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 214, y: 330, doseOna: 2, depth: 'superficial', side: 'izq' },
    ],
  },
  {
    id: 'buccinator',
    muscleKey: 'Buccinator',
    name: 'Buccinador',
    zone: 'perioral',
    maxDoseAesthetic: 15,
    // Pegado al borde lateral del orbicular de los labios (bbox oris ≈ 148–252).
    // Pantalla izq = der. paciente; pantalla der = izq. paciente.
    svgPath:
      'M146,278 C158,276 168,288 168,300 C168,312 158,324 146,322 C138,312 136,296 138,286 C140,280 143,279 146,278 Z M254,278 C242,276 232,288 232,300 C232,312 242,324 254,322 C262,312 264,296 262,286 C260,280 257,279 254,278 Z',
    bbox: { minX: 136, minY: 276, maxX: 264, maxY: 324 },
    defaultPoints: [
      { x: 155, y: 300, doseOna: 3, depth: 'profundo', side: 'der' },
      { x: 245, y: 300, doseOna: 3, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'mentalis',
    muscleKey: 'Mentalis',
    name: 'Mentoniano',
    zone: 'menton',
    maxDoseAesthetic: 8,
    svgPath:
      'M186,338 C192,336 208,336 214,338 C216,352 213,367 207,373 C203,369 197,369 193,373 C187,367 184,352 186,338 Z',
    bbox: { minX: 184, minY: 336, maxX: 216, maxY: 373 },
    defaultPoints: [{ x: 200, y: 354, doseOna: 4, depth: 'profundo', side: 'centro' }],
  },
  {
    id: 'masseter',
    muscleKey: 'Masseter',
    name: 'Masetero',
    zone: 'mandibula',
    maxDoseAesthetic: 50,
    // Pegado al borde mandibular / ángulo (un poco más afuera).
    // Pantalla izq = der. paciente; pantalla der = izq. paciente.
    svgPath:
      'M100,248 C116,242 128,252 130,274 C132,304 128,334 120,356 C112,366 98,362 92,346 C88,316 92,280 98,258 C99,252 99,249 100,248 Z M300,248 C284,242 272,252 270,274 C268,304 272,334 280,356 C288,366 302,362 308,346 C312,316 308,280 302,258 C301,252 301,249 300,248 Z',
    bbox: { minX: 88, minY: 242, maxX: 312, maxY: 366 },
    defaultPoints: [
      { x: 110, y: 268, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 114, y: 302, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 106, y: 342, doseOna: 5, depth: 'profundo', side: 'der' },
      { x: 290, y: 268, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 286, y: 302, doseOna: 5, depth: 'profundo', side: 'izq' },
      { x: 294, y: 342, doseOna: 5, depth: 'profundo', side: 'izq' },
    ],
  },
  {
    id: 'platysma',
    muscleKey: 'Platysma',
    name: 'Platisma',
    zone: 'cuello',
    maxDoseAesthetic: 12,
    // Bandas cervicales más anchas y largas
    svgPath:
      'M125,388 C152,385 172,392 176,415 C178,445 174,468 166,490 C148,488 132,482 124,470 C118,448 118,415 122,396 C123,391 124,389 125,388 Z M275,388 C248,385 228,392 224,415 C222,445 226,468 234,490 C252,488 268,482 276,470 C282,448 282,415 278,396 C277,391 276,389 275,388 Z',
    bbox: { minX: 118, minY: 385, maxX: 282, maxY: 490 },
    defaultPoints: [
      { x: 142, y: 408, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 138, y: 438, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 148, y: 468, doseOna: 2, depth: 'superficial', side: 'der' },
      { x: 258, y: 408, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 262, y: 438, doseOna: 2, depth: 'superficial', side: 'izq' },
      { x: 252, y: 468, doseOna: 2, depth: 'superficial', side: 'izq' },
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
    x: Math.min(Math.max(x, bbox.minX), bbox.maxX),
    y: Math.min(Math.max(y, bbox.minY), bbox.maxY),
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
export function sideFromClickX(x: number, midlineTolerance = 16): SideMode {
  const mid = FACIAL_VIEWBOX.width / 2;
  if (Math.abs(x - mid) <= midlineTolerance) return 'ambos';
  return x < mid ? 'der' : 'izq';
}

/** Mitad de pantalla que corresponde al lado del paciente */
export function screenHalfForPatientSide(side: 'izq' | 'der'): 'left' | 'right' {
  // Paciente de frente: su derecha → izquierda de pantalla
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
