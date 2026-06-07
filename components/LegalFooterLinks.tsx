import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_DOCUMENT_META } from '../constants/legalVersions';

interface LegalFooterLinksProps {
  className?: string;
}

const LegalFooterLinks: React.FC<LegalFooterLinksProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 ${className}`}>
      <Link
        to={LEGAL_DOCUMENT_META.privacy.route}
        className="font-bold hover:text-primary hover:underline transition-colors"
      >
        Aviso de Privacidad
      </Link>
      <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
        |
      </span>
      <Link
        to={LEGAL_DOCUMENT_META.terms.route}
        className="font-bold hover:text-primary hover:underline transition-colors"
      >
        Términos de Uso
      </Link>
    </div>
  );
};

export default LegalFooterLinks;
