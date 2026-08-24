import React from 'react';

interface MuscleIconProps {
  icon: string;
  className?: string;
  size?: number | string;
}

export const MuscleIcon: React.FC<MuscleIconProps> = ({ 
  icon, 
  className = 'text-2xl',
  size 
}) => {
  // Flexed arm / biceps icon
  if (icon === 'arm_flex' || icon === 'biceps' || icon === 'fitness_center') {
    return (
      <svg
        className={`inline-block select-none shrink-0 ${className}`}
        viewBox="0 0 24 24"
        width={size || '1em'}
        height={size || '1em'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-label="Brazo flexionado"
      >
        {/* Puño cerrado y antebrazo flexionado */}
        <path d="M12.4 13.6a3 3 0 1 0-4.24-4.24l-1.59 1.59a2 2 0 0 0-.58 1.26l-.32 2.59a1 1 0 0 0 1.12 1.12l2.59-.32a2 2 0 0 0 1.26-.58z" />
        {/* Curvatura de muñeca y mano */}
        <path d="m15 8 1.5-1.5a2.12 2.12 0 0 1 3 3L18 11" />
        {/* Pico del bíceps braquial en flexión */}
        <path d="M9 5a6 6 0 0 1 6 6" />
        {/* Tríceps, codo y brazo inferior */}
        <path d="M18 11a6 6 0 0 1-6 6H7" />
      </svg>
    );
  }

  // Standard Material Symbols Outlined icon
  return (
    <span 
      className={`material-symbols-outlined shrink-0 select-none ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {icon}
    </span>
  );
};

export default MuscleIcon;
