import React from 'react';
import type { VisitType } from '../types/clinical';
import { VISIT_TYPE_LABELS } from '../types/clinical';

interface VisitTypeBadgeProps {
  visitType: VisitType;
  className?: string;
}

const VisitTypeBadge: React.FC<VisitTypeBadgeProps> = ({ visitType, className = '' }) => {
  const isNewApplication = visitType === 'new_application';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
        isNewApplication
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
      } ${className}`}
    >
      {VISIT_TYPE_LABELS[visitType]}
    </span>
  );
};

export default VisitTypeBadge;
