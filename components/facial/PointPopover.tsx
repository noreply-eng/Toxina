import React, { useEffect, useRef } from 'react';
import type { InjectionPoint } from '../../hooks/useFacialPlan';
import {
  convertOnaToBrand,
  RISK_MESSAGES,
  type PointDepth,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';

interface PointPopoverProps {
  point: InjectionPoint;
  brand: ToxinBrand;
  muscleName?: string;
  anchor: { x: number; y: number };
  onClose: () => void;
  onUpdateDose: (id: string, delta: number) => void;
  onSetDepth: (id: string, depth: PointDepth) => void;
  onRemove: (id: string) => void;
}

const PointPopover: React.FC<PointPopoverProps> = ({
  point,
  brand,
  muscleName,
  anchor,
  onClose,
  onUpdateDose,
  onSetDepth,
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

  return (
    <div
      ref={ref}
      className="fixed z-[70] w-56 rounded-xl border border-slate-700 bg-surface-dark shadow-2xl p-3"
      style={{
        left: Math.min(anchor.x, window.innerWidth - 240),
        top: Math.min(anchor.y + 8, window.innerHeight - 220),
      }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Editar punto de inyección"
    >
      <p className="text-xs font-bold text-white mb-2 truncate">
        {muscleName ?? point.muscleKey}
      </p>
      {point.risk && (
        <p className="text-[10px] text-red-400 mb-2 flex items-start gap-1">
          <span className="material-symbols-outlined text-[12px] mt-px shrink-0">warning</span>
          {RISK_MESSAGES[point.risk]}
        </p>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">Dosis ({brand})</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="size-9 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 min-w-[44px] min-h-[44px]"
            onClick={() => onUpdateDose(point.id, -0.5)}
            aria-label="Reducir dosis"
          >
            −
          </button>
          <span className="text-sm font-bold text-white w-8 text-center">{displayDose}</span>
          <button
            type="button"
            className="size-9 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 min-w-[44px] min-h-[44px]"
            onClick={() => onUpdateDose(point.id, 0.5)}
            aria-label="Aumentar dosis"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {(['superficial', 'profundo'] as PointDepth[]).map((d) => (
          <button
            key={d}
            type="button"
            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize min-h-[44px] ${
              point.depth === d
                ? 'bg-primary text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            onClick={() => onSetDepth(point.id, d)}
          >
            {d}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="w-full py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 min-h-[44px]"
        onClick={() => {
          onRemove(point.id);
          onClose();
        }}
      >
        Eliminar punto
      </button>
    </div>
  );
};

export default PointPopover;
