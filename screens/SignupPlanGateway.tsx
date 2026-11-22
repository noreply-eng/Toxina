import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import LegalFooterLinks from '../components/LegalFooterLinks';
import { APP_NAME } from '../constants/brand';
import { supabase } from '../supabaseClient';
import { useSignupFlow } from '../contexts/SignupFlowContext';
import { useEntitlements } from '../features/entitlements/EntitlementContext';
import { fetchSubscriptionPlans } from '../features/billing/billingProvider';
import {
  ALL_FEATURE_KEYS,
  FALLBACK_PLANS,
  TIER_DEFAULT_FEATURES,
  TIER_LABELS,
  formatMoney,
  type SubscriptionPlanRecord,
  type SubscriptionTier,
} from '../features/entitlements/planCatalog';
import {
  completeUserOnboarding,
  resolvePlanSlug,
  savePendingOnboarding,
  type OnboardingSelectionPayload,
} from '../services/onboardingService';
import { translateAuthError } from '../utils/authErrors';
import { getAuthUser } from '../utils/auth';

const TIER_ORDER: SubscriptionTier[] = ['free', 'plus', 'premium'];

const TIER_HIGHLIGHT_COPY: Record<
  SubscriptionTier,
  { tagline: string; accent: string; icon: string }
> = {
  free: {
    tagline: 'Ideal para comenzar con cálculo clínico por marca y reportes de sesión.',
    accent: 'from-slate-600 to-slate-800',
    icon: 'calculate',
  },
  plus: {
    tagline: 'Expedientes completos, metas GAS, agenda inteligente y modo offline PWA.',
    accent: 'from-sky-600 to-indigo-700',
    icon: 'medical_services',
  },
  premium: {
    tagline: 'Suite completa: anatomía 3D, puntos motores, ecografía USG, protocolos y videos.',
    accent: 'from-primary via-teal-600 to-cyan-700',
    icon: 'workspace_premium',
  },
};

const SignupPlanGateway: React.FC = () => {
  const navigate = useNavigate();
  const { state, updateState, resetFlow, setIsFinalizingSignup } = useSignupFlow();
  const { entitlements, refresh: refreshEntitlements } = useEntitlements();

  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>(FALLBACK_PLANS);
  const [plansLoading, setPlansLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPromoInput, setShowPromoInput] = useState(Boolean(state.promoCode));
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [alreadyAuthUserId, setAlreadyAuthUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSubscriptionPlans(false).then((rows) => {
      if (!active) return;
      if (rows.length > 0) setPlans(rows);
      setPlansLoading(false);
    });
    getAuthUser().then((user) => {
      if (!active) return;
      if (user) {
        setAlreadyAuthUserId(user.id);
        if (!state.email && user.email) {
          updateState({
            email: user.email,
            fullName: state.fullName || user.user_metadata?.full_name || '',
          });
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isClinic = state.practiceType === 'clinic';
  const teamSize = isClinic ? Math.max(2, state.clinicTeamSize || 2) : 1;

  // Always offer all 3 plan tiers (Gratuito, Plus, Premium) matched to Individual vs Clinic
  const gatewayPlans = useMemo(() => {
    return TIER_ORDER.map((tier) => {
      const targetSlug = resolvePlanSlug(tier, state.practiceType);
      const exact = plans.find((p) => p.slug === targetSlug);
      if (exact) return exact;

      const fallbackExact = FALLBACK_PLANS.find((p) => p.slug === targetSlug);
      if (fallbackExact) return fallbackExact;

      const byTier =
        plans.find((p) => p.tier === tier && p.scope === (isClinic ? 'clinic' : 'individual')) ||
        plans.find((p) => p.tier === tier);
      return byTier || FALLBACK_PLANS[0];
    });
  }, [plans, state.practiceType, isClinic]);

  const selectedPlan = useMemo(
    () => gatewayPlans.find((p) => p.tier === state.selectedPlanTier) || gatewayPlans[2],
    [gatewayPlans, state.selectedPlanTier]
  );

  const selectedPriceCents =
    state.billingInterval === 'annual'
      ? selectedPlan.price_annual_cents
      : selectedPlan.price_monthly_cents;
  const periodSuffix = state.billingInterval === 'annual' ? '/año' : '/mes';

  const missingCredentials = !alreadyAuthUserId && (!state.email.trim() || !state.password);

  const handleCompleteRegistration = async () => {
    setError(null);

    if (missingCredentials) {
      navigate('/signup', {
        replace: true,
        state: {
          step: 1,
          notice:
            'Por seguridad, vuelve a ingresar tu contraseña para completar tu inscripción. Tus datos y modalidad se conservaron.',
        },
      });
      return;
    }

    const planSlug = resolvePlanSlug(selectedPlan.tier, state.practiceType);
    const onboardingPayload: OnboardingSelectionPayload = {
      fullName: state.fullName.trim(),
      practiceType: state.practiceType,
      clinicTeamSize: teamSize,
      clinicName: state.clinicName.trim(),
      planTier: selectedPlan.tier,
      planSlug,
      billingInterval: state.billingInterval,
      termsAccepted: state.termsAccepted,
      privacySensitiveAccepted: state.privacySensitiveAccepted,
      secondaryPurposesAccepted: state.secondaryPurposesAccepted,
      promoCode: state.promoCode.trim() || undefined,
    };

    setSubmitting(true);
    setIsFinalizingSignup(true);

    try {
      // Case A: User is already signed in (e.g., visiting /onboarding/plan)
      if (alreadyAuthUserId) {
        const res = await completeUserOnboarding(alreadyAuthUserId, onboardingPayload);
        await refreshEntitlements();
        resetFlow();
        navigate('/profile?welcome=1', {
          replace: true,
          state: {
            fromSignup: true,
            selectedPlanTier: selectedPlan.tier,
            selectedPlanName: selectedPlan.name,
            practiceType: state.practiceType,
            clinicTeamSize: teamSize,
            clinicName: state.clinicName.trim(),
            warning: res.warning,
          },
        });
        return;
      }

      // Case B: New user registration
      const cleanEmail = state.email.trim();
      savePendingOnboarding(cleanEmail, onboardingPayload);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: state.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: onboardingPayload.fullName,
            practice_type: onboardingPayload.practiceType,
            clinic_team_size: onboardingPayload.clinicTeamSize,
            clinic_name: onboardingPayload.clinicName || null,
            selected_plan_tier: onboardingPayload.planTier,
            selected_plan_slug: onboardingPayload.planSlug,
            billing_interval: onboardingPayload.billingInterval,
            terms_accepted: onboardingPayload.termsAccepted,
            privacy_sensitive_accepted: onboardingPayload.privacySensitiveAccepted,
            secondary_purposes_accepted: onboardingPayload.secondaryPurposesAccepted,
            onboarding_pending: true,
          },
        },
      });

      if (signUpError) {
        setIsFinalizingSignup(false);
        setError(translateAuthError(signUpError.message));
        return;
      }

      // Detect anti-enumeration duplicate email response from Supabase
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setIsFinalizingSignup(false);
        setError({
          code: 'already_registered',
          message: 'Ya existe una cuenta registrada con este correo electrónico. Inicia sesión para continuar.',
        });
        return;
      }

      // Subcase B1: Immediate session created (email confirmation disabled)
      if (data.session && data.user) {
        const res = await completeUserOnboarding(data.user.id, onboardingPayload);
        await refreshEntitlements();
        resetFlow();
        navigate('/profile?welcome=1', {
          replace: true,
          state: {
            fromSignup: true,
            selectedPlanTier: selectedPlan.tier,
            selectedPlanName: selectedPlan.name,
            practiceType: onboardingPayload.practiceType,
            clinicTeamSize: onboardingPayload.clinicTeamSize,
            clinicName: onboardingPayload.clinicName,
            warning: res.warning,
          },
        });
        return;
      }

      // Subcase B2: Email confirmation required before first login
      setIsFinalizingSignup(false);
      navigate('/email-confirmation', {
        replace: true,
        state: {
          email: cleanEmail,
          practiceType: onboardingPayload.practiceType,
          clinicTeamSize: onboardingPayload.clinicTeamSize,
          clinicName: onboardingPayload.clinicName,
          planTier: onboardingPayload.planTier,
          planName: selectedPlan.name,
        },
      });
    } catch (err: any) {
      setIsFinalizingSignup(false);
      setError(translateAuthError(err?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background-light dark:bg-background-dark">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                alreadyAuthUserId
                  ? navigate('/profile')
                  : navigate('/signup', { state: { step: 2 } })
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              {alreadyAuthUserId ? 'Volver' : 'Modalidad'}
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <Link to="/" className="hidden sm:flex items-center gap-2">
              <BrandLogo size={30} rounded="xl" />
              <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white">
                {APP_NAME}
              </span>
            </Link>
          </div>

          {/* Compact 3-step indicator */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="hidden md:inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              1. Cuenta
            </span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700">/</span>
            <span className="hidden md:inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              2. Modalidad
            </span>
            <span className="hidden md:inline text-slate-300 dark:text-slate-700">/</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 font-black">
              <span className="material-symbols-outlined text-[15px]">payments</span>
              3. Pasarela de planes
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Heading + Stripe Pending Banner */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <span className="material-symbols-outlined text-[14px]">celebration</span>
                Pasarela de inscripción · $0 MXN hoy
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Elige tu plan para finalizar tu registro
              </h1>
              <p className="text-sm text-text-muted max-w-2xl">
                Selecciona entre <strong>Gratuito</strong>, <strong>Plus</strong> o{' '}
                <strong>Premium</strong>. Al finalizar, guardaremos toda tu información y te llevaremos directamente a tu perfil.
              </p>
            </div>

            {/* Monthly / Annual toggle */}
            <div className="inline-flex p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800/90 self-start shrink-0">
              <button
                type="button"
                onClick={() => updateState({ billingInterval: 'monthly' })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  state.billingInterval === 'monthly'
                    ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                    : 'text-text-muted hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => updateState({ billingInterval: 'annual' })}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  state.billingInterval === 'annual'
                    ? 'bg-white dark:bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                    : 'text-text-muted hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Anual
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* Modality confirmation strip + Stripe notice */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Selected Practice Modality Pill */}
            <div className="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">
                    {isClinic ? 'local_hospital' : 'person'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Modalidad seleccionada
                  </p>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {isClinic
                      ? `Clínica con equipo · ${teamSize} ${teamSize === 1 ? 'persona' : 'personas'}`
                      : 'Médico particular · 1 especialista'}
                  </p>
                  {isClinic && state.clinicName.trim() && (
                    <p className="text-xs text-text-muted truncate">{state.clinicName.trim()}</p>
                  )}
                </div>
              </div>
              {!alreadyAuthUserId ? (
                <button
                  type="button"
                  onClick={() => navigate('/signup', { state: { step: 2 } })}
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  Cambiar
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateState({ practiceType: 'individual', clinicTeamSize: 1 })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      !isClinic
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-text-muted'
                    }`}
                  >
                    Particular
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateState({
                        practiceType: 'clinic',
                        clinicTeamSize: Math.max(2, state.clinicTeamSize || 3),
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                      isClinic
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-text-muted'
                    }`}
                  >
                    Clínica
                  </button>
                  {isClinic && (
                    <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateState({ clinicTeamSize: Math.max(2, teamSize - 1) })
                        }
                        className="size-5 rounded font-black text-xs hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        aria-label="Menos personas"
                      >
                        −
                      </button>
                      <span className="text-[11px] font-black px-1">{teamSize}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateState({ clinicTeamSize: Math.min(500, teamSize + 1) })
                        }
                        className="size-5 rounded font-black text-xs hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        aria-label="Más personas"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stripe Status Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/25 p-4 flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-[22px]">credit_card_off</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                  Stripe aún no cobra · Activa Gratuito, Plus o Premium sin tarjeta
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  Mientras vinculamos la pasarela de Stripe, puedes elegir cualquiera de los 3 planes a{' '}
                  <strong>$0 MXN</strong> y conservar tu beneficio Early Adopter (
                  {entitlements.platform_settings.founder_discount_percent}% dto. futuro).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Missing password warning (if refreshed mid-signup) */}
        {missingCredentials && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300/70 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-sm text-amber-900 dark:text-amber-200">
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">info</span>
              <span>
                Para completar tu registro necesitas confirmar tu contraseña en el Paso 1 (tus datos de modalidad se mantendrán guardados).
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/signup', { state: { step: 1 } })}
              className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer"
            >
              Volver al Paso 1
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-red-700 dark:text-red-300"
          >
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">error</span>
              <span className="font-medium">{error.message}</span>
            </div>
            {error.code === 'already_registered' && (
              <Link
                to="/login"
                state={{ email: state.email }}
                className="shrink-0 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black"
              >
                Ir a iniciar sesión
              </Link>
            )}
          </div>
        )}

        {/* 3 Plan Cards Grid */}
        {plansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-96 rounded-3xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <section aria-label="Selección de plan" className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {gatewayPlans.map((plan) => {
              const isSelected = state.selectedPlanTier === plan.tier;
              const priceCents =
                state.billingInterval === 'annual'
                  ? plan.price_annual_cents
                  : plan.price_monthly_cents;
              const featureMap = {
                ...TIER_DEFAULT_FEATURES[plan.tier],
                ...(plan.features || {}),
              };
              const meta = TIER_HIGHLIGHT_COPY[plan.tier];
              const isPaidTier = plan.tier !== 'free';

              return (
                <div
                  key={plan.slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => updateState({ selectedPlanTier: plan.tier })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      updateState({ selectedPlanTier: plan.tier });
                    }
                  }}
                  aria-pressed={isSelected}
                  className={`relative flex flex-col rounded-3xl p-6 bg-white dark:bg-surface-dark border-2 transition-all cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
                    isSelected
                      ? 'border-primary shadow-2xl shadow-primary/15 ring-1 ring-primary/25 -translate-y-0.5'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-primary/40 shadow-sm'
                  }`}
                >
                  {/* Top row: icon + badge + radio */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`size-10 rounded-2xl bg-gradient-to-br ${meta.accent} text-white flex items-center justify-center shadow-sm`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest text-text-muted">
                          {plan.tier === 'free'
                            ? 'Acceso base'
                            : isClinic
                            ? `Clínica · ${teamSize} pers.`
                            : 'Médico particular'}
                        </span>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                          Plan {TIER_LABELS[plan.tier]}
                        </h2>
                      </div>
                    </div>

                    <span
                      className={`material-symbols-outlined text-[24px] shrink-0 ${
                        isSelected ? 'text-primary' : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </div>

                  {/* Highlight badge */}
                  {plan.tier === 'premium' && (
                    <span className="self-start mb-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[13px]">stars</span>
                      Recomendado
                    </span>
                  )}
                  {plan.tier === 'plus' && (
                    <span className="self-start mb-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      Práctica clínica
                    </span>
                  )}
                  {plan.tier === 'free' && (
                    <span className="self-start mb-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Siempre sin costo
                    </span>
                  )}

                  <p className="text-xs text-text-muted leading-relaxed min-h-[2.5rem]">
                    {meta.tagline}
                  </p>

                  {/* Pricing block */}
                  <div className="mt-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    {isPaidTier && priceCents > 0 ? (
                      <div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                            $0
                          </span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {plan.currency}
                          </span>
                          <span className="text-sm font-semibold text-slate-400 line-through">
                            {formatMoney(priceCents, plan.currency)}
                            {periodSuffix}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                          Gratis hoy mientras se vincula Stripe
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-black text-slate-900 dark:text-white">
                            $0
                          </span>
                          <span className="text-xs font-bold text-text-muted">MXN / siempre</span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-1">
                          Sin cobro ni vencimiento
                        </p>
                      </div>
                    )}

                    {isClinic && isPaidTier && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                        <span className="material-symbols-outlined text-[14px]">groups</span>
                        Unidad configurada para {teamSize} personas
                      </div>
                    )}
                  </div>

                  {/* Feature list */}
                  <ul className="mt-4 space-y-2 text-xs flex-1">
                    {ALL_FEATURE_KEYS.filter((f) => f.key !== 'data.export').map((feat) => {
                      const enabled = Boolean(featureMap[feat.key]);
                      return (
                        <li
                          key={feat.key}
                          className={`flex items-start gap-2 ${
                            enabled
                              ? 'text-slate-700 dark:text-slate-200 font-medium'
                              : 'text-slate-400 dark:text-slate-600 line-through'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] shrink-0 mt-0.5 ${
                              enabled ? 'text-primary' : 'text-slate-300 dark:text-slate-700'
                            }`}
                          >
                            {enabled ? 'check_circle' : 'cancel'}
                          </span>
                          <span>{feat.label}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <div
                    className={`mt-5 w-full py-2.5 rounded-2xl text-center text-xs font-black transition-colors ${
                      isSelected
                        ? 'bg-primary text-white shadow-md shadow-primary/25'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {isSelected
                      ? `Plan ${TIER_LABELS[plan.tier]} seleccionado`
                      : `Elegir Plan ${TIER_LABELS[plan.tier]}`}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Payment Gateway Summary & Confirmation Card */}
        <section className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-900/5 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
            {/* Left: Stripe-ready payment method & promo */}
            <div className="p-6 sm:p-8 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">lock</span>
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white">
                      Pasarela de pago segura
                    </h2>
                    <p className="text-xs text-text-muted">
                      Resumen de método de pago y activación inmediata
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                  Stripe Ready
                </span>
              </div>

              {/* Simulated Stripe panel explaining $0 activation */}
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-500 text-[20px]">
                      credit_card
                    </span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Tarjeta bancaria vía Stripe
                    </span>
                  </div>
                  <span className="rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-black uppercase">
                    Próximamente
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  El cobro con Stripe aún no está activo, por lo que{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    no se solicitará tarjeta bancaria
                  </strong>
                  . Tu cuenta quedará activa inmediatamente en el plan que elegiste ({TIER_LABELS[selectedPlan.tier]}) y guardaremos todos los datos en tu perfil.
                </p>
              </div>

              {/* Optional promo / enterprise code */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPromoInput((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">confirmation_number</span>
                  {showPromoInput
                    ? 'Ocultar código promocional'
                    : '¿Tienes un cupón promocional o licencia Enterprise?'}
                </button>
                {showPromoInput && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={state.promoCode}
                      onChange={(e) => updateState({ promoCode: e.target.value.toUpperCase() })}
                      placeholder="INGRESA TU CODIGO AQUI"
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Order summary & Final CTA */}
            <div className="p-6 sm:p-8 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-text-muted">
                  Resumen de inscripción
                </h3>

                <dl className="space-y-2 text-xs">
                  {state.fullName.trim() && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Titular</dt>
                      <dd className="font-bold text-slate-900 dark:text-white text-right truncate">
                        {state.fullName.trim()}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">Modalidad</dt>
                    <dd className="font-bold text-slate-900 dark:text-white text-right">
                      {isClinic ? 'Clínica con equipo' : 'Médico particular'}
                    </dd>
                  </div>
                  {isClinic && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Personas en la unidad</dt>
                      <dd className="font-bold text-slate-900 dark:text-white text-right">
                        {teamSize} integrantes
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-muted">Plan elegido</dt>
                    <dd className="font-black text-primary text-right">
                      Plan {TIER_LABELS[selectedPlan.tier]}
                      {selectedPlan.tier !== 'free'
                        ? ` (${state.billingInterval === 'annual' ? 'Anual' : 'Mensual'})`
                        : ''}
                    </dd>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 mt-2.5 space-y-1.5">
                    {selectedPlan.tier !== 'free' && selectedPriceCents > 0 && (
                      <>
                        <div className="flex justify-between gap-3">
                          <dt className="text-text-muted">Precio de lista</dt>
                          <dd className="font-semibold text-slate-500 line-through">
                            {formatMoney(selectedPriceCents, selectedPlan.currency)}
                            {periodSuffix}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-400">
                          <dt className="font-bold">Acceso sin pasarela Stripe</dt>
                          <dd className="font-black">
                            -{formatMoney(selectedPriceCents, selectedPlan.currency)}
                          </dd>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-baseline gap-3 pt-1">
                      <dt className="text-sm font-black text-slate-900 dark:text-white">
                        Total a pagar hoy
                      </dt>
                      <dd className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        $0 MXN
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCompleteRegistration}
                  className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 px-5 rounded-2xl text-sm sm:text-base shadow-xl shadow-primary/25 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[20px]">
                        progress_activity
                      </span>
                      Guardando tu inscripción…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                      Activar Plan {TIER_LABELS[selectedPlan.tier]} e ir a mi perfil
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-text-muted">
                  Podrás cambiar de plan o actualizar los datos de tu unidad en cualquier momento desde tu perfil.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 py-6 text-center border-t border-slate-200/60 dark:border-slate-800/60">
        <LegalFooterLinks />
      </footer>
    </div>
  );
};

export default SignupPlanGateway;
