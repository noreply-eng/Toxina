import React from 'react';
import { useNavigate } from 'react-router-dom';
import LegalDocumentViewer from '../components/LegalDocumentViewer';
import PageContainer from '../components/PageContainer';
import { getLegalDocument } from '../content/legal';
import type { LegalDocumentType } from '../constants/legalVersions';

interface LegalDocumentPageProps {
  type: LegalDocumentType;
}

const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ type }) => {
  const navigate = useNavigate();
  const document = getLegalDocument(type);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-surface-dark/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <PageContainer maxWidth="max-w-4xl" className="py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              {document.title}
            </h1>
            <p className="text-xs text-text-muted font-bold">Versión {document.version}</p>
          </div>
        </PageContainer>
      </header>

      <PageContainer maxWidth="max-w-4xl" className="py-8">
        <div className="bg-white dark:bg-surface-dark rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-sm">
          <LegalDocumentViewer document={document} />
        </div>
      </PageContainer>
    </div>
  );
};

export default LegalDocumentPage;
