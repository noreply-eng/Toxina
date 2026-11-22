import { musclesData, type MuscleData } from '../data/muscleData';
import { guiaUsgData } from '../constants/usgData';
import type { MuscleMedia, USGView } from '../types/muscleMedia';
import type { MuscleClinicalPearl } from '../services/premiumContent';
import type {
  PdfBookConfig,
  PdfColorTheme,
  PdfLayoutMode,
  PdfPaperPreset,
  PdfSortOrder,
  ResolvedMuscleForBook,
} from '../types/pdfExport';

export type RGBTuple = [number, number, number];

export interface CategoryEditorialMeta {
  id: MuscleData['category'];
  label: string;
  chapterTitle: string;
  shortLabel: string;
  description: string;
  hex: string;
  softHex: string;
  rgb: RGBTuple;
  softRgb: RGBTuple;
}

export const CATEGORY_ORDER: MuscleData['category'][] = [
  'face',
  'neck',
  'upper-limb',
  'trunk',
  'lower-limb',
];

export const CATEGORY_META: Record<MuscleData['category'], CategoryEditorialMeta> = {
  face: {
    id: 'face',
    label: 'Cara y Cráneo',
    chapterTitle: 'CAPÍTULO I · CARA Y CRÁNEO',
    shortLabel: 'CARA',
    description: 'Músculos de la expresión facial, masticación y protocolos craneofaciales.',
    hex: '#BE185D',
    softHex: '#FDF2F8',
    rgb: [190, 24, 93],
    softRgb: [253, 242, 248],
  },
  neck: {
    id: 'neck',
    label: 'Cuello y Región Cervical',
    chapterTitle: 'CAPÍTULO II · CUELLO',
    shortLabel: 'CUELLO',
    description: 'Abordaje cervical para distonía, tortícolis espasmódica y dolor miofascial.',
    hex: '#B45309',
    softHex: '#FFFBEB',
    rgb: [180, 83, 9],
    softRgb: [255, 251, 235],
  },
  'upper-limb': {
    id: 'upper-limb',
    label: 'Miembro Superior',
    chapterTitle: 'CAPÍTULO III · MIEMBRO SUPERIOR',
    shortLabel: 'M. SUPERIOR',
    description: 'Hombro, brazo, antebrazo y mano para espasticidad y distonía focal.',
    hex: '#0369A1',
    softHex: '#F0F9FF',
    rgb: [3, 105, 161],
    softRgb: [240, 249, 255],
  },
  trunk: {
    id: 'trunk',
    label: 'Tronco y Cintura Escapular',
    chapterTitle: 'CAPÍTULO IV · TRONCO',
    shortLabel: 'TRONCO',
    description: 'Musculatura paravertebral, torácica y lumbar de soporte axial.',
    hex: '#4338CA',
    softHex: '#EEF2FF',
    rgb: [67, 56, 202],
    softRgb: [238, 242, 255],
  },
  'lower-limb': {
    id: 'lower-limb',
    label: 'Miembro Inferior',
    chapterTitle: 'CAPÍTULO V · MIEMBRO INFERIOR',
    shortLabel: 'M. INFERIOR',
    description: 'Cadera, muslo, pierna y pie en espasticidad de marcha y pie equinovaro.',
    hex: '#047857',
    softHex: '#ECFDF5',
    rgb: [4, 120, 87],
    softRgb: [236, 253, 245],
  },
};

export interface PaperPresetSpec {
  id: PdfPaperPreset;
  label: string;
  dimensionsLabel: string;
  widthMm: number;
  heightMm: number;
  recommendedFor: string;
  supportsCutSheet2Up: boolean;
}

export const PAPER_PRESETS: Record<PdfPaperPreset, PaperPresetSpec> = {
  a5: {
    id: 'a5',
    label: 'Libro A5 (Bolsillo Médico)',
    dimensionsLabel: '148 × 210 mm',
    widthMm: 148,
    heightMm: 210,
    recommendedFor: 'Ideal para manual anillado o flashcards A5 a doble cara',
    supportsCutSheet2Up: false,
  },
  'half-letter': {
    id: 'half-letter',
    label: 'Media Carta (Imprenta MX/US)',
    dimensionsLabel: '140 × 216 mm',
    widthMm: 140,
    heightMm: 216,
    recommendedFor: 'Formato estándar en imprentas comerciales de México y LATAM',
    supportsCutSheet2Up: false,
  },
  'flashcard-5x7': {
    id: 'flashcard-5x7',
    label: 'Flashcard 5×7" (Tipo Netter)',
    dimensionsLabel: '127 × 178 mm',
    widthMm: 127,
    heightMm: 178,
    recommendedFor: 'Caja de tarjetas didácticas en cartulina couché 300g',
    supportsCutSheet2Up: false,
  },
  a6: {
    id: 'a6',
    label: 'Flashcard A6 (Bata Médica)',
    dimensionsLabel: '105 × 148 mm',
    widthMm: 105,
    heightMm: 148,
    recommendedFor: 'Tarjetas ultracompactas con argolla para consulta diaria',
    supportsCutSheet2Up: false,
  },
  letter: {
    id: 'letter',
    label: 'Carta / US Letter',
    dimensionsLabel: '215.9 × 279.4 mm',
    widthMm: 215.9,
    heightMm: 279.4,
    recommendedFor: 'Atlas completo (1/pág) o Pliego cortable 2 flashcards por hoja',
    supportsCutSheet2Up: true,
  },
  a4: {
    id: 'a4',
    label: 'A4 Internacional',
    dimensionsLabel: '210 × 297 mm',
    widthMm: 210,
    heightMm: 297,
    recommendedFor: 'Atlas de escritorio (1/pág) o Pliego cortable 2 flashcards/hoja',
    supportsCutSheet2Up: true,
  },
};

export interface LayoutModeMeta {
  id: PdfLayoutMode;
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  icon: string;
  defaultPaper: PdfPaperPreset;
}

export const LAYOUT_MODES: LayoutModeMeta[] = [
  {
    id: 'duplex-flashcards',
    title: 'Libro / Flashcards Doble Cara',
    shortTitle: 'Doble Cara (Frente + Reverso)',
    badge: 'Recomendado Venta',
    description:
      '2 páginas por músculo con alineación dúplex: Anverso = Referencia Anatómica + Punto Motor; Reverso = Ecografía USG + Dosis + Precauciones.',
    icon: 'style',
    defaultPaper: 'half-letter',
  },
  {
    id: 'single-sheet',
    title: 'Atlas Completo (1 Músculo / Página)',
    shortTitle: 'Ficha Completa 1/pág',
    badge: 'Atlas de Escritorio',
    description:
      'Anatomía y Ecografía USG lado a lado en la misma página con toda la ficha clínica, dosis comparativa y referencias.',
    icon: 'article',
    defaultPaper: 'letter',
  },
  {
    id: 'cut-sheet-2up',
    title: 'Pliego Cortable 2×1 (Guillotina)',
    shortTitle: 'Pliego 2×1 con Guías',
    badge: 'Imposición Imprenta',
    description:
      '2 flashcards horizontales por hoja Carta/A4, pareadas tiro y retiro con línea de corte central para guillotina.',
    icon: 'content_cut',
    defaultPaper: 'letter',
  },
];

export interface ThemePalette {
  id: PdfColorTheme;
  label: string;
  description: string;
  coverBg: RGBTuple;
  coverText: RGBTuple;
  coverSubtext: RGBTuple;
  primary: RGBTuple;
  accent: RGBTuple;
  ink: RGBTuple;
  muted: RGBTuple;
  surface: RGBTuple;
  border: RGBTuple;
  usgFrameBg: RGBTuple;
  warningBg: RGBTuple;
  warningBorder: RGBTuple;
  warningText: RGBTuple;
  isEcoInk: boolean;
}

export const COLOR_THEMES: Record<PdfColorTheme, ThemePalette> = {
  'sonotox-editorial': {
    id: 'sonotox-editorial',
    label: 'SONOTOX Editorial (Azul + Dorado)',
    description: 'Portada azul marino de lujo, acentos dorados y pestañas por región.',
    coverBg: [11, 21, 38],
    coverText: [255, 255, 255],
    coverSubtext: [186, 206, 232],
    primary: [19, 127, 236],
    accent: [198, 155, 55],
    ink: [15, 23, 42],
    muted: [82, 102, 128],
    surface: [248, 250, 252],
    border: [216, 226, 238],
    usgFrameBg: [11, 18, 32],
    warningBg: [255, 247, 237],
    warningBorder: [234, 88, 12],
    warningText: [154, 52, 18],
    isEcoInk: false,
  },
  'medical-classic': {
    id: 'medical-classic',
    label: 'Atlas Médico Clásico (Petróleo + Cian)',
    description: 'Estética académica sobria inspirada en textos de anatomía clínica.',
    coverBg: [15, 45, 68],
    coverText: [255, 255, 255],
    coverSubtext: [186, 224, 238],
    primary: [8, 145, 178],
    accent: [14, 116, 144],
    ink: [17, 24, 39],
    muted: [75, 85, 99],
    surface: [247, 250, 252],
    border: [209, 219, 229],
    usgFrameBg: [12, 22, 34],
    warningBg: [254, 242, 242],
    warningBorder: [220, 38, 38],
    warningText: [153, 27, 27],
    isEcoInk: false,
  },
  'eco-ink': {
    id: 'eco-ink',
    label: 'Blanco Editorial (Ahorro de Tinta)',
    description: 'Fondo blanco limpio, marcos finos y máximo contraste en impresión económica.',
    coverBg: [255, 255, 255],
    coverText: [15, 23, 42],
    coverSubtext: [71, 85, 105],
    primary: [15, 23, 42],
    accent: [19, 127, 236],
    ink: [15, 23, 42],
    muted: [71, 85, 105],
    surface: [252, 253, 254],
    border: [196, 206, 218],
    usgFrameBg: [15, 23, 42],
    warningBg: [255, 251, 235],
    warningBorder: [180, 83, 9],
    warningText: [120, 53, 15],
    isEcoInk: true,
  },
};

export const DEFAULT_BOOK_CONFIG: PdfBookConfig = {
  title: 'ATLAS DE FLASHCARDS MUSCULARES',
  subtitle: 'Referencia Anatómica, Puntos Motores y Guía Ecográfica (USG) para Toxina Botulínica',
  author: 'Dr. Marcos Yocupicio',
  publisher: 'SONOTOX · DeepLuxMed Editorial',
  edition: '1.ª Edición',
  year: String(new Date().getFullYear()),
  website: 'sonotox.com',
  isbn: '',
  coverBadge: 'EDICIÓN PROFESIONAL PARA CONSULTA CLÍNICA',

  layoutMode: 'duplex-flashcards',
  paperPreset: 'half-letter',
  colorTheme: 'sonotox-editorial',
  sortOrder: 'category',
  cropMarks: true,
  bindingGutter: true,

  includeCover: true,
  includeCopyright: true,
  includeToc: true,
  includeChapterDividers: true,
  includeBackCover: true,
  includePageNumbers: true,

  includeMotorPointImage: true,
  includeUsgImage: true,
  includeMotorPointPin: true,
  includeAnatomyDetails: true,
  includeDosingTable: true,
  includeTechniqueNotes: true,
  includeUsgLandmarks: true,
  includePrecautions: true,
  includeIndications: true,
  includeClinicalPearls: true,
  includeAdminNotes: false,
  showMissingImagePlaceholder: true,
};

const STORAGE_KEY = 'sonotox_admin_pdf_book_config_v1';

export function loadSavedBookConfig(): PdfBookConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOOK_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BOOK_CONFIG, ...parsed };
  } catch {
    return DEFAULT_BOOK_CONFIG;
  }
}

export function saveBookConfig(config: PdfBookConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore quota/storage errors
  }
}

function normalizeLookupKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const FALLBACK_USG_INDEX: Record<string, string> = Object.entries(guiaUsgData).reduce(
  (acc, [key, value]) => {
    acc[normalizeLookupKey(key)] = value;
    return acc;
  },
  {} as Record<string, string>
);

export function buildResolvedMuscleCatalog(
  mediaMap: Record<string, MuscleMedia>,
  pearls: MuscleClinicalPearl[]
): ResolvedMuscleForBook[] {
  const pearlsByMuscle: Record<string, MuscleClinicalPearl[]> = {};
  pearls
    .filter((p) => p.is_published !== false)
    .forEach((p) => {
      if (!pearlsByMuscle[p.muscle_id]) pearlsByMuscle[p.muscle_id] = [];
      pearlsByMuscle[p.muscle_id].push(p);
    });

  return musclesData.map((muscle) => {
    const media = mediaMap[muscle.id] ?? null;
    const effectiveMotorImageUrl =
      media?.motor_point_image_url || muscle.motorPoint.imageUrl || null;
    const effectiveUsgImageUrl =
      media?.usg_image_url || muscle.usgGuidance?.imageUrl || null;
    const effectiveUsgView: USGView =
      (media?.usg_view as USGView) ||
      (muscle.usgGuidance?.view as USGView) ||
      'Transversal';

    const effectiveCoordinates =
      media?.motor_point_coord_x != null && media?.motor_point_coord_y != null
        ? { x: Number(media.motor_point_coord_x), y: Number(media.motor_point_coord_y) }
        : muscle.motorPoint.coordinates ?? null;

    const fallbackUsgText =
      FALLBACK_USG_INDEX[normalizeLookupKey(muscle.latinName)] ||
      FALLBACK_USG_INDEX[normalizeLookupKey(muscle.name)] ||
      null;

    const hasMotorImage = Boolean(effectiveMotorImageUrl);
    const hasUsgImage = Boolean(effectiveUsgImageUrl);

    return {
      muscle,
      media,
      pearls: pearlsByMuscle[muscle.id] ?? [],
      effectiveMotorImageUrl,
      effectiveUsgImageUrl,
      effectiveUsgView,
      effectiveCoordinates,
      fallbackUsgText,
      adminNotes: media?.notes?.trim() || null,
      hasMotorImage,
      hasUsgImage,
      isComplete: hasMotorImage && hasUsgImage,
      isCustomMedia: Boolean(media),
    };
  });
}

export function sortMusclesForBook(
  items: ResolvedMuscleForBook[],
  sortOrder: PdfSortOrder
): ResolvedMuscleForBook[] {
  const copy = [...items];
  if (sortOrder === 'alpha-es') {
    return copy.sort((a, b) =>
      a.muscle.name.localeCompare(b.muscle.name, 'es', { sensitivity: 'base' })
    );
  }
  if (sortOrder === 'alpha-latin') {
    return copy.sort((a, b) =>
      a.muscle.latinName.localeCompare(b.muscle.latinName, 'en', { sensitivity: 'base' })
    );
  }
  // By anatomical chapter order, then Spanish name
  return copy.sort((a, b) => {
    const catDiff =
      CATEGORY_ORDER.indexOf(a.muscle.category) -
      CATEGORY_ORDER.indexOf(b.muscle.category);
    if (catDiff !== 0) return catDiff;
    const regDiff = a.muscle.region.localeCompare(b.muscle.region, 'es', {
      sensitivity: 'base',
    });
    if (regDiff !== 0) return regDiff;
    return a.muscle.name.localeCompare(b.muscle.name, 'es', { sensitivity: 'base' });
  });
}

export function formatDoseRange(range?: { min: number; max: number } | null): string {
  if (!range || (range.min == null && range.max == null)) return '—';
  if (range.min === range.max) return `${range.min} U`;
  return `${range.min}-${range.max} U`;
}

export function getEffectivePaperSpec(config: PdfBookConfig): PaperPresetSpec {
  const preset = PAPER_PRESETS[config.paperPreset] || PAPER_PRESETS['half-letter'];
  if (config.layoutMode === 'cut-sheet-2up' && !preset.supportsCutSheet2Up) {
    return PAPER_PRESETS.letter;
  }
  return preset;
}

export function computeTocPageCount(
  items: ResolvedMuscleForBook[],
  config: PdfBookConfig
): number {
  if (!config.includeToc || items.length === 0) return 0;
  const spec = getEffectivePaperSpec(config);
  const twoCol = spec.widthMm >= 195;
  const rowsPerCol = spec.heightMm >= 250 ? 34 : spec.heightMm >= 195 ? 24 : 16;
  const capacity = twoCol ? rowsPerCol * 2 : rowsPerCol;
  const categoriesCount =
    config.sortOrder === 'category'
      ? new Set(items.map((i) => i.muscle.category)).size
      : 0;
  const totalSlots = items.length + categoriesCount * 2;
  return Math.max(1, Math.ceil(totalSlots / capacity));
}

export function estimateBookPages(
  items: ResolvedMuscleForBook[],
  config: PdfBookConfig
): { totalPages: number; physicalSheets: number; tocPages: number; chaptersCount: number } {
  const isDuplexAligned =
    config.layoutMode === 'duplex-flashcards' || config.layoutMode === 'cut-sheet-2up';

  let pages = 0;

  // Front matter (Cover + Copyright)
  if (config.includeCover && config.includeCopyright) {
    pages += 2;
  } else if (config.includeCover || config.includeCopyright) {
    pages += isDuplexAligned ? 2 : 1;
  }

  // Table of Contents
  const rawTocPages = computeTocPageCount(items, config);
  const tocPages =
    rawTocPages > 0 && isDuplexAligned && rawTocPages % 2 !== 0
      ? rawTocPages + 1
      : rawTocPages;
  pages += tocPages;

  // Chapters & Cards
  const chaptersCount =
    config.includeChapterDividers && config.sortOrder === 'category'
      ? new Set(items.map((i) => i.muscle.category)).size
      : 0;

  if (config.layoutMode === 'duplex-flashcards') {
    pages += chaptersCount * 2; // Front chapter opener + Back chapter index
    pages += items.length * 2; // Front anatomy + Back USG
  } else if (config.layoutMode === 'single-sheet') {
    pages += chaptersCount;
    pages += items.length;
  } else {
    // cut-sheet-2up: pairs of muscles -> 2 pages (front sheet + back sheet)
    if (config.sortOrder === 'category' && config.includeChapterDividers) {
      const grouped = new Map<MuscleData['category'], number>();
      items.forEach((it) => {
        grouped.set(it.muscle.category, (grouped.get(it.muscle.category) || 0) + 1);
      });
      pages += chaptersCount * 2;
      grouped.forEach((count) => {
        pages += Math.ceil(count / 2) * 2;
      });
    } else {
      pages += Math.ceil(items.length / 2) * 2;
    }
  }

  // Back Cover
  if (config.includeBackCover) {
    pages += isDuplexAligned ? 2 : 1;
  }

  return {
    totalPages: pages,
    physicalSheets: Math.ceil(pages / 2),
    tocPages: rawTocPages,
    chaptersCount,
  };
}
