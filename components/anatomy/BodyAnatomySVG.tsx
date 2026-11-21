import React, { useMemo, useState } from 'react';
import { BodyRegionKey, AnatomyView, bodyRegionsDatabase } from '../../data/bodyAnatomyData';
import { bodyPathsData, BodyGender } from '../../data/bodyPathsData';

export interface BodyAnatomySVGProps {
  view: AnatomyView;
  selectedRegion: BodyRegionKey | null;
  hoveredRegion?: BodyRegionKey | null;
  highlightedRegions?: BodyRegionKey[];
  onSelectRegion: (region: BodyRegionKey) => void;
  onHoverRegion?: (region: BodyRegionKey | null) => void;
  className?: string;
  zoom?: number;
  bodyGender?: BodyGender;
  onChangeBodyGender?: (gender: BodyGender) => void;
  showGenderToggle?: boolean;
}

type FascicleRole = 'primary' | 'secondary' | 'silhouette' | 'inert';

interface SlugAnatomicalMeta {
  region: BodyRegionKey | null;
  role: FascicleRole;
  subLabel: string;
}

/**
 * Maps each high-definition MuscleMap anatomical group slug to SONOTOX clinical regions.
 * Ordered from background/structural layers to foreground muscular bellies.
 */
const FRONT_SLUG_ORDER: Array<{ slug: string; meta: SlugAnatomicalMeta }> = [
  // Structural & articular silhouette landmarks
  { slug: 'hair', meta: { region: 'cabeza', role: 'silhouette', subLabel: 'Bóveda Craneal' } },
  { slug: 'knees', meta: { region: null, role: 'inert', subLabel: 'Rótula y Articulación Femorotibial' } },
  { slug: 'ankles', meta: { region: 'pantorrillas', role: 'silhouette', subLabel: 'Maléolos y Cuello del Pie' } },
  { slug: 'feet', meta: { region: 'pantorrillas', role: 'secondary', subLabel: 'Músculos Intrínsecos del Pie y Hallux' } },
  { slug: 'hands', meta: { region: 'antebrazos', role: 'secondary', subLabel: 'Eminencia Tenar, Hipotenar y Dedos' } },

  // Craneofacial & Cervical
  { slug: 'head', meta: { region: 'cabeza', role: 'primary', subLabel: 'Mímica Facial, Masetero y Temporal' } },
  { slug: 'neck', meta: { region: 'cuello', role: 'primary', subLabel: 'ECOM, Escalenos y Platisma' } },
  { slug: 'trapezius', meta: { region: 'trapecio', role: 'primary', subLabel: 'Trapecio (Fibras Superiores)' } },

  // Upper Trunk & Shoulder Girdle
  { slug: 'serratus', meta: { region: 'pecho', role: 'secondary', subLabel: 'Serrato Anterior (Digitaciones Costales)' } },
  { slug: 'chest', meta: { region: 'pecho', role: 'primary', subLabel: 'Pectoral Mayor y Menor' } },
  { slug: 'deltoids', meta: { region: 'hombros', role: 'primary', subLabel: 'Deltoides Anterior y Lateral' } },

  // Upper Limb
  { slug: 'triceps', meta: { region: 'brazos', role: 'secondary', subLabel: 'Braquial y Tabique Intermuscular' } },
  { slug: 'biceps', meta: { region: 'brazos', role: 'primary', subLabel: 'Bíceps Braquial y Coracobraquial' } },
  { slug: 'forearm', meta: { region: 'antebrazos', role: 'primary', subLabel: 'Braquiorradial, Pronadores y Flexores' } },

  // Core & Abdominal Wall
  { slug: 'obliques', meta: { region: 'abdomen', role: 'secondary', subLabel: 'Oblicuo Externo e Interno' } },
  { slug: 'abs', meta: { region: 'abdomen', role: 'primary', subLabel: 'Recto Abdominal' } },

  // Pelvis, Hip Flexors & Adductors
  { slug: 'hip-flexors', meta: { region: 'pelvis', role: 'primary', subLabel: 'Psoas-Ilíaco y Tensor de la Fascia Lata' } },
  { slug: 'adductors', meta: { region: 'pelvis', role: 'primary', subLabel: 'Pectíneo, Aductor Largo/Mayor y Grácil' } },

  // Lower Limb Anterior
  { slug: 'quadriceps', meta: { region: 'cuadriceps', role: 'primary', subLabel: 'Recto Femoral, Vasto Lateral y Vasto Medial (VMO)' } },
  { slug: 'calves', meta: { region: 'pantorrillas', role: 'secondary', subLabel: 'Gastrocnemio Medial y Sóleo' } },
  { slug: 'tibialis', meta: { region: 'pantorrillas', role: 'primary', subLabel: 'Tibial Anterior y Extensores Largos' } },
];

const BACK_SLUG_ORDER: Array<{ slug: string; meta: SlugAnatomicalMeta }> = [
  // Structural & articular silhouette landmarks
  { slug: 'hair', meta: { region: 'cabeza', role: 'silhouette', subLabel: 'Región Craneal Posterior' } },
  { slug: 'ankles', meta: { region: 'pantorrillas', role: 'silhouette', subLabel: 'Tendón Calcáneo Distal y Maléolos' } },
  { slug: 'feet', meta: { region: 'pantorrillas', role: 'secondary', subLabel: 'Calcáneo y Región Plantar' } },
  { slug: 'hands', meta: { region: 'antebrazos', role: 'secondary', subLabel: 'Dorso de la Mano y Extensores Distales' } },

  // Head & Posterior Neck
  { slug: 'head', meta: { region: 'cabeza', role: 'primary', subLabel: 'Occipital y Línea Nucal Superior' } },
  { slug: 'neck', meta: { region: 'cuello', role: 'primary', subLabel: 'Esplenio de la Cabeza y Paravertebrales' } },

  // Back & Shoulder Girdle
  { slug: 'trapezius', meta: { region: 'trapecio', role: 'primary', subLabel: 'Trapecio (Porción Descendente, Transversa y Ascendente)' } },
  { slug: 'deltoids', meta: { region: 'hombros', role: 'primary', subLabel: 'Deltoides Posterior' } },
  { slug: 'lower-back', meta: { region: 'dorsales', role: 'secondary', subLabel: 'Cuadrado Lumbar y Erectores Espinales' } },
  { slug: 'upper-back', meta: { region: 'dorsales', role: 'primary', subLabel: 'Dorsal Ancho, Infraespinoso y Redondo Mayor' } },

  // Posterior Upper Limb
  { slug: 'triceps', meta: { region: 'triceps', role: 'primary', subLabel: 'Tríceps Braquial (Cabezas Larga, Lateral y Medial)' } },
  { slug: 'forearm', meta: { region: 'antebrazos', role: 'primary', subLabel: 'Compartimento Extensor y Supinador' } },

  // Gluteal & Posterior Lower Limb
  { slug: 'gluteal', meta: { region: 'gluteos', role: 'primary', subLabel: 'Glúteo Medio, Glúteo Mayor y Pelvitrocantéreos' } },
  { slug: 'adductors', meta: { region: 'isquiotibiales', role: 'secondary', subLabel: 'Aductor Mayor (Porción Posterior)' } },
  { slug: 'hamstring', meta: { region: 'isquiotibiales', role: 'primary', subLabel: 'Bíceps Femoral, Semitendinoso y Semimembranoso' } },
  { slug: 'calves', meta: { region: 'pantorrillas', role: 'primary', subLabel: 'Gastrocnemio Medial/Lateral y Sóleo' } },
];

const BodyAnatomySVG: React.FC<BodyAnatomySVGProps> = ({
  view,
  selectedRegion,
  hoveredRegion,
  highlightedRegions = [],
  onSelectRegion,
  onHoverRegion,
  className = '',
  zoom = 1,
  bodyGender: controlledGender,
  onChangeBodyGender,
  showGenderToggle = true,
}) => {
  const [internalGender, setInternalGender] = useState<BodyGender>('male');
  const [hoveredSubLabel, setHoveredSubLabel] = useState<string | null>(null);

  const gender: BodyGender = controlledGender ?? internalGender;

  const handleGenderChange = (newGender: BodyGender) => {
    setInternalGender(newGender);
    onChangeBodyGender?.(newGender);
  };

  const isSelected = (part: BodyRegionKey | null) => part !== null && selectedRegion === part;
  const isHovered = (part: BodyRegionKey | null) => part !== null && hoveredRegion === part;
  const isHighlighted = (part: BodyRegionKey | null) =>
    part !== null && highlightedRegions.includes(part);

  const getFascicleClass = (region: BodyRegionKey | null, role: FascicleRole) => {
    // Crisp negative-space inter-fascicle groove stroke (like openGym / MuscleMap)
    const baseStroke = 'stroke-white dark:stroke-[#0b1320] [stroke-linejoin:round] transition-colors duration-200 ';

    if (role === 'inert' || region === null) {
      return (
        baseStroke +
        'stroke-[2.2] fill-slate-200/85 dark:fill-[#111c2b] pointer-events-none'
      );
    }

    const active = isSelected(region);
    const hovered = isHovered(region);
    const highlighted = isHighlighted(region);

    if (active) {
      if (role === 'primary') {
        return (
          baseStroke +
          'cursor-pointer stroke-[2.2] fill-sky-400 dark:fill-[#38bdf8]'
        );
      }
      if (role === 'secondary') {
        return (
          baseStroke +
          'cursor-pointer stroke-[2.2] fill-sky-500/85 dark:fill-[#0284c7]'
        );
      }
      // silhouette (e.g. hair or ankles belonging to active region)
      return (
        baseStroke +
        'cursor-pointer stroke-[2.2] fill-sky-600/45 dark:fill-sky-800/55'
      );
    }

    if (hovered) {
      if (role === 'primary') {
        return (
          baseStroke +
          'cursor-pointer stroke-[2.2] fill-sky-400/80 dark:fill-sky-500/80'
        );
      }
      if (role === 'secondary') {
        return (
          baseStroke +
          'cursor-pointer stroke-[2.2] fill-sky-500/65 dark:fill-sky-600/65'
        );
      }
      return (
        baseStroke +
        'cursor-pointer stroke-[2.2] fill-sky-600/35 dark:fill-sky-800/40'
      );
    }

    if (highlighted) {
      return (
        baseStroke +
        'cursor-pointer stroke-[2.2] fill-sky-300/60 dark:fill-sky-900/70'
      );
    }

    // Default resting state: anatomical depth differentiation between primary bellies, secondary bellies, and silhouette landmarks
    if (role === 'silhouette') {
      return (
        baseStroke +
        'cursor-pointer stroke-[2.2] fill-slate-200/90 dark:fill-[#121d2d] hover:fill-sky-400/50 dark:hover:fill-sky-700/50'
      );
    }
    if (role === 'secondary') {
      return (
        baseStroke +
        'cursor-pointer stroke-[2.4] fill-slate-300/80 dark:fill-[#19283c] hover:fill-sky-400/70 dark:hover:fill-sky-600/60'
      );
    }
    return (
      baseStroke +
      'cursor-pointer stroke-[2.5] fill-slate-300/95 dark:fill-[#1e3048] hover:fill-sky-400/75 dark:hover:fill-sky-500/70'
    );
  };

  const handlePointerEnter = (part: BodyRegionKey | null, subLabel: string) => {
    setHoveredSubLabel(subLabel);
    if (part) {
      onHoverRegion?.(part);
    }
  };

  const handlePointerLeave = () => {
    setHoveredSubLabel(null);
    onHoverRegion?.(null);
  };

  const geometry = bodyPathsData[gender][view];
  const slugOrder = view === 'front' ? FRONT_SLUG_ORDER : BACK_SLUG_ORDER;

  // Accurate anatomical belly centroids in MuscleMap viewBox coordinates
  const regionPins: Record<string, { x: number; y: number; label: string }> = useMemo(() => {
    if (gender === 'male') {
      if (view === 'front') {
        return {
          cabeza: { x: 363, y: 192, label: 'Cabeza y Cara' },
          cuello: { x: 363, y: 278, label: 'Cuello' },
          trapecio: { x: 298, y: 298, label: 'Trapecio Sup.' },
          hombros: { x: 235, y: 348, label: 'Hombros' },
          pecho: { x: 308, y: 377, label: 'Pectorales' },
          brazos: { x: 204, y: 448, label: 'Bíceps y Brazo' },
          antebrazos: { x: 162, y: 585, label: 'Antebrazo y Mano' },
          abdomen: { x: 364, y: 525, label: 'Abdomen y Core' },
          pelvis: { x: 312, y: 710, label: 'Pelvis y Aductores' },
          cuadriceps: { x: 282, y: 805, label: 'Cuádriceps' },
          pantorrillas: { x: 278, y: 1115, label: 'Pantorrilla y Pie' },
        };
      } else {
        return {
          cabeza: { x: 1083, y: 165, label: 'Cabeza Post.' },
          cuello: { x: 1083, y: 255, label: 'Cuello Post.' },
          trapecio: { x: 1083, y: 365, label: 'Trapecio' },
          hombros: { x: 965, y: 356, label: 'Deltoides Post.' },
          triceps: { x: 936, y: 448, label: 'Tríceps' },
          antebrazos: { x: 882, y: 585, label: 'Antebrazo y Mano' },
          dorsales: { x: 1020, y: 465, label: 'Dorsales y Lumbar' },
          gluteos: { x: 1025, y: 700, label: 'Glúteos' },
          isquiotibiales: { x: 1015, y: 865, label: 'Isquiosurales' },
          pantorrillas: { x: 1005, y: 1120, label: 'Gemelos y Sóleo' },
        };
      }
    } else {
      if (view === 'front') {
        return {
          cabeza: { x: 320, y: 164, label: 'Cabeza y Cara' },
          cuello: { x: 321, y: 286, label: 'Cuello' },
          trapecio: { x: 268, y: 286, label: 'Trapecio Sup.' },
          hombros: { x: 198, y: 328, label: 'Hombros' },
          pecho: { x: 272, y: 377, label: 'Pectorales' },
          brazos: { x: 182, y: 432, label: 'Bíceps y Brazo' },
          antebrazos: { x: 132, y: 565, label: 'Antebrazo y Mano' },
          abdomen: { x: 321, y: 525, label: 'Abdomen y Core' },
          pelvis: { x: 285, y: 705, label: 'Pelvis y Aductores' },
          cuadriceps: { x: 248, y: 796, label: 'Cuádriceps' },
          pantorrillas: { x: 268, y: 1170, label: 'Pantorrilla y Pie' },
        };
      } else {
        return {
          cabeza: { x: 1143, y: 135, label: 'Cabeza Post.' },
          cuello: { x: 1143, y: 252, label: 'Cuello Post.' },
          trapecio: { x: 1143, y: 343, label: 'Trapecio' },
          hombros: { x: 1024, y: 328, label: 'Deltoides Post.' },
          triceps: { x: 998, y: 430, label: 'Tríceps' },
          antebrazos: { x: 952, y: 566, label: 'Antebrazo y Mano' },
          dorsales: { x: 1085, y: 445, label: 'Dorsales y Lumbar' },
          gluteos: { x: 1075, y: 696, label: 'Glúteos' },
          isquiotibiales: { x: 1068, y: 880, label: 'Isquiosurales' },
          pantorrillas: { x: 1085, y: 1135, label: 'Gemelos y Sóleo' },
        };
      }
    }
  }, [gender, view]);

  // Midline and axis coordinates for subtle medical grid background
  const [vbX, vbY, vbW, vbH] = useMemo(
    () => geometry.vb.split(' ').map(Number),
    [geometry.vb]
  );
  const centerX = useMemo(() => {
    if (gender === 'male') return view === 'front' ? 363.5 : 1083;
    return view === 'front' ? 321 : 1143;
  }, [gender, view]);

  const activeOrHoveredRegion = hoveredRegion || selectedRegion;

  return (
    <div className={`relative flex items-center justify-center select-none overflow-hidden ${className}`}>
      {/* Subtle Morphology Switcher (Masculino / Femenino) */}
      {showGenderToggle && (
        <div
          className="absolute top-1.5 right-1.5 z-10 flex items-center bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 shadow-sm"
          title="Cambiar morfología anatómica"
        >
          <button
            type="button"
            onClick={() => handleGenderChange('male')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
              gender === 'male'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">male</span>
            <span>M</span>
          </button>
          <button
            type="button"
            onClick={() => handleGenderChange('female')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${
              gender === 'female'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[12px]">female</span>
            <span>F</span>
          </button>
        </div>
      )}

      {/* Dynamic zoom container */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-250 origin-center"
        style={{ transform: `scale(${zoom})` }}
      >
        <svg
          viewBox={geometry.vb}
          className="w-full h-full max-h-[600px] drop-shadow-xl transition-all duration-300"
          style={{ overflow: 'visible' }}
          role="group"
          aria-label="Modelo anatómico muscular interactivo"
        >
          {/* Background subtle medical reference axes */}
          <g className="opacity-35 pointer-events-none">
            <line
              x1={centerX}
              y1={vbY + 20}
              x2={centerX}
              y2={vbY + vbH - 20}
              stroke="rgba(56, 189, 248, 0.16)"
              strokeWidth="1.8"
              strokeDasharray="6,6"
            />
            {[0.16, 0.31, 0.52, 0.75, 0.94].map((ratio, idx) => {
              const y = Math.round(vbY + vbH * ratio);
              return (
                <line
                  key={idx}
                  x1={vbX + 40}
                  y1={y}
                  x2={vbX + vbW - 40}
                  y2={y}
                  stroke="rgba(56, 189, 248, 0.08)"
                  strokeWidth="1.4"
                />
              );
            })}
          </g>

          {/* Render anatomical fascicles grouped by slug */}
          <g key={`${gender}-${view}`} className="animate-fadeIn">
            {slugOrder.map(({ slug, meta }) => {
              const paths = geometry.p[slug];
              if (!paths || paths.length === 0) return null;

              const { region, role, subLabel } = meta;
              const active = isSelected(region);
              const hovered = isHovered(region);
              const fascicleClass = getFascicleClass(region, role);

              const glowFilter =
                active && role !== 'silhouette'
                  ? 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.65))'
                  : hovered && role !== 'silhouette'
                  ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.35))'
                  : undefined;

              return (
                <g
                  key={slug}
                  data-slug={slug}
                  data-part={region ?? 'inert'}
                  style={glowFilter ? { filter: glowFilter } : undefined}
                  onClick={region ? () => onSelectRegion(region) : undefined}
                  onPointerEnter={() => handlePointerEnter(region, subLabel)}
                  onPointerLeave={handlePointerLeave}
                >
                  {paths.map((d, i) => (
                    <path key={`${slug}-${i}`} className={fascicleClass} d={d}>
                      <title>
                        {region
                          ? `${bodyRegionsDatabase[region]?.shortLabel} — ${subLabel}`
                          : subLabel}
                      </title>
                    </path>
                  ))}
                </g>
              );
            })}

            {/* Craneofacial Clinical Muscle Landmarks Overlay (Front View) */}
            {view === 'front' && (
              <g
                className={`pointer-events-none transition-opacity duration-200 ${
                  isSelected('cabeza') || isHovered('cabeza')
                    ? 'stroke-white dark:stroke-slate-950 opacity-85'
                    : 'stroke-slate-500/50 dark:stroke-slate-400/35 opacity-75'
                }`}
                fill="none"
                strokeLinecap="round"
              >
                {gender === 'male' ? (
                  <>
                    {/* Frontalis & Temporal lines */}
                    <path d="M 332 145 Q 348 140 361 144 M 366 144 Q 379 140 395 145" strokeWidth="1.5" />
                    <path d="M 322 148 C 318 160 318 172 322 184 M 405 148 C 409 160 409 172 405 184" strokeWidth="1.4" />
                    {/* Corrugator & Procerus glabellar arch */}
                    <path d="M 334 166 Q 348 161 360 167 M 367 167 Q 379 161 393 166" strokeWidth="2" />
                    <path d="M 363.5 162 L 363.5 190" strokeWidth="1.6" />
                    {/* Orbicularis oculi */}
                    <ellipse cx="345" cy="175" rx="10" ry="4.5" strokeWidth="1.5" />
                    <ellipse cx="382" cy="175" rx="10" ry="4.5" strokeWidth="1.5" />
                    {/* Zygomaticus & Masseter contour */}
                    <path d="M 323 192 C 324 206 328 218 338 228 M 404 192 C 403 206 399 218 389 228" strokeWidth="1.6" />
                    {/* Orbicularis oris & Mentalis */}
                    <path d="M 349 214 Q 363.5 219 378 214" strokeWidth="1.8" />
                    <path d="M 354 228 Q 363.5 224 373 228" strokeWidth="1.5" />
                  </>
                ) : (
                  <>
                    {/* Frontalis & Corrugator arch (Female) */}
                    <path d="M 288 128 Q 304 123 317 127 M 323 127 Q 336 123 352 128" strokeWidth="1.5" />
                    <path d="M 290 148 Q 305 143 317 149 M 323 149 Q 335 143 350 148" strokeWidth="1.9" />
                    <path d="M 320 145 L 320 174" strokeWidth="1.5" />
                    {/* Orbicularis oculi */}
                    <ellipse cx="302" cy="157" rx="9.5" ry="4.2" strokeWidth="1.4" />
                    <ellipse cx="338" cy="157" rx="9.5" ry="4.2" strokeWidth="1.4" />
                    {/* Masseter / Zygomaticus */}
                    <path d="M 282 175 C 284 190 290 202 300 212 M 358 175 C 356 190 350 202 340 212" strokeWidth="1.5" />
                    {/* Orbicularis oris & Mentalis */}
                    <path d="M 306 196 Q 320 201 334 196" strokeWidth="1.7" />
                    <path d="M 311 210 Q 320 207 329 210" strokeWidth="1.4" />
                  </>
                )}
              </g>
            )}
          </g>

          {/* Active indicator dot and label pulse */}
          {selectedRegion && regionPins[selectedRegion] && (
            <g className="pointer-events-none transition-all duration-300">
              <circle
                cx={regionPins[selectedRegion].x}
                cy={regionPins[selectedRegion].y}
                r="24"
                className="fill-sky-400/35 animate-ping"
              />
              <circle
                cx={regionPins[selectedRegion].x}
                cy={regionPins[selectedRegion].y}
                r="9"
                className="fill-white stroke-sky-500 stroke-[4] shadow-lg"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Floating Region & Sub-Muscle Fascicle Indicator on Hover/Select */}
      {activeOrHoveredRegion && (
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/92 dark:bg-slate-950/95 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-sky-500/40 shadow-xl pointer-events-none flex flex-col items-center gap-0.5 z-10 transition-all max-w-[92%]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shrink-0"></span>
            <span className="text-xs font-bold text-sky-300 tracking-wide truncate">
              {bodyRegionsDatabase[activeOrHoveredRegion]?.title || 'Región Anatómica'}
            </span>
          </div>
          {hoveredSubLabel && (
            <span className="text-[10px] font-medium text-slate-300/90 truncate max-w-full">
              {hoveredSubLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default BodyAnatomySVG;
