import React, { useMemo } from 'react';
import { BodyRegionKey, AnatomyView, bodyRegionsDatabase } from '../../data/bodyAnatomyData';

export interface BodyAnatomySVGProps {
  view: AnatomyView;
  selectedRegion: BodyRegionKey | null;
  hoveredRegion?: BodyRegionKey | null;
  highlightedRegions?: BodyRegionKey[];
  onSelectRegion: (region: BodyRegionKey) => void;
  onHoverRegion?: (region: BodyRegionKey | null) => void;
  className?: string;
  zoom?: number;
}

const BodyAnatomySVG: React.FC<BodyAnatomySVGProps> = ({
  view,
  selectedRegion,
  hoveredRegion,
  highlightedRegions = [],
  onSelectRegion,
  onHoverRegion,
  className = '',
  zoom = 1,
}) => {
  const isSelected = (part: BodyRegionKey) => selectedRegion === part;
  const isHovered = (part: BodyRegionKey) => hoveredRegion === part;
  const isHighlighted = (part: BodyRegionKey) => highlightedRegions.includes(part);

  const getPartClass = (part: BodyRegionKey) => {
    const active = isSelected(part);
    const hovered = isHovered(part);
    const highlighted = isHighlighted(part);

    let classes = 'transition-all duration-300 ease-out cursor-pointer ';

    if (active) {
      classes += 'fill-sky-500 stroke-white stroke-[2.2] filter drop-shadow-[0_0_16px_rgba(56,189,248,0.9)]';
    } else if (hovered) {
      classes += 'fill-sky-600/90 dark:fill-sky-600 stroke-sky-200 stroke-[1.8] filter drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]';
    } else if (highlighted) {
      classes += 'fill-sky-950/70 stroke-sky-400 stroke-[1.5]';
    } else {
      classes += 'fill-slate-200/95 dark:fill-[#121c29] stroke-slate-300 dark:stroke-[#26384d] hover:fill-sky-600/70 dark:hover:fill-sky-600/60 hover:stroke-sky-300 stroke-[1.2]';
    }

    return classes;
  };

  const handlePointerEnter = (part: BodyRegionKey) => {
    onHoverRegion?.(part);
  };

  const handlePointerLeave = () => {
    onHoverRegion?.(null);
  };

  // Hotspot center coords for pulsing indicator pin
  const regionPins: Record<string, { x: number; y: number; label: string }> = useMemo(() => {
    if (view === 'front') {
      return {
        cabeza: { x: 170, y: 48, label: 'Cabeza y Cara' },
        cuello: { x: 170, y: 92, label: 'Cuello' },
        hombros: { x: 110, y: 132, label: 'Hombros' },
        pecho: { x: 170, y: 142, label: 'Pectorales' },
        brazos: { x: 92, y: 200, label: 'Bíceps y Brazo' },
        antebrazos: { x: 76, y: 300, label: 'Antebrazo y Mano' },
        abdomen: { x: 170, y: 228, label: 'Abdomen y Core' },
        pelvis: { x: 170, y: 308, label: 'Pelvis y Cadera' },
        cuadriceps: { x: 138, y: 410, label: 'Cuádriceps' },
        pantorrillas: { x: 130, y: 560, label: 'Pantorrilla y Pie' }
      };
    } else {
      return {
        cabeza: { x: 170, y: 48, label: 'Cabeza Post.' },
        cuello: { x: 170, y: 90, label: 'Cuello Post.' },
        trapecio: { x: 170, y: 142, label: 'Trapecio' },
        hombros: { x: 110, y: 136, label: 'Deltoides Post.' },
        triceps: { x: 92, y: 202, label: 'Tríceps' },
        antebrazos: { x: 76, y: 300, label: 'Antebrazo y Mano' },
        dorsales: { x: 170, y: 236, label: 'Dorsales' },
        gluteos: { x: 170, y: 326, label: 'Glúteos' },
        isquiotibiales: { x: 138, y: 426, label: 'Isquiosurales' },
        pantorrillas: { x: 130, y: 560, label: 'Gemelos/Sóleo' }
      };
    }
  }, [view]);

  return (
    <div className={`relative flex items-center justify-center select-none overflow-hidden ${className}`}>
      {/* Dynamic zoom container */}
      <div 
        className="w-full h-full flex items-center justify-center transition-transform duration-250 origin-center"
        style={{ transform: `scale(${zoom})` }}
      >
        <svg
          viewBox="0 0 340 680"
          className="w-full h-full max-h-[600px] drop-shadow-xl transition-all duration-300"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Holographic grid pattern */}
            <pattern id="medical-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="0.8" />
            </pattern>

            {/* Subtle muscle 3D depth gradients */}
            <linearGradient id="muscle-sheen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#0369a1" stopOpacity="0.02" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="hyper-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background subtle medical axis lines */}
          <g className="opacity-40 pointer-events-none">
            {/* Center line */}
            <line x1="170" y1="10" x2="170" y2="670" stroke="rgba(56, 189, 248, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
            {/* Proportional height ticks */}
            <line x1="20" y1="78" x2="320" y2="78" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.75" />
            <line x1="20" y1="180" x2="320" y2="180" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.75" />
            <line x1="20" y1="335" x2="320" y2="335" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.75" />
            <line x1="20" y1="485" x2="320" y2="485" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.75" />
            <line x1="20" y1="655" x2="320" y2="655" stroke="rgba(56, 189, 248, 0.06)" strokeWidth="0.75" />
          </g>

          {/* ========================================================================= */}
          {/* VISTA ANTERIOR (VENTRAL) — ANATOMÍA CLÍNICA DE ALTA DEFINICIÓN */}
          {/* ========================================================================= */}
          {view === 'front' && (
            <g id="pro-anatomy-front" className="animate-fadeIn">
              
              {/* Outer Anatomical Silhouette Halo */}
              <path
                d="M170 14 C188 14 198 26 198 48 C198 64 189 74 180 80 C190 84 208 92 226 101 C245 110 260 128 264 153 C268 179 263 216 261 234 C267 251 282 293 284 324 C286 345 275 368 262 368 C256 368 250 355 248 343 C244 372 238 427 234 464 C240 493 245 543 241 581 C237 615 222 634 205 638 C188 640 181 625 179 610 C176 610 174 610 170 610 C166 610 164 610 161 610 C159 625 152 640 135 638 C118 634 103 615 99 581 C95 543 100 493 106 464 C102 427 96 372 92 343 C90 355 84 368 78 368 C65 368 54 345 56 324 C58 293 73 251 79 234 C77 216 72 179 76 153 C80 128 95 110 114 101 C132 92 150 84 160 80 C151 74 142 64 142 48 C142 26 152 14 170 14 Z"
                className="fill-none stroke-sky-500/25 dark:stroke-sky-500/20 stroke-[4] filter blur-[3px] pointer-events-none"
              />

              {/* 1. CABEZA Y CARA */}
              <g 
                onClick={() => onSelectRegion('cabeza')}
                onPointerEnter={() => handlePointerEnter('cabeza')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="cabeza"
                  className={getPartClass('cabeza')}
                  d="M170 16 C189 16 198 29 198 48 C198 62 193 71 183 79 C178 83 174 85 170 85 C166 85 162 83 157 79 C147 71 142 62 142 48 C142 29 151 16 170 16 Z"
                />
                {/* Facial Features & Muscles */}
                {/* Temporal lines */}
                <path d="M152 30 C154 38 152 46 148 52" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.75] pointer-events-none" />
                <path d="M188 30 C186 38 188 46 192 52" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.75] pointer-events-none" />
                {/* Eyebrow / Corrugator arch */}
                <path d="M151 43 Q160 41 168 43 M172 43 Q180 41 189 43" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.9] pointer-events-none" />
                {/* Orbicularis oculi & Eyes */}
                <path d="M153 49 Q159 47 165 49 M175 49 Q181 47 187 49" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.8] pointer-events-none" />
                {/* Nasal bridge & Procerus */}
                <path d="M170 45 L170 59 L166 62 L174 62" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.85] pointer-events-none" />
                {/* Mouth / Orbicularis oris */}
                <path d="M161 69 Q170 72 179 69" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[0.9] pointer-events-none" />
                {/* Menton / Jawline angle */}
                <path d="M163 76 Q170 78 177 76" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.75] pointer-events-none" />
                <path d="M148 58 C150 68 158 76 170 82 C182 76 190 68 192 58" className="fill-none stroke-slate-400/30 dark:stroke-slate-500/25 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 2. CUELLO (ESTERNOCLEIDOMASTOIDEO Y ESCALENOS) */}
              <g
                onClick={() => onSelectRegion('cuello')}
                onPointerEnter={() => handlePointerEnter('cuello')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="cuello"
                  className={getPartClass('cuello')}
                  d="M157 83 C154 92 147 98 134 104 L206 104 C193 98 186 92 183 83 C178 85 174 86 170 86 C166 86 162 85 157 83 Z"
                />
                {/* SCM heads to sternal notch */}
                <path d="M161 86 C157 92 151 98 147 103" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.9] pointer-events-none" />
                <path d="M179 86 C183 92 189 98 193 103" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.9] pointer-events-none" />
                {/* Sternal notch / Thyroid cartilage */}
                <ellipse cx="170" cy="94" rx="2.5" ry="3" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.75] pointer-events-none" />
                <path d="M166 103 Q170 106 174 103" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.85] pointer-events-none" />
              </g>

              {/* 3. HOMBROS (DELTOIDES ANTERIOR / LATERAL) */}
              <g
                onClick={() => onSelectRegion('hombros')}
                onPointerEnter={() => handlePointerEnter('hombros')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Deltoides Izquierdo */}
                <path
                  data-part="hombros"
                  className={getPartClass('hombros')}
                  d="M133 105 C118 107 101 119 95 137 C89 152 92 168 97 178 C104 171 113 156 121 145 C128 134 131 119 133 105 Z"
                />
                {/* Deltoides Derecho */}
                <path
                  data-part="hombros"
                  className={getPartClass('hombros')}
                  d="M207 105 C222 107 239 119 245 137 C251 152 248 168 243 178 C236 171 227 156 219 145 C212 134 209 119 207 105 Z"
                />
                {/* Deltoid muscle fiber striations */}
                <path d="M130 112 C115 120 105 136 100 156" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <path d="M124 126 C116 138 110 152 108 168" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
                <path d="M210 112 C225 120 235 136 240 156" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <path d="M216 126 C224 138 230 152 232 168" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 4. PECHO / PECTORALES */}
              <g
                onClick={() => onSelectRegion('pecho')}
                onPointerEnter={() => handlePointerEnter('pecho')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Pectoral Izquierdo */}
                <path
                  data-part="pecho"
                  className={getPartClass('pecho')}
                  d="M169 106 L134 106 C132 124 126 138 120 148 C117 162 130 174 153 176 C164 177 169 171 169 162 Z"
                />
                {/* Pectoral Derecho */}
                <path
                  data-part="pecho"
                  className={getPartClass('pecho')}
                  d="M171 106 L206 106 C208 124 214 138 220 148 C223 162 210 174 187 176 C176 177 171 171 171 162 Z"
                />
                {/* Clavicles & sternal line */}
                <path d="M136 107 Q153 111 169 107 M171 107 Q187 111 204 107" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[1] pointer-events-none" />
                <path d="M170 107 L170 172" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[1] pointer-events-none" />
                {/* Pectoral lower crest curve */}
                <path d="M128 152 Q148 172 168 166" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.85] pointer-events-none" />
                <path d="M212 152 Q192 172 172 166" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.85] pointer-events-none" />
                {/* Pectoralis major clavicular / sternocostal split */}
                <path d="M136 122 Q154 136 169 138" className="fill-none stroke-slate-400/35 dark:stroke-slate-500/30 stroke-[0.7] pointer-events-none" />
                <path d="M204 122 Q186 136 171 138" className="fill-none stroke-slate-400/35 dark:stroke-slate-500/30 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 5. BRAZOS / BÍCEPS, BRAQUIAL & CORACOBRAQUIAL */}
              <g
                onClick={() => onSelectRegion('brazos')}
                onPointerEnter={() => handlePointerEnter('brazos')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Bíceps Izquierdo */}
                <path
                  data-part="brazos"
                  className={getPartClass('brazos')}
                  d="M96 179 C91 167 89 152 93 140 C85 155 78 177 77 203 C76 223 82 241 87 253 C96 246 102 229 104 209 C104 196 100 185 96 179 Z"
                />
                {/* Bíceps Derecho */}
                <path
                  data-part="brazos"
                  className={getPartClass('brazos')}
                  d="M244 179 C249 167 251 152 247 140 C255 155 262 177 263 203 C264 223 258 241 253 253 C244 246 238 229 236 209 C236 196 240 185 244 179 Z"
                />
                {/* Biceps long/short head separation & bicipital aponeurosis */}
                <path d="M90 184 C88 204 90 224 94 238" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <path d="M250 184 C252 204 250 224 246 238" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                {/* Brachialis lateral contour */}
                <path d="M84 194 C82 212 84 228 88 240" className="fill-none stroke-slate-400/35 dark:stroke-slate-500/30 stroke-[0.7] pointer-events-none" />
                <path d="M256 194 C258 212 256 228 252 240" className="fill-none stroke-slate-400/35 dark:stroke-slate-500/30 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 6. ANTEBRAZOS Y MANOS (ANTERIOR) */}
              <g
                onClick={() => onSelectRegion('antebrazos')}
                onPointerEnter={() => handlePointerEnter('antebrazos')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Antebrazo Izquierdo */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M87 254 C80 270 68 300 64 328 C61 342 63 352 68 359 L81 357 C92 336 99 298 102 263 C97 258 91 255 87 254 Z"
                />
                {/* Mano Izquierda Anatómica con dedos y eminencia tenar */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M68 359 C65 367 60 378 57 386 C56 394 62 398 69 395 C74 393 77 379 80 368 L81 357 Z"
                />
                {/* Antebrazo Derecho */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M253 254 C260 270 272 300 276 328 C279 342 277 352 272 359 L259 357 C248 336 241 298 238 263 C243 258 249 255 253 254 Z"
                />
                {/* Mano Derecha Anatómica con dedos */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M272 359 C275 367 280 378 283 386 C284 394 278 398 271 395 C266 393 263 379 260 368 L259 357 Z"
                />
                {/* Brachioradialis & Flexor tendons */}
                <path d="M84 268 C78 292 74 320 72 344" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.75] pointer-events-none" />
                <path d="M90 286 C86 312 84 336 82 354" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
                <path d="M256 268 C262 292 266 320 268 344" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.75] pointer-events-none" />
                <path d="M250 286 C254 312 256 336 258 354" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 7. ABDOMEN Y CORE (RECTO ABDOMINAL, OBLICUOS Y SERRATOS) */}
              <g
                onClick={() => onSelectRegion('abdomen')}
                onPointerEnter={() => handlePointerEnter('abdomen')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="abdomen"
                  className={getPartClass('abdomen')}
                  d="M133 177 C123 198 120 225 123 254 C125 273 131 286 137 295 L203 295 C209 286 215 273 217 254 C220 225 217 198 207 177 C195 179 183 180 170 180 C157 180 145 179 133 177 Z"
                />
                {/* Linea alba & 6-pack rectus abdominal blocks */}
                <path d="M170 180 L170 293" className="fill-none stroke-slate-400/75 dark:stroke-slate-500/65 stroke-[1.1] pointer-events-none" />
                <path d="M142 212 Q170 215 198 212" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                <path d="M140 248 Q170 252 200 248" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                {/* External oblique borders */}
                <path d="M129 218 C133 245 137 270 144 288" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.8] pointer-events-none" />
                <path d="M211 218 C207 245 203 270 196 288" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.8] pointer-events-none" />
                {/* Serratus anterior tooth indentations on ribcage */}
                <path d="M124 186 C128 190 132 192 136 193 M122 198 C126 202 130 204 134 205 M121 210 C125 214 129 216 133 217" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.8] pointer-events-none" />
                <path d="M216 186 C212 190 208 192 204 193 M218 198 C214 202 210 204 206 205 M219 210 C215 214 211 216 207 217" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.8] pointer-events-none" />
                {/* Umbilicus */}
                <ellipse cx="170" cy="256" rx="2" ry="2.5" className="fill-slate-400/70 dark:fill-slate-500/60 pointer-events-none" />
              </g>

              {/* 8. PELVIS / CADERA Y FLEXORES PROFUNDOS */}
              <g
                onClick={() => onSelectRegion('pelvis')}
                onPointerEnter={() => handlePointerEnter('pelvis')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="pelvis"
                  className={getPartClass('pelvis')}
                  d="M137 297 C131 310 128 323 126 336 C140 344 155 348 170 348 C185 348 200 344 214 336 C212 323 209 310 203 297 Z"
                />
                {/* Inguinal ligaments & pectineus lines */}
                <path d="M144 302 C153 315 162 330 170 343" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                <path d="M196 302 C187 315 178 330 170 343" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                <path d="M152 300 C158 316 164 332 170 347" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
                <path d="M188 300 C182 316 176 332 170 347" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 9. CUÁDRICEPS (MUSLO ANTERIOR: RECTO FEMORAL, VASTOS Y RÓTULA) */}
              <g
                onClick={() => onSelectRegion('cuadriceps')}
                onPointerEnter={() => handlePointerEnter('cuadriceps')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Cuádriceps Izquierdo */}
                <path
                  data-part="cuadriceps"
                  className={getPartClass('cuadriceps')}
                  d="M126 338 C120 362 114 404 112 441 C110 473 116 497 124 510 C136 512 148 499 155 479 C163 451 167 407 169 351 C155 350 139 344 126 338 Z"
                />
                {/* Cuádriceps Derecho */}
                <path
                  data-part="cuadriceps"
                  className={getPartClass('cuadriceps')}
                  d="M214 338 C220 362 226 404 228 441 C230 473 224 497 216 510 C204 512 192 499 185 479 C177 451 173 407 171 351 C185 350 201 344 214 338 Z"
                />
                {/* Rectus femoris & Vastus lateralis sweep */}
                <path d="M145 362 C143 404 140 448 134 490" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                <path d="M195 362 C197 404 200 448 206 490" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                {/* Vastus Medialis Oblique (VMO teardrop bulge) */}
                <path d="M151 452 C156 472 153 492 144 502" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.85] pointer-events-none" />
                <path d="M189 452 C184 472 187 492 196 502" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.85] pointer-events-none" />
                {/* Patellas (Rótulas) */}
                <ellipse cx="134" cy="504" rx="6" ry="5" className="fill-none stroke-slate-400/75 dark:stroke-slate-500/65 stroke-[1] pointer-events-none" />
                <ellipse cx="206" cy="504" rx="6" ry="5" className="fill-none stroke-slate-400/75 dark:stroke-slate-500/65 stroke-[1] pointer-events-none" />
                {/* Patellar ligament to tibial tuberosity */}
                <path d="M134 509 L134 516 M206 509 L206 516" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[1] pointer-events-none" />
              </g>

              {/* 10. PANTORRILLAS / TIBIALES Y PIES (ANTERIOR) */}
              <g
                onClick={() => onSelectRegion('pantorrillas')}
                onPointerEnter={() => handlePointerEnter('pantorrillas')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Pantorrilla Izquierda */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M123 512 C114 531 106 564 109 593 C111 614 121 630 128 642 L147 642 C151 624 155 597 153 564 C151 537 149 519 144 512 Z"
                />
                {/* Pie Izquierdo Anatómico */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M128 642 C125 650 120 659 115 664 L145 664 C147 656 147 648 147 642 Z"
                />
                {/* Pantorrilla Derecha */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M217 512 C226 531 234 564 231 593 C229 614 219 630 212 642 L193 642 C189 624 185 597 187 564 C189 537 191 519 196 512 Z"
                />
                {/* Pie Derecho Anatómico */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M212 642 C215 650 220 659 225 664 L195 664 C193 656 193 648 193 642 Z"
                />
                {/* Anterior tibial crest & Peroneal groove */}
                <path d="M132 522 L134 628" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.9] pointer-events-none" />
                <path d="M124 536 C120 564 120 594 124 622" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
                <path d="M208 522 L206 628" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.9] pointer-events-none" />
                <path d="M216 536 C220 564 220 594 216 622" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
                {/* Malleoli (Medial higher, Lateral lower) */}
                <ellipse cx="145" cy="633" rx="2.5" ry="3.5" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <ellipse cx="120" cy="637" rx="2.5" ry="3.5" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <ellipse cx="195" cy="633" rx="2.5" ry="3.5" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <ellipse cx="220" cy="637" rx="2.5" ry="3.5" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
              </g>
            </g>
          )}

          {/* ========================================================================= */}
          {/* VISTA POSTERIOR (DORSAL) — ANATOMÍA CLÍNICA DE ALTA DEFINICIÓN */}
          {/* ========================================================================= */}
          {view === 'back' && (
            <g id="pro-anatomy-back" className="animate-fadeIn">
              
              {/* Outer Silhouette Halo */}
              <path
                d="M170 14 C188 14 198 26 198 48 C198 64 189 74 180 80 C190 84 208 92 226 101 C245 110 260 128 264 153 C268 179 263 216 261 234 C267 251 282 293 284 324 C286 345 275 368 262 368 C256 368 250 355 248 343 C244 372 238 427 234 464 C240 493 245 543 241 581 C237 615 222 634 205 638 C188 640 181 625 179 610 C176 610 174 610 170 610 C166 610 164 610 161 610 C159 625 152 640 135 638 C118 634 103 615 99 581 C95 543 100 493 106 464 C102 427 96 372 92 343 C90 355 84 368 78 368 C65 368 54 345 56 324 C58 293 73 251 79 234 C77 216 72 179 76 153 C80 128 95 110 114 101 C132 92 150 84 160 80 C151 74 142 64 142 48 C142 26 152 14 170 14 Z"
                className="fill-none stroke-sky-500/25 dark:stroke-sky-500/20 stroke-[4] filter blur-[3px] pointer-events-none"
              />

              {/* 1. CABEZA POSTERIOR (OCCIPITAL & PARIETAL) */}
              <g
                onClick={() => onSelectRegion('cabeza')}
                onPointerEnter={() => handlePointerEnter('cabeza')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="cabeza"
                  className={getPartClass('cabeza')}
                  d="M170 16 C189 16 198 29 198 48 C198 64 189 77 170 83 C151 77 142 64 142 48 C142 29 151 16 170 16 Z"
                />
                {/* Superior nuchal line & inion */}
                <path d="M156 48 Q170 53 184 48" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                <circle cx="170" cy="58" r="2.5" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
              </g>

              {/* 2. CUELLO POSTERIOR & PARAVERTEBRALES */}
              <g
                onClick={() => onSelectRegion('cuello')}
                onPointerEnter={() => handlePointerEnter('cuello')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="cuello"
                  className={getPartClass('cuello')}
                  d="M158 83 C155 91 151 97 144 101 L196 101 C189 97 185 91 182 83 Z"
                />
                <path d="M170 83 L170 101" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[0.9] pointer-events-none" />
              </g>

              {/* 3. TRAPECIO, ROMBOIDES Y ELEVADOR DE LA ESCÁPULA */}
              <g
                onClick={() => onSelectRegion('trapecio')}
                onPointerEnter={() => handlePointerEnter('trapecio')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="trapecio"
                  className={getPartClass('trapecio')}
                  d="M158 84 L182 84 C195 96 220 106 233 112 L196 182 L170 206 L144 182 L107 112 C120 106 145 96 158 84 Z"
                />
                {/* Spine axis & Spina scapulae */}
                <path d="M170 85 L170 204" className="fill-none stroke-slate-400/75 dark:stroke-slate-500/65 stroke-[1.1] pointer-events-none" />
                <path d="M138 128 L164 145" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.85] pointer-events-none" />
                <path d="M202 128 L176 145" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.85] pointer-events-none" />
                {/* Rhomboid muscle fibers */}
                <path d="M152 152 L168 168 M188 152 L172 168" className="fill-none stroke-slate-400/45 dark:stroke-slate-500/35 stroke-[0.75] pointer-events-none" />
                {/* C7 Prominens dot */}
                <ellipse cx="170" cy="104" rx="2" ry="3" className="fill-slate-400/60 dark:fill-slate-500/50 pointer-events-none" />
              </g>

              {/* 4. HOMBROS POSTERIORES (DELTOIDES POSTERIOR) */}
              <g
                onClick={() => onSelectRegion('hombros')}
                onPointerEnter={() => handlePointerEnter('hombros')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Deltoides Posterior Izquierdo */}
                <path
                  data-part="hombros"
                  className={getPartClass('hombros')}
                  d="M105 114 C95 127 91 146 93 168 C97 175 105 179 109 175 C118 156 123 137 115 120 Z"
                />
                {/* Deltoides Posterior Derecho */}
                <path
                  data-part="hombros"
                  className={getPartClass('hombros')}
                  d="M235 114 C245 127 249 146 247 168 C243 175 235 179 231 175 C222 156 217 137 225 120 Z"
                />
                {/* Infraspinatus & Teres major/minor hints */}
                <path d="M103 134 C101 150 102 164 105 174" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.75] pointer-events-none" />
                <path d="M237 134 C239 150 238 164 235 174" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.75] pointer-events-none" />
              </g>

              {/* 5. TRÍCEPS BRAQUIAL (CABEZA LARGA, LATERAL Y MEDIAL) */}
              <g
                onClick={() => onSelectRegion('triceps')}
                onPointerEnter={() => handlePointerEnter('triceps')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Tríceps Izquierdo */}
                <path
                  data-part="triceps"
                  className={getPartClass('triceps')}
                  d="M93 170 C85 185 81 210 83 238 C91 244 101 240 105 227 C108 208 107 185 104 174 Z"
                />
                {/* Tríceps Derecho */}
                <path
                  data-part="triceps"
                  className={getPartClass('triceps')}
                  d="M247 170 C255 185 259 210 257 238 C249 244 239 240 235 227 C232 208 233 185 236 174 Z"
                />
                {/* Tricipital horseshoe tendon & Long/Lateral heads */}
                <path d="M92 188 C95 208 96 224 100 234" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <path d="M248 188 C245 208 244 224 240 234" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                {/* Olecranon (Codo) */}
                <ellipse cx="94" cy="242" rx="3" ry="3.5" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.8] pointer-events-none" />
                <ellipse cx="246" cy="242" rx="3" ry="3.5" className="fill-none stroke-slate-400/60 dark:stroke-slate-500/50 stroke-[0.8] pointer-events-none" />
              </g>

              {/* 6. ANTEBRAZOS POSTERIORES Y MANOS */}
              <g
                onClick={() => onSelectRegion('antebrazos')}
                onPointerEnter={() => handlePointerEnter('antebrazos')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Antebrazo Post Izq */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M83 243 C77 260 65 294 63 323 C62 338 65 348 71 355 L84 353 C94 336 100 300 103 264 Z"
                />
                {/* Mano Post Izq */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M71 355 C68 362 62 373 60 381 C59 388 64 392 71 390 C75 388 79 375 82 364 L84 353 Z"
                />
                {/* Antebrazo Post Der */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M257 243 C263 260 275 294 277 323 C278 338 275 348 269 355 L256 353 C246 336 240 300 237 264 Z"
                />
                {/* Mano Post Der */}
                <path
                  data-part="antebrazos"
                  className={getPartClass('antebrazos')}
                  d="M269 355 C272 362 278 373 280 381 C281 388 276 392 269 390 C265 388 261 375 258 364 L256 353 Z"
                />
                {/* Extensor digitorum & Carpi ulnaris ridges */}
                <path d="M80 262 C74 288 70 316 68 340" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
                <path d="M260 262 C266 288 270 316 272 340" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.8] pointer-events-none" />
              </g>

              {/* 7. DORSAL ANCHO Y ZONA LUMBAR */}
              <g
                onClick={() => onSelectRegion('dorsales')}
                onPointerEnter={() => handlePointerEnter('dorsales')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="dorsales"
                  className={getPartClass('dorsales')}
                  d="M142 186 L170 210 L198 186 C212 211 214 247 208 289 L132 289 C126 247 128 211 142 186 Z"
                />
                {/* Spine & Erector spinae columns */}
                <path d="M170 210 L170 288" className="fill-none stroke-slate-400/75 dark:stroke-slate-500/65 stroke-[1.1] pointer-events-none" />
                <path d="M159 224 L159 284 M181 224 L181 284" className="fill-none stroke-slate-400/50 dark:stroke-slate-500/40 stroke-[0.8] pointer-events-none" />
                {/* Latissimus V-Taper muscular fan */}
                <path d="M144 218 C155 248 161 272 166 288" className="fill-none stroke-slate-400/45 dark:stroke-slate-500/35 stroke-[0.8] pointer-events-none" />
                <path d="M196 218 C185 248 179 272 174 288" className="fill-none stroke-slate-400/45 dark:stroke-slate-500/35 stroke-[0.8] pointer-events-none" />
                {/* Thoracolumbar fascia triangle */}
                <path d="M152 284 L170 256 L188 284" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.75] pointer-events-none" />
              </g>

              {/* 8. GLÚTEOS (GLÚTEO MAYOR & MEDIO) */}
              <g
                onClick={() => onSelectRegion('gluteos')}
                onPointerEnter={() => handlePointerEnter('gluteos')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                <path
                  data-part="gluteos"
                  className={getPartClass('gluteos')}
                  d="M133 291 L207 291 C221 312 224 344 215 369 C201 379 182 381 170 362 C158 381 139 379 125 369 C116 344 119 312 133 291 Z"
                />
                {/* Gluteal cleft & Infragluteal folds */}
                <path d="M170 291 L170 363" className="fill-none stroke-slate-400/80 dark:stroke-slate-500/70 stroke-[1.1] pointer-events-none" />
                <path d="M131 361 C144 376 157 376 168 364" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                <path d="M209 361 C196 376 183 376 172 364" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                {/* Gluteus medius lateral upper ridge */}
                <path d="M136 304 C132 322 130 340 134 354" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
                <path d="M204 304 C208 322 210 340 206 354" className="fill-none stroke-slate-400/40 dark:stroke-slate-500/35 stroke-[0.7] pointer-events-none" />
              </g>

              {/* 9. ISQUIOSURALES (FEMORAL / BÍCEPS FEMORAL, SEMITENDINOSO Y SEMIMEMBRANOSO) */}
              <g
                onClick={() => onSelectRegion('isquiotibiales')}
                onPointerEnter={() => handlePointerEnter('isquiotibiales')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Isquio Izquierdo */}
                <path
                  data-part="isquiotibiales"
                  className={getPartClass('isquiotibiales')}
                  d="M125 373 C137 381 153 383 164 368 C166 402 164 445 158 485 C146 489 135 485 128 477 C119 450 119 407 125 373 Z"
                />
                {/* Isquio Derecho */}
                <path
                  data-part="isquiotibiales"
                  className={getPartClass('isquiotibiales')}
                  d="M215 373 C203 381 187 383 176 368 C174 402 176 445 182 485 C194 489 205 485 212 477 C221 450 221 407 215 373 Z"
                />
                {/* Biceps femoris lateral & Semitendinosus medial divide */}
                <path d="M145 383 C145 418 144 454 142 482" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                <path d="M195 383 C195 418 196 454 198 482" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                {/* Popliteal fossa back-of-knee diamonds */}
                <path d="M134 480 Q143 487 152 482" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
                <path d="M206 480 Q197 487 188 482" className="fill-none stroke-slate-400/65 dark:stroke-slate-500/55 stroke-[0.85] pointer-events-none" />
              </g>

              {/* 10. PANTORRILLAS POSTERIOR (GEMELOS MEDIAL/LATERAL, SÓLEO Y TENDÓN DE AQUILES) */}
              <g
                onClick={() => onSelectRegion('pantorrillas')}
                onPointerEnter={() => handlePointerEnter('pantorrillas')}
                onPointerLeave={handlePointerLeave}
                className="group cursor-pointer"
              >
                {/* Gemelo Izquierdo */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M128 482 C116 509 110 544 114 574 C119 599 128 616 132 624 L151 624 C155 607 160 579 157 546 C155 518 152 497 150 484 Z"
                />
                {/* Talón y Calcáneo Izquierdo */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M132 624 C131 632 126 641 120 646 L148 646 C150 638 151 630 151 624 Z"
                />
                {/* Gemelo Derecho */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M212 482 C224 509 230 544 226 574 C221 599 212 616 208 624 L189 624 C185 607 180 579 183 546 C185 518 188 497 190 484 Z"
                />
                {/* Talón y Calcáneo Derecho */}
                <path
                  data-part="pantorrillas"
                  className={getPartClass('pantorrillas')}
                  d="M208 624 C209 632 214 641 220 646 L192 646 C190 638 189 630 189 624 Z"
                />
                {/* Gastrocnemius medial head (larger/lower) and lateral head */}
                <path d="M141 490 C139 518 138 548 140 574" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                <path d="M199 490 C201 518 202 548 200 574" className="fill-none stroke-slate-400/55 dark:stroke-slate-500/45 stroke-[0.85] pointer-events-none" />
                {/* Achilles Tendon cords */}
                <path d="M140 574 L140 624 M144 578 L144 624" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[0.95] pointer-events-none" />
                <path d="M200 574 L200 624 M196 578 L196 624" className="fill-none stroke-slate-400/70 dark:stroke-slate-500/60 stroke-[0.95] pointer-events-none" />
              </g>
            </g>
          )}

          {/* Active indicator dot and label pulse */}
          {selectedRegion && regionPins[selectedRegion] && (
            <g className="pointer-events-none transition-all duration-300">
              <circle
                cx={regionPins[selectedRegion].x}
                cy={regionPins[selectedRegion].y}
                r="12"
                className="fill-sky-400/35 animate-ping"
              />
              <circle
                cx={regionPins[selectedRegion].x}
                cy={regionPins[selectedRegion].y}
                r="4.5"
                className="fill-white stroke-sky-500 stroke-[2] shadow-lg"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Floating Region Indicator on Hover/Select */}
      {(hoveredRegion || selectedRegion) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-sky-500/40 shadow-xl pointer-events-none flex items-center gap-2 z-10 transition-all">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
          <span className="text-xs font-bold text-sky-300 tracking-wide">
            {bodyRegionsDatabase[(hoveredRegion || selectedRegion)!]?.title || 'Región Anatómica'}
          </span>
        </div>
      )}
    </div>
  );
};

export default BodyAnatomySVG;
