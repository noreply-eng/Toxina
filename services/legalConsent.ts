import { supabase } from '../supabaseClient';
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from '../constants/legalVersions';
import type {
  ComplianceStatus,
  RecordConsentsPayload,
  UserComplianceProfile,
  ArcoRequestType,
} from '../types/legalConsent';

const COMPLIANCE_SELECT =
  'id, full_name, general_license, terms_accepted_at, terms_version, privacy_sensitive_accepted_at, privacy_version, secondary_purposes_accepted_at, secondary_purposes_version, consent_revoked_at';

function compareVersions(accepted: string | null, current: string): boolean {
  if (!accepted) return true;
  const a = accepted.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

export function evaluateCompliance(profile: UserComplianceProfile | null): ComplianceStatus {
  if (!profile) {
    return {
      hasAcceptedTerms: false,
      hasAcceptedPrivacySensitive: false,
      needsReConsent: true,
      hasCompletedProfile: false,
      isRevoked: false,
      secondaryPurposesAccepted: false,
      termsVersion: null,
      privacyVersion: null,
    };
  }

  const isRevoked = !!profile.consent_revoked_at;
  const hasAcceptedTerms = !!profile.terms_accepted_at && !isRevoked;
  const hasAcceptedPrivacySensitive =
    !!profile.privacy_sensitive_accepted_at && !isRevoked;
  const needsReConsent =
    !isRevoked &&
    (compareVersions(profile.terms_version, CURRENT_TERMS_VERSION) ||
      compareVersions(profile.privacy_version, CURRENT_PRIVACY_VERSION));

  return {
    hasAcceptedTerms,
    hasAcceptedPrivacySensitive,
    needsReConsent,
    hasCompletedProfile: !!profile.general_license?.trim(),
    isRevoked,
    secondaryPurposesAccepted: !!profile.secondary_purposes_accepted_at,
    termsVersion: profile.terms_version,
    privacyVersion: profile.privacy_version,
  };
}

export async function fetchComplianceProfile(
  userId: string
): Promise<UserComplianceProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(COMPLIANCE_SELECT)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('fetchComplianceProfile:', error);
    return null;
  }
  return data as UserComplianceProfile;
}

export async function getComplianceStatus(userId: string): Promise<ComplianceStatus> {
  const profile = await fetchComplianceProfile(userId);
  return evaluateCompliance(profile);
}

async function recordConsentsFallback(
  payload: RecordConsentsPayload
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('user_profiles')
    .update({
      terms_accepted_at: now,
      terms_version: payload.termsVersion,
      privacy_sensitive_accepted_at: now,
      privacy_version: payload.privacyVersion,
      secondary_purposes_accepted_at: payload.secondaryPurposes ? now : null,
      secondary_purposes_version: payload.secondaryPurposes ? payload.privacyVersion : null,
      consent_revoked_at: null,
      updated_at: now,
    })
    .eq('id', user.id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function recordConsents(payload: RecordConsentsPayload): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('record_user_consents', {
    p_terms_version: payload.termsVersion,
    p_privacy_version: payload.privacyVersion,
    p_secondary_purposes: payload.secondaryPurposes,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    p_ip_address: null,
  });

  if (error) {
    const missingRpc =
      error.code === 'PGRST202' ||
      error.message.includes('record_user_consents') ||
      error.message.includes('schema cache');
    if (missingRpc) {
      return recordConsentsFallback(payload);
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function updateSecondaryPurposes(
  granted: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('update_secondary_purposes_consent', {
    p_granted: granted,
    p_privacy_version: CURRENT_PRIVACY_VERSION,
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function revokeConsents(): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('revoke_user_consents', {
    p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function submitArcoRequest(
  requestType: ArcoRequestType,
  description: string
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { error } = await supabase.from('arco_requests').insert({
    user_id: user.id,
    request_type: requestType,
    description,
  });

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function fetchArcoRequests() {
  const { data, error } = await supabase
    .from('arco_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('fetchArcoRequests:', error);
    return [];
  }
  return data ?? [];
}
