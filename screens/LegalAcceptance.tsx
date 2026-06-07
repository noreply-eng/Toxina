import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LegalAcceptanceForm from '../components/LegalAcceptanceForm';
import LegalFooterLinks from '../components/LegalFooterLinks';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';
import { getAuthUser } from '../utils/auth';
import {
  fetchComplianceProfile,
  evaluateCompliance,
  recordConsents,
} from '../services/legalConsent';

const LegalAcceptance: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'initial' | 'reconsent'>('initial');
  const [initialSecondary, setInitialSecondary] = useState(false);

  useEffect(() => {
    const check = async () => {
      const user = await getAuthUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const profile = await fetchComplianceProfile(user.id);
      const status = evaluateCompliance(profile);

      if (
        status.hasAcceptedTerms &&
        status.hasAcceptedPrivacySensitive &&
        !status.needsReConsent &&
        !status.isRevoked
      ) {
        navigate(status.hasCompletedProfile ? '/dashboard' : '/complete-profile', {
          replace: true,
        });
        return;
      }

      if (profile?.terms_accepted_at || profile?.privacy_sensitive_accepted_at) {
        setMode('reconsent');
      }
      setInitialSecondary(!!profile?.secondary_purposes_accepted_at);
      setChecking(false);
    };
    check();
  }, [navigate]);

  const handleSubmit = async (values: {
    termsAccepted: boolean;
    privacySensitiveAccepted: boolean;
    secondaryPurposesAccepted: boolean;
  }) => {
    setLoading(true);
    const { error } = await recordConsents({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      secondaryPurposes: values.secondaryPurposesAccepted,
    });
    setLoading(false);

    if (error) {
      throw new Error(error);
    }

    const user = await getAuthUser();
    if (!user) {
      navigate('/login');
      return;
    }

    const profile = await fetchComplianceProfile(user.id);
    const status = evaluateCompliance(profile);
    navigate(status.hasCompletedProfile ? '/dashboard' : '/complete-profile', {
      replace: true,
    });
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-background-light dark:bg-background-dark p-6 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-5">
        <span className="material-symbols-outlined absolute -top-10 -right-10 text-[400px]">
          gavel
        </span>
      </div>

      <div className="w-full max-w-lg flex-1 flex flex-col justify-center z-10 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white dark:bg-surface-dark rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-100 dark:ring-slate-800">
            <span className="material-symbols-outlined text-primary text-3xl">policy</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {mode === 'reconsent' ? 'Actualización legal' : 'Consentimiento legal'}
          </h1>
          <p className="text-sm text-text-muted mt-2 max-w-sm mx-auto">
            Antes de utilizar Toxina DLM debe aceptar los términos de uso y otorgar su
            consentimiento expreso para el tratamiento de datos personales sensibles.
          </p>
        </div>

        <LegalAcceptanceForm
          mode={mode}
          initialSecondaryPurposes={initialSecondary}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>

      <LegalFooterLinks className="py-6 z-10" />
    </div>
  );
};

export default LegalAcceptance;
