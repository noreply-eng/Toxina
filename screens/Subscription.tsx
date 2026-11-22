import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { useEntitlements } from '../features/entitlements/EntitlementContext';
import {
  ALL_FEATURE_KEYS,
  ORIGIN_LABELS,
  TIER_DEFAULT_FEATURES,
  TIER_LABELS,
  formatMoney,
  type SubscriptionPlanRecord,
} from '../features/entitlements/planCatalog';
import {
  activatePlanSubscription,
  fetchSubscriptionPlans,
  openCustomerBillingPortal,
  redeemPromoOrEnterpriseCode,
} from '../features/billing/billingProvider';

const Subscription: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    entitlements,
    effectiveTier,
    isEnterpriseManager,
    isSuperAdmin,
    loading: entLoading,
    refresh,
  } = useEntitlements();

  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [scope, setScope] = useState<'individual' | 'clinic'>(() =>
    entitlements.practice_type === 'clinic' ? 'clinic' : 'individual'
  );
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [showPlanCatalog, setShowPlanCatalog] = useState<boolean>(
    () => searchParams.get('catalog') === '1'
  );
  const [activatingSlug, setActivatingSlug] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState(() => searchParams.get('code') || '');
  const [redeeming, setRedeeming] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'info' | 'error'; text: string } | null>(
    () => {
      const checkout = searchParams.get('checkout');
      if (checkout === 'success') {
        return { kind: 'success', text: '¡Pago recibido! Tu suscripción se está actualizando.' };
      }
      if (checkout === 'canceled') {
        return { kind: 'info', text: 'El proceso de pago fue cancelado. No se realizó ningún cargo.' };
      }
      return null;
    }
  );

  useEffect(() => {
    let active = true;
    fetchSubscriptionPlans(false).then((rows) => {
      if (!active) return;
      setPlans(rows);
      setPlansLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && !promoCode) {
      setPromoCode(codeParam.toUpperCase());
    }
  }, [searchParams, promoCode]);

  const billingMode = entitlements.platform_settings.billing_mode;
  const isFreeLaunch = billingMode === 'free_launch';
  const isStripeLive = billingMode === 'stripe_live';

  useEffect(() => {
    if (entitlements.practice_type === 'clinic') {
      setScope('clinic');
    }
  }, [entitlements.practice_type]);

  const visiblePlans = useMemo(() => {
    if (scope === 'clinic') {
      const freePlan = plans.find((p) => p.tier === 'free');
      const clinicPlans = plans.filter((p) => p.scope === 'clinic');
      const combined = freePlan ? [freePlan, ...clinicPlans] : clinicPlans;
      if (combined.length > 0) return combined;
    }
    const filtered = plans.filter((p) => p.scope === scope);
    if (filtered.length > 0) return filtered;
    return plans.filter((p) => p.scope === 'individual');
  }, [plans, scope]);

  const hasClinicPlans = useMemo(() => plans.some((p) => p.scope === 'clinic'), [plans]);

  const handleActivatePlan = async (plan: SubscriptionPlanRecord) => {
    setFeedback(null);
    setActivatingSlug(plan.slug);
    try {
      const res = await activatePlanSubscription({
        planSlug: plan.slug,
        billingInterval,
        billingMode,
        clinicId: plan.scope === 'clinic' ? entitlements.active_clinic_id : null,
      });

      if (res.mode === 'redirect_checkout' && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }

      await refresh();
      if (plan.tier !== 'free') {
        navigate('/clinic-admin', { replace: true });
        return;
      }
      setFeedback({
        kind: res.mode === 'claimed_free' ? 'success' : 'info',
        text: res.message,
      });
    } catch (err: any) {
      setFeedback({
        kind: 'error',
        text: err?.message || 'No se pudo procesar tu solicitud de suscripción.',
      });
    } finally {
      setActivatingSlug(null);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = promoCode.trim();
    if (!cleaned) return;

    setFeedback(null);
    setRedeeming(true);
    try {
      const result = await redeemPromoOrEnterpriseCode(cleaned);
      await refresh();
      setPromoCode('');
      if (searchParams.has('code')) {
        searchParams.delete('code');
        setSearchParams(searchParams, { replace: true });
      }
      navigate('/clinic-admin', { replace: true });
    } catch (err: any) {
      setFeedback({
        kind: 'error',
        text: err?.message || 'Código inválido, vencido o sin licencias disponibles.',
      });
    } finally {
      setRedeeming(false);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    setFeedback(null);
    try {
      const url = await openCustomerBillingPortal(billingMode);
      if (url) {
        window.location.href = url;
      } else {
        setFeedback({
          kind: 'info',
          text: 'El portal de facturación de Stripe se habilitará cuando la pasarela de cobro entre en operación.',
        });
      }
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'No se pudo abrir el portal de pagos.' });
    } finally {
      setPortalLoading(false);
    }
  };

  if (entLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  const heroGradient =
    effectiveTier === 'premium'
      ? 'from-primary via-teal-600 to-cyan-700 shadow-primary/25'
      : effectiveTier === 'plus'
      ? 'from-sky-600 to-indigo-700 shadow-sky-600/20'
      : 'from-slate-700 to-slate-900 shadow-slate-700/20';

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32 lg:pb-12 overflow-y-auto no-scrollbar">
      <header className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60">
        <PageContainer maxWidth="max-w-5xl" className="flex items-center justify-between pt-12 lg:pt-6 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="mr-1 rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              aria-label="Volver a Ajustes"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Planes y Suscripción</h1>
              <p className="text-xs text-text-muted">
                Gestiona tu plan, canjea cupones promocionales o licencias Enterprise
              </p>
            </div>
          </div>
          {isStripeLive && effectiveTier !== 'free' && (
            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              {portalLoading ? 'Abriendo…' : 'Portal Stripe'}
            </button>
          )}
        </PageContainer>
      </header>

      <main className="flex-1">
        <PageContainer maxWidth="max-w-5xl" className="space-y-6 pt-6">
          {isSuperAdmin && (
            <section className="rounded-2xl bg-slate-900 text-white border border-slate-700 p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Acceso SuperAdmin
                  </p>
                  <p className="text-xs text-slate-300 truncate">
                    Modifica suscripciones activas, cambia planes, vigencias y precios desde la consola de administración.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/super-admin?tab=billing&subtab=subscriptions')}
                className="shrink-0 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">tune</span>
                Gestionar Suscripciones
              </button>
            </section>
          )}

          {feedback && (
            <div
              className={`rounded-2xl p-4 text-sm font-medium flex items-start justify-between gap-3 border ${
                feedback.kind === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : feedback.kind === 'error'
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                  : 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-xl shrink-0">
                  {feedback.kind === 'success'
                    ? 'check_circle'
                    : feedback.kind === 'error'
                    ? 'error'
                    : 'info'}
                </span>
                <span>{feedback.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-0.5 rounded-lg hover:bg-black/5"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* Active Plan Hero */}
          <section>
            <div className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-xl bg-gradient-to-br ${heroGradient}`}>
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative z-10 flex flex-wrap justify-between items-start gap-4">
                <div>
                  <p className="text-white/75 text-[10px] font-bold uppercase tracking-widest mb-1">
                    Tu Plan Efectivo Actual
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {entitlements.plan_name || `Plan ${TIER_LABELS[effectiveTier]}`}
                  </h2>
                  <p className="text-white/85 text-xs sm:text-sm mt-1">
                    Origen: <span className="font-bold">{ORIGIN_LABELS[entitlements.origin]}</span>
                    {entitlements.period_end
                      ? ` · Vigente hasta ${new Date(entitlements.period_end).toLocaleDateString('es-MX')}`
                      : entitlements.is_protected_grant
                      ? ' · Acceso protegido sin vencimiento automático'
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {entitlements.is_founder && (
                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase bg-amber-400/25 border border-amber-300/40 text-amber-100">
                      <span className="material-symbols-outlined text-[13px]">stars</span>
                      Fundador Early Adopter
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase bg-white/15 border border-white/25 backdrop-blur-md">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    {TIER_LABELS[effectiveTier]}
                  </span>
                </div>
              </div>

              {entitlements.grant_reason && (
                <p className="relative z-10 mt-3 text-xs text-white/80 bg-black/15 rounded-xl px-3.5 py-2 inline-block">
                  Nota de administración: {entitlements.grant_reason}
                </p>
              )}

              {entitlements.sponsor && (
                <div className="relative z-10 mt-5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-2xl text-amber-200 shrink-0">
                      workspace_premium
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-amber-100">
                        Licencia Enterprise Patrocinada
                      </p>
                      <p className="text-sm font-bold text-white">
                        Cortesía de {entitlements.sponsor.brand_display_name}
                      </p>
                      <p className="text-xs text-white/80 mt-0.5">
                        Privacidad garantizada (Zero-PHI): tu consultorio es 100% independiente; la marca patrocinadora nunca tiene acceso a tus pacientes ni a tus historiales clínicos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {effectiveTier !== 'free' && entitlements.role !== 'enterprise' && (
                <div className="relative z-10 mt-5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-2xl shrink-0">
                      {(entitlements.plan_slug || '').includes('clinic')
                        ? 'local_hospital'
                        : 'medical_services'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-white/85">
                        {(entitlements.plan_slug || '').includes('clinic')
                          ? `Panel de Clínica Privada ${TIER_LABELS[effectiveTier]} Activo`
                          : `Panel de Consultorio Privado ${TIER_LABELS[effectiveTier]} Activo`}
                      </p>
                      <p className="text-sm font-bold text-white truncate">
                        {entitlements.clinics.find((c) =>
                          ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
                        )?.name ||
                          ((entitlements.plan_slug || '').includes('clinic')
                            ? `Clínica de ${entitlements.full_name || 'Dr. Especialista'}`
                            : `Consultorio de ${entitlements.full_name || 'Dr. Especialista'}`)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const managed = entitlements.clinics.find((c) =>
                          ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
                        );
                        navigate(managed ? `/clinic-admin/${managed.clinic_id}` : '/clinic-admin');
                      }}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-white text-teal-800 font-black text-xs hover:bg-emerald-50 transition-colors cursor-pointer shadow-md"
                    >
                      {(entitlements.plan_slug || '').includes('clinic')
                        ? 'Abrir Panel de mi Clínica Privada'
                        : 'Abrir Panel de mi Consultorio Privado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPlanCatalog((prev) => !prev)}
                      className="shrink-0 px-3.5 py-2.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/25 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      {showPlanCatalog ? 'Ocultar catálogo de planes' : 'Cambiar modalidad (Consultorio / Clínica)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Only show launch promo banner & pricing cards when user is on Free OR explicitly opened catalog to change modality */}
          {(effectiveTier === 'free' || showPlanCatalog) && (
            <>
              {/* Free Launch Promo Banner */}
              {isFreeLaunch && (
                <section className="rounded-3xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border border-emerald-500/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="size-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <span className="material-symbols-outlined text-2xl">celebration</span>
                    </div>
                    <div>
                      <span className="inline-block text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                        Acceso de Lanzamiento por Tiempo Limitado
                      </span>
                      <h3 className="text-base font-extrabold text-text-main dark:text-white">
                        Todos los planes individuales y de clínica están a $0 MXN hoy
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        La pasarela de pago aún no cobra. Activa Plus o Premium sin tarjeta ahora mismo y recibe insignia de Fundador con{' '}
                        <strong>{entitlements.platform_settings.founder_discount_percent}% de descuento preferencial</strong> cuando inicien los cobros.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Scope & Interval Toggles */}
              <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {hasClinicPlans ? (
                  <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 self-start">
                    <button
                      type="button"
                      onClick={() => setScope('individual')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        scope === 'individual'
                          ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm'
                          : 'text-text-muted hover:text-text-main dark:hover:text-white'
                      }`}
                    >
                      Consultorio Privado Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('clinic')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        scope === 'clinic'
                          ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm'
                          : 'text-text-muted hover:text-text-main dark:hover:text-white'
                      }`}
                    >
                      Clínica Privada y Equipos
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 self-start">
                  <button
                    type="button"
                    onClick={() => setBillingInterval('monthly')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      billingInterval === 'monthly'
                        ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('annual')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      billingInterval === 'annual'
                        ? 'bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    Anual
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                      -17%
                    </span>
                  </button>
                </div>
              </section>

              {/* Plans Grid */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {visiblePlans.map((plan) => {
                  const isCurrent =
                    entitlements.plan_slug === plan.slug ||
                    (scope === 'individual' &&
                      effectiveTier === plan.tier &&
                      plan.scope === 'individual' &&
                      !(entitlements.plan_slug || '').includes('clinic'));
                  const priceCents =
                    billingInterval === 'annual' ? plan.price_annual_cents : plan.price_monthly_cents;
                  const periodSuffix = billingInterval === 'annual' ? '/año' : '/mes';
                  const featureMap = {
                    ...TIER_DEFAULT_FEATURES[plan.tier],
                    ...(plan.features || {}),
                  };
                  const isBusy = activatingSlug === plan.slug;

                  return (
                    <div
                      key={plan.id || plan.slug}
                      className={`relative flex flex-col rounded-3xl p-6 bg-white dark:bg-surface-dark border transition-all ${
                        plan.is_featured
                          ? 'border-primary shadow-xl shadow-primary/10 ring-1 ring-primary/20'
                          : 'border-slate-200/80 dark:border-slate-800 shadow-sm'
                      }`}
                    >
                      {plan.badge_text && (
                        <span className="self-start mb-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                          {plan.badge_text}
                        </span>
                      )}

                      <h3 className="text-xl font-black text-text-main dark:text-white">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-xs text-text-muted mt-1.5 leading-relaxed min-h-[2.5rem]">
                          {plan.description}
                        </p>
                      )}

                      <div className="mt-5 pb-5 border-b border-slate-100 dark:border-slate-800">
                        {isFreeLaunch && priceCents > 0 ? (
                          <div>
                            <div className="flex items-baseline gap-2">
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
                              Gratis durante el lanzamiento · Sin tarjeta
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-text-main dark:text-white">
                              {priceCents === 0 ? '$0' : formatMoney(priceCents, plan.currency)}
                            </span>
                            {priceCents > 0 && (
                              <span className="text-xs font-semibold text-text-muted">{periodSuffix}</span>
                            )}
                          </div>
                        )}
                        {plan.max_seats > 1 && (
                          <p className="text-[11px] text-text-muted mt-1">
                            Incluye hasta <strong>{plan.max_seats} asientos</strong> de clínica compartida
                          </p>
                        )}
                      </div>

                      <ul className="mt-5 space-y-2.5 text-xs flex-1">
                        {ALL_FEATURE_KEYS.filter((f) => f.key !== 'data.export').map((feat) => {
                          const enabled = Boolean(featureMap[feat.key]);
                          return (
                            <li
                              key={feat.key}
                              className={`flex items-start gap-2 ${
                                enabled
                                  ? 'text-text-main dark:text-slate-200 font-medium'
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

                      <button
                        type="button"
                        disabled={isCurrent || isBusy}
                        onClick={() => handleActivatePlan(plan)}
                        className={`mt-6 w-full py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer disabled:cursor-default ${
                          isCurrent
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            : plan.is_featured
                            ? 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/25'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                        }`}
                      >
                        {isBusy
                          ? 'Procesando…'
                          : isCurrent
                          ? 'Plan Actual'
                          : plan.tier === 'free'
                          ? 'Cambiar a Gratuito'
                          : isFreeLaunch
                          ? `Activar ${plan.scope === 'clinic' ? 'Clínica ' : 'Consultorio '}${TIER_LABELS[plan.tier]} Gratis ($0)`
                          : isStripeLive
                          ? `Suscribirse a ${TIER_LABELS[plan.tier]}`
                          : `Solicitar ${TIER_LABELS[plan.tier]}`}
                      </button>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {/* Unified Promo & Enterprise Voucher Redemption */}
          <section className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined">confirmation_number</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-text-main dark:text-white">
                  ¿Tienes un cupón promocional?
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Canjea aquí tu código para activar tu consultorio privado Premium al instante. Tu información clínica siempre permanece 100% privada.
                </p>
              </div>
            </div>

            <form onSubmit={handleRedeemCode} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  local_offer
                </span>
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="block w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-sm font-mono font-bold tracking-wider text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:outline-none uppercase"
                  placeholder="AGREGA AQUI TU CUPON"
                  type="text"
                />
              </div>
              <button
                type="submit"
                disabled={redeeming || !promoCode.trim()}
                className="bg-primary hover:bg-primary-dark disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-black transition-colors shadow-lg shadow-primary/25 cursor-pointer"
              >
                {redeeming ? 'Validando…' : 'Canjear Código'}
              </button>
            </form>
          </section>

          {/* Enterprise B2B2C Info Section */}
          <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 sm:p-7 shadow-xl border border-indigo-500/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                  <span className="material-symbols-outlined text-[13px]">business_center</span>
                  Programa Enterprise B2B · Lotes de 20 en 20
                </span>
                <h3 className="text-xl font-black">
                  ¿Representas a Allergan, Ipsen, Merz, una escuela de medicina estética o institución?
                </h3>
                <p className="text-xs sm:text-sm text-indigo-100/80 leading-relaxed">
                  Adquiere lotes de licencias Premium en múltiplos de <strong>20 usuarios</strong> (20, 40, 60… ilimitado) y distribuye cupones de marca a tus médicos o alumnos. Cada especialista opera su propio <strong>consultorio privado aislado (Zero-PHI)</strong> sin compartir bases de datos de pacientes.
                </p>
              </div>
              {isEnterpriseManager ? (
                <button
                  type="button"
                  onClick={() => navigate('/enterprise')}
                  className="shrink-0 px-5 py-3 rounded-2xl bg-white text-indigo-950 font-black text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                  Ir a mi Portal Enterprise
                </button>
              ) : (
                <a
                  href="mailto:contacto@deepluxmed.mx?subject=Licencias%20Enterprise%20SonoTox%20(Lotes%20x20)"
                  className="shrink-0 px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">mail</span>
                  Solicitar Lote Enterprise
                </a>
              )}
            </div>
          </section>
        </PageContainer>
      </main>
    </div>
  );
};

export default Subscription;
