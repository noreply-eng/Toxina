import React from 'react';
import { APP_LOGO_SRC, APP_NAME } from '../constants/brand';

const ROUNDED = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
} as const;

type BrandLogoProps = {
  size?: number;
  rounded?: keyof typeof ROUNDED;
  className?: string;
  alt?: string;
};

const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 80,
  rounded = '3xl',
  className = '',
  alt = APP_NAME,
}) => (
  <img
    src={APP_LOGO_SRC}
    alt={alt}
    width={size}
    height={size}
    className={`object-cover shadow-xl ring-1 ring-black/10 ${ROUNDED[rounded]} ${className}`}
  />
);

export default BrandLogo;
