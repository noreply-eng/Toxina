import React from 'react';
import type { LegalDocumentContent } from '../content/legal';

interface LegalDocumentViewerProps {
  document: LegalDocumentContent;
  className?: string;
}

const LegalDocumentViewer: React.FC<LegalDocumentViewerProps> = ({
  document,
  className = '',
}) => {
  return (
    <article
      className={`legal-document prose-legal ${className}`}
      dangerouslySetInnerHTML={{ __html: document.html }}
    />
  );
};

export default LegalDocumentViewer;
