import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  /** Tailwind max-width class. Defaults to max-w-6xl for dashboard-style pages. */
  maxWidth?: 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl';
  className?: string;
}

const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = 'max-w-6xl',
  className = '',
}) => {
  return (
    <div className={`w-full ${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};

export default PageContainer;
