import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthSplitShell from '../components/auth/AuthSplitShell';
import { supabase } from '../supabaseClient';
import { TIER_LABELS, type SubscriptionTier } from '../features/entitlements/planCatalog';
import type { PracticeType } from '../services/onboardingService';

interface ConfirmationRouteState {
  email?: string;
  practiceType?: PracticeType;
  clinicTeamSize?: number;
  clinicName?: string;
  planTier?: SubscriptionTier;
  planName?: string;
}

const EmailConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const info = (location.state as ConfirmationRouteState | null) || {};

  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!info.email || cooldown > 0) return;
    setResending(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: info.email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) {
        setFeedback({ kind: 'error', text: error.message || 'No se pudo reenviar el correo.' });
      } else {
        setFeedback({
          kind: 'success',
          text: `Reenviamos el enlace de activación a ${info.email}.`,
        });
        setCooldown(60);
      }
    } finally {
      setResending(false);
    }
  };

  const planDisplay =
    info.planName || (info.planTier ? `Plan ${TIER_LABELS[info.planTier]}` : null);

  return (
    <AuthSplitShell
      backTo="/login"
      backLabel="Iniciar sesión"
      badge="Activación de cuenta"
      asideTitle="Ya casi terminamos tu registro"
      asideDescription="Guardamos tu modalidad de práctica y tu selección de plan. Al confirmar tu correo entrarás directo a tu perfil."
      maxContentWidth="max-w-lg"
    >
      <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-xl p-7 sm:p-10 text-center space-y-6">
        <div className="mx-auto size-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
          <span className="material-symbols-outlined text-[42px]">mark_email_read</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            ¡Revisa tu correo para activar tu cuenta!
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Enviamos un enlace de confirmación
            {info.email ? (
              <>
                {' '}
                a <strong className="text-slate-900 dark:text-white">{info.email}</strong>
              </>
            ) : (
              ' a tu dirección de correo electrónico'
            )}
            . Haz clic en el enlace para iniciar sesión y acceder a tu perfil con todo listo.
          </p>
        </div>

        {(planDisplay || info.practiceType) && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-4 text-left space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">
              Configuración reservada para tu perfil
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {info.practiceType && (
                <div className="rounded-xl bg-white dark:bg-surface-dark border border-slate-200/70 dark:border-slate-800 p-3">
                  <span className="block text-[10px] font-bold uppercase text-text-muted">
                    Modalidad
                  </span>
                  <span className="block font-black text-slate-900 dark:text-white mt-0.5">
                    {info.practiceType === 'clinic'
                      ? `Clínica (${info.clinicTeamSize || 2} personas)`
                      : 'Médico particular'}
                  </span>
                  {info.clinicName && (
                    <span className="block text-[11px] text-text-muted truncate mt-0.5">
                      {info.clinicName}
                    </span>
                  )}
                </div>
              )}
              {planDisplay && (
                <div className="rounded-xl bg-white dark:bg-surface-dark border border-slate-200/70 dark:border-slate-800 p-3">
                  <span className="block text-[10px] font-bold uppercase text-text-muted">
                    Plan seleccionado
                  </span>
                  <span className="block font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {planDisplay}
                  </span>
                  <span className="block text-[11px] text-text-muted mt-0.5">
                    $0 MXN hoy · Sin tarjeta
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-2xl p-3.5 text-xs font-bold border ${
              feedback.kind === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => navigate('/login', { state: { email: info.email } })}
            className="w-full bg-primary hover:bg-primary-dark text-white font-black py-3.5 rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.99] cursor-pointer"
          >
            Ir a iniciar sesión
          </button>

          {info.email && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {resending
                ? 'Reenviando correo…'
                : cooldown > 0
                ? `Reenviar disponible en ${cooldown}s`
                : 'Reenviar correo de confirmación'}
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">
          ¿No ves el correo? Revisa tu carpeta de <strong className="text-slate-500 dark:text-slate-300">Spam</strong> o <strong className="text-slate-500 dark:text-slate-300">Promociones</strong>.
        </p>
      </div>
    </AuthSplitShell>
  );
};

export default EmailConfirmation;
