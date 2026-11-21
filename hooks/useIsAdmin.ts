import { useEntitlements } from '../features/entitlements/EntitlementContext';

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { isSuperAdmin, loading } = useEntitlements();
  return { isAdmin: isSuperAdmin, loading };
}
