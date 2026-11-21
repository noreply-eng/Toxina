import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from './EntitlementContext';
import type { FeatureKey, SubscriptionTier } from './planCatalog';

interface FeatureGateProps {
  feature: FeatureKey;
  requiredTier?: Exclude<SubscriptionTier, 'free'>;
  title?: string;
  description?: string;
  silent?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const UpgradePromptCard: React.FC<{
  requiredTier?: Exclude<SubscriptionTier, 'free'>;
  title?: string;
  description?: string;
  compact?: boolean;
}> = ({ requiredTier = 'premium', title, description, compact = false }) => {
  const navigate = useNavigate();
  const { entitlements } = useEntitlements();
  const isFreeLaunch = entitlements.platform_settings.billing_mode === 'free_launch';
  const tierLabel = requiredTier === 'plus' ? 'Plus' : 'Premium';

  const resolvedTitle =
    title ||
    (isFreeLaunch
      ? `Activa Plan ${tierLabel} gratis (Lanzamiento)`
      : `Función disponible en Plan ${tierLabel}`);

  const resolvedDesc =
    description ||
    (isFreeLaunch
      ? `Aprovecha el acceso de lanzamiento por tiempo limitado y desbloquea ${tierLabel} sin costo ahora mismo.`
      : `Actualiza tu suscripción a ${tierLabel} o canjea un cupón para desbloquear esta herramienta clínica.`);

  if (compact) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="material-symbols-outlined text-primary text-xl shrink-0">
            {isFreeLaunch ? 'redeem' : 'lock'}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-text-main dark:text-white truncate">{resolvedTitle}</p>
            <p className="text-[11px] text-text-muted truncate">{resolvedDesc}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/subscription')}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary-dark transition-colors"
        >
          {isFreeLaunch ? 'Activar $0' : `Ver ${tierLabel}`}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg my-10 px-4">
      <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-cyan-500/15 text-primary">
          <span className="material-symbols-outlined text-3xl">
            {isFreeLaunch ? 'workspace_premium' : 'lock'}
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider mb-3 bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[13px]">
            {isFreeLaunch ? 'celebration' : 'verified'}
          </span>
          {isFreeLaunch ? `Lanzamiento $0 · Plan ${tierLabel}` : `Plan ${tierLabel}`}
        </div>

        <h2 className="text-xl font-black text-text-main dark:text-white mb-2">{resolvedTitle}</h2>
        <p className="text-sm text-text-muted leading-relaxed mb-6">{resolvedDesc}</p>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => navigate('/subscription')}
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">
              {isFreeLaunch ? 'bolt' : 'upgrade'}
            </span>
            {isFreeLaunch ? `Activar ${tierLabel} Gratis ($0)` : `Ver Planes y Cupones`}
          </button>
          <button
            type="button"
            onClick={() => navigate('/calculator')}
            className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Ir a Calculadora
          </button>
        </div>
      </div>
    </div>
  );
};

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  requiredTier = 'premium',
  title,
  description,
  silent = false,
  fallback,
  children,
}) => {
  const { can, loading } = useEntitlements();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary" />
      </div>
    );
  }

  if (can(feature)) return <>{children}</>;
  if (silent) return null;
  if (fallback) return <>{fallback}</>;

  return <UpgradePromptCard requiredTier={requiredTier} title={title} description={description} />;
};

export const PlatformAnnouncementBanner: React.FC = () => {
  const navigate = useNavigate();
  const { entitlements, isSuperAdmin, simulatedTier, setSimulatedTier, effectiveTier } = useEntitlements();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const showLaunchPromo =
    entitlements.authenticated &&
    !entitlements.is_enterprise_manager &&
    entitlements.platform_settings.billing_mode === 'free_launch' &&
    entitlements.platform_settings.launch_promo_banner_enabled &&
    effectiveTier !== 'premium' &&
    !dismissedIds.includes('launch-promo');

  const activeAnnouncements = (entitlements.announcements || []).filter(
    (a) => !dismissedIds.includes(a.id)
  );

  if (!simulatedTier && !showLaunchPromo && activeAnnouncements.length === 0) return null;

  const variantClasses: Record<string, string> = {
    info: 'bg-sky-600 text-white',
    promo: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white',
    warning: 'bg-amber-500 text-slate-950',
    critical: 'bg-red-600 text-white',
  };

  return (
    <div className="print:hidden z-40">
      {isSuperAdmin && simulatedTier && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">visibility</span>
            <span>
              MODO SIMULACIÓN SUPERADMIN: viendo la app como plan{' '}
              <span className="uppercase underline">{simulatedTier}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSimulatedTier(null)}
            className="px-2.5 py-1 rounded-lg bg-slate-950 text-white text-[11px] font-bold hover:bg-slate-800"
          >
            Salir de simulación
          </button>
        </div>
      )}

      {showLaunchPromo && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-white px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-lg shrink-0">celebration</span>
            <p className="font-semibold truncate sm:whitespace-normal">
              {entitlements.platform_settings.launch_promo_banner_text}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/subscription')}
              className="px-3 py-1 rounded-lg bg-white text-teal-800 font-black text-xs hover:bg-emerald-50 transition-colors"
            >
              Activar $0
            </button>
            <button
              type="button"
              onClick={() => setDismissedIds((prev) => [...prev, 'launch-promo'])}
              className="p-1 rounded-lg hover:bg-white/15"
              aria-label="Cerrar aviso"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      )}

      {activeAnnouncements.slice(0, 1).map((ann) => (
        <div
          key={ann.id}
          className={`${variantClasses[ann.variant] || variantClasses.info} px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between gap-3`}
        >
          <div className="min-w-0">
            <span className="font-black mr-2">{ann.title}:</span>
            <span className="opacity-95">{ann.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ann.cta_label && ann.cta_path && (
              <button
                type="button"
                onClick={() => navigate(ann.cta_path!)}
                className="px-3 py-1 rounded-lg bg-white/95 text-slate-900 font-bold text-xs hover:bg-white"
              >
                {ann.cta_label}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissedIds((prev) => [...prev, ann.id])}
              className="p-1 rounded-lg hover:bg-black/15"
              aria-label="Cerrar anuncio"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
