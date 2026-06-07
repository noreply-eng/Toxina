import { useCallback, useEffect, useState } from 'react';
import { prefetchClinicalData } from '../services/clinicalCache';
import {
  getPendingOutboxCount,
  retryFailedSync,
  SYNC_CHANGED_EVENT,
  syncPendingChanges,
} from '../services/offlineSync';
import { isOnline } from '../utils/auth';

export function useOfflineSync(userId?: string) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    if (!userId) {
      setPendingCount(0);
      return;
    }
    const count = await getPendingOutboxCount(userId);
    setPendingCount(count);
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!userId || !isOnline()) return;

    setSyncing(true);
    setLastError(null);

    try {
      const result = await syncPendingChanges(userId);
      if (result.failed > 0) {
        setLastError(result.errors[0] ?? 'Error de sincronización');
      } else if (result.synced > 0) {
        await prefetchClinicalData(userId);
      }
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [userId, refreshCount]);

  const retrySync = useCallback(async () => {
    if (!userId || !isOnline()) return;

    setSyncing(true);
    setLastError(null);

    try {
      const result = await retryFailedSync(userId);
      if (result.failed > 0) {
        setLastError(result.errors[0] ?? 'Error de sincronización');
      } else if (result.synced > 0) {
        await prefetchClinicalData(userId);
      }
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [userId, refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const handleChange = () => {
      refreshCount();
    };

    window.addEventListener(SYNC_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(SYNC_CHANGED_EVENT, handleChange);
  }, [refreshCount]);

  useEffect(() => {
    if (!userId) return;

    const handleOnline = () => {
      syncNow();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId, syncNow]);

  return {
    pendingCount,
    syncing,
    lastError,
    syncNow,
    retrySync,
    hasPending: pendingCount > 0,
  };
}
