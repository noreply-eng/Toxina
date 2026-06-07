import privacyMarkdown from './privacy-notice-v1.0.md?raw';
import termsMarkdown from './terms-of-use-v1.0.md?raw';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../../constants/legalVersions';
import { markdownToHtml } from '../../utils/markdown';
import type { LegalDocumentType } from '../../constants/legalVersions';

export interface LegalDocumentContent {
  type: LegalDocumentType;
  version: string;
  title: string;
  markdown: string;
  html: string;
}

const documents: Record<LegalDocumentType, LegalDocumentContent> = {
  privacy: {
    type: 'privacy',
    version: CURRENT_PRIVACY_VERSION,
    title: 'Aviso de Privacidad Integral',
    markdown: privacyMarkdown,
    html: markdownToHtml(privacyMarkdown),
  },
  terms: {
    type: 'terms',
    version: CURRENT_TERMS_VERSION,
    title: 'Términos y Condiciones de Uso',
    markdown: termsMarkdown,
    html: markdownToHtml(termsMarkdown),
  },
};

export function getLegalDocument(type: LegalDocumentType): LegalDocumentContent {
  return documents[type];
}

export function getAllLegalDocuments(): LegalDocumentContent[] {
  return [documents.privacy, documents.terms];
}
