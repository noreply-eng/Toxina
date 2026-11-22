import type { PdfBookConfig, ResolvedMuscleForBook } from '../types/pdfExport';
import {
  CATEGORY_META,
  COLOR_THEMES,
  formatDoseRange,
  getEffectivePaperSpec,
  sortMusclesForBook,
} from './muscleBookCatalog';

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rgbCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Opens a self-contained high-definition editorial print window with Google Fonts
 * (Manrope + Inter), exact CSS @page sizing, and full flashcard book layout.
 */
export function openHtmlPrintBookPreview(
  selectedMuscles: ResolvedMuscleForBook[],
  config: PdfBookConfig
): boolean {
  if (selectedMuscles.length === 0) return false;

  const win = window.open('', '_blank');
  if (!win) return false;

  const sorted = sortMusclesForBook(selectedMuscles, config.sortOrder);
  const spec = getEffectivePaperSpec(config);
  const theme = COLOR_THEMES[config.colorTheme] || COLOR_THEMES['sonotox-editorial'];
  const isSingleSheet = config.layoutMode === 'single-sheet';

  const cardsHtml = sorted
    .map((item, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const meta = CATEGORY_META[item.muscle.category];
      const { muscle } = item;
      const landmarks = muscle.usgGuidance?.landmarks?.length
        ? muscle.usgGuidance.landmarks
        : item.fallbackUsgText
        ? [item.fallbackUsgText]
        : ['Identificar vientre muscular y planos fasciales con sonda lineal.'];

      const pinHtml =
        config.includeMotorPointPin && item.effectiveCoordinates
          ? `<div class="pin" style="left:${item.effectiveCoordinates.x}%;top:${item.effectiveCoordinates.y}%"></div>`
          : '';

      const motorVisualHtml = config.includeMotorPointImage
        ? item.effectiveMotorImageUrl
          ? `<div class="img-frame"><img src="${escapeHtml(item.effectiveMotorImageUrl)}" alt="${escapeHtml(muscle.name)}" /><span class="img-tag">ANATOMÍA · PUNTO MOTOR</span></div>`
          : config.showMissingImagePlaceholder
          ? `<div class="img-placeholder"><strong>REFERENCIA ANATÓMICA</strong><span>Pendiente de subir en Admin Media</span></div>`
          : ''
        : '';

      const usgVisualHtml = config.includeUsgImage
        ? item.effectiveUsgImageUrl
          ? `<div class="img-frame img-dark"><div class="img-inner"><img src="${escapeHtml(item.effectiveUsgImageUrl)}" alt="USG ${escapeHtml(muscle.name)}" />${pinHtml}</div><span class="img-tag tag-blue">USG · ${escapeHtml(item.effectiveUsgView.toUpperCase())}</span></div>`
          : config.showMissingImagePlaceholder
          ? `<div class="img-placeholder dark"><strong>ECOGRAFÍA USG (${escapeHtml(item.effectiveUsgView)})</strong><span>Pendiente de subir en Admin Media</span></div>`
          : ''
        : '';

      const dosingHtml = config.includeDosingTable
        ? `<div class="dosing-bar">
            <div><small>BOTOX® (Ona)</small><strong>${escapeHtml(formatDoseRange(muscle.dosing?.botox))}</strong></div>
            <div><small>DYSPORT® (Abo)</small><strong>${escapeHtml(formatDoseRange(muscle.dosing?.dysport))}</strong></div>
            <div><small>XEOMIN® (Inco)</small><strong>${escapeHtml(formatDoseRange(muscle.dosing?.xeomin))}</strong></div>
          </div>`
        : '';

      const precautionsHtml =
        config.includePrecautions && (muscle.usgGuidance?.precautions?.length || 0) > 0
          ? `<div class="warning-box"><h4>PRECAUCIONES Y SEGURIDAD</h4><p>${escapeHtml(
              muscle.usgGuidance!.precautions.join(' · ')
            )}</p></div>`
          : '';

      const pearlsHtml =
        config.includeClinicalPearls && item.pearls.length > 0
          ? `<div class="pearl-box"><h4>PERLA CLÍNICA · ${escapeHtml(item.pearls[0].title)}</h4><p>${escapeHtml(
              item.pearls[0].content
            )}</p></div>`
          : '';

      const anatomyGridHtml = config.includeAnatomyDetails
        ? `<div class="anat-grid">
            <div><h4>ORIGEN</h4><p>${escapeHtml(muscle.anatomy.origin)}</p></div>
            <div><h4>INSERCIÓN</h4><p>${escapeHtml(muscle.anatomy.insertion)}</p></div>
            <div><h4>INERVACIÓN</h4><p>${escapeHtml(muscle.anatomy.innervation)}</p></div>
            <div><h4>FUNCIÓN PRIMARIA</h4><p>${escapeHtml(muscle.anatomy.function)}</p></div>
          </div>`
        : '';

      if (isSingleSheet) {
        return `
          <section class="page" style="--accent:${meta.hex};--accent-soft:${meta.softHex};">
            <div class="top-bar"></div>
            <div class="page-body">
              <div class="card-head">
                <div class="badges">
                  <span class="badge-solid">#${num}</span>
                  <span class="badge-soft">${escapeHtml(meta.label)} · ${escapeHtml(muscle.region)}</span>
                </div>
                <span class="side-label">FICHA COMPLETA</span>
              </div>
              <h1>${escapeHtml(muscle.name)} <em class="latin-inline">(${escapeHtml(muscle.latinName)})</em></h1>
              <div class="dual-visuals">${motorVisualHtml}${usgVisualHtml}</div>
              <div class="mp-box"><strong>PUNTO MOTOR:</strong> ${escapeHtml(muscle.motorPoint.description)}</div>
              ${dosingHtml}
              <div class="two-col">
                <div>
                  ${anatomyGridHtml}
                </div>
                <div class="col-stack">
                  ${
                    config.includeUsgLandmarks
                      ? `<div class="info-box"><h4>GUÍA ECOGRÁFICA (${escapeHtml(muscle.usgGuidance?.transducerType || 'Sonda Lineal')})</h4><ul>${landmarks
                          .slice(0, 4)
                          .map((l) => `<li>${escapeHtml(l)}</li>`)
                          .join('')}</ul></div>`
                      : ''
                  }
                  ${
                    config.includeTechniqueNotes
                      ? `<div class="info-box"><h4>TÉCNICA DE INYECCIÓN</h4><ul>${muscle.motorPoint.techniqueNotes
                          .slice(0, 3)
                          .map((n) => `<li>${escapeHtml(n)}</li>`)
                          .join('')}</ul></div>`
                      : ''
                  }
                  ${precautionsHtml}
                  ${pearlsHtml}
                </div>
              </div>
            </div>
            <div class="page-foot"><span>${escapeHtml(config.title)} · #${num} ${escapeHtml(muscle.name)}</span><span>${escapeHtml(config.website)}</span></div>
          </section>`;
      }

      return `
        <section class="page" style="--accent:${meta.hex};--accent-soft:${meta.softHex};">
          <div class="top-bar"></div>
          <div class="page-body">
            <div class="card-head">
              <div class="badges">
                <span class="badge-solid">#${num}</span>
                <span class="badge-soft">${escapeHtml(meta.shortLabel)} · ${escapeHtml(muscle.region)}</span>
              </div>
              <span class="side-label">ANVERSO · ANATOMÍA</span>
            </div>
            <h1>${escapeHtml(muscle.name)}</h1>
            <p class="latin">${escapeHtml(muscle.latinName)}</p>
            ${motorVisualHtml}
            <div class="mp-box"><strong>LOCALIZACIÓN DEL PUNTO MOTOR:</strong> ${escapeHtml(muscle.motorPoint.description)}</div>
            ${anatomyGridHtml}
          </div>
          <div class="page-foot"><span>${escapeHtml(config.title)} · #${num}</span><span>ANVERSO</span></div>
        </section>

        <section class="page" style="--accent:${meta.hex};--accent-soft:${meta.softHex};">
          <div class="top-bar"></div>
          <div class="page-body">
            <div class="card-head">
              <div class="badges">
                <span class="badge-solid">#${num}</span>
                <strong class="back-name">${escapeHtml(muscle.name)}</strong>
              </div>
              <span class="side-label">REVERSO · GUÍA USG</span>
            </div>
            <p class="usg-sub">${escapeHtml(muscle.latinName)} · ${escapeHtml(
              muscle.usgGuidance?.transducerType || 'Sonda Lineal'
            )} · ${escapeHtml(muscle.usgGuidance?.approach || item.effectiveUsgView)}</p>
            ${usgVisualHtml}
            ${dosingHtml}
            <div class="two-col">
              ${
                config.includeUsgLandmarks
                  ? `<div class="info-box"><h4>REFERENCIAS USG</h4><ul>${landmarks
                      .slice(0, 4)
                      .map((l) => `<li>${escapeHtml(l)}</li>`)
                      .join('')}</ul></div>`
                  : ''
              }
              ${
                config.includeTechniqueNotes
                  ? `<div class="info-box"><h4>TÉCNICA DE INYECCIÓN</h4><ul>${muscle.motorPoint.techniqueNotes
                      .slice(0, 4)
                      .map((n) => `<li>${escapeHtml(n)}</li>`)
                      .join('')}</ul></div>`
                  : ''
              }
            </div>
            ${precautionsHtml}
            ${pearlsHtml}
            ${
              config.includeIndications && muscle.indications.length > 0
                ? `<div class="indications"><strong>INDICACIONES:</strong> ${escapeHtml(muscle.indications.join(' · '))}</div>`
                : ''
            }
          </div>
          <div class="page-foot"><span>${escapeHtml(config.publisher)}</span><span>REVERSO · USG</span></div>
        </section>`;
    })
    .join('\n');

  const coverHtml = config.includeCover
    ? `<section class="page cover-page">
        <div class="cover-spine"></div>
        <div class="cover-content">
          <div class="cover-pub">${escapeHtml(config.publisher)}</div>
          <div class="cover-badge">${escapeHtml(config.coverBadge)}</div>
          <h1 class="cover-title">${escapeHtml(config.title)}</h1>
          <div class="cover-rule"></div>
          <p class="cover-sub">${escapeHtml(config.subtitle)}</p>
          <div class="cover-pill">${sorted.length} FICHAS MUSCULARES · ANATOMÍA + ECOGRAFÍA USG</div>
          <div class="cover-footer">
            <strong>${escapeHtml(config.author)}</strong>
            <span>${escapeHtml([config.edition, config.year, config.website].filter(Boolean).join(' · '))}</span>
            ${config.isbn ? `<small>ISBN: ${escapeHtml(config.isbn)}</small>` : ''}
          </div>
        </div>
      </section>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(config.title)} — Vista de Impresión HD</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Manrope:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: ${spec.widthMm}mm ${spec.heightMm}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; background: #1e293b; font-family: 'Inter', sans-serif; color: #0f172a; }
    .toolbar { position: sticky; top: 0; z-index: 99; background: #0f172a; color: #fff; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #334155; }
    .toolbar button { background: #137fec; color: #fff; border: none; border-radius: 10px; padding: 10px 18px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .toolbar button.sec { background: #334155; }
    .book { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px 12px; }
    .page { width: ${spec.widthMm}mm; height: ${spec.heightMm}mm; background: #fff; position: relative; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 18px 40px rgba(0,0,0,0.45); break-after: page; page-break-after: always; }
    .top-bar { height: 4mm; background: var(--accent); flex-shrink: 0; }
    .page-body { flex: 1; padding: 6mm 8mm 4mm; display: flex; flex-direction: column; gap: 2.8mm; min-height: 0; }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .badges { display: flex; align-items: center; gap: 5px; }
    .badge-solid { background: var(--accent); color: #fff; font-weight: 800; font-size: 7.5pt; padding: 2px 7px; border-radius: 4px; font-family: 'Manrope', sans-serif; }
    .badge-soft { background: var(--accent-soft); color: var(--accent); font-weight: 700; font-size: 6.5pt; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; }
    .side-label { font-size: 6.2pt; font-weight: 800; color: #64748b; letter-spacing: 0.06em; }
    h1 { margin: 0; font-family: 'Manrope', sans-serif; font-size: 14.5pt; font-weight: 800; line-height: 1.15; color: #0f172a; }
    .latin { margin: -1.5mm 0 0; font-style: italic; color: var(--accent); font-size: 8.5pt; font-weight: 600; }
    .latin-inline { font-style: italic; font-weight: 600; font-size: 9.5pt; color: var(--accent); }
    .back-name { font-family: 'Manrope', sans-serif; font-size: 10pt; }
    .usg-sub { margin: -1.2mm 0 0; font-size: 7pt; color: #64748b; font-style: italic; }
    .dual-visuals { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
    .img-frame { position: relative; border: 1px solid #d8e2ee; border-radius: 6px; background: #fff; height: ${isSingleSheet ? '56mm' : '64mm'}; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 2mm; }
    .img-frame.img-dark { background: #0b1220; border-color: #1e293b; }
    .img-inner { position: relative; display: inline-flex; max-width: 100%; max-height: 100%; }
    .img-frame img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .img-tag { position: absolute; top: 5px; left: 5px; background: rgba(15,23,42,0.86); color: #fff; font-size: 5.5pt; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em; }
    .img-tag.tag-blue { background: #137fec; }
    .pin { position: absolute; width: 14px; height: 14px; border: 2.5px solid #ef4444; box-shadow: 0 0 0 2px #fff; border-radius: 50%; transform: translate(-50%,-50%); }
    .pin::after { content: ''; position: absolute; inset: 3px; background: #ef4444; border-radius: 50%; }
    .img-placeholder { height: ${isSingleSheet ? '56mm' : '64mm'}; border: 1.5px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8px; gap: 4px; color: #64748b; font-size: 7.5pt; }
    .img-placeholder.dark { background: #111827; border-color: #334155; color: #94a3b8; }
    .mp-box { background: var(--accent-soft); border: 1px solid var(--accent); border-left: 3.5px solid var(--accent); border-radius: 5px; padding: 2.2mm 3mm; font-size: 7pt; line-height: 1.35; }
    .anat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2.2mm; }
    .anat-grid > div, .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 2mm 2.6mm; }
    .anat-grid h4, .info-box h4 { margin: 0 0 1mm; font-size: 6pt; font-weight: 800; color: var(--accent); letter-spacing: 0.04em; }
    .anat-grid p { margin: 0; font-size: 6.7pt; line-height: 1.3; color: #1e293b; }
    .dosing-bar { display: grid; grid-template-columns: repeat(3,1fr); border: 1px solid #d8e2ee; border-radius: 5px; background: #f8fafc; overflow: hidden; }
    .dosing-bar > div { text-align: center; padding: 1.8mm 2mm; border-right: 1px solid #e2e8f0; }
    .dosing-bar > div:last-child { border-right: none; }
    .dosing-bar small { display: block; font-size: 5.5pt; font-weight: 700; color: #64748b; }
    .dosing-bar strong { font-size: 8.5pt; color: #137fec; font-family: 'Manrope', sans-serif; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4mm; }
    .col-stack { display: flex; flex-direction: column; gap: 2mm; }
    .info-box ul { margin: 0; padding-left: 3.5mm; font-size: 6.4pt; line-height: 1.32; color: #1e293b; }
    .warning-box { background: #fff7ed; border: 1px solid #ea580c; border-radius: 5px; padding: 2mm 2.8mm; }
    .warning-box h4 { margin: 0 0 0.8mm; font-size: 6pt; color: #9a3412; font-weight: 800; }
    .warning-box p { margin: 0; font-size: 6.4pt; color: #9a3412; line-height: 1.3; }
    .pearl-box { background: #fefce8; border: 1px solid #ca8a04; border-radius: 5px; padding: 1.8mm 2.6mm; }
    .pearl-box h4 { margin: 0 0 0.6mm; font-size: 5.8pt; color: #854d0e; font-weight: 800; }
    .pearl-box p { margin: 0; font-size: 6.2pt; color: #713f12; line-height: 1.28; }
    .indications { font-size: 6pt; color: #334155; }
    .page-foot { border-top: 1px solid #e2e8f0; padding: 2mm 8mm 3mm; display: flex; justify-content: space-between; font-size: 6pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .cover-page { background: ${rgbCss(theme.coverBg)}; color: ${rgbCss(theme.coverText)}; }
    .cover-spine { position: absolute; left: 0; top: 0; bottom: 0; width: 5mm; background: ${rgbCss(theme.accent)}; }
    .cover-content { flex: 1; padding: 18mm 14mm 16mm 18mm; display: flex; flex-direction: column; }
    .cover-pub { font-size: 8pt; font-weight: 800; letter-spacing: 0.14em; color: ${rgbCss(theme.accent)}; text-transform: uppercase; }
    .cover-badge { font-size: 6.5pt; color: ${rgbCss(theme.coverSubtext)}; margin-top: 4px; letter-spacing: 0.1em; text-transform: uppercase; }
    .cover-title { margin-top: 22mm; font-size: 24pt; line-height: 1.08; color: ${rgbCss(theme.coverText)}; }
    .cover-rule { width: 30mm; height: 1.5mm; background: ${rgbCss(theme.accent)}; margin: 6mm 0; }
    .cover-sub { font-size: 10.5pt; line-height: 1.45; color: ${rgbCss(theme.coverSubtext)}; max-width: 90%; }
    .cover-pill { margin-top: 8mm; align-self: flex-start; padding: 6px 12px; border-radius: 6px; background: rgba(19,127,236,0.22); border: 1px solid rgba(19,127,236,0.45); font-size: 7pt; font-weight: 800; letter-spacing: 0.08em; }
    .cover-footer { margin-top: auto; border-top: 1px solid rgba(255,255,255,0.18); padding-top: 5mm; display: flex; flex-direction: column; gap: 3px; }
    .cover-footer strong { font-size: 12pt; }
    .cover-footer span { font-size: 8pt; color: ${rgbCss(theme.coverSubtext)}; }
    @media print {
      body { background: #fff; }
      .toolbar { display: none !important; }
      .book { padding: 0; gap: 0; }
      .page { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong>${escapeHtml(config.title)}</strong>
      <span style="opacity:.75;font-size:12px;margin-left:10px;">${sorted.length} músculos · ${spec.widthMm} × ${spec.heightMm} mm · Activa "Gráficos de fondo" al imprimir</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()">Imprimir / Guardar como PDF</button>
      <button class="sec" onclick="window.close()">Cerrar</button>
    </div>
  </div>
  <main class="book">
    ${coverHtml}
    ${cardsHtml}
  </main>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
