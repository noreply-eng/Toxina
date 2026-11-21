import React, { useCallback, useRef } from 'react';
import {
  convertOnaToBrand,
  type PointSizeMode,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import type { InjectionPoint } from '../../hooks/useFacialPlan';

interface InjectionPointNodeProps {
  point: InjectionPoint;
  brand: ToxinBrand;
  pointSize?: PointSizeMode;
  isSelected: boolean;
  dimmed?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onOpenPopover: (id: string, clientX: number, clientY: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const SIZE_CONFIG: Record<
  PointSizeMode,
  { r: number; hitR: number; selR: number; riskR: number; deepRingR: number; fontSize: number; textY: number }
> = {
  sm: { r: 6.2, hitR: 14, selR: 9.2, riskR: 8.5, deepRingR: 4.5, fontSize: 6.2, textY: 2.2 },
  md: { r: 9.2, hitR: 17, selR: 13, riskR: 12.2, deepRingR: 7, fontSize: 8.2, textY: 3 },
  lg: { r: 12.4, hitR: 21, selR: 16.5, riskR: 15.5, deepRingR: 9.6, fontSize: 10.2, textY: 3.6 },
};

function screenToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

const InjectionPointNode: React.FC<InjectionPointNodeProps> = ({
  point,
  brand,
  pointSize = 'md',
  isSelected,
  dimmed = false,
  onSelect,
  onMove,
  onOpenPopover,
  svgRef,
}) => {
  const dragging = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const startPos = useRef({ x: 0, y: 0 });

  const displayDose = convertOnaToBrand(point.doseOna, brand);
  const isRisk = !!point.risk;
  const isDeep = point.depth === 'profundo';
  const cfg = SIZE_CONFIG[pointSize];

  // Visual differentiation:
  // - Risk: Crimson red (#ef4444)
  // - Profundo (Intramuscular deep): Clinical Cyan/Blue (#0284c7 / #0ea5e9)
  // - Superficial (Subcutaneous/Intradermal): Coral/Orange (#e06d53 / #f97316)
  const fill = isRisk
    ? '#ef4444'
    : isDeep
      ? isSelected
        ? '#0ea5e9'
        : '#0284c7'
      : isSelected
        ? '#f97316'
        : '#e06d53';

  const stroke = isSelected ? '#ffffff' : isRisk ? '#fecaca' : isDeep ? '#bae6fd' : '#ffffff';
  const selectionRingColor = isDeep ? '#38bdf8' : '#f97316';

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragging.current = false;
      startPos.current = { x: e.clientX, y: e.clientY };
      onSelect(point.id);

      longPressTimer.current = setTimeout(() => {
        onOpenPopover(point.id, e.clientX, e.clientY);
      }, 480);
    },
    [onOpenPopover, onSelect, point.id]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx > 4 || dy > 4) {
        clearLongPress();
        dragging.current = true;
        const svg = svgRef.current;
        if (!svg) return;
        const { x, y } = screenToSvg(svg, e.clientX, e.clientY);
        onMove(point.id, x, y);
      }
    },
    [onMove, point.id, svgRef]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGGElement>) => {
      clearLongPress();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (!dragging.current) {
        const now = Date.now();
        if (now - lastTap.current < 350) {
          onOpenPopover(point.id, e.clientX, e.clientY);
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      }
      dragging.current = false;
    },
    [onOpenPopover, point.id]
  );

  return (
    <g
      transform={`translate(${point.x}, ${point.y})`}
      style={{
        touchAction: 'none',
        cursor: 'grab',
        opacity: dimmed ? 0.3 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearLongPress}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpenPopover(point.id, e.clientX, e.clientY);
      }}
      role="button"
      aria-label={`Punto ${displayDose} unidades (${point.depth})${isRisk ? ', zona de riesgo' : ''}`}
      aria-pressed={isSelected}
    >
      <title>{`${displayDose} U (${point.depth === 'profundo' ? 'Profundo / IM' : 'Superficial / SC'}) · Doble clic o clic derecho para editar · Arrastra para mover`}</title>
      {/* Expanded hit area */}
      <circle r={cfg.hitR} fill="transparent" />
      {isSelected && (
        <circle
          r={cfg.selR}
          fill="none"
          stroke={selectionRingColor}
          strokeWidth={1.6}
          strokeOpacity={0.75}
        />
      )}
      {isRisk && !isSelected && (
        <circle r={cfg.riskR} fill="none" stroke="#f87171" strokeWidth={1.3} strokeOpacity={0.8} />
      )}
      <circle
        r={cfg.r}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2.2 : 1.7}
      />
      {/* Inner dashed ring for deep intramuscular points */}
      {isDeep && (
        <circle
          r={cfg.deepRingR}
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={0.8}
          strokeDasharray="2 1.5"
          pointerEvents="none"
        />
      )}
      <text
        y={cfg.textY}
        textAnchor="middle"
        fontSize={cfg.fontSize}
        fontWeight="bold"
        fill="#fff"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {displayDose}
      </text>
    </g>
  );
};

export default InjectionPointNode;
