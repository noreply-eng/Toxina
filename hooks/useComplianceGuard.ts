import { useState, useEffect, useCallback } from 'react';
import { fetchComplianceProfile, evaluateCompliance } from '../services/legalConsent';
import type { ComplianceStatus } from '../types/legalConsent';

const EXEMPT_PATHS = new Set([
  '/legal-acceptance',
  '/aviso-privacidad',
  '/terminos',
  '/complete-profile',
]);

export function useComplianceGuard(userId: string | undefined, pathname: string) {
  const [status, setStatus] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(!!userId);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const profile = await fetchComplianceProfile(userId);
    setStatus(evaluateCompliance(profile));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isExempt = EXEMPT_PATHS.has(pathname);

  let redirectTo: string | null = null;

  if (!loading && status && !isExempt) {
    if (
      status.isRevoked ||
      !status.hasAcceptedTerms ||
      !status.hasAcceptedPrivacySensitive ||
      status.needsReConsent
    ) {
      redirectTo = '/legal-acceptance';
    } else if (!status.hasCompletedProfile) {
      redirectTo = '/complete-profile';
    }
  }

  return { status, loading, redirectTo, refresh };
}
