import { supabase } from '../supabaseClient';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';
import { recordConsents } from './legalConsent';
import {
  activatePlanSubscription,
  redeemPromoOrEnterpriseCode,
} from '../features/billing/billingProvider';
import type { SubscriptionTier } from '../features/entitlements/planCatalog';

export type PracticeType = 'individual' | 'clinic';

export interface OnboardingSelectionPayload {
  fullName: string;
  practiceType: PracticeType;
  clinicTeamSize: number;
  clinicName: string;
  planTier: SubscriptionTier;
  planSlug: string;
  billingInterval: 'monthly' | 'annual';
  termsAccepted: boolean;
  privacySensitiveAccepted: boolean;
  secondaryPurposesAccepted: boolean;
  promoCode?: string;
}

export interface PracticeProfileMeta {
  practice_type: PracticeType;
  clinic_team_size: number;
  clinic_name: string | null;
  selected_plan_tier?: SubscriptionTier;
  selected_plan_slug?: string;
  billing_interval?: 'monthly' | 'annual';
}

const PENDING_ONBOARDING_KEY = 'sonotox_pending_onboarding_v1';
const SIGNUP_DRAFT_KEY = 'sonotox_signup_draft_v1';

function getPracticeMetaKey(userId: string) {
  return `sonotox_practice_meta_v1_${userId}`;
}

export function resolvePlanSlug(tier: SubscriptionTier, practiceType: PracticeType): string {
  if (tier === 'free') return 'free';
  return practiceType === 'clinic' ? `${tier}_clinic` : `${tier}_solo`;
}

export function saveSignupDraft(draft: Partial<OnboardingSelectionPayload> & { email?: string }) {
  try {
    sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
}

export function readSignupDraft(): (Partial<OnboardingSelectionPayload> & { email?: string }) | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSignupDraft() {
  try {
    sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function savePendingOnboarding(email: string, payload: OnboardingSelectionPayload) {
  try {
    localStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({
        email: email.trim().toLowerCase(),
        payload,
        savedAt: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

export function readPendingOnboarding(email?: string | null): OnboardingSelectionPayload | null {
  try {
    const raw = localStorage.getItem(PENDING_ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      email?: string;
      payload?: OnboardingSelectionPayload;
      savedAt?: number;
    };
    if (!parsed?.payload) return null;
    if (email && parsed.email && parsed.email !== email.trim().toLowerCase()) {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

export function clearPendingOnboarding() {
  try {
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
  } catch {
    // ignore
  }
}

export function readLocalPracticeMeta(userId: string): PracticeProfileMeta | null {
  try {
    const raw = localStorage.getItem(getPracticeMetaKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as PracticeProfileMeta;
  } catch {
    return null;
  }
}

export function writeLocalPracticeMeta(userId: string, meta: PracticeProfileMeta) {
  try {
    localStorage.setItem(getPracticeMetaKey(userId), JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function isMissingRpcOrColumnError(error: any, token: string): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return (
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === '42883' ||
    code === '42703' ||
    message.includes(token) ||
    message.includes('Could not find') ||
    message.includes('schema cache')
  );
}

/**
 * Reads practice modality & clinic unit metadata from DB row -> auth metadata -> localStorage.
 */
export function resolvePracticeMeta(
  userId: string,
  profileRow?: any,
  userMetadata?: Record<string, any> | null
): PracticeProfileMeta {
  const local = readLocalPracticeMeta(userId);
  const rawType =
    profileRow?.practice_type ||
    userMetadata?.practice_type ||
    local?.practice_type ||
    'individual';
  const practice_type: PracticeType = rawType === 'clinic' ? 'clinic' : 'individual';

  const rawSize =
    profileRow?.clinic_team_size ??
    userMetadata?.clinic_team_size ??
    local?.clinic_team_size ??
    (practice_type === 'clinic' ? 2 : 1);

  const parsedSize = Number(rawSize);
  const clinic_team_size =
    practice_type === 'clinic'
      ? Math.max(2, Math.min(500, Number.isFinite(parsedSize) ? Math.round(parsedSize) : 2))
      : 1;

  const clinic_name =
    profileRow?.clinic_name ||
    userMetadata?.clinic_name ||
    local?.clinic_name ||
    null;

  return {
    practice_type,
    clinic_team_size,
    clinic_name,
    selected_plan_tier: userMetadata?.selected_plan_tier || local?.selected_plan_tier,
    selected_plan_slug: userMetadata?.selected_plan_slug || local?.selected_plan_slug,
    billing_interval: userMetadata?.billing_interval || local?.billing_interval,
  };
}

/**
 * Persists practice modality & team size cleanly to DB (with graceful fallback if SQL migration
 * has not been pushed yet), auth user_metadata, and localStorage.
 */
export async function persistPracticeProfileMeta(
  userId: string,
  meta: PracticeProfileMeta
): Promise<void> {
  const normalized: PracticeProfileMeta = {
    practice_type: meta.practice_type === 'clinic' ? 'clinic' : 'individual',
    clinic_team_size:
      meta.practice_type === 'clinic'
        ? Math.max(2, Math.min(500, Math.round(meta.clinic_team_size || 2)))
        : 1,
    clinic_name: meta.clinic_name?.trim() || null,
    selected_plan_tier: meta.selected_plan_tier,
    selected_plan_slug: meta.selected_plan_slug,
    billing_interval: meta.billing_interval,
  };

  writeLocalPracticeMeta(userId, normalized);

  await supabase.auth
    .updateUser({
      data: {
        practice_type: normalized.practice_type,
        clinic_team_size: normalized.clinic_team_size,
        clinic_name: normalized.clinic_name,
        ...(normalized.selected_plan_tier ? { selected_plan_tier: normalized.selected_plan_tier } : {}),
        ...(normalized.selected_plan_slug ? { selected_plan_slug: normalized.selected_plan_slug } : {}),
        ...(normalized.billing_interval ? { billing_interval: normalized.billing_interval } : {}),
        onboarding_pending: false,
      },
    })
    .catch((err) => console.warn('auth metadata sync warning:', err));

  const { error } = await supabase
    .from('user_profiles')
    .update({
      practice_type: normalized.practice_type,
      clinic_team_size: normalized.clinic_team_size,
      clinic_name: normalized.clinic_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error && !isMissingRpcOrColumnError(error, 'practice_type')) {
    console.warn('user_profiles practice meta update warning:', error.message);
  }
}

/**
 * Finalizes registration onboarding for an authenticated user:
 * 1. Records legal consents (LFPDPPP) if accepted during signup
 * 2. Saves practice modality (individual vs clinic), clinic team size & name
 * 3. Activates chosen plan (free / plus / premium) without requiring Stripe yet
 * 4. Redeems optional promo/enterprise voucher code
 */
export async function completeUserOnboarding(
  userId: string,
  payload: OnboardingSelectionPayload
): Promise<{ ok: boolean; warning?: string }> {
  const practiceType: PracticeType = payload.practiceType === 'clinic' ? 'clinic' : 'individual';
  const teamSize =
    practiceType === 'clinic'
      ? Math.max(2, Math.min(500, Math.round(payload.clinicTeamSize || 2)))
      : 1;
  const clinicName = payload.clinicName?.trim() || '';
  const planSlug = payload.planSlug || resolvePlanSlug(payload.planTier, practiceType);
  const fullName = payload.fullName?.trim() || '';

  // 1. Always save local backup immediately
  writeLocalPracticeMeta(userId, {
    practice_type: practiceType,
    clinic_team_size: teamSize,
    clinic_name: clinicName || null,
    selected_plan_tier: payload.planTier,
    selected_plan_slug: planSlug,
    billing_interval: payload.billingInterval,
  });

  // 2. Record legal consents if accepted in Step 1
  if (payload.termsAccepted && payload.privacySensitiveAccepted) {
    const consentRes = await recordConsents({
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      secondaryPurposes: Boolean(payload.secondaryPurposesAccepted),
    });
    if (consentRes.error) {
      console.warn('recordConsents warning during onboarding:', consentRes.error);
    }
  }

  let warning: string | undefined;

  // 3. Try unified onboarding RPC first
  const { error: rpcError } = await supabase.rpc('complete_registration_onboarding', {
    p_full_name: fullName || null,
    p_practice_type: practiceType,
    p_clinic_team_size: teamSize,
    p_clinic_name: clinicName || null,
    p_plan_slug: planSlug,
    p_billing_interval: payload.billingInterval,
  });

  if (rpcError) {
    if (isMissingRpcOrColumnError(rpcError, 'complete_registration_onboarding')) {
      // Resilient fallback when SQL migration hasn't been executed in Supabase yet:
      if (fullName) {
        await supabase
          .from('user_profiles')
          .upsert({
            id: userId,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) console.warn('Fallback profile upsert warning:', error.message);
          });
      }

      try {
        await activatePlanSubscription({
          planSlug,
          billingInterval: payload.billingInterval,
          billingMode: 'free_launch',
        });
      } catch (actErr: any) {
        console.warn('Fallback plan activation warning:', actErr?.message);
        warning = actErr?.message;
      }
    } else {
      console.warn('complete_registration_onboarding RPC error:', rpcError.message);
      warning = rpcError.message;
    }
  }

  // 4. Sync auth metadata & clear onboarding_pending flag
  await persistPracticeProfileMeta(userId, {
    practice_type: practiceType,
    clinic_team_size: teamSize,
    clinic_name: clinicName || null,
    selected_plan_tier: payload.planTier,
    selected_plan_slug: planSlug,
    billing_interval: payload.billingInterval,
  });

  // 5. Optional promo / enterprise code
  if (payload.promoCode?.trim()) {
    try {
      await redeemPromoOrEnterpriseCode(payload.promoCode.trim());
    } catch (codeErr: any) {
      warning = codeErr?.message || 'El código promocional no pudo aplicarse, pero tu plan quedó activado.';
    }
  }

  clearPendingOnboarding();
  clearSignupDraft();

  return { ok: true, warning };
}

/**
 * Checks if a newly signed-in user (e.g. right after confirming email) has pending
 * registration selections in localStorage or auth.user_metadata and finalizes them.
 */
export async function syncPendingOnboardingForSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
}): Promise<boolean> {
  const localPending = readPendingOnboarding(user.email);
  const meta = user.user_metadata || {};

  if (localPending) {
    await completeUserOnboarding(user.id, localPending);
    return true;
  }

  if (meta.onboarding_pending === true && meta.selected_plan_slug) {
    const practiceType: PracticeType = meta.practice_type === 'clinic' ? 'clinic' : 'individual';
    const tier: SubscriptionTier =
      meta.selected_plan_tier === 'premium'
        ? 'premium'
        : meta.selected_plan_tier === 'plus'
        ? 'plus'
        : 'free';

    await completeUserOnboarding(user.id, {
      fullName: meta.full_name || '',
      practiceType,
      clinicTeamSize: Number(meta.clinic_team_size) || (practiceType === 'clinic' ? 2 : 1),
      clinicName: meta.clinic_name || '',
      planTier: tier,
      planSlug: meta.selected_plan_slug || resolvePlanSlug(tier, practiceType),
      billingInterval: meta.billing_interval === 'annual' ? 'annual' : 'monthly',
      termsAccepted: Boolean(meta.terms_accepted),
      privacySensitiveAccepted: Boolean(meta.privacy_sensitive_accepted),
      secondaryPurposesAccepted: Boolean(meta.secondary_purposes_accepted),
    });
    return true;
  }

  return false;
}
