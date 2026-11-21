import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { isOnline } from '../../utils/auth';
import {
  TIER_DEFAULT_FEATURES,
  normalizeTier,
  type BillingMode,
  type FeatureKey,
  type FeatureMap,
  type SubscriptionOrigin,
  type SubscriptionTier,
  type UserRole,
} from './planCatalog';

export interface PlatformSettingsSnapshot {
  billing_mode: BillingMode;
  launch_promo_banner_enabled: boolean;
  launch_promo_banner_text: string;
  launch_promo_ends_at: string | null;
  founder_discount_percent: number;
  enterprise_batch_size: number;
  enforce_entitlements: boolean;
}

export interface SponsorSnapshot {
  enterprise_account_id: string;
  name: string;
  brand_display_name: string;
  organization_type: string;
  logo_url: string | null;
}

export interface AnnouncementSnapshot {
  id: string;
  title: string;
  message: string;
  variant: 'info' | 'promo' | 'warning' | 'critical';
  cta_label: string | null;
  cta_path: string | null;
  ends_at: string | null;
}

export interface ClinicMembershipSnapshot {
  clinic_id: string;
  name: string;
  role_in_clinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
  status: string;
}

export interface EnterpriseOrgSnapshot {
  id: string;
  name: string;
  brand_display_name: string;
  organization_type: string;
  role_in_org: 'owner' | 'manager' | 'billing';
  status: string;
}

export interface EntitlementSnapshot {
  authenticated: boolean;
  user_id?: string;
  email?: string | null;
  full_name?: string | null;
  role: UserRole;
  is_active: boolean;
  account_status: string;
  is_super_admin: boolean;
  is_enterprise_manager: boolean;
  effective_tier: SubscriptionTier;
  plan_slug: string;
  plan_name: string;
  origin: SubscriptionOrigin;
  status: string;
  period_end: string | null;
  is_founder: boolean;
  is_protected_grant: boolean;
  grant_reason: string | null;
  sponsor: SponsorSnapshot | null;
  features: FeatureMap;
  feature_overrides: Record<string, boolean>;
  active_clinic_id: string | null;
  clinics: ClinicMembershipSnapshot[];
  enterprise_accounts: EnterpriseOrgSnapshot[];
  platform_settings: PlatformSettingsSnapshot;
  announcements: AnnouncementSnapshot[];
}

const DEFAULT_SETTINGS: PlatformSettingsSnapshot = {
  billing_mode: 'free_launch',
  launch_promo_banner_enabled: true,
  launch_promo_banner_text:
    'Acceso de lanzamiento gratuito por tiempo limitado: activa Plus o Premium a $0 MXN antes de que cierre la beta.',
  launch_promo_ends_at: null,
  founder_discount_percent: 40,
  enterprise_batch_size: 20,
  enforce_entitlements: true,
};

const DEFAULT_SNAPSHOT: EntitlementSnapshot = {
  authenticated: false,
  role: 'specialist',
  is_active: true,
  account_status: 'active',
  is_super_admin: false,
  is_enterprise_manager: false,
  effective_tier: 'free',
  plan_slug: 'free',
  plan_name: 'Plan Gratuito',
  origin: 'free_default',
  status: 'active',
  period_end: null,
  is_founder: false,
  is_protected_grant: false,
  grant_reason: null,
  sponsor: null,
  features: { ...TIER_DEFAULT_FEATURES.free },
  feature_overrides: {},
  active_clinic_id: null,
  clinics: [],
  enterprise_accounts: [],
  platform_settings: DEFAULT_SETTINGS,
  announcements: [],
};

const CACHE_TTL_MS = 72 * 60 * 60 * 1000;

function getCacheKey(userId: string) {
  return `sonotox_entitlements_v2_${userId}`;
}

function readCachedSnapshot(userId: string): EntitlementSnapshot | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: EntitlementSnapshot };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(userId: string, data: EntitlementSnapshot) {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // ignore quota errors
  }
}

function parseEntitlementPayload(raw: any): EntitlementSnapshot {
  const tier = normalizeTier(raw?.effective_tier);
  const rawFeatures = raw?.features && typeof raw.features === 'object' ? raw.features : {};
  const mergedFeatures: FeatureMap = {
    ...TIER_DEFAULT_FEATURES[tier],
    ...rawFeatures,
  };

  return {
    authenticated: Boolean(raw?.authenticated ?? true),
    user_id: raw?.user_id,
    email: raw?.email ?? null,
    full_name: raw?.full_name ?? null,
    role: (raw?.role as UserRole) || 'specialist',
    is_active: raw?.is_active ?? true,
    account_status: raw?.account_status || 'active',
    is_super_admin: Boolean(raw?.is_super_admin),
    is_enterprise_manager: Boolean(raw?.is_enterprise_manager),
    effective_tier: tier,
    plan_slug: raw?.plan_slug || (tier === 'free' ? 'free' : `${tier}_solo`),
    plan_name: raw?.plan_name || (tier === 'premium' ? 'Plan Premium' : tier === 'plus' ? 'Plan Plus' : 'Plan Gratuito'),
    origin: (raw?.origin as SubscriptionOrigin) || 'free_default',
    status: raw?.status || 'active',
    period_end: raw?.period_end ?? null,
    is_founder: Boolean(raw?.is_founder),
    is_protected_grant: Boolean(raw?.is_protected_grant),
    grant_reason: raw?.grant_reason ?? null,
    sponsor: raw?.sponsor ?? null,
    features: mergedFeatures,
    feature_overrides: raw?.feature_overrides || {},
    active_clinic_id: raw?.active_clinic_id ?? null,
    clinics: Array.isArray(raw?.clinics) ? raw.clinics : [],
    enterprise_accounts: Array.isArray(raw?.enterprise_accounts) ? raw.enterprise_accounts : [],
    platform_settings: {
      ...DEFAULT_SETTINGS,
      ...(raw?.platform_settings || {}),
    },
    announcements: Array.isArray(raw?.announcements) ? raw.announcements : [],
  };
}

export interface EntitlementContextValue {
  entitlements: EntitlementSnapshot;
  loading: boolean;
  rpcAvailable: boolean;
  isSuperAdmin: boolean;
  isEnterpriseManager: boolean;
  isClinicAdmin: boolean;
  effectiveTier: SubscriptionTier;
  isFree: boolean;
  isPlus: boolean;
  isPremium: boolean;
  simulatedTier: SubscriptionTier | null;
  setSimulatedTier: (tier: SubscriptionTier | null) => void;
  can: (feature: FeatureKey) => boolean;
  refresh: () => Promise<void>;
}

const EntitlementContext = createContext<EntitlementContextValue>({
  entitlements: DEFAULT_SNAPSHOT,
  loading: true,
  rpcAvailable: true,
  isSuperAdmin: false,
  isEnterpriseManager: false,
  isClinicAdmin: false,
  effectiveTier: 'free',
  isFree: true,
  isPlus: false,
  isPremium: false,
  simulatedTier: null,
  setSimulatedTier: () => {},
  can: () => false,
  refresh: async () => {},
});

export const EntitlementProvider: React.FC<{ userId?: string; children: React.ReactNode }> = ({
  userId,
  children,
}) => {
  const [entitlements, setEntitlements] = useState<EntitlementSnapshot>(() => {
    if (userId) {
      const cached = readCachedSnapshot(userId);
      if (cached) return cached;
    }
    return DEFAULT_SNAPSHOT;
  });
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [rpcAvailable, setRpcAvailable] = useState<boolean>(true);
  const [simulatedTier, setSimulatedTierState] = useState<SubscriptionTier | null>(null);

  const loadEntitlements = useCallback(async () => {
    if (!userId) {
      setEntitlements(DEFAULT_SNAPSHOT);
      setSimulatedTierState(null);
      setLoading(false);
      return;
    }

    if (!isOnline()) {
      const cached = readCachedSnapshot(userId);
      if (cached) setEntitlements(cached);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_my_entitlements');
      if (!error && data) {
        const parsed = parseEntitlementPayload(data);
        setEntitlements(parsed);
        setRpcAvailable(true);
        writeCachedSnapshot(userId, parsed);
        setLoading(false);
        return;
      }

      if (error) {
        console.warn('get_my_entitlements RPC fallback:', error.message);
        setRpcAvailable(false);
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, subscription_tier')
        .eq('id', userId)
        .maybeSingle();

      const { data: legacyAdmin } = await supabase.rpc('is_admin');
      const isLegacyAdmin = Boolean(legacyAdmin);
      const fallbackTier: SubscriptionTier = isLegacyAdmin
        ? 'premium'
        : normalizeTier(profile?.subscription_tier);

      const fallbackSnapshot: EntitlementSnapshot = {
        ...DEFAULT_SNAPSHOT,
        authenticated: true,
        user_id: userId,
        full_name: profile?.full_name ?? null,
        role: isLegacyAdmin ? 'super_admin' : 'specialist',
        is_super_admin: isLegacyAdmin,
        effective_tier: fallbackTier,
        plan_slug: fallbackTier === 'free' ? 'free' : `${fallbackTier}_solo`,
        plan_name:
          isLegacyAdmin
            ? 'Super Administrador'
            : fallbackTier === 'premium'
            ? 'Plan Premium'
            : fallbackTier === 'plus'
            ? 'Plan Plus'
            : 'Plan Gratuito',
        features: { ...TIER_DEFAULT_FEATURES.premium },
        platform_settings: {
          ...DEFAULT_SETTINGS,
          enforce_entitlements: false,
        },
      };
      setEntitlements(fallbackSnapshot);
    } catch (err) {
      console.warn('Failed loading entitlements, using cache:', err);
      const cached = readCachedSnapshot(userId);
      if (cached) setEntitlements(cached);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      const cached = readCachedSnapshot(userId);
      if (cached) setEntitlements(cached);
    }
    setLoading(Boolean(userId));
    loadEntitlements();
  }, [userId, loadEntitlements]);

  useEffect(() => {
    if (!userId) return;

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && isOnline()) {
        loadEntitlements();
      }
    };

    document.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('online', onFocusOrVisible);

    const channel = supabase
      .channel(`entitlements-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        () => loadEntitlements()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` },
        () => loadEntitlements()
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('online', onFocusOrVisible);
      supabase.removeChannel(channel);
    };
  }, [userId, loadEntitlements]);

  const setSimulatedTier = useCallback(
    (tier: SubscriptionTier | null) => {
      if (!entitlements.is_super_admin) return;
      setSimulatedTierState(tier);
    },
    [entitlements.is_super_admin]
  );

  const value = useMemo<EntitlementContextValue>(() => {
    const isSuperAdmin = entitlements.is_super_admin;
    const isSimulating = isSuperAdmin && simulatedTier !== null;
    const effectiveTier: SubscriptionTier = isSimulating
      ? simulatedTier!
      : entitlements.effective_tier;

    const activeFeatures: FeatureMap = isSimulating
      ? TIER_DEFAULT_FEATURES[simulatedTier!]
      : entitlements.features;

    const can = (feature: FeatureKey): boolean => {
      if (isSimulating) return Boolean(activeFeatures[feature]);
      if (isSuperAdmin) return true;
      if (!entitlements.platform_settings.enforce_entitlements) return true;
      return Boolean(activeFeatures[feature]);
    };

    const isClinicAdmin =
      isSuperAdmin ||
      entitlements.clinics.some((c) =>
        ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
      );

    return {
      entitlements,
      loading,
      rpcAvailable,
      isSuperAdmin,
      isEnterpriseManager: entitlements.is_enterprise_manager,
      isClinicAdmin,
      effectiveTier,
      isFree: effectiveTier === 'free',
      isPlus: effectiveTier === 'plus',
      isPremium: effectiveTier === 'premium',
      simulatedTier: isSuperAdmin ? simulatedTier : null,
      setSimulatedTier,
      can,
      refresh: loadEntitlements,
    };
  }, [entitlements, loading, rpcAvailable, simulatedTier, setSimulatedTier, loadEntitlements]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
};

export function useEntitlements(): EntitlementContextValue {
  return useContext(EntitlementContext);
}
