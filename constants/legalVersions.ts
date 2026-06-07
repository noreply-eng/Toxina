export const CURRENT_TERMS_VERSION = '1.0';
export const CURRENT_PRIVACY_VERSION = '1.0';
export const ARCO_CONTACT_EMAIL = 'privacidad@deeplux.org';

export type LegalDocumentType = 'privacy' | 'terms';
export type ConsentType = 'terms' | 'privacy_sensitive' | 'secondary_purposes';

export const LEGAL_DOCUMENT_META = {
  privacy: {
    version: CURRENT_PRIVACY_VERSION,
    title: 'Aviso de Privacidad Integral',
    route: '/aviso-privacidad',
  },
  terms: {
    version: CURRENT_TERMS_VERSION,
    title: 'Términos y Condiciones de Uso',
    route: '/terminos',
  },
} as const;
