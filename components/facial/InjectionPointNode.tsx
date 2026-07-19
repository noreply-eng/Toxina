import React, { useCallback, useRef } from 'react';
import {
  convertOnaToBrand,
  type ToxinBrand,
} from '../../constants/facialAestheticMap';
import type { InjectionPoint } from '../../hooks/useFacialPlan';

interface InjectionPointNodeProps {
  point: InjectionPoint;
  brand: ToxinBrand;
  isSelected: boolean;
  dimmed?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onOpenPopover: (id: string, clientX: number, clientY: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

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
  const fill = isRisk ? '#ef4444' : isSelected ? '#f97316' : '#e06d53';
  const stroke = isSelected ? '#fff' : isRisk ? '#fecaca' : '#fff';

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
      }, 500);
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
        opacity: dimmed ? 0.35 : 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearLongPress}
      role="button"
      aria-label={`Punto ${displayDose} unidades${isRisk ? ', zona de riesgo' : ''}`}
      aria-pressed={isSelected}
    >
      {/* Expanded hit area */}
      <circle r={18} fill="transparent" />
      {isSelected && (
        <circle r={14} fill="none" stroke="#f97316" strokeWidth={1.5} strokeOpacity={0.55} />
      )}
      {isRisk && !isSelected && (
        <circle r={13} fill="none" stroke="#f87171" strokeWidth={1.25} strokeOpacity={0.7} />
      )}
      <circle r={10} fill={fill} stroke={stroke} strokeWidth={isSelected ? 2.5 : 2} />
      <text
        y={4}
        textAnchor="middle"
        fontSize={8.5}
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
