import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import LegalFooterLinks from '../components/LegalFooterLinks';
import {
  ARCO_CONTACT_EMAIL,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  LEGAL_DOCUMENT_META,
} from '../constants/legalVersions';
import { getAuthUser } from '../utils/auth';
import { supabase } from '../supabaseClient';
import {
  fetchComplianceProfile,
  evaluateCompliance,
  updateSecondaryPurposes,
  revokeConsents,
  submitArcoRequest,
  fetchArcoRequests,
} from '../services/legalConsent';
import type { ArcoRequestType } from '../types/legalConsent';
import { clearClinicalCacheForUser } from '../services/clinicalCache';

const ARCO_LABELS: Record<ArcoRequestType, string> = {
  access: 'Acceso',
  rectification: 'Rectificación',
  cancellation: 'Cancelación',
  opposition: 'Oposición',
};

const PrivacySettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [secondaryPurposes, setSecondaryPurposes] = useState(false);
  const [updatingSecondary, setUpdatingSecondary] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState<string | null>(null);
  const [termsVersion, setTermsVersion] = useState<string | null>(null);
  const [privacyVersion, setPrivacyVersion] = useState<string | null>(null);
  const [needsReConsent, setNeedsReConsent] = useState(false);

  const [arcoType, setArcoType] = useState<ArcoRequestType>('access');
  const [arcoDescription, setArcoDescription] = useState('');
  const [arcoSubmitting, setArcoSubmitting] = useState(false);
  const [arcoMessage, setArcoMessage] = useState<string | null>(null);
  const [arcoRequests, setArcoRequests] = useState<
    { id: string; request_type: string; status: string; created_at: string }[]
  >([]);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const user = await getAuthUser();
    if (!user) {
      navigate('/login');
      return;
    }

    const profile = await fetchComplianceProfile(user.id);
    if (profile) {
      const status = evaluateCompliance(profile);
      setSecondaryPurposes(status.secondaryPurposesAccepted);
      setTermsAcceptedAt(profile.terms_accepted_at);
      setPrivacyAcceptedAt(profile.privacy_sensitive_accepted_at);
      setTermsVersion(profile.terms_version);
      setPrivacyVersion(profile.privacy_version);
      setNeedsReConsent(status.needsReConsent);
    }

    const requests = await fetchArcoRequests();
    setArcoRequests(requests);
    setLoading(false);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSecondaryToggle = async () => {
    setUpdatingSecondary(true);
    const next = !secondaryPurposes;
    const { error } = await updateSecondaryPurposes(next);
    setUpdatingSecondary(false);
    if (error) {
      setArcoMessage(error);
      return;
    }
    setSecondaryPurposes(next);
    setArcoMessage(
      next
        ? 'Consentimiento para finalidades secundarias activado.'
        : 'Consentimiento para finalidades secundarias revocado.'
    );
  };

  const handleArcoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arcoDescription.trim()) {
      setArcoMessage('Describe tu solicitud ARCO.');
      return;
    }
    setArcoSubmitting(true);
    setArcoMessage(null);
    const { error } = await submitArcoRequest(arcoType, arcoDescription.trim());
    setArcoSubmitting(false);
    if (error) {
      setArcoMessage(error);
      return;
    }
    setArcoDescription('');
    setArcoMessage(
      `Solicitud registrada. También puede escribir a ${ARCO_CONTACT_EMAIL}. Responderemos en un plazo máximo de 20 días hábiles.`
    );
    const requests = await fetchArcoRequests();
    setArcoRequests(requests);
  };

  const handleRevoke = async () => {
    const confirmed = window.confirm(
      '¿Revocar su consentimiento? Esto cerrará su sesión y limitará el uso de la plataforma. Los datos podrán conservarse solo por obligación legal.'
    );
    if (!confirmed) return;

    setRevoking(true);
    const user = await getAuthUser();
    const { error } = await revokeConsents();
    if (error) {
      setArcoMessage(error);
      setRevoking(false);
      return;
    }

    if (user) {
      await clearClinicalCacheForUser(user.id);
    }
    await supabase.auth.signOut();
    setRevoking(false);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-surface-dark/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <PageContainer maxWidth="max-w-4xl" className="py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Volver"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Privacidad</h1>
        </PageContainer>
      </header>

      <PageContainer maxWidth="max-w-4xl" className="py-6 space-y-6">
        {needsReConsent && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">
              Documentos legales desactualizados
            </p>
            <button
              type="button"
              onClick={() => navigate('/legal-acceptance')}
              className="text-sm font-black text-primary hover:underline"
            >
              Revisar y aceptar la versión actual
            </button>
          </div>
        )}

        {arcoMessage && (
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 text-sm text-blue-900 dark:text-blue-100">
            {arcoMessage}
          </div>
        )}

        <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-text-muted">
            Consentimientos registrados
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-300">Términos de Uso</span>
              <span className="font-bold text-right">
                v{termsVersion ?? '—'} · {formatDate(termsAcceptedAt)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-300">Datos sensibles (privacidad)</span>
              <span className="font-bold text-right">
                v{privacyVersion ?? '—'} · {formatDate(privacyAcceptedAt)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-600 dark:text-slate-300">Versión vigente</span>
              <span className="font-bold">
                Términos {CURRENT_TERMS_VERSION} · Privacidad {CURRENT_PRIVACY_VERSION}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(LEGAL_DOCUMENT_META.privacy.route)}
              className="text-sm font-bold text-primary hover:underline"
            >
              Ver Aviso de Privacidad
            </button>
            <button
              type="button"
              onClick={() => navigate(LEGAL_DOCUMENT_META.terms.route)}
              className="text-sm font-bold text-primary hover:underline"
            >
              Ver Términos de Uso
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                Finalidades secundarias
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Uso de datos clínicos anonimizados para estadísticas e investigación.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={secondaryPurposes}
              disabled={updatingSecondary}
              onClick={handleSecondaryToggle}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                secondaryPurposes ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  secondaryPurposes ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-text-muted">
            Ejercer derechos ARCO
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Acceso, Rectificación, Cancelación u Oposición. También puede escribir a{' '}
            <a href={`mailto:${ARCO_CONTACT_EMAIL}`} className="text-primary font-bold">
              {ARCO_CONTACT_EMAIL}
            </a>
            .
          </p>
          <form onSubmit={handleArcoSubmit} className="space-y-3">
            <select
              value={arcoType}
              onChange={(e) => setArcoType(e.target.value as ArcoRequestType)}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {(Object.keys(ARCO_LABELS) as ArcoRequestType[]).map((key) => (
                <option key={key} value={key}>
                  {ARCO_LABELS[key]}
                </option>
              ))}
            </select>
            <textarea
              value={arcoDescription}
              onChange={(e) => setArcoDescription(e.target.value)}
              placeholder="Describe tu solicitud..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
              required
            />
            <button
              type="submit"
              disabled={arcoSubmitting}
              className="w-full h-12 bg-primary text-white font-bold rounded-xl disabled:opacity-60"
            >
              {arcoSubmitting ? 'Enviando...' : 'Enviar solicitud ARCO'}
            </button>
          </form>

          {arcoRequests.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase text-text-muted mb-2">
                Solicitudes recientes
              </p>
              <ul className="space-y-2 text-sm">
                {arcoRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between gap-2 text-slate-600 dark:text-slate-300"
                  >
                    <span>
                      {ARCO_LABELS[r.request_type as ArcoRequestType] ?? r.request_type}
                    </span>
                    <span className="font-bold capitalize">{r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-900/30 p-6">
          <h2 className="font-bold text-red-900 dark:text-red-200 mb-2">
            Revocar consentimiento
          </h2>
          <p className="text-sm text-red-800 dark:text-red-300 mb-4">
            Puede retirar su autorización en cualquier momento. Esto cerrará su sesión y puede
            implicar la cancelación de su cuenta.
          </p>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={revoking}
            className="px-6 h-11 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl disabled:opacity-60"
          >
            {revoking ? 'Procesando...' : 'Revocar consentimiento'}
          </button>
        </section>

        <LegalFooterLinks />
      </PageContainer>
    </div>
  );
};

export default PrivacySettings;
