import type { jsPDF as JsPdfType } from 'jspdf';
import type { MuscleData } from '../data/muscleData';
import type {
  PdfBookConfig,
  PdfExportProgress,
  PdfExportResult,
  PdfImageFailure,
  ResolvedMuscleForBook,
} from '../types/pdfExport';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  COLOR_THEMES,
  computeTocPageCount,
  formatDoseRange,
  getEffectivePaperSpec,
  sortMusclesForBook,
  type RGBTuple,
  type ThemePalette,
} from './muscleBookCatalog';

interface LoadedImage {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
}

interface TocEntry {
  cardNumber: number;
  name: string;
  latinName: string;
  region: string;
  category: MuscleData['category'];
  pageNumber: number;
  hasBothImages: boolean;
}

const PEARL_TYPE_LABELS: Record<string, string> = {
  usg_tip: 'Tip USG',
  technique: 'Técnica',
  safety_warning: 'Seguridad',
  dosing_tip: 'Dosis',
  pitfall: 'Evitar',
};

/**
 * Normalize text for jsPDF Helvetica (WinAnsi / ISO-8859-1 encoding).
 * Preserves Spanish accents (áéíóúÁÉÍÓÚñÑüÜ¿¡°ºª) while converting unsupported Unicode symbols.
 */
function pdfText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/\u2014|\u2013|\u2212/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00B5|\u03BC/g, 'u')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .trim();
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mixRgb(a: RGBTuple, b: RGBTuple, weightB: number): RGBTuple {
  return [
    Math.round(a[0] * (1 - weightB) + b[0] * weightB),
    Math.round(a[1] * (1 - weightB) + b[1] * weightB),
    Math.round(a[2] * (1 - weightB) + b[2] * weightB),
  ];
}

function loadImageToCanvas(
  src: string,
  bgHex: string,
  maxDimension = 1500
): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const natW = img.naturalWidth || img.width;
        const natH = img.naturalHeight || img.height;
        if (!natW || !natH) {
          reject(new Error('Dimensiones de imagen inválidas'));
          return;
        }
        const scale = Math.min(1, maxDimension / Math.max(natW, natH));
        const w = Math.max(1, Math.round(natW * scale));
        const h = Math.max(1, Math.round(natH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar canvas 2D'));
          return;
        }
        ctx.fillStyle = bgHex;
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.91);
        resolve({ dataUrl, format: 'JPEG', width: w, height: h });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src}`));
    img.src = src;
  });
}

async function fetchImageAsset(
  url: string,
  bgHex: string,
  maxDimension = 1500
): Promise<LoadedImage> {
  // Prefer fetch -> Blob -> ObjectURL to avoid browser cache CORS mismatches
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImageToCanvas(objectUrl, bgHex, maxDimension);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // Fallback to direct Image with crossOrigin
    return await loadImageToCanvas(url, bgHex, maxDimension);
  }
}

async function loadLogoAsset(bgHex: string): Promise<LoadedImage | null> {
  try {
    const response = await fetch('/icons/icono-ultrasonido.svg');
    if (!response.ok) return null;
    const svgText = await response.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      return await loadImageToCanvas(url, bgHex, 420);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

interface PageGeometry {
  trimW: number;
  trimH: number;
  marginCrop: number; // outer space for crop marks (0 if cropMarks=false)
  pageW: number;
  pageH: number;
  ox: number; // trim origin X
  oy: number; // trim origin Y
  scale: number; // responsive typographic scale relative to A5 (148mm)
}

function buildGeometry(config: PdfBookConfig): PageGeometry {
  const spec = getEffectivePaperSpec(config);
  const marginCrop = config.cropMarks ? 8 : 0;
  return {
    trimW: spec.widthMm,
    trimH: spec.heightMm,
    marginCrop,
    pageW: spec.widthMm + marginCrop * 2,
    pageH: spec.heightMm + marginCrop * 2,
    ox: marginCrop,
    oy: marginCrop,
    scale: clamp(spec.widthMm / 148, 0.72, 1.24),
  };
}

function getContentBounds(
  geo: PageGeometry,
  config: PdfBookConfig,
  pageNumber: number
): { left: number; right: number; top: number; bottom: number; width: number; height: number } {
  const basePad = Math.round(9.5 * geo.scale * 10) / 10;
  const gutterExtra = config.bindingGutter ? 4.5 : 0;
  const isOdd = pageNumber % 2 === 1;
  const leftPad = basePad + (isOdd ? gutterExtra : 0);
  const rightPad = basePad + (!isOdd ? gutterExtra : 0);
  const topPad = Math.round(9.5 * geo.scale * 10) / 10;
  const bottomPad = Math.round(11.5 * geo.scale * 10) / 10;
  return {
    left: geo.ox + leftPad,
    right: geo.ox + geo.trimW - rightPad,
    top: geo.oy + topPad,
    bottom: geo.oy + geo.trimH - bottomPad,
    width: geo.trimW - leftPad - rightPad,
    height: geo.trimH - topPad - bottomPad,
  };
}

function drawCropMarks(doc: JsPdfType, geo: PageGeometry): void {
  if (geo.marginCrop <= 0) return;
  const { ox, oy, trimW, trimH } = geo;
  const markLen = 4.5;
  const gap = 1.8;

  doc.setDrawColor(110, 120, 134);
  doc.setLineWidth(0.18);

  // Top-left
  doc.line(ox - gap - markLen, oy, ox - gap, oy);
  doc.line(ox, oy - gap - markLen, ox, oy - gap);
  // Top-right
  doc.line(ox + trimW + gap, oy, ox + trimW + gap + markLen, oy);
  doc.line(ox + trimW, oy - gap - markLen, ox + trimW, oy - gap);
  // Bottom-left
  doc.line(ox - gap - markLen, oy + trimH, ox - gap, oy + trimH);
  doc.line(ox, oy + trimH + gap, ox, oy + trimH + gap + markLen);
  // Bottom-right
  doc.line(ox + trimW + gap, oy + trimH, ox + trimW + gap + markLen, oy + trimH);
  doc.line(ox + trimW, oy + trimH + gap, ox + trimW, oy + trimH + gap + markLen);
}

function drawFooter(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  pageNumber: number,
  leftLabel: string,
  accentRgb: RGBTuple
): void {
  const bounds = getContentBounds(geo, config, pageNumber);
  const yLine = geo.oy + geo.trimH - 8.2 * geo.scale;
  const yText = geo.oy + geo.trimH - 4.7 * geo.scale;

  doc.setDrawColor(...theme.border);
  doc.setLineWidth(0.22);
  doc.line(bounds.left, yLine, bounds.right, yLine);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4 * geo.scale);
  doc.setTextColor(...accentRgb);
  doc.text(pdfText(leftLabel).toUpperCase(), bounds.left, yText);

  if (config.includePageNumbers) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2 * geo.scale);
    doc.setTextColor(...theme.ink);
    doc.text(String(pageNumber), bounds.right, yText, { align: 'right' });
  }
}

function drawThumbTab(
  doc: JsPdfType,
  geo: PageGeometry,
  category: MuscleData['category'],
  pageNumber: number
): void {
  const meta = CATEGORY_META[category];
  const idx = CATEGORY_ORDER.indexOf(category);
  const tabH = Math.min(26, geo.trimH * 0.125);
  const tabW = 3.2;
  const topStart = geo.oy + 24 + idx * (tabH + 2.5);
  const isOdd = pageNumber % 2 === 1;
  const bleedExtra = geo.marginCrop > 0 ? 2.5 : 0;
  const x = isOdd ? geo.ox + geo.trimW - tabW : geo.ox - bleedExtra;
  const w = tabW + bleedExtra;

  doc.setFillColor(...meta.rgb);
  doc.rect(x, topStart, w, tabH, 'F');
}

function fitImageInBox(
  img: LoadedImage,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  padding = 1.5
): { rx: number; ry: number; rw: number; rh: number } {
  const availW = Math.max(4, boxW - padding * 2);
  const availH = Math.max(4, boxH - padding * 2);
  const ratio = img.width / img.height;
  let rw = availW;
  let rh = rw / ratio;
  if (rh > availH) {
    rh = availH;
    rw = rh * ratio;
  }
  const rx = boxX + (boxW - rw) / 2;
  const ry = boxY + (boxH - rh) / 2;
  return { rx, ry, rw, rh };
}

function drawMotorPointTarget(
  doc: JsPdfType,
  px: number,
  py: number,
  scale: number
): void {
  const rOuter = 3.1 * scale;
  const rInner = 1.15 * scale;
  const tick = 1.9 * scale;

  // Outer contrast white halo
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.95 * scale);
  doc.circle(px, py, rOuter, 'S');

  // Clinical crimson/cyan target ring
  doc.setDrawColor(239, 68, 68);
  doc.setLineWidth(0.55 * scale);
  doc.circle(px, py, rOuter, 'S');

  // Crosshair ticks
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.42 * scale);
  doc.line(px - rOuter - tick, py, px - rOuter * 0.45, py);
  doc.line(px + rOuter * 0.45, py, px + rOuter + tick, py);
  doc.line(px, py - rOuter - tick, px, py - rOuter * 0.45);
  doc.line(px, py + rOuter * 0.45, px, py + rOuter + tick);

  // Center filled dot
  doc.setFillColor(239, 68, 68);
  doc.circle(px, py, rInner, 'F');
  doc.setFillColor(255, 255, 255);
  doc.circle(px, py, rInner * 0.42, 'F');
}

function drawBadge(
  doc: JsPdfType,
  label: string,
  x: number,
  y: number,
  bg: RGBTuple,
  fg: RGBTuple,
  fontSize: number,
  padX = 2.4,
  padY = 1.1,
  align: 'left' | 'right' = 'left'
): number {
  const clean = pdfText(label);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  const tw = doc.getTextWidth(clean);
  const w = tw + padX * 2;
  const h = fontSize * 0.3528 + padY * 2;
  const rx = align === 'right' ? x - w : x;
  doc.setFillColor(...bg);
  doc.roundedRect(rx, y, w, h, 1.3, 1.3, 'F');
  doc.setTextColor(...fg);
  doc.text(clean, rx + padX, y + h - padY - 0.35);
  return w;
}

function drawClampedParagraph(
  doc: JsPdfType,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const clean = pdfText(text);
  if (!clean) return y;
  const lines = doc.splitTextToSize(clean, maxWidth) as string[];
  const clipped = lines.slice(0, maxLines);
  if (lines.length > maxLines && clipped.length > 0) {
    const last = clipped[clipped.length - 1];
    clipped[clipped.length - 1] =
      last.length > 4 ? `${last.slice(0, Math.max(1, last.length - 3)).trim()}...` : `${last}...`;
  }
  doc.text(clipped, x, y);
  return y + clipped.length * lineHeight;
}

function drawPlaceholderFrame(
  doc: JsPdfType,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  dark: boolean,
  scale: number
): void {
  if (dark) {
    doc.setFillColor(17, 25, 40);
    doc.setDrawColor(56, 72, 98);
  } else {
    doc.setFillColor(246, 249, 252);
    doc.setDrawColor(203, 213, 225);
  }
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, 'FD');

  // Subtle inner dashed frame
  doc.setLineDashPattern([1.6, 1.6], 0);
  doc.setDrawColor(dark ? 74 : 185, dark ? 92 : 198, dark ? 118 : 212);
  doc.roundedRect(x + 2.5, y + 2.5, w - 5, h - 5, 1.5, 1.5, 'S');
  doc.setLineDashPattern([], 0);

  const cx = x + w / 2;
  const cy = y + h / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8 * scale);
  doc.setTextColor(dark ? 186 : 71, dark ? 202 : 85, dark ? 224 : 105);
  doc.text(pdfText(title), cx, cy - 1.5 * scale, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5 * scale);
  doc.setTextColor(dark ? 128 : 130, dark ? 148 : 144, dark ? 172 : 162);
  doc.text(pdfText(subtitle), cx, cy + 3.2 * scale, { align: 'center', maxWidth: w - 12 });
}

function renderCoverPage(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  muscleCount: number,
  logo: LoadedImage | null
): void {
  const { ox, oy, trimW, trimH, marginCrop, scale } = geo;
  const bleed = marginCrop > 0 ? 3 : 0;

  // Full bleed background
  doc.setFillColor(...theme.coverBg);
  doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, trimH + bleed * 2, 'F');

  // Decorative acoustic ultrasound arcs (subtle vector art)
  const arcColor = theme.isEcoInk
    ? mixRgb(theme.primary, [255, 255, 255], 0.88)
    : mixRgb(theme.primary, theme.coverBg, 0.72);
  doc.setDrawColor(...arcColor);
  doc.setLineWidth(0.45);
  const cx = ox + trimW * 0.85;
  const cy = oy + trimH * 0.22;
  [18, 30, 44, 60, 78].forEach((r) => {
    doc.circle(cx, cy, r * scale, 'S');
  });

  // Left vertical editorial spine accent bar
  doc.setFillColor(...theme.accent);
  doc.rect(ox - bleed, oy - bleed, 4.5 + bleed, trimH + bleed * 2, 'F');

  // Regional 5-color spectrum bar at top
  const barY = oy + 12 * scale;
  const contentX = ox + 14 * scale;
  const contentW = trimW - 24 * scale;
  const segW = contentW / CATEGORY_ORDER.length;
  CATEGORY_ORDER.forEach((cat, idx) => {
    doc.setFillColor(...CATEGORY_META[cat].rgb);
    doc.rect(contentX + idx * segW, barY, segW - 0.8, 1.8, 'F');
  });

  // Publisher & Cover badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5 * scale);
  doc.setTextColor(...theme.accent);
  doc.text(pdfText(config.publisher || 'SONOTOX EDITORIAL').toUpperCase(), contentX, barY + 8 * scale);

  if (config.coverBadge.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5 * scale);
    doc.setTextColor(...theme.coverSubtext);
    doc.text(pdfText(config.coverBadge).toUpperCase(), contentX, barY + 13 * scale);
  }

  // Logo emblem
  let cursorY = oy + trimH * 0.22;
  if (logo) {
    const logoH = 22 * scale;
    const logoW = logoH * (logo.width / logo.height);
    doc.addImage(logo.dataUrl, logo.format, contentX, cursorY, logoW, logoH, undefined, 'FAST');
    cursorY += logoH + 10 * scale;
  } else {
    cursorY += 8 * scale;
  }

  // Main Book Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22 * scale);
  doc.setTextColor(...theme.coverText);
  const titleLines = doc.splitTextToSize(pdfText(config.title).toUpperCase(), contentW) as string[];
  doc.text(titleLines, contentX, cursorY);
  cursorY += titleLines.length * (9.2 * scale) + 4 * scale;

  // Golden / Accent rule
  doc.setFillColor(...theme.accent);
  doc.rect(contentX, cursorY, 32 * scale, 1.2, 'F');
  cursorY += 8 * scale;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5 * scale);
  doc.setTextColor(...theme.coverSubtext);
  const subLines = doc.splitTextToSize(pdfText(config.subtitle), contentW) as string[];
  doc.text(subLines, contentX, cursorY);
  cursorY += subLines.length * (5.2 * scale) + 10 * scale;

  // Key spec highlights pills
  const pillBg = theme.isEcoInk
    ? ([241, 245, 249] as RGBTuple)
    : mixRgb(theme.primary, theme.coverBg, 0.72);
  const pillFg = theme.isEcoInk ? theme.ink : ([255, 255, 255] as RGBTuple);
  const specText = `${muscleCount} FICHAS MUSCULARES  ·  ANATOMÍA + ECOGRAFÍA USG  ·  DOSIFICACIÓN`;
  drawBadge(doc, specText, contentX, cursorY, pillBg, pillFg, 6.4 * scale, 3.2, 1.8);

  // Bottom Author & Edition Band
  const footerTop = oy + trimH - 36 * scale;
  doc.setDrawColor(...(theme.isEcoInk ? theme.border : mixRgb(theme.coverText, theme.coverBg, 0.78)));
  doc.setLineWidth(0.3);
  doc.line(contentX, footerTop, contentX + contentW, footerTop);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5 * scale);
  doc.setTextColor(...theme.coverText);
  doc.text(pdfText(config.author), contentX, footerTop + 9 * scale);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2 * scale);
  doc.setTextColor(...theme.coverSubtext);
  const editionLine = [config.edition, config.year, config.website].filter(Boolean).join('  ·  ');
  doc.text(pdfText(editionLine), contentX, footerTop + 15.5 * scale);

  if (config.isbn.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2 * scale);
    doc.setTextColor(...theme.accent);
    doc.text(pdfText(`ISBN: ${config.isbn}`), contentX, footerTop + 21.5 * scale);
  }

  drawCropMarks(doc, geo);
}

function renderCopyrightAndLegendPage(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  pageNumber: number
): void {
  const bounds = getContentBounds(geo, config, pageNumber);
  const { scale } = geo;
  let y = bounds.top + 4 * scale;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11 * scale);
  doc.setTextColor(...theme.ink);
  doc.text(pdfText(config.title), bounds.left, y);
  y += 5 * scale;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8 * scale);
  doc.setTextColor(...theme.muted);
  y = drawClampedParagraph(doc, config.subtitle, bounds.left, y, bounds.width, 3.8 * scale, 2) + 4 * scale;

  // Credits & Legal box
  doc.setFillColor(...theme.surface);
  doc.setDrawColor(...theme.border);
  doc.setLineWidth(0.25);
  const legalBoxH = 44 * scale;
  doc.roundedRect(bounds.left, y, bounds.width, legalBoxH, 2, 2, 'FD');

  let ly = y + 6 * scale;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4 * scale);
  doc.setTextColor(...theme.ink);
  doc.text(pdfText(`Dirección Médica y Autoría: ${config.author}`), bounds.left + 4, ly);
  ly += 4.5 * scale;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7 * scale);
  doc.setTextColor(...theme.muted);
  doc.text(
    pdfText(`Editorial: ${config.publisher}  ·  ${config.edition} (${config.year})`),
    bounds.left + 4,
    ly
  );
  ly += 4.5 * scale;
  if (config.isbn.trim()) {
    doc.text(pdfText(`ISBN: ${config.isbn}  ·  ${config.website}`), bounds.left + 4, ly);
  } else {
    doc.text(pdfText(`Plataforma Digital Complementaria: ${config.website}`), bounds.left + 4, ly);
  }
  ly += 5.5 * scale;
  doc.setFontSize(6.5 * scale);
  const copyrightText = `© ${config.year} ${config.author} / ${config.publisher}. Todos los derechos reservados. Queda prohibida la reproducción total o parcial de esta obra, sus esquemas anatómicos y capturas ecográficas sin autorización escrita del titular.`;
  ly = drawClampedParagraph(doc, copyrightText, bounds.left + 4, ly, bounds.width - 8, 3.1 * scale, 4);
  ly += 2 * scale;
  const disclaimerText =
    'AVISO CLÍNICO: Material de referencia dirigido exclusivamente a profesionales de la salud capacitados. Las dosis de toxina botulínica tipo A (Botox®, Dysport®, Xeomin®) son rangos orientativos y no son intercambiables 1:1. La dosis final, dilución y técnica son responsabilidad exclusiva del médico tratante.';
  drawClampedParagraph(doc, disclaimerText, bounds.left + 4, ly, bounds.width - 8, 3.1 * scale, 4);

  y += legalBoxH + 8 * scale;

  // How to read these flashcards
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5 * scale);
  doc.setTextColor(...theme.primary);
  doc.text('CÓMO UTILIZAR ESTE ATLAS DE FLASHCARDS', bounds.left, y);
  y += 5.5 * scale;

  const steps = [
    [
      '1. Anverso (Referencia Anatómica)',
      'Identifica el músculo por nombre en español, nómina latina, imagen anatómica de punto motor, origen, inserción, inervación y función primaria.',
    ],
    [
      '2. Reverso (Guía Ecográfica USG)',
      'Consulta la ventana ecográfica (Transversal / Longitudinal), transductor sugerido, puntos de referencia sonoanatómicos y precauciones vasculonerviosas.',
    ],
    [
      '3. Marcador de Punto Motor (Mira roja)',
      'Sobre la ecografía, el blanco de precisión señala el punto motor objetivo para infiltración intramuscular segura.',
    ],
    [
      '4. Tabla de Dosificación Comparativa',
      'Compara rangos clínicos orientativos en unidades para Botox®, Dysport® y Xeomin® según literatura y práctica clínica.',
    ],
  ];

  steps.forEach(([heading, desc]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4 * scale);
    doc.setTextColor(...theme.ink);
    doc.text(pdfText(heading), bounds.left, y);
    y += 3.6 * scale;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8 * scale);
    doc.setTextColor(...theme.muted);
    y = drawClampedParagraph(doc, desc, bounds.left + 2, y, bounds.width - 2, 3.2 * scale, 3) + 2.8 * scale;
  });

  // Regional Color Code Index
  y += 3 * scale;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2 * scale);
  doc.setTextColor(...theme.ink);
  doc.text('CÓDIGO DE COLOR POR REGIÓN ANATÓMICA', bounds.left, y);
  y += 4.5 * scale;

  CATEGORY_ORDER.forEach((cat) => {
    const meta = CATEGORY_META[cat];
    if (y > bounds.bottom - 10) return;
    doc.setFillColor(...meta.rgb);
    doc.roundedRect(bounds.left, y - 2.6 * scale, 3.2 * scale, 3.2 * scale, 0.6, 0.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7 * scale);
    doc.setTextColor(...theme.ink);
    const catLabelClean = pdfText(meta.label);
    const catLabelW = doc.getTextWidth(catLabelClean);
    doc.text(catLabelClean, bounds.left + 5 * scale, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4 * scale);
    doc.setTextColor(...theme.muted);
    const descX = bounds.left + 5 * scale + catLabelW + 1.5;
    doc.text(pdfText(`- ${meta.description}`), descX, y, {
      maxWidth: Math.max(20, bounds.right - descX),
    });
    y += 4.6 * scale;
  });

  drawFooter(doc, geo, config, theme, pageNumber, `${config.publisher} · Créditos y Guía`, theme.muted);
  drawCropMarks(doc, geo);
}

function renderBlankNotesPage(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  pageNumber: number,
  heading = 'NOTAS CLÍNICAS DEL ESPECIALISTA'
): void {
  const bounds = getContentBounds(geo, config, pageNumber);
  const { scale } = geo;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9 * scale);
  doc.setTextColor(...theme.muted);
  doc.text(pdfText(heading), bounds.left, bounds.top + 6 * scale);

  doc.setDrawColor(...theme.border);
  doc.setLineWidth(0.2);
  let y = bounds.top + 16 * scale;
  while (y < bounds.bottom - 8) {
    doc.line(bounds.left, y, bounds.right, y);
    y += 7.5 * scale;
  }

  drawFooter(doc, geo, config, theme, pageNumber, config.title, theme.muted);
  drawCropMarks(doc, geo);
}

function renderChapterDividerFront(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  category: MuscleData['category'],
  chapterNumber: number,
  musclesInChapter: ResolvedMuscleForBook[],
  pageNumber: number
): void {
  const meta = CATEGORY_META[category];
  const { ox, oy, trimW, trimH, marginCrop, scale } = geo;
  const bleed = marginCrop > 0 ? 3 : 0;
  const bounds = getContentBounds(geo, config, pageNumber);

  // Subtle regional soft header band
  if (!theme.isEcoInk) {
    doc.setFillColor(...meta.softRgb);
    doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, trimH * 0.44 + bleed, 'F');
  }

  // Strong top regional strip
  doc.setFillColor(...meta.rgb);
  doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, 5.5 + bleed, 'F');

  const topY = oy + trimH * 0.16;
  drawBadge(
    doc,
    `CAPÍTULO ${String(chapterNumber).padStart(2, '0')}`,
    bounds.left,
    topY,
    meta.rgb,
    [255, 255, 255],
    8 * scale,
    3.5,
    1.8
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22 * scale);
  doc.setTextColor(...theme.ink);
  const catLines = doc.splitTextToSize(pdfText(meta.label).toUpperCase(), bounds.width) as string[];
  doc.text(catLines, bounds.left, topY + 16 * scale);

  const descY = topY + 16 * scale + catLines.length * (9 * scale) + 2 * scale;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5 * scale);
  doc.setTextColor(...theme.muted);
  drawClampedParagraph(doc, meta.description, bounds.left, descY, bounds.width, 4.6 * scale, 3);

  // Stats pill
  const completeCount = musclesInChapter.filter((m) => m.isComplete).length;
  const statY = oy + trimH * 0.48;
  doc.setFillColor(...theme.surface);
  doc.setDrawColor(...meta.rgb);
  doc.setLineWidth(0.45);
  doc.roundedRect(bounds.left, statY, bounds.width, 13 * scale, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2 * scale);
  doc.setTextColor(...meta.rgb);
  doc.text(
    pdfText(
      `${musclesInChapter.length} MÚSCULOS EN ESTE CAPÍTULO  ·  ${completeCount} CON ANATOMÍA + USG`
    ),
    bounds.left + bounds.width / 2,
    statY + 8 * scale,
    { align: 'center' }
  );

  // Quick muscle roster list (2 columns)
  let listY = statY + 21 * scale;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5 * scale);
  doc.setTextColor(...theme.ink);
  doc.text('MÚSCULOS INCLUIDOS', bounds.left, listY);
  listY += 5 * scale;

  const colGap = 6;
  const colW = (bounds.width - colGap) / 2;
  const maxRows = Math.floor((bounds.bottom - listY - 6) / (4.3 * scale));
  const shown = musclesInChapter.slice(0, maxRows * 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8 * scale);
  doc.setTextColor(...theme.muted);
  shown.forEach((item, idx) => {
    const col = idx < maxRows ? 0 : 1;
    const row = idx < maxRows ? idx : idx - maxRows;
    const x = bounds.left + col * (colW + colGap);
    const y = listY + row * (4.3 * scale);
    doc.text(pdfText(`- ${item.muscle.name}`), x, y, { maxWidth: colW });
  });

  if (musclesInChapter.length > shown.length) {
    doc.setFont('helvetica', 'italic');
    doc.text(
      pdfText(`... y ${musclesInChapter.length - shown.length} músculos adicionales en este capítulo.`),
      bounds.left,
      bounds.bottom - 2
    );
  }

  drawThumbTab(doc, geo, category, pageNumber);
  drawFooter(doc, geo, config, theme, pageNumber, meta.chapterTitle, meta.rgb);
  drawCropMarks(doc, geo);
}

function renderTableOfContentsPages(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  tocStartPage: number,
  tocAllocatedPages: number,
  entries: TocEntry[]
): void {
  const { scale } = geo;
  const twoCol = geo.trimW >= 195;

  // Build flat render rows (category headings + entries)
  type TocRow =
    | { kind: 'category'; label: string; rgb: RGBTuple }
    | { kind: 'entry'; entry: TocEntry };

  const rows: TocRow[] = [];
  let lastCat: MuscleData['category'] | null = null;
  entries.forEach((entry) => {
    if (config.sortOrder === 'category' && entry.category !== lastCat) {
      lastCat = entry.category;
      const meta = CATEGORY_META[entry.category];
      rows.push({ kind: 'category', label: meta.label.toUpperCase(), rgb: meta.rgb });
    }
    rows.push({ kind: 'entry', entry });
  });

  let rowIdx = 0;
  for (let p = 0; p < tocAllocatedPages; p++) {
    const pageNum = tocStartPage + p;
    doc.setPage(pageNum);
    const bounds = getContentBounds(geo, config, pageNum);

    if (rowIdx >= rows.length) {
      // Extra parity page in duplex mode
      renderBlankNotesPage(doc, geo, config, theme, pageNum, 'NOTAS Y ABREVIATURAS CLÍNICAS');
      continue;
    }

    let headerY = bounds.top + 4 * scale;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13 * scale);
    doc.setTextColor(...theme.ink);
    doc.text(p === 0 ? 'ÍNDICE GENERAL DE MÚSCULOS' : 'ÍNDICE GENERAL (CONT.)', bounds.left, headerY);

    doc.setFillColor(...theme.primary);
    doc.rect(bounds.left, headerY + 2.2 * scale, 22 * scale, 0.9, 'F');

    const startY = headerY + 9 * scale;
    const rowStep = 4.9 * scale;
    const cols = twoCol ? 2 : 1;
    const colGap = 8;
    const colW = cols === 2 ? (bounds.width - colGap) / 2 : bounds.width;

    for (let c = 0; c < cols; c++) {
      let y = startY;
      const x = bounds.left + c * (colW + colGap);

      while (rowIdx < rows.length && y <= bounds.bottom - 5) {
        const row = rows[rowIdx];
        if (row.kind === 'category') {
          if (y > startY + 2) y += 2.2 * scale;
          if (y > bounds.bottom - 10) break;
          doc.setFillColor(...row.rgb);
          doc.rect(x, y - 2.6 * scale, 2, 3.2 * scale, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.4 * scale);
          doc.setTextColor(...row.rgb);
          doc.text(pdfText(row.label), x + 3.5, y);
          y += rowStep * 0.95;
          rowIdx++;
        } else {
          const e = row.entry;
          const numPrefix = `${String(e.cardNumber).padStart(2, '0')}. `;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.1 * scale);
          doc.setTextColor(...theme.ink);
          const nameLabel = pdfText(`${numPrefix}${e.name}`);
          const pageStr = String(e.pageNumber);
          const pageW = doc.getTextWidth(pageStr);
          const maxNameW = colW - pageW - 8;
          let displayText = nameLabel;
          if (doc.getTextWidth(displayText) > maxNameW) {
            while (displayText.length > 6 && doc.getTextWidth(`${displayText}...`) > maxNameW) {
              displayText = displayText.slice(0, -1);
            }
            displayText = `${displayText.trim()}...`;
          }
          doc.text(displayText, x, y);

          // Dotted leader
          const nameEndX = x + doc.getTextWidth(displayText) + 1.5;
          const pageStartX = x + colW - pageW - 1.5;
          if (pageStartX > nameEndX + 3) {
            doc.setDrawColor(...theme.border);
            doc.setLineDashPattern([0.4, 1.2], 0);
            doc.setLineWidth(0.2);
            doc.line(nameEndX, y - 0.5, pageStartX, y - 0.5);
            doc.setLineDashPattern([], 0);
          }

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...theme.primary);
          doc.text(pageStr, x + colW, y, { align: 'right' });
          y += rowStep;
          rowIdx++;
        }
      }
    }

    drawFooter(doc, geo, config, theme, pageNum, `${config.title} · Índice`, theme.primary);
    drawCropMarks(doc, geo);
  }
}

/**
 * DUPLEX FLASHCARD — FRONT (ANVERSO: REFERENCIA ANATÓMICA Y PUNTO MOTOR)
 */
function renderDuplexFront(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  item: ResolvedMuscleForBook,
  cardNumber: number,
  pageNumber: number,
  motorImg: LoadedImage | null
): void {
  const { muscle } = item;
  const meta = CATEGORY_META[muscle.category];
  const { ox, oy, trimW, marginCrop, scale } = geo;
  const bleed = marginCrop > 0 ? 3 : 0;
  const bounds = getContentBounds(geo, config, pageNumber);

  // Top regional accent strip
  doc.setFillColor(...meta.rgb);
  doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, 4.2 + bleed, 'F');

  let y = bounds.top + 1.5 * scale;

  // Header metadata row: Card # + Category pill + Side tag
  const cardBadgeW = drawBadge(
    doc,
    `#${String(cardNumber).padStart(2, '0')}`,
    bounds.left,
    y,
    meta.rgb,
    [255, 255, 255],
    7.2 * scale,
    2.4,
    1.2
  );
  drawBadge(
    doc,
    `${meta.shortLabel} · ${muscle.region.toUpperCase()}`,
    bounds.left + cardBadgeW + 2,
    y,
    theme.isEcoInk ? theme.surface : meta.softRgb,
    meta.rgb,
    6.4 * scale,
    2.2,
    1.2
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2 * scale);
  doc.setTextColor(...theme.muted);
  doc.text('ANVERSO · ANATOMÍA', bounds.right, y + 3.2 * scale, { align: 'right' });

  y += 8.8 * scale;

  // Muscle Name (Spanish) & Latin Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5 * scale);
  doc.setTextColor(...theme.ink);
  const nameLines = doc.splitTextToSize(pdfText(muscle.name), bounds.width) as string[];
  doc.text(nameLines.slice(0, 2), bounds.left, y);
  y += Math.min(2, nameLines.length) * (5.8 * scale);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.8 * scale);
  doc.setTextColor(...meta.rgb);
  doc.text(pdfText(muscle.latinName), bounds.left, y);
  y += 4.2 * scale;

  // Anatomical / Motor Point Illustration Frame
  const footerReserve = 12 * scale;
  const anatomyBoxReserve = config.includeAnatomyDetails ? 53 * scale : 18 * scale;
  const maxImgH = Math.max(36 * scale, bounds.bottom - footerReserve - anatomyBoxReserve - y);
  const imgBoxH = Math.min(bounds.height * 0.44, maxImgH);

  if (config.includeMotorPointImage) {
    if (motorImg) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...theme.border);
      doc.setLineWidth(0.35);
      doc.roundedRect(bounds.left, y, bounds.width, imgBoxH, 2.2, 2.2, 'FD');

      const { rx, ry, rw, rh } = fitImageInBox(motorImg, bounds.left, y, bounds.width, imgBoxH, 1.8);
      doc.addImage(motorImg.dataUrl, motorImg.format, rx, ry, rw, rh, undefined, 'FAST');

      drawBadge(
        doc,
        'REFERENCIA ANATÓMICA · PUNTO MOTOR',
        bounds.left + 2.2,
        y + 2.2,
        [15, 23, 42],
        [255, 255, 255],
        5.5 * scale,
        2,
        0.9
      );
      y += imgBoxH + 3.5 * scale;
    } else if (config.showMissingImagePlaceholder) {
      drawPlaceholderFrame(
        doc,
        bounds.left,
        y,
        bounds.width,
        imgBoxH,
        'REFERENCIA ANATÓMICA / PUNTO MOTOR',
        'Pendiente de subir imagen anatómica en Admin -> Gestión de Medios',
        false,
        scale
      );
      y += imgBoxH + 3.5 * scale;
    }
  }

  // Motor Point Landmark Callout
  const mpBoxH = 14.5 * scale;
  if (y + mpBoxH < bounds.bottom - 8) {
    doc.setFillColor(...(theme.isEcoInk ? theme.surface : meta.softRgb));
    doc.setDrawColor(...meta.rgb);
    doc.setLineWidth(0.3);
    doc.roundedRect(bounds.left, y, bounds.width, mpBoxH, 1.8, 1.8, 'FD');
    doc.setFillColor(...meta.rgb);
    doc.rect(bounds.left, y, 1.8, mpBoxH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5 * scale);
    doc.setTextColor(...meta.rgb);
    doc.text('LOCALIZACIÓN DEL PUNTO MOTOR', bounds.left + 4, y + 4 * scale);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1 * scale);
    doc.setTextColor(...theme.ink);
    drawClampedParagraph(
      doc,
      muscle.motorPoint.description,
      bounds.left + 4,
      y + 8 * scale,
      bounds.width - 7,
      3.2 * scale,
      2
    );
    y += mpBoxH + 3.5 * scale;
  }

  // Anatomy 2x2 Grid (Origen, Inserción, Inervación, Función)
  if (config.includeAnatomyDetails && y < bounds.bottom - 16) {
    const availH = bounds.bottom - y - 2;
    const cellGap = 2.6;
    const colW = (bounds.width - cellGap) / 2;
    const rowH = Math.min(20 * scale, (availH - cellGap) / 2);

    const cells = [
      { title: 'ORIGEN', text: muscle.anatomy.origin },
      { title: 'INSERCIÓN', text: muscle.anatomy.insertion },
      { title: 'INERVACIÓN', text: muscle.anatomy.innervation },
      { title: 'FUNCIÓN PRIMARIA', text: muscle.anatomy.function },
    ];

    cells.forEach((cell, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = bounds.left + col * (colW + cellGap);
      const cy = y + row * (rowH + cellGap);
      if (cy + rowH > bounds.bottom + 1) return;

      doc.setFillColor(...theme.surface);
      doc.setDrawColor(...theme.border);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, cy, colW, rowH, 1.6, 1.6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2 * scale);
      doc.setTextColor(...meta.rgb);
      doc.text(cell.title, cx + 2.8, cy + 4 * scale);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8 * scale);
      doc.setTextColor(...theme.ink);
      const maxL = Math.max(2, Math.floor((rowH - 6 * scale) / (3.05 * scale)));
      drawClampedParagraph(doc, cell.text, cx + 2.8, cy + 7.7 * scale, colW - 5.2, 3.05 * scale, maxL);
    });
  }

  drawThumbTab(doc, geo, muscle.category, pageNumber);
  drawFooter(doc, geo, config, theme, pageNumber, `${config.title} · #${String(cardNumber).padStart(2, '0')} ${muscle.name}`, meta.rgb);
  drawCropMarks(doc, geo);
}

/**
 * DUPLEX FLASHCARD — BACK (REVERSO: GUÍA ECOGRÁFICA USG, DOSIS Y PRECAUCIONES)
 */
function renderDuplexBack(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  item: ResolvedMuscleForBook,
  cardNumber: number,
  pageNumber: number,
  usgImg: LoadedImage | null
): void {
  const { muscle } = item;
  const meta = CATEGORY_META[muscle.category];
  const { ox, oy, trimW, marginCrop, scale } = geo;
  const bleed = marginCrop > 0 ? 3 : 0;
  const bounds = getContentBounds(geo, config, pageNumber);

  // Top regional accent strip
  doc.setFillColor(...meta.rgb);
  doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, 4.2 + bleed, 'F');

  let y = bounds.top + 1.5 * scale;

  // Compact header echoing muscle identity
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5 * scale);
  doc.setTextColor(...theme.ink);
  doc.text(pdfText(`#${String(cardNumber).padStart(2, '0')}  ${muscle.name}`), bounds.left, y + 3.2 * scale, {
    maxWidth: bounds.width * 0.68,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2 * scale);
  doc.setTextColor(...meta.rgb);
  doc.text('REVERSO · GUÍA USG', bounds.right, y + 2.8 * scale, { align: 'right' });

  y += 6.2 * scale;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.4 * scale);
  doc.setTextColor(...theme.muted);
  const transducerText = muscle.usgGuidance
    ? `${muscle.latinName}  ·  ${muscle.usgGuidance.transducerType}  ·  ${muscle.usgGuidance.approach}`
    : `${muscle.latinName}  ·  Vista ${item.effectiveUsgView}`;
  doc.text(pdfText(transducerText), bounds.left, y, { maxWidth: bounds.width });
  y += 3.2 * scale;

  // USG Image Frame (dark clinical canvas so ultrasound scans look crisp)
  if (config.includeUsgImage) {
    const usgH = Math.min(bounds.height * 0.37, 64 * scale);
    if (usgImg) {
      doc.setFillColor(...theme.usgFrameBg);
      doc.setDrawColor(...theme.border);
      doc.setLineWidth(0.35);
      doc.roundedRect(bounds.left, y, bounds.width, usgH, 2.2, 2.2, 'FD');

      const { rx, ry, rw, rh } = fitImageInBox(usgImg, bounds.left, y, bounds.width, usgH, 1.5);
      doc.addImage(usgImg.dataUrl, usgImg.format, rx, ry, rw, rh, undefined, 'FAST');

      // Vector precision target pin on exact motor point coordinates
      if (config.includeMotorPointPin && item.effectiveCoordinates) {
        const px = rx + (rw * item.effectiveCoordinates.x) / 100;
        const py = ry + (rh * item.effectiveCoordinates.y) / 100;
        drawMotorPointTarget(doc, px, py, scale * 0.92);
      }

      // Top-left USG view badge
      drawBadge(
        doc,
        `USG · ${item.effectiveUsgView.toUpperCase()}`,
        bounds.left + 2.2,
        y + 2.2,
        [19, 127, 236],
        [255, 255, 255],
        5.6 * scale,
        2,
        0.9
      );

      if (config.includeMotorPointPin && item.effectiveCoordinates) {
        drawBadge(
          doc,
          'PUNTO MOTOR',
          bounds.right - 2.2,
          y + 2.2,
          [220, 38, 38],
          [255, 255, 255],
          5.2 * scale,
          1.8,
          0.9,
          'right'
        );
      }

      y += usgH + 3 * scale;
    } else if (config.showMissingImagePlaceholder) {
      drawPlaceholderFrame(
        doc,
        bounds.left,
        y,
        bounds.width,
        usgH,
        `ECOGRAFÍA (USG) · VISTA ${item.effectiveUsgView.toUpperCase()}`,
        'Pendiente de subir captura ecográfica en Admin -> Gestión de Medios',
        true,
        scale
      );
      y += usgH + 3 * scale;
    }
  }

  // Comparative Dosing Bar (Botox / Dysport / Xeomin)
  if (config.includeDosingTable && y < bounds.bottom - 18) {
    const doseH = 12.5 * scale;
    const colW = bounds.width / 3;
    doc.setFillColor(...theme.surface);
    doc.setDrawColor(...theme.border);
    doc.setLineWidth(0.28);
    doc.roundedRect(bounds.left, y, bounds.width, doseH, 1.8, 1.8, 'FD');

    const brands = [
      { label: 'BOTOX® (Ona)', val: formatDoseRange(muscle.dosing?.botox) },
      { label: 'DYSPORT® (Abo)', val: formatDoseRange(muscle.dosing?.dysport) },
      { label: 'XEOMIN® (Inco)', val: formatDoseRange(muscle.dosing?.xeomin) },
    ];

    brands.forEach((b, idx) => {
      const cx = bounds.left + idx * colW;
      if (idx > 0) {
        doc.setDrawColor(...theme.border);
        doc.line(cx, y + 2, cx, y + doseH - 2);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.7 * scale);
      doc.setTextColor(...theme.muted);
      doc.text(pdfText(b.label), cx + colW / 2, y + 4.3 * scale, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8 * scale);
      doc.setTextColor(...theme.primary);
      doc.text(pdfText(b.val), cx + colW / 2, y + 9.8 * scale, { align: 'center' });
    });

    y += doseH + 3 * scale;
  }

  // Two-column USG Landmarks + Injection Technique
  const landmarks = muscle.usgGuidance?.landmarks?.length
    ? muscle.usgGuidance.landmarks
    : item.fallbackUsgText
    ? [item.fallbackUsgText]
    : [];
  const techniques = muscle.motorPoint.techniqueNotes || [];
  const precautions = muscle.usgGuidance?.precautions || [];

  const reserveForWarnings =
    (config.includePrecautions && precautions.length > 0 ? 18 * scale : 0) +
    (config.includeIndications && muscle.indications.length > 0 ? 9 * scale : 0) +
    (config.includeClinicalPearls && item.pearls.length > 0 ? 14 * scale : 0) +
    (config.includeAdminNotes && item.adminNotes ? 10 * scale : 0);

  const midSectionH = Math.max(20 * scale, bounds.bottom - reserveForWarnings - y - 2);

  if ((config.includeUsgLandmarks || config.includeTechniqueNotes) && midSectionH > 14) {
    const showBoth = config.includeUsgLandmarks && config.includeTechniqueNotes;
    const gap = 2.6;
    const wLeft = showBoth ? (bounds.width - gap) / 2 : bounds.width;
    const maxListY = y + midSectionH;

    if (config.includeUsgLandmarks) {
      doc.setFillColor(...theme.surface);
      doc.setDrawColor(...theme.border);
      doc.setLineWidth(0.24);
      doc.roundedRect(bounds.left, y, wLeft, midSectionH, 1.6, 1.6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2 * scale);
      doc.setTextColor(...theme.primary);
      doc.text('REFERENCIAS ECOGRÁFICAS (USG)', bounds.left + 2.5, y + 4 * scale);

      let ly = y + 7.6 * scale;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4 * scale);
      doc.setTextColor(...theme.ink);
      const list = landmarks.length > 0 ? landmarks : ['Identificar vientre muscular y planos fasciales con sonda lineal.'];
      for (const lm of list.slice(0, 4)) {
        if (ly > maxListY - 3) break;
        ly = drawClampedParagraph(doc, `- ${lm}`, bounds.left + 2.5, ly, wLeft - 5, 2.9 * scale, 2) + 0.9 * scale;
      }
    }

    if (config.includeTechniqueNotes) {
      const tx = showBoth ? bounds.left + wLeft + gap : bounds.left;
      doc.setFillColor(...theme.surface);
      doc.setDrawColor(...theme.border);
      doc.setLineWidth(0.24);
      doc.roundedRect(tx, y, wLeft, midSectionH, 1.6, 1.6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2 * scale);
      doc.setTextColor(...meta.rgb);
      doc.text('TÉCNICA DE INYECCIÓN', tx + 2.5, y + 4 * scale);

      let ty = y + 7.6 * scale;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4 * scale);
      doc.setTextColor(...theme.ink);
      for (const note of techniques.slice(0, 4)) {
        if (ty > maxListY - 3) break;
        ty = drawClampedParagraph(doc, `- ${note}`, tx + 2.5, ty, wLeft - 5, 2.9 * scale, 2) + 0.9 * scale;
      }
    }

    y += midSectionH + 2.6 * scale;
  }

  // Precautions Warning Box
  if (config.includePrecautions && precautions.length > 0 && y < bounds.bottom - 10) {
    const precH = Math.min(16 * scale, bounds.bottom - y - (config.includeIndications ? 8 * scale : 2));
    if (precH >= 9) {
      doc.setFillColor(...theme.warningBg);
      doc.setDrawColor(...theme.warningBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(bounds.left, y, bounds.width, precH, 1.6, 1.6, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.1 * scale);
      doc.setTextColor(...theme.warningText);
      doc.text('! PRECAUCIONES Y SEGURIDAD', bounds.left + 2.8, y + 3.8 * scale);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4 * scale);
      doc.setTextColor(...theme.warningText);
      const maxL = Math.max(1, Math.floor((precH - 5.5 * scale) / (2.9 * scale)));
      drawClampedParagraph(
        doc,
        precautions.join(' · '),
        bounds.left + 2.8,
        y + 7.3 * scale,
        bounds.width - 5.6,
        2.9 * scale,
        maxL
      );
      y += precH + 2.4 * scale;
    }
  }

  // Premium Clinical Pearls (from Supabase CMS)
  if (config.includeClinicalPearls && item.pearls.length > 0 && y < bounds.bottom - 9) {
    const firstPearl = item.pearls[0];
    const pearlH = Math.min(12.5 * scale, bounds.bottom - y - 2);
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(202, 138, 4);
    doc.setLineWidth(0.25);
    doc.roundedRect(bounds.left, y, bounds.width, pearlH, 1.5, 1.5, 'FD');

    const typeLbl = PEARL_TYPE_LABELS[firstPearl.pearl_type] || 'Perla';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9 * scale);
    doc.setTextColor(133, 77, 14);
    doc.text(pdfText(`PERLA CLÍNICA (${typeLbl.toUpperCase()}): ${firstPearl.title}`), bounds.left + 2.5, y + 3.6 * scale, {
      maxWidth: bounds.width - 5,
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2 * scale);
    drawClampedParagraph(doc, firstPearl.content, bounds.left + 2.5, y + 6.9 * scale, bounds.width - 5, 2.75 * scale, 2);
    y += pearlH + 2 * scale;
  }

  // Admin editorial notes
  if (config.includeAdminNotes && item.adminNotes && y < bounds.bottom - 7) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.1 * scale);
    doc.setTextColor(...theme.muted);
    y = drawClampedParagraph(doc, `Nota editorial: ${item.adminNotes}`, bounds.left, y + 2.2 * scale, bounds.width, 2.7 * scale, 2) + 1.5 * scale;
  }

  // Indications compact strip
  if (config.includeIndications && muscle.indications.length > 0 && y < bounds.bottom - 4) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8 * scale);
    doc.setTextColor(...theme.muted);
    const label = 'INDICACIONES: ';
    doc.text(label, bounds.left, Math.min(bounds.bottom - 1, y + 2.6 * scale));
    const lw = doc.getTextWidth(label);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...theme.ink);
    doc.text(pdfText(muscle.indications.join('  ·  ')), bounds.left + lw, Math.min(bounds.bottom - 1, y + 2.6 * scale), {
      maxWidth: bounds.width - lw,
    });
  }

  drawThumbTab(doc, geo, muscle.category, pageNumber);
  drawFooter(doc, geo, config, theme, pageNumber, `${config.website || config.publisher} · Guía USG & Dosis`, meta.rgb);
  drawCropMarks(doc, geo);
}

/**
 * SINGLE-SHEET ATLAS — 1 FULL PAGE PER MUSCLE (ANATOMY + USG SIDE BY SIDE)
 */
function renderSingleSheetMuscle(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  item: ResolvedMuscleForBook,
  cardNumber: number,
  pageNumber: number,
  motorImg: LoadedImage | null,
  usgImg: LoadedImage | null
): void {
  const { muscle } = item;
  const meta = CATEGORY_META[muscle.category];
  const { ox, oy, trimW, marginCrop, scale } = geo;
  const bleed = marginCrop > 0 ? 3 : 0;
  const bounds = getContentBounds(geo, config, pageNumber);

  // Top regional accent strip
  doc.setFillColor(...meta.rgb);
  doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, 4.8 + bleed, 'F');

  let y = bounds.top + 1.5 * scale;

  // Header
  const numW = drawBadge(
    doc,
    `FICHA #${String(cardNumber).padStart(2, '0')}`,
    bounds.left,
    y,
    meta.rgb,
    [255, 255, 255],
    7 * scale,
    2.6,
    1.3
  );
  drawBadge(
    doc,
    `${meta.label.toUpperCase()}  ·  ${muscle.region.toUpperCase()}`,
    bounds.left + numW + 2,
    y,
    theme.isEcoInk ? theme.surface : meta.softRgb,
    meta.rgb,
    6.4 * scale,
    2.4,
    1.3
  );

  y += 8.6 * scale;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5 * scale);
  doc.setTextColor(...theme.ink);
  doc.text(pdfText(muscle.name), bounds.left, y);
  const nameW = doc.getTextWidth(pdfText(muscle.name));
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9.5 * scale);
  doc.setTextColor(...meta.rgb);
  if (nameW < bounds.width * 0.65) {
    doc.text(pdfText(`  (${muscle.latinName})`), bounds.left + nameW, y);
    y += 4.5 * scale;
  } else {
    y += 5.2 * scale;
    doc.text(pdfText(muscle.latinName), bounds.left, y);
    y += 4 * scale;
  }

  // Dual Visual Panel (Side by side Anatomy + USG)
  const showVisuals = config.includeMotorPointImage || config.includeUsgImage;
  if (showVisuals) {
    const visualH = Math.min(bounds.height * 0.35, 76 * scale);
    const gap = 3.2;
    const both = config.includeMotorPointImage && config.includeUsgImage;
    const panelW = both ? (bounds.width - gap) / 2 : bounds.width;

    // Left: Anatomy
    if (config.includeMotorPointImage) {
      if (motorImg) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.32);
        doc.roundedRect(bounds.left, y, panelW, visualH, 2, 2, 'FD');
        const { rx, ry, rw, rh } = fitImageInBox(motorImg, bounds.left, y, panelW, visualH, 1.6);
        doc.addImage(motorImg.dataUrl, motorImg.format, rx, ry, rw, rh, undefined, 'FAST');
        drawBadge(doc, 'ANATOMÍA · PUNTO MOTOR', bounds.left + 2, y + 2, [15, 23, 42], [255, 255, 255], 5.3 * scale, 1.8, 0.9);
      } else if (config.showMissingImagePlaceholder) {
        drawPlaceholderFrame(doc, bounds.left, y, panelW, visualH, 'REFERENCIA ANATÓMICA', 'Pendiente en Admin Media', false, scale * 0.9);
      }
    }

    // Right: USG
    if (config.includeUsgImage) {
      const ux = both ? bounds.left + panelW + gap : bounds.left;
      if (usgImg) {
        doc.setFillColor(...theme.usgFrameBg);
        doc.setDrawColor(...theme.border);
        doc.setLineWidth(0.32);
        doc.roundedRect(ux, y, panelW, visualH, 2, 2, 'FD');
        const { rx, ry, rw, rh } = fitImageInBox(usgImg, ux, y, panelW, visualH, 1.6);
        doc.addImage(usgImg.dataUrl, usgImg.format, rx, ry, rw, rh, undefined, 'FAST');
        if (config.includeMotorPointPin && item.effectiveCoordinates) {
          drawMotorPointTarget(
            doc,
            rx + (rw * item.effectiveCoordinates.x) / 100,
            ry + (rh * item.effectiveCoordinates.y) / 100,
            scale * 0.85
          );
        }
        drawBadge(doc, `USG · ${item.effectiveUsgView.toUpperCase()}`, ux + 2, y + 2, [19, 127, 236], [255, 255, 255], 5.3 * scale, 1.8, 0.9);
      } else if (config.showMissingImagePlaceholder) {
        drawPlaceholderFrame(doc, ux, y, panelW, visualH, `ECOGRAFÍA USG (${item.effectiveUsgView})`, 'Pendiente en Admin Media', true, scale * 0.9);
      }
    }

    y += visualH + 3.2 * scale;
  }

  // Motor point + Dosing strip
  if (config.includeDosingTable) {
    const stripH = 12 * scale;
    const doseW = bounds.width * 0.56;
    const mpW = bounds.width - doseW - 3;

    // Left: Motor point summary
    doc.setFillColor(...(theme.isEcoInk ? theme.surface : meta.softRgb));
    doc.setDrawColor(...meta.rgb);
    doc.setLineWidth(0.28);
    doc.roundedRect(bounds.left, y, mpW, stripH, 1.6, 1.6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.7 * scale);
    doc.setTextColor(...meta.rgb);
    doc.text('PUNTO MOTOR', bounds.left + 2.4, y + 3.5 * scale);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2 * scale);
    doc.setTextColor(...theme.ink);
    drawClampedParagraph(doc, muscle.motorPoint.description, bounds.left + 2.4, y + 6.8 * scale, mpW - 4.5, 2.7 * scale, 2);

    // Right: 3-brand dosing
    const dx = bounds.left + mpW + 3;
    doc.setFillColor(...theme.surface);
    doc.setDrawColor(...theme.border);
    doc.roundedRect(dx, y, doseW, stripH, 1.6, 1.6, 'FD');
    const colW = doseW / 3;
    [
      { label: 'BOTOX®', val: formatDoseRange(muscle.dosing?.botox) },
      { label: 'DYSPORT®', val: formatDoseRange(muscle.dosing?.dysport) },
      { label: 'XEOMIN®', val: formatDoseRange(muscle.dosing?.xeomin) },
    ].forEach((b, idx) => {
      const bx = dx + idx * colW;
      if (idx > 0) doc.line(bx, y + 1.8, bx, y + stripH - 1.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5 * scale);
      doc.setTextColor(...theme.muted);
      doc.text(pdfText(b.label), bx + colW / 2, y + 4 * scale, { align: 'center' });
      doc.setFontSize(8.2 * scale);
      doc.setTextColor(...theme.primary);
      doc.text(pdfText(b.val), bx + colW / 2, y + 9.2 * scale, { align: 'center' });
    });

    y += stripH + 3.2 * scale;
  }

  // Lower 2-column detail grid
  const gap = 3.2;
  const colW = (bounds.width - gap) / 2;
  const availH = bounds.bottom - y - 5 * scale;

  // Left Column: Anatomy + Technique
  let ly = y;
  if (config.includeAnatomyDetails) {
    const anatH = Math.min(availH * 0.56, 44 * scale);
    doc.setFillColor(...theme.surface);
    doc.setDrawColor(...theme.border);
    doc.setLineWidth(0.24);
    doc.roundedRect(bounds.left, ly, colW, anatH, 1.6, 1.6, 'FD');

    let ay = ly + 4 * scale;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4 * scale);
    doc.setTextColor(...meta.rgb);
    doc.text('ANATOMÍA FUNCIONAL', bounds.left + 2.6, ay);
    ay += 3.8 * scale;

    [
      ['Origen:', muscle.anatomy.origin],
      ['Inserción:', muscle.anatomy.insertion],
      ['Inervación:', muscle.anatomy.innervation],
      ['Función:', muscle.anatomy.function],
    ].forEach(([lbl, val]) => {
      if (ay > ly + anatH - 3) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2 * scale);
      doc.setTextColor(...theme.ink);
      doc.text(lbl, bounds.left + 2.6, ay);
      const lw = doc.getTextWidth(`${lbl} `);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...theme.muted);
      ay = drawClampedParagraph(doc, val, bounds.left + 2.6 + lw, ay, colW - 5.2 - lw, 2.85 * scale, 2) + 1.1 * scale;
    });
    ly += anatH + 2.6 * scale;
  }

  if (config.includeTechniqueNotes && ly < bounds.bottom - 14) {
    const techH = Math.max(14, bounds.bottom - 5 * scale - ly);
    doc.setFillColor(...theme.surface);
    doc.setDrawColor(...theme.border);
    doc.roundedRect(bounds.left, ly, colW, techH, 1.6, 1.6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2 * scale);
    doc.setTextColor(...theme.ink);
    doc.text('TÉCNICA DE INYECCIÓN', bounds.left + 2.6, ly + 4 * scale);
    let ty = ly + 7.4 * scale;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2 * scale);
    doc.setTextColor(...theme.muted);
    for (const note of muscle.motorPoint.techniqueNotes.slice(0, 4)) {
      if (ty > ly + techH - 3) break;
      ty = drawClampedParagraph(doc, `- ${note}`, bounds.left + 2.6, ty, colW - 5.2, 2.8 * scale, 2) + 0.8 * scale;
    }
  }

  // Right Column: USG Landmarks + Precautions + Pearls
  const rx = bounds.left + colW + gap;
  let ry = y;
  if (config.includeUsgLandmarks) {
    const usgBoxH = Math.min(availH * 0.5, 38 * scale);
    doc.setFillColor(...theme.surface);
    doc.setDrawColor(...theme.border);
    doc.roundedRect(rx, ry, colW, usgBoxH, 1.6, 1.6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4 * scale);
    doc.setTextColor(...theme.primary);
    doc.text('GUÍA ECOGRÁFICA (USG)', rx + 2.6, ry + 4 * scale);

    let uy = ry + 7.5 * scale;
    if (muscle.usgGuidance) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6 * scale);
      doc.setTextColor(...theme.ink);
      doc.text(
        pdfText(`${muscle.usgGuidance.transducerType} · ${muscle.usgGuidance.approach}`),
        rx + 2.6,
        uy,
        { maxWidth: colW - 5.2 }
      );
      uy += 3.4 * scale;
    }

    const lms = muscle.usgGuidance?.landmarks?.length
      ? muscle.usgGuidance.landmarks
      : item.fallbackUsgText
      ? [item.fallbackUsgText]
      : ['Visualizar plano muscular objetivo y estructuras vasculares adyacentes.'];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2 * scale);
    doc.setTextColor(...theme.muted);
    for (const lm of lms.slice(0, 4)) {
      if (uy > ry + usgBoxH - 3) break;
      uy = drawClampedParagraph(doc, `- ${lm}`, rx + 2.6, uy, colW - 5.2, 2.8 * scale, 2) + 0.8 * scale;
    }
    ry += usgBoxH + 2.6 * scale;
  }

  if (config.includePrecautions && (muscle.usgGuidance?.precautions?.length || 0) > 0 && ry < bounds.bottom - 14) {
    const precH = Math.min(18 * scale, bounds.bottom - 5 * scale - ry);
    doc.setFillColor(...theme.warningBg);
    doc.setDrawColor(...theme.warningBorder);
    doc.roundedRect(rx, ry, colW, precH, 1.6, 1.6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6 * scale);
    doc.setTextColor(...theme.warningText);
    doc.text('! PRECAUCIONES', rx + 2.6, ry + 3.8 * scale);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1 * scale);
    drawClampedParagraph(
      doc,
      muscle.usgGuidance!.precautions.join(' · '),
      rx + 2.6,
      ry + 7 * scale,
      colW - 5.2,
      2.75 * scale,
      3
    );
    ry += precH + 2.4 * scale;
  }

  if (config.includeClinicalPearls && item.pearls.length > 0 && ry < bounds.bottom - 11) {
    const pearl = item.pearls[0];
    const pH = Math.max(10, bounds.bottom - 5 * scale - ry);
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(202, 138, 4);
    doc.roundedRect(rx, ry, colW, pH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8 * scale);
    doc.setTextColor(133, 77, 14);
    doc.text(pdfText(`PERLA: ${pearl.title}`), rx + 2.4, ry + 3.6 * scale, { maxWidth: colW - 4.8 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6 * scale);
    drawClampedParagraph(doc, pearl.content, rx + 2.4, ry + 6.6 * scale, colW - 4.8, 2.7 * scale, 2);
  }

  // Bottom indications bar
  if (config.includeIndications && muscle.indications.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9 * scale);
    doc.setTextColor(...theme.muted);
    const lbl = 'INDICACIONES CLÍNICAS: ';
    doc.text(lbl, bounds.left, bounds.bottom - 1);
    const lw = doc.getTextWidth(lbl);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...theme.ink);
    doc.text(pdfText(muscle.indications.join('  ·  ')), bounds.left + lw, bounds.bottom - 1, {
      maxWidth: bounds.width - lw,
    });
  }

  drawThumbTab(doc, geo, muscle.category, pageNumber);
  drawFooter(doc, geo, config, theme, pageNumber, `${config.title} · #${String(cardNumber).padStart(2, '0')} ${muscle.name}`, meta.rgb);
  drawCropMarks(doc, geo);
}

/**
 * CUT-SHEET 2-UP LANDSCAPE FLASHCARD SLOT (for Letter/A4 duplex guillotine sheets)
 */
function renderCutCardSlot(
  doc: JsPdfType,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
  side: 'front' | 'back',
  config: PdfBookConfig,
  theme: ThemePalette,
  item: ResolvedMuscleForBook,
  cardNumber: number,
  img: LoadedImage | null
): void {
  const { muscle } = item;
  const meta = CATEGORY_META[muscle.category];
  const pad = 4.5;

  // Card outer cut-line frame
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...theme.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(slotX, slotY, slotW, slotH, 2.2, 2.2, 'FD');

  // Top regional band inside card
  doc.setFillColor(...meta.rgb);
  doc.rect(slotX, slotY, slotW, 3.4, 'F');

  const innerX = slotX + pad;
  const innerY = slotY + 5.8;
  const innerW = slotW - pad * 2;
  const innerH = slotH - 8.5;

  // Header row inside card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.2);
  doc.setTextColor(...theme.ink);
  doc.text(pdfText(`#${String(cardNumber).padStart(2, '0')}  ${muscle.name}`), innerX, innerY + 3.2, {
    maxWidth: innerW * 0.68,
  });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.6);
  doc.setTextColor(...meta.rgb);
  doc.text(pdfText(`${muscle.latinName} · ${muscle.region}`), innerX, innerY + 7.2, {
    maxWidth: innerW * 0.68,
  });

  drawBadge(
    doc,
    side === 'front' ? 'ANVERSO · ANATOMÍA' : `REVERSO · USG (${item.effectiveUsgView.toUpperCase()})`,
    slotX + slotW - pad,
    innerY - 0.3,
    side === 'front' ? meta.softRgb : [19, 127, 236],
    side === 'front' ? meta.rgb : [255, 255, 255],
    5.8,
    2.2,
    1.1,
    'right'
  );

  // Split horizontally: Left 47% Visual, Right 53% Clinical details
  const bodyY = innerY + 10;
  const bodyH = innerH - 11.5;
  const imgW = innerW * 0.46;
  const infoX = innerX + imgW + 4;
  const infoW = innerW - imgW - 4;

  // Left Visual Box
  const showImg = side === 'front' ? config.includeMotorPointImage : config.includeUsgImage;
  if (showImg) {
    if (img) {
      doc.setFillColor(...(side === 'front' ? ([255, 255, 255] as RGBTuple) : theme.usgFrameBg));
      doc.setDrawColor(...theme.border);
      doc.roundedRect(innerX, bodyY, imgW, bodyH, 1.8, 1.8, 'FD');
      const { rx, ry, rw, rh } = fitImageInBox(img, innerX, bodyY, imgW, bodyH, 1.4);
      doc.addImage(img.dataUrl, img.format, rx, ry, rw, rh, undefined, 'FAST');
      if (side === 'back' && config.includeMotorPointPin && item.effectiveCoordinates) {
        drawMotorPointTarget(
          doc,
          rx + (rw * item.effectiveCoordinates.x) / 100,
          ry + (rh * item.effectiveCoordinates.y) / 100,
          0.85
        );
      }
    } else if (config.showMissingImagePlaceholder) {
      drawPlaceholderFrame(
        doc,
        innerX,
        bodyY,
        imgW,
        bodyH,
        side === 'front' ? 'IMAGEN ANATÓMICA' : 'ECOGRAFÍA USG',
        'Subir en Admin Media',
        side === 'back',
        0.85
      );
    }
  }

  // Right Info Column
  let cy = bodyY;
  if (side === 'front') {
    // Motor point box
    doc.setFillColor(...(theme.isEcoInk ? theme.surface : meta.softRgb));
    doc.setDrawColor(...meta.rgb);
    doc.roundedRect(infoX, cy, infoW, 16, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...meta.rgb);
    doc.text('PUNTO MOTOR', infoX + 2.5, cy + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...theme.ink);
    drawClampedParagraph(doc, muscle.motorPoint.description, infoX + 2.5, cy + 7.8, infoW - 5, 3.1, 2);
    cy += 18.5;

    // Anatomy details
    if (config.includeAnatomyDetails) {
      [
        ['ORIGEN', muscle.anatomy.origin],
        ['INSERCIÓN', muscle.anatomy.insertion],
        ['INERVACIÓN', muscle.anatomy.innervation],
        ['FUNCIÓN', muscle.anatomy.function],
      ].forEach(([lbl, val]) => {
        if (cy > bodyY + bodyH - 8) return;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(...meta.rgb);
        doc.text(lbl, infoX, cy + 2.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.7);
        doc.setTextColor(...theme.ink);
        cy = drawClampedParagraph(doc, val, infoX, cy + 5.8, infoW, 3.0, 2) + 1.8;
      });
    }
  } else {
    // Back side: Dosing + Landmarks + Precautions
    if (config.includeDosingTable) {
      const dh = 12.5;
      const cw = infoW / 3;
      doc.setFillColor(...theme.surface);
      doc.setDrawColor(...theme.border);
      doc.roundedRect(infoX, cy, infoW, dh, 1.5, 1.5, 'FD');
      [
        { l: 'BOTOX®', v: formatDoseRange(muscle.dosing?.botox) },
        { l: 'DYSPORT®', v: formatDoseRange(muscle.dosing?.dysport) },
        { l: 'XEOMIN®', v: formatDoseRange(muscle.dosing?.xeomin) },
      ].forEach((b, i) => {
        const bx = infoX + i * cw;
        if (i > 0) doc.line(bx, cy + 1.5, bx, cy + dh - 1.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.6);
        doc.setTextColor(...theme.muted);
        doc.text(pdfText(b.l), bx + cw / 2, cy + 4.1, { align: 'center' });
        doc.setFontSize(8.2);
        doc.setTextColor(...theme.primary);
        doc.text(pdfText(b.v), bx + cw / 2, cy + 9.4, { align: 'center' });
      });
      cy += dh + 2.8;
    }

    if (config.includeUsgLandmarks) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.1);
      doc.setTextColor(...theme.primary);
      const usgHead = muscle.usgGuidance
        ? `USG (${muscle.usgGuidance.transducerType} · ${muscle.usgGuidance.approach})`
        : 'REFERENCIAS ECOGRÁFICAS';
      doc.text(pdfText(usgHead), infoX, cy + 2.4, { maxWidth: infoW });
      cy += 5.4;
      const lms = muscle.usgGuidance?.landmarks?.length
        ? muscle.usgGuidance.landmarks
        : item.fallbackUsgText
        ? [item.fallbackUsgText]
        : ['Visualizar plano fascial y vientre muscular.'];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(...theme.ink);
      for (const lm of lms.slice(0, 3)) {
        if (cy > bodyY + bodyH - 22) break;
        cy = drawClampedParagraph(doc, `- ${lm}`, infoX, cy, infoW, 2.9, 2) + 0.8;
      }
      cy += 1.2;
    }

    if (config.includeTechniqueNotes && cy < bodyY + bodyH - 18) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.1);
      doc.setTextColor(...meta.rgb);
      doc.text('TÉCNICA', infoX, cy + 2);
      cy += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(...theme.ink);
      for (const note of muscle.motorPoint.techniqueNotes.slice(0, 2)) {
        if (cy > bodyY + bodyH - 15) break;
        cy = drawClampedParagraph(doc, `- ${note}`, infoX, cy, infoW, 2.85, 2) + 0.7;
      }
    }

    if (config.includePrecautions && (muscle.usgGuidance?.precautions?.length || 0) > 0) {
      const ph = 13.5;
      const py = bodyY + bodyH - ph;
      doc.setFillColor(...theme.warningBg);
      doc.setDrawColor(...theme.warningBorder);
      doc.roundedRect(infoX, py, infoW, ph, 1.4, 1.4, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(...theme.warningText);
      doc.text('! PRECAUCIONES', infoX + 2.2, py + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.1);
      drawClampedParagraph(
        doc,
        muscle.usgGuidance!.precautions.join(' · '),
        infoX + 2.2,
        py + 6.9,
        infoW - 4.4,
        2.75,
        2
      );
    }
  }
}

function renderCutSheetPage(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  side: 'front' | 'back',
  pair: { item: ResolvedMuscleForBook; cardNumber: number; img: LoadedImage | null }[],
  pageNumber: number
): void {
  const { ox, oy, trimW, trimH } = geo;
  const marginX = 11;
  const marginY = 12;
  const centerGap = 10;
  const slotW = trimW - marginX * 2;
  const slotH = (trimH - marginY * 2 - centerGap) / 2;

  pair.forEach((entry, idx) => {
    const sy = oy + marginY + idx * (slotH + centerGap);
    renderCutCardSlot(
      doc,
      ox + marginX,
      sy,
      slotW,
      slotH,
      side,
      config,
      theme,
      entry.item,
      entry.cardNumber,
      entry.img
    );
  });

  // Central horizontal guillotine cut guide
  const midY = oy + trimH / 2;
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2.5, 2], 0);
  doc.setLineWidth(0.22);
  doc.line(ox + 2, midY, ox + trimW - 2, midY);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('LÍNEA DE CORTE GUILLOTINA (2 FLASHCARDS POR HOJA)', ox + trimW / 2, midY - 1.2, {
    align: 'center',
  });

  drawFooter(
    doc,
    geo,
    config,
    theme,
    pageNumber,
    `${config.title} · Pliego 2×1 (${side === 'front' ? 'TIRO / ANVERSOS' : 'RETIRO / REVERSOS'})`,
    theme.primary
  );
  drawCropMarks(doc, geo);
}

function renderBackCover(
  doc: JsPdfType,
  geo: PageGeometry,
  config: PdfBookConfig,
  theme: ThemePalette,
  muscleCount: number,
  logo: LoadedImage | null
): void {
  const { ox, oy, trimW, trimH, marginCrop, scale } = geo;
  const bleed = marginCrop > 0 ? 3 : 0;

  doc.setFillColor(...theme.coverBg);
  doc.rect(ox - bleed, oy - bleed, trimW + bleed * 2, trimH + bleed * 2, 'F');

  // Right vertical editorial accent bar
  doc.setFillColor(...theme.accent);
  doc.rect(ox + trimW - 4.5, oy - bleed, 4.5 + bleed, trimH + bleed * 2, 'F');

  const left = ox + 14 * scale;
  const contentW = trimW - 28 * scale;
  let y = oy + 22 * scale;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5 * scale);
  doc.setTextColor(...theme.accent);
  doc.text(pdfText(config.publisher).toUpperCase(), left, y);
  y += 8 * scale;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14 * scale);
  doc.setTextColor(...theme.coverText);
  const hLines = doc.splitTextToSize(pdfText(config.title), contentW) as string[];
  doc.text(hLines, left, y);
  y += hLines.length * (6.2 * scale) + 4 * scale;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5 * scale);
  doc.setTextColor(...theme.coverSubtext);
  const synopsis =
    'Diseñada como herramienta de consulta rápida junto al paciente y al equipo de ultrasonido, esta obra reúne la referencia anatómica de puntos motores junto con su correlato ecográfico (USG) y rangos de dosificación comparativa para toxina botulínica.';
  y = drawClampedParagraph(doc, synopsis, left, y, contentW, 4.3 * scale, 5) + 8 * scale;

  // Value pillars
  const pillars = [
    `${muscleCount} músculos organizados por región anatómica con código de color`,
    'Referencia anatómica precisa: origen, inserción, inervación y punto motor',
    'Guía ecográfica (USG) con plano de exploración, landmarks y precauciones',
    'Dosificación comparativa orientativa: Botox®, Dysport® y Xeomin®',
  ];

  pillars.forEach((p) => {
    doc.setFillColor(...theme.accent);
    doc.circle(left + 1.5, y - 1.2 * scale, 1.1 * scale, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8 * scale);
    doc.setTextColor(...theme.coverText);
    y = drawClampedParagraph(doc, p, left + 5.5, y, contentW - 5.5, 4 * scale, 2) + 2.6 * scale;
  });

  // Bottom author + ISBN/Barcode retail box
  const bottomBoxY = oy + trimH - 42 * scale;
  if (logo) {
    const lh = 14 * scale;
    const lw = lh * (logo.width / logo.height);
    doc.addImage(logo.dataUrl, logo.format, left, bottomBoxY, lw, lh, undefined, 'FAST');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9 * scale);
  doc.setTextColor(...theme.coverText);
  doc.text(pdfText(config.author), left, bottomBoxY + 20 * scale);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5 * scale);
  doc.setTextColor(...theme.coverSubtext);
  doc.text(pdfText([config.website, config.edition, config.year].filter(Boolean).join('  ·  ')), left, bottomBoxY + 25.5 * scale);

  // Commercial Barcode / ISBN placeholder box (standard retail placement)
  const barW = 42 * scale;
  const barH = 22 * scale;
  const barX = left + contentW - barW;
  const barY = bottomBoxY + 4 * scale;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...theme.border);
  doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2 * scale);
  doc.setTextColor(15, 23, 42);
  doc.text(
    pdfText(config.isbn.trim() ? `ISBN ${config.isbn}` : 'ESPACIO ISBN / CÓDIGO'),
    barX + barW / 2,
    barY + 5 * scale,
    { align: 'center' }
  );

  // Decorative barcode vertical bars
  const barsStart = barX + 4.5 * scale;
  const barsEnd = barX + barW - 4.5 * scale;
  let bx = barsStart;
  let patternIdx = 0;
  const widths = [0.5, 0.25, 0.8, 0.3, 0.5, 0.25, 0.9, 0.35, 0.45, 0.25];
  doc.setFillColor(15, 23, 42);
  while (bx < barsEnd - 1) {
    const w = widths[patternIdx % widths.length] * scale;
    doc.rect(bx, barY + 7.2 * scale, w, 10 * scale, 'F');
    bx += w + (0.65 + (patternIdx % 3) * 0.25) * scale;
    patternIdx++;
  }

  drawCropMarks(doc, geo);
}

/**
 * Main commercial PDF book export entry point.
 * Dynamically imports jsPDF, preloads high-res images in parallel batches,
 * builds exact TOC page numbers, enforces duplex parity for print shops,
 * and triggers browser file download.
 */
export async function generateFlashcardBookPdf(
  selectedMuscles: ResolvedMuscleForBook[],
  config: PdfBookConfig,
  onProgress?: (p: PdfExportProgress) => void
): Promise<PdfExportResult> {
  if (selectedMuscles.length === 0) {
    throw new Error('Selecciona al menos un músculo para generar el libro PDF.');
  }

  onProgress?.({
    phase: 'preparing',
    current: 0,
    total: selectedMuscles.length,
    message: 'Inicializando motor editorial PDF...',
  });

  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const sorted = sortMusclesForBook(selectedMuscles, config.sortOrder);
  const geo = buildGeometry(config);
  const theme = COLOR_THEMES[config.colorTheme] || COLOR_THEMES['sonotox-editorial'];
  const isDuplexAligned =
    config.layoutMode === 'duplex-flashcards' || config.layoutMode === 'cut-sheet-2up';

  // 1. Preload all needed images in concurrent batches
  interface ImageTask {
    key: string;
    muscleId: string;
    muscleName: string;
    kind: 'anatomia' | 'usg';
    url: string;
    bgHex: string;
  }

  const tasks: ImageTask[] = [];
  sorted.forEach((item) => {
    if (config.includeMotorPointImage && item.effectiveMotorImageUrl) {
      tasks.push({
        key: `${item.muscle.id}:motor`,
        muscleId: item.muscle.id,
        muscleName: item.muscle.name,
        kind: 'anatomia',
        url: item.effectiveMotorImageUrl,
        bgHex: '#ffffff',
      });
    }
    if (config.includeUsgImage && item.effectiveUsgImageUrl) {
      tasks.push({
        key: `${item.muscle.id}:usg`,
        muscleId: item.muscle.id,
        muscleName: item.muscle.name,
        kind: 'usg',
        url: item.effectiveUsgImageUrl,
        bgHex: '#0b1220',
      });
    }
  });

  const imageMap = new Map<string, LoadedImage>();
  const imagesFailed: PdfImageFailure[] = [];

  const coverBgHex = theme.isEcoInk
    ? '#ffffff'
    : `rgb(${theme.coverBg[0]}, ${theme.coverBg[1]}, ${theme.coverBg[2]})`;
  const logoAsset = await loadLogoAsset(coverBgHex);

  const CONCURRENCY = 6;
  let completedTasks = 0;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (task) => {
        try {
          const loaded = await fetchImageAsset(task.url, task.bgHex, 1500);
          imageMap.set(task.key, loaded);
        } catch {
          imagesFailed.push({
            muscleId: task.muscleId,
            muscleName: task.muscleName,
            kind: task.kind,
            url: task.url,
          });
        } finally {
          completedTasks++;
          onProgress?.({
            phase: 'loading-images',
            current: completedTasks,
            total: Math.max(1, tasks.length),
            message: `Procesando imágenes de alta resolución (${completedTasks}/${tasks.length})...`,
          });
        }
      })
    );
  }

  // 2. Initialize PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [geo.pageW, geo.pageH],
    compress: true,
  });

  doc.setProperties({
    title: pdfText(config.title),
    subject: pdfText(config.subtitle),
    author: pdfText(config.author),
    creator: 'SONOTOX Editorial PDF Studio',
    keywords: 'SONOTOX, flashcards, anatomia, ultrasonido, USG, toxina botulinica, puntos motores',
  });

  let currentPage = 0;
  const nextPage = (): number => {
    if (currentPage === 0) {
      currentPage = 1;
    } else {
      doc.addPage([geo.pageW, geo.pageH], 'portrait');
      currentPage++;
    }
    return currentPage;
  };

  // 3. Cover & Copyright (keeping duplex sheet parity!)
  if (config.includeCover) {
    nextPage();
    renderCoverPage(doc, geo, config, theme, sorted.length, logoAsset);
  }

  if (config.includeCopyright) {
    const p = nextPage();
    renderCopyrightAndLegendPage(doc, geo, config, theme, p);
  } else if (config.includeCover && isDuplexAligned) {
    // Keep cover on sheet 1 front + clean inner cover on sheet 1 back
    const p = nextPage();
    renderBlankNotesPage(doc, geo, config, theme, p, 'PROPIEDAD DEL ESPECIALISTA / NOTAS');
  }

  if (!config.includeCover && config.includeCopyright && isDuplexAligned) {
    const p = nextPage();
    renderBlankNotesPage(doc, geo, config, theme, p, 'NOTAS INICIALES');
  }

  // 4. Reserve Table of Contents pages (filled after exact page numbers are known!)
  const rawTocPages = computeTocPageCount(sorted, config);
  const tocAllocatedPages =
    rawTocPages > 0 && isDuplexAligned && rawTocPages % 2 !== 0
      ? rawTocPages + 1
      : rawTocPages;
  const tocStartPage = tocAllocatedPages > 0 ? currentPage + 1 : 0;
  for (let i = 0; i < tocAllocatedPages; i++) {
    nextPage();
  }

  // 5. Render Chapters & Muscle Flashcards
  const tocEntries: TocEntry[] = [];

  if (config.layoutMode === 'duplex-flashcards' || config.layoutMode === 'single-sheet') {
    let lastCategory: MuscleData['category'] | null = null;
    let chapterIdx = 0;

    for (let idx = 0; idx < sorted.length; idx++) {
      const item = sorted[idx];
      const cardNumber = idx + 1;

      if (
        config.includeChapterDividers &&
        config.sortOrder === 'category' &&
        item.muscle.category !== lastCategory
      ) {
        lastCategory = item.muscle.category;
        chapterIdx++;
        const chapterMuscles = sorted.filter((m) => m.muscle.category === item.muscle.category);
        const pFront = nextPage();
        renderChapterDividerFront(
          doc,
          geo,
          config,
          theme,
          item.muscle.category,
          chapterIdx,
          chapterMuscles,
          pFront
        );
        if (config.layoutMode === 'duplex-flashcards') {
          const pBack = nextPage();
          renderBlankNotesPage(
            doc,
            geo,
            config,
            theme,
            pBack,
            `NOTAS · ${CATEGORY_META[item.muscle.category].label.toUpperCase()}`
          );
        }
      }

      const motorImg = imageMap.get(`${item.muscle.id}:motor`) ?? null;
      const usgImg = imageMap.get(`${item.muscle.id}:usg`) ?? null;

      if (config.layoutMode === 'duplex-flashcards') {
        const frontPage = nextPage();
        tocEntries.push({
          cardNumber,
          name: item.muscle.name,
          latinName: item.muscle.latinName,
          region: item.muscle.region,
          category: item.muscle.category,
          pageNumber: frontPage,
          hasBothImages: item.isComplete,
        });
        renderDuplexFront(doc, geo, config, theme, item, cardNumber, frontPage, motorImg);

        const backPage = nextPage();
        renderDuplexBack(doc, geo, config, theme, item, cardNumber, backPage, usgImg);
      } else {
        const sheetPage = nextPage();
        tocEntries.push({
          cardNumber,
          name: item.muscle.name,
          latinName: item.muscle.latinName,
          region: item.muscle.region,
          category: item.muscle.category,
          pageNumber: sheetPage,
          hasBothImages: item.isComplete,
        });
        renderSingleSheetMuscle(
          doc,
          geo,
          config,
          theme,
          item,
          cardNumber,
          sheetPage,
          motorImg,
          usgImg
        );
      }

      if (idx % 3 === 0 || idx === sorted.length - 1) {
        onProgress?.({
          phase: 'rendering',
          current: idx + 1,
          total: sorted.length,
          message: `Maquetando flashcard ${idx + 1} de ${sorted.length}: ${item.muscle.name}...`,
        });
        // Yield briefly to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  } else {
    // CUT-SHEET 2-UP (2 flashcards per Letter/A4 page, duplex aligned!)
    const groups: { category: MuscleData['category'] | null; items: { item: ResolvedMuscleForBook; cardNumber: number }[] }[] = [];
    if (config.includeChapterDividers && config.sortOrder === 'category') {
      let runningNumber = 1;
      CATEGORY_ORDER.forEach((cat) => {
        const catItems = sorted.filter((m) => m.muscle.category === cat);
        if (catItems.length > 0) {
          groups.push({
            category: cat,
            items: catItems.map((item) => ({ item, cardNumber: runningNumber++ })),
          });
        }
      });
    } else {
      groups.push({
        category: null,
        items: sorted.map((item, idx) => ({ item, cardNumber: idx + 1 })),
      });
    }

    let chapterIdx = 0;
    let renderedCount = 0;
    for (const group of groups) {
      if (group.category && config.includeChapterDividers) {
        chapterIdx++;
        const pFront = nextPage();
        renderChapterDividerFront(
          doc,
          geo,
          config,
          theme,
          group.category,
          chapterIdx,
          group.items.map((g) => g.item),
          pFront
        );
        const pBack = nextPage();
        renderBlankNotesPage(
          doc,
          geo,
          config,
          theme,
          pBack,
          `NOTAS · ${CATEGORY_META[group.category].label.toUpperCase()}`
        );
      }

      for (let i = 0; i < group.items.length; i += 2) {
        const pairSlice = group.items.slice(i, i + 2);
        const frontSheetPage = nextPage();

        pairSlice.forEach((entry) => {
          tocEntries.push({
            cardNumber: entry.cardNumber,
            name: entry.item.muscle.name,
            latinName: entry.item.muscle.latinName,
            region: entry.item.muscle.region,
            category: entry.item.muscle.category,
            pageNumber: frontSheetPage,
            hasBothImages: entry.item.isComplete,
          });
        });

        renderCutSheetPage(
          doc,
          geo,
          config,
          theme,
          'front',
          pairSlice.map((entry) => ({
            item: entry.item,
            cardNumber: entry.cardNumber,
            img: imageMap.get(`${entry.item.muscle.id}:motor`) ?? null,
          })),
          frontSheetPage
        );

        const backSheetPage = nextPage();
        renderCutSheetPage(
          doc,
          geo,
          config,
          theme,
          'back',
          pairSlice.map((entry) => ({
            item: entry.item,
            cardNumber: entry.cardNumber,
            img: imageMap.get(`${entry.item.muscle.id}:usg`) ?? null,
          })),
          backSheetPage
        );

        renderedCount += pairSlice.length;
        onProgress?.({
          phase: 'rendering',
          current: renderedCount,
          total: sorted.length,
          message: `Maquetando pliego cortable (${renderedCount}/${sorted.length})...`,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  // 6. Back Cover
  if (config.includeBackCover) {
    if (isDuplexAligned) {
      const pInside = nextPage();
      renderBlankNotesPage(doc, geo, config, theme, pInside, 'NOTAS FINALES Y REGISTRO DE PRÁCTICA');
    }
    nextPage();
    renderBackCover(doc, geo, config, theme, sorted.length, logoAsset);
  }

  // 7. Fill reserved TOC pages with exact page numbers
  if (tocAllocatedPages > 0 && tocStartPage > 0) {
    onProgress?.({
      phase: 'finalizing',
      current: sorted.length,
      total: sorted.length,
      message: 'Compilando índice con numeración exacta de páginas...',
    });
    renderTableOfContentsPages(
      doc,
      geo,
      config,
      theme,
      tocStartPage,
      tocAllocatedPages,
      tocEntries
    );
  }

  // 8. Save PDF
  onProgress?.({
    phase: 'finalizing',
    current: sorted.length,
    total: sorted.length,
    message: 'Empaquetando archivo PDF para imprenta...',
  });

  const slug = pdfText(config.title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || 'sonotox_flashcards';

  const fileName = `${slug}_${config.paperPreset}_${config.year || new Date().getFullYear()}.pdf`;
  doc.save(fileName);

  onProgress?.({
    phase: 'done',
    current: sorted.length,
    total: sorted.length,
    message: 'PDF generado y descargado correctamente.',
  });

  return {
    fileName,
    totalPages: currentPage,
    physicalSheets: Math.ceil(currentPage / 2),
    muscleCount: sorted.length,
    imagesLoaded: imageMap.size,
    imagesFailed,
  };
}
