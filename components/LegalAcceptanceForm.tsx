import React, { useState } from 'react';
import ConsentCheckbox from './ConsentCheckbox';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  LEGAL_DOCUMENT_META,
} from '../constants/legalVersions';

export interface LegalAcceptanceFormValues {
  termsAccepted: boolean;
  privacySensitiveAccepted: boolean;
  secondaryPurposesAccepted: boolean;
}

interface LegalAcceptanceFormValuesProps {
  mode?: 'initial' | 'reconsent';
  initialSecondaryPurposes?: boolean;
  onSubmit: (values: LegalAcceptanceFormValues) => Promise<void>;
  loading?: boolean;
}

const LegalAcceptanceForm: React.FC<LegalAcceptanceFormValuesProps> = ({
  mode = 'initial',
  initialSecondaryPurposes = false,
  onSubmit,
  loading = false,
}) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacySensitiveAccepted, setPrivacySensitiveAccepted] = useState(false);
  const [secondaryPurposesAccepted, setSecondaryPurposesAccepted] =
    useState(initialSecondaryPurposes);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = termsAccepted && privacySensitiveAccepted && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await onSubmit({
        termsAccepted,
        privacySensitiveAccepted,
        secondaryPurposesAccepted,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar consentimiento');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {mode === 'reconsent' && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-bold mb-1">Actualización de documentos legales</p>
          <p>
            Hemos actualizado nuestros documentos legales. Debe aceptar la versión{' '}
            {CURRENT_TERMS_VERSION} de los Términos y la versión {CURRENT_PRIVACY_VERSION} del
            Aviso de Privacidad para continuar.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <ConsentCheckbox
        id="consent-terms"
        checked={termsAccepted}
        onChange={setTermsAccepted}
        required
        linkHref={LEGAL_DOCUMENT_META.terms.route}
        linkLabel="Términos y Condiciones de Uso"
        disabled={loading}
      >
        He leído y acepto los
      </ConsentCheckbox>

      <ConsentCheckbox
        id="consent-privacy-sensitive"
        checked={privacySensitiveAccepted}
        onChange={setPrivacySensitiveAccepted}
        required
        linkHref={LEGAL_DOCUMENT_META.privacy.route}
        linkLabel="Aviso de Privacidad Integral"
        disabled={loading}
      >
        Consiento expresamente el tratamiento de mis datos personales sensibles conforme al
      </ConsentCheckbox>

      <ConsentCheckbox
        id="consent-secondary"
        checked={secondaryPurposesAccepted}
        onChange={setSecondaryPurposesAccepted}
        disabled={loading}
      >
        Autorizo el uso de datos clínicos anonimizados para estadísticas, mejora de algoritmos e
        investigación (finalidades secundarias, opcional)
      </ConsentCheckbox>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-primary hover:bg-primary-dark text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-primary/25 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mt-6"
      >
        {loading ? (
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
        ) : mode === 'reconsent' ? (
          'Aceptar y continuar'
        ) : (
          'Continuar'
        )}
      </button>
    </form>
  );
};

export default LegalAcceptanceForm;
