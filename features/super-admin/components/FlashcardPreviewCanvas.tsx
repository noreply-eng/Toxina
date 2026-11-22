import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PdfBookConfig, ResolvedMuscleForBook } from '../../../types/pdfExport';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  COLOR_THEMES,
  formatDoseRange,
  getEffectivePaperSpec,
} from '../../../utils/muscleBookCatalog';

interface FlashcardPreviewCanvasProps {
  item: ResolvedMuscleForBook | null;
  cardNumber: number;
  totalSelected: number;
  config: PdfBookConfig;
  onPrev: () => void;
  onNext: () => void;
}

type PreviewView = 'front' | 'back' | 'spread' | 'cover';

function rgbStr(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

const FlashcardPreviewCanvas: React.FC<FlashcardPreviewCanvasProps> = ({
  item,
  cardNumber,
  totalSelected,
  config,
  onPrev,
  onNext,
}) => {
  const navigate = useNavigate();
  const [view, setView] = useState<PreviewView>('front');
  const spec = getEffectivePaperSpec(config);
  const theme = COLOR_THEMES[config.colorTheme] || COLOR_THEMES['sonotox-editorial'];
  const aspectRatio = `${spec.widthMm} / ${spec.heightMm}`;

  const meta = item ? CATEGORY_META[item.muscle.category] : CATEGORY_META['upper-limb'];

  const renderFrontCard = (compact = false) => {
    if (!item) return null;
    const { muscle } = item;
    return (
      <div
        className="relative bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col select-none"
        style={{ aspectRatio }}
      >
        {/* Regional top stripe */}
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: meta.hex }} />

        {/* Simulated right thumb-index tab */}
        <div
          className="absolute right-0 w-1.5 rounded-l-sm"
          style={{
            backgroundColor: meta.hex,
            top: `${14 + CATEGORY_ORDER.indexOf(muscle.category) * 14}%`,
            height: '12%',
          }}
        />

        <div className={`flex-1 flex flex-col min-h-0 ${compact ? 'p-2.5 gap-1.5' : 'p-4 gap-2'}`}>
          {/* Header badges */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-black text-white shrink-0"
                style={{ backgroundColor: meta.hex }}
              >
                #{String(cardNumber).padStart(2, '0')}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase truncate"
                style={{
                  backgroundColor: theme.isEcoInk ? '#f1f5f9' : meta.softHex,
                  color: meta.hex,
                }}
              >
                {meta.shortLabel} · {muscle.region}
              </span>
            </div>
            <span className="text-[7px] font-extrabold text-slate-400 tracking-wider shrink-0">
              ANVERSO
            </span>
          </div>

          {/* Title */}
          <div>
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-black leading-tight text-slate-900 truncate`}>
              {muscle.name}
            </p>
            <p className="text-[10px] italic font-semibold truncate" style={{ color: meta.hex }}>
              {muscle.latinName}
            </p>
          </div>

          {/* Anatomy image frame */}
          {config.includeMotorPointImage && (
            <div className="relative flex-1 min-h-[76px] max-h-[44%] rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center p-1">
              {item.effectiveMotorImageUrl ? (
                <>
                  <img
                    src={item.effectiveMotorImageUrl}
                    alt={muscle.name}
                    className="max-w-full max-h-full object-contain"
                  />
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/85 text-white text-[7px] font-bold uppercase">
                    Anatomía · Punto Motor
                  </span>
                </>
              ) : (
                <div className="w-full h-full border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-center px-2 text-slate-400">
                  <span className="material-symbols-outlined text-base">image</span>
                  <span className="text-[8px] font-bold">Sin foto anatómica</span>
                </div>
              )}
            </div>
          )}

          {/* Motor point callout */}
          <div
            className="rounded-md px-2 py-1.5 border text-[8.5px] leading-snug"
            style={{
              backgroundColor: theme.isEcoInk ? '#f8fafc' : meta.softHex,
              borderColor: meta.hex,
              borderLeftWidth: 3,
            }}
          >
            <p className="font-black text-[7px] uppercase" style={{ color: meta.hex }}>
              Punto Motor
            </p>
            <p className="text-slate-800 line-clamp-2">{muscle.motorPoint.description}</p>
          </div>

          {/* Anatomy 2x2 */}
          {config.includeAnatomyDetails && (
            <div className="grid grid-cols-2 gap-1.5 text-[8px] leading-tight">
              {[
                ['ORIGEN', muscle.anatomy.origin],
                ['INSERCIÓN', muscle.anatomy.insertion],
                ['INERVACIÓN', muscle.anatomy.innervation],
                ['FUNCIÓN', muscle.anatomy.function],
              ].map(([lbl, val]) => (
                <div key={lbl} className="rounded border border-slate-200 bg-slate-50/80 p-1.5">
                  <p className="font-black text-[6.8px]" style={{ color: meta.hex }}>
                    {lbl}
                  </p>
                  <p className="text-slate-700 line-clamp-2 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-slate-200 flex items-center justify-between text-[7px] font-bold text-slate-400 uppercase shrink-0">
          <span className="truncate">{config.title}</span>
          {config.includePageNumbers && <span className="text-slate-700">1</span>}
        </div>
      </div>
    );
  };

  const renderBackCard = (compact = false) => {
    if (!item) return null;
    const { muscle } = item;
    const landmarks = muscle.usgGuidance?.landmarks?.length
      ? muscle.usgGuidance.landmarks
      : item.fallbackUsgText
      ? [item.fallbackUsgText]
      : ['Identificar vientre muscular y planos fasciales con sonda lineal.'];

    return (
      <div
        className="relative bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col select-none"
        style={{ aspectRatio }}
      >
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: meta.hex }} />

        <div className={`flex-1 flex flex-col min-h-0 ${compact ? 'p-2.5 gap-1.5' : 'p-4 gap-2'}`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className={`${compact ? 'text-[11px]' : 'text-xs'} font-black text-slate-900 truncate`}>
                #{String(cardNumber).padStart(2, '0')} {muscle.name}
              </p>
              <p className="text-[8.5px] italic text-slate-500 truncate">
                {muscle.latinName} · {muscle.usgGuidance?.transducerType || 'Lineal'}
              </p>
            </div>
            <span className="text-[7px] font-extrabold tracking-wider shrink-0" style={{ color: meta.hex }}>
              REVERSO · USG
            </span>
          </div>

          {/* USG Frame */}
          {config.includeUsgImage && (
            <div className="relative flex-1 min-h-[72px] max-h-[38%] rounded-lg bg-[#0b1220] border border-slate-800 overflow-hidden flex items-center justify-center p-1">
              {item.effectiveUsgImageUrl ? (
                <div className="relative inline-flex max-w-full max-h-full">
                  <img
                    src={item.effectiveUsgImageUrl}
                    alt={`USG ${muscle.name}`}
                    className="max-w-full max-h-full object-contain block"
                  />
                  {config.includeMotorPointPin && item.effectiveCoordinates && (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `${item.effectiveCoordinates.x}%`,
                        top: `${item.effectiveCoordinates.y}%`,
                      }}
                    >
                      <div className="size-4 rounded-full border-2 border-red-500 ring-2 ring-white flex items-center justify-center">
                        <div className="size-1.5 rounded-full bg-red-500" />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full border border-dashed border-slate-700 rounded flex flex-col items-center justify-center text-center px-2 text-slate-400">
                  <span className="material-symbols-outlined text-base">ultrasound</span>
                  <span className="text-[8px] font-bold">Sin captura USG</span>
                </div>
              )}
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-primary text-white text-[7px] font-bold uppercase">
                USG · {item.effectiveUsgView}
              </span>
            </div>
          )}

          {/* Dosing table */}
          {config.includeDosingTable && (
            <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-md border border-slate-200 bg-slate-50 py-1 text-center">
              {[
                ['BOTOX®', formatDoseRange(muscle.dosing?.botox)],
                ['DYSPORT®', formatDoseRange(muscle.dosing?.dysport)],
                ['XEOMIN®', formatDoseRange(muscle.dosing?.xeomin)],
              ].map(([brand, dose]) => (
                <div key={brand} className="px-1">
                  <p className="text-[6.5px] font-bold text-slate-500">{brand}</p>
                  <p className="text-[9.5px] font-black text-primary">{dose}</p>
                </div>
              ))}
            </div>
          )}

          {/* Landmarks & Technique */}
          {(config.includeUsgLandmarks || config.includeTechniqueNotes) && (
            <div className="grid grid-cols-2 gap-1.5 text-[7.5px] leading-snug">
              {config.includeUsgLandmarks && (
                <div className="rounded border border-slate-200 bg-slate-50 p-1.5">
                  <p className="font-black text-[6.5px] text-primary mb-0.5">REFERENCIAS USG</p>
                  <ul className="space-y-0.5 text-slate-700">
                    {landmarks.slice(0, 2).map((l, i) => (
                      <li key={i} className="line-clamp-2">• {l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {config.includeTechniqueNotes && (
                <div className="rounded border border-slate-200 bg-slate-50 p-1.5">
                  <p className="font-black text-[6.5px] mb-0.5" style={{ color: meta.hex }}>
                    TÉCNICA
                  </p>
                  <ul className="space-y-0.5 text-slate-700">
                    {muscle.motorPoint.techniqueNotes.slice(0, 2).map((n, i) => (
                      <li key={i} className="line-clamp-2">• {n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Precautions */}
          {config.includePrecautions && (muscle.usgGuidance?.precautions?.length || 0) > 0 && (
            <div className="rounded-md bg-orange-50 border border-orange-300 px-2 py-1 text-[7.5px] text-orange-900">
              <p className="font-black text-[6.5px] uppercase">! Precauciones</p>
              <p className="line-clamp-2">{muscle.usgGuidance!.precautions.join(' · ')}</p>
            </div>
          )}

          {/* Clinical Pearl */}
          {config.includeClinicalPearls && item.pearls.length > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-300 px-2 py-1 text-[7.5px] text-amber-900">
              <p className="font-black text-[6.5px] uppercase truncate">
                Perla: {item.pearls[0].title}
              </p>
              <p className="line-clamp-1">{item.pearls[0].content}</p>
            </div>
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-slate-200 flex items-center justify-between text-[7px] font-bold text-slate-400 uppercase shrink-0">
          <span className="truncate">{config.website || config.publisher}</span>
          {config.includePageNumbers && <span className="text-slate-700">2</span>}
        </div>
      </div>
    );
  };

  const renderCoverMockup = () => (
    <div
      className="relative rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col select-none mx-auto max-w-[280px] w-full"
      style={{
        aspectRatio,
        backgroundColor: rgbStr(theme.coverBg),
        color: rgbStr(theme.coverText),
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: rgbStr(theme.accent) }} />
      <div className="flex-1 p-5 pl-6 flex flex-col">
        <div className="grid grid-cols-5 gap-0.5 mb-3">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="h-1 rounded-full" style={{ backgroundColor: CATEGORY_META[cat].hex }} />
          ))}
        </div>
        <p className="text-[8px] font-black tracking-widest uppercase" style={{ color: rgbStr(theme.accent) }}>
          {config.publisher}
        </p>
        <p className="text-[7px] uppercase tracking-wider mt-0.5" style={{ color: rgbStr(theme.coverSubtext) }}>
          {config.coverBadge}
        </p>

        <img
          src="/icons/icono-ultrasonido.svg"
          alt="Logo"
          className="h-10 w-auto object-contain self-start mt-4 opacity-95"
        />

        <h3 className="text-lg font-black leading-tight mt-3 tracking-tight uppercase">
          {config.title || 'ATLAS DE FLASHCARDS'}
        </h3>
        <div className="w-10 h-0.5 my-2.5" style={{ backgroundColor: rgbStr(theme.accent) }} />
        <p className="text-[9.5px] leading-relaxed" style={{ color: rgbStr(theme.coverSubtext) }}>
          {config.subtitle}
        </p>

        <div className="mt-3 inline-flex self-start px-2 py-1 rounded bg-primary/20 border border-primary/40 text-[7.5px] font-black tracking-wide">
          {totalSelected} MÚSCULOS · ANATOMÍA + USG
        </div>

        <div className="mt-auto pt-3 border-t border-white/15">
          <p className="text-xs font-black">{config.author}</p>
          <p className="text-[8.5px]" style={{ color: rgbStr(theme.coverSubtext) }}>
            {[config.edition, config.year, config.website].filter(Boolean).join(' · ')}
          </p>
          {config.isbn && (
            <p className="text-[7.5px] font-bold mt-0.5" style={{ color: rgbStr(theme.accent) }}>
              ISBN: {config.isbn}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-lg">auto_stories</span>
            Vista Previa Editorial en Vivo
          </h3>
          <p className="text-[11px] text-slate-500">
            Proporción real {spec.dimensionsLabel} {config.cropMarks ? '· Con marcas de corte' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
          {[
            { id: 'front' as PreviewView, label: 'Anverso' },
            { id: 'back' as PreviewView, label: 'Reverso' },
            { id: 'spread' as PreviewView, label: 'Doble' },
            { id: 'cover' as PreviewView, label: 'Portada' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                view === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview Stage */}
      <div className="relative rounded-2xl bg-slate-200/75 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-center min-h-[340px]">
        {view === 'cover' ? (
          renderCoverMockup()
        ) : !item ? (
          <div className="text-center text-slate-400 space-y-2 py-10">
            <span className="material-symbols-outlined text-4xl">menu_book</span>
            <p className="text-xs font-bold">Selecciona al menos un músculo para previsualizar su flashcard.</p>
          </div>
        ) : view === 'spread' ? (
          <div className="grid grid-cols-2 gap-3 w-full max-w-[460px]">
            {renderFrontCard(true)}
            {renderBackCard(true)}
          </div>
        ) : (
          <div className={`relative w-full max-w-[280px] ${config.cropMarks ? 'p-2' : ''}`}>
            {config.cropMarks && (
              <>
                <span className="pointer-events-none absolute top-0 left-2 w-0.5 h-1.5 bg-slate-400" />
                <span className="pointer-events-none absolute top-2 left-0 w-1.5 h-0.5 bg-slate-400" />
                <span className="pointer-events-none absolute top-0 right-2 w-0.5 h-1.5 bg-slate-400" />
                <span className="pointer-events-none absolute top-2 right-0 w-1.5 h-0.5 bg-slate-400" />
                <span className="pointer-events-none absolute bottom-0 left-2 w-0.5 h-1.5 bg-slate-400" />
                <span className="pointer-events-none absolute bottom-2 left-0 w-1.5 h-0.5 bg-slate-400" />
                <span className="pointer-events-none absolute bottom-0 right-2 w-0.5 h-1.5 bg-slate-400" />
                <span className="pointer-events-none absolute bottom-2 right-0 w-1.5 h-0.5 bg-slate-400" />
              </>
            )}
            {view === 'front' ? renderFrontCard(false) : renderBackCard(false)}
          </div>
        )}
      </div>

      {/* Preview Navigation Footer */}
      {item && view !== 'cover' && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrev}
              disabled={totalSelected <= 1}
              className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"
              title="Músculo anterior"
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-1">
              Ficha {cardNumber} / {totalSelected} · <strong className="text-slate-900 dark:text-white">{item.muscle.name}</strong>
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={totalSelected <= 1}
              className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer"
              title="Siguiente músculo"
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/admin/media/${item.muscle.id}`)}
            className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Editar fotos
          </button>
        </div>
      )}
    </div>
  );
};

export default FlashcardPreviewCanvas;
