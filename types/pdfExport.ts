import type { MuscleData } from '../data/muscleData';
import type { MuscleMedia, USGView } from './muscleMedia';
import type { MuscleClinicalPearl } from '../services/premiumContent';

export type PdfLayoutMode =
  | 'duplex-flashcards'
  | 'single-sheet'
  | 'cut-sheet-2up';

export type PdfPaperPreset =
  | 'a5'
  | 'half-letter'
  | 'flashcard-5x7'
  | 'a6'
  | 'letter'
  | 'a4';

export type PdfColorTheme =
  | 'sonotox-editorial'
  | 'medical-classic'
  | 'eco-ink';

export type PdfSortOrder = 'category' | 'alpha-es' | 'alpha-latin';

export interface PdfBookConfig {
  // Editorial & Commercial Metadata
  title: string;
  subtitle: string;
  author: string;
  publisher: string;
  edition: string;
  year: string;
  website: string;
  isbn: string;
  coverBadge: string;

  // Format & Pre-press
  layoutMode: PdfLayoutMode;
  paperPreset: PdfPaperPreset;
  colorTheme: PdfColorTheme;
  sortOrder: PdfSortOrder;
  cropMarks: boolean;
  bindingGutter: boolean;

  // Book Structure
  includeCover: boolean;
  includeCopyright: boolean;
  includeToc: boolean;
  includeChapterDividers: boolean;
  includeBackCover: boolean;
  includePageNumbers: boolean;

  // Flashcard Content
  includeMotorPointImage: boolean;
  includeUsgImage: boolean;
  includeMotorPointPin: boolean;
  includeAnatomyDetails: boolean;
  includeDosingTable: boolean;
  includeTechniqueNotes: boolean;
  includeUsgLandmarks: boolean;
  includePrecautions: boolean;
  includeIndications: boolean;
  includeClinicalPearls: boolean;
  includeAdminNotes: boolean;
  showMissingImagePlaceholder: boolean;
}

export interface ResolvedMuscleForBook {
  muscle: MuscleData;
  media: MuscleMedia | null;
  pearls: MuscleClinicalPearl[];
  effectiveMotorImageUrl: string | null;
  effectiveUsgImageUrl: string | null;
  effectiveUsgView: USGView;
  effectiveCoordinates: { x: number; y: number } | null;
  fallbackUsgText: string | null;
  adminNotes: string | null;
  hasMotorImage: boolean;
  hasUsgImage: boolean;
  isComplete: boolean;
  isCustomMedia: boolean;
}

export interface PdfExportProgress {
  phase: 'preparing' | 'loading-images' | 'rendering' | 'finalizing' | 'done';
  current: number;
  total: number;
  message: string;
}

export interface PdfImageFailure {
  muscleId: string;
  muscleName: string;
  kind: 'anatomia' | 'usg';
  url: string;
}

export interface PdfExportResult {
  fileName: string;
  totalPages: number;
  physicalSheets: number;
  muscleCount: number;
  imagesLoaded: number;
  imagesFailed: PdfImageFailure[];
}
