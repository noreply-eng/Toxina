import React, { useEffect, useRef } from 'react';
import {
  convertOnaToBrand,
  RISK_MESSAGES,
  type PointDepth,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import type { InjectionPin3D } from '../../types/facial3d';

interface Point3DPopoverProps {
  point: InjectionPin3D;
  brand: ToxinBrand;
  mirrorSync: boolean;
  anchor: { x: number; y: number };
  onClose: () => void;
  onUpdateDose: (id: string, deltaOna: number) => void;
  onSetExactDose: (id: string, doseOna: number) => void;
  onSetDepth: (id: string, depth: PointDepth) => void;
  onStartMove: (id: string) => void;
  onRemove: (id: string) => void;
}

const QUICK_ONA_DOSES = [1, 2, 4, 5];

const Point3DPopover: React.FC<Point3DPopoverProps> = ({
  point,
  brand,
  mirrorSync,
  anchor,
  onClose,
  onUpdateDose,
  onSetExactDose,
  onSetDepth,
  onStartMove,
  onRemove,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const displayDose = convertOnaToBrand(point.doseOna, brand);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const sideText =
    point.side === 'izq' ? 'Izq (Pac.)' : point.side === 'der' ? 'Der (Pac.)' : 'Centro';

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-64 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md shadow-2xl p-3.5 text-white"
      style={{
        left: Math.max(12, Math.min(anchor.x, window.innerWidth - 272)),
        top: Math.max(12, Math.min(anchor.y + 10, window.innerHeight - 310)),
      }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Editar punto de aplicación 3D"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-black text-white truncate">{point.label}</p>
          <p className="text-[10px] text-slate-400">
            {sideText}
            {mirrorSync && point.side !== 'centro' ? ' · Espejo ON' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-6 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer shrink-0"
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {point.risk && (
        <div className="text-[10px] text-red-300 bg-red-500/15 border border-red-500/35 rounded-lg p-2 mb-2.5 flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-red-400 shrink-0">
            warning
          </span>
          <span>{RISK_MESSAGES[point.risk]}</span>
        </div>
      )}

      {/* Dose Stepper */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400">Dosis ({brand})</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            onClick={() => onUpdateDose(point.id, -0.5)}
            aria-label="Reducir dosis"
          >
            −
          </button>
          <span className="text-sm font-black text-white w-12 text-center tabular-nums">
            {displayDose} U
          </span>
          <button
            type="button"
            className="size-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            onClick={() => onUpdateDose(point.id, 0.5)}
            aria-label="Aumentar dosis"
          >
            +
          </button>
        </div>
      </div>

      {/* Quick Dose Chips */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {QUICK_ONA_DOSES.map((ona) => {
          const brandVal = convertOnaToBrand(ona, brand);
          const active = Math.abs(point.doseOna - ona) < 0.01;
          return (
            <button
              key={ona}
              type="button"
              onClick={() => onSetExactDose(point.id, ona)}
              className={`py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {brandVal}U
            </button>
          );
        })}
      </div>

      {/* Depth Toggle */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        {(['superficial', 'profundo'] as PointDepth[]).map((d) => (
          <button
            key={d}
            type="button"
            className={`py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer transition-colors flex items-center justify-center gap-1 ${
              point.depth === d
                ? d === 'profundo'
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-orange-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            onClick={() => onSetDepth(point.id, d)}
          >
            <span
              className={`size-2 rounded-full ${
                d === 'profundo' ? 'bg-sky-300' : 'bg-orange-300'
              }`}
            />
            {d}
          </button>
        ))}
      </div>

      {/* Actions: Relocate 3D + Delete */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="py-1.5 rounded-lg text-[11px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 flex items-center justify-center gap-1 cursor-pointer"
          onClick={() => {
            onStartMove(point.id);
            onClose();
          }}
        >
          <span className="material-symbols-outlined text-sm">open_with</span>
          Reubicar
        </button>
        <button
          type="button"
          className="py-1.5 rounded-lg text-[11px] font-bold text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 flex items-center justify-center gap-1 cursor-pointer"
          onClick={() => {
            onRemove(point.id);
            onClose();
          }}
        >
          <span className="material-symbols-outlined text-sm">delete</span>
          Eliminar
        </button>
      </div>
    </div>
  );
};

export default Point3DPopover;
