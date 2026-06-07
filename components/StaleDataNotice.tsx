import React from 'react';
import { getClinicalCacheMeta } from '../services/clinicalCache';
import { isOnline } from '../utils/auth';

interface StaleDataNoticeProps {
  visible: boolean;
  lastSyncedAt?: string | null;
  className?: string;
}

function formatSyncTime(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const StaleDataNotice: React.FC<StaleDataNoticeProps> = ({
  visible,
  lastSyncedAt,
  className = '',
}) => {
  if (!visible) return null;

  const syncedLabel = formatSyncTime(lastSyncedAt);

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 ${className}`}
      role="status"
    >
      <span className="material-symbols-outlined text-base mt-0.5">history</span>
      <div className="min-w-0">
        <p className="text-xs font-bold leading-tight">Mostrando datos guardados</p>
        <p className="text-[11px] opacity-80 leading-snug">
          {syncedLabel
            ? `Última sincronización: ${syncedLabel}. Se actualizarán al reconectar.`
            : 'Sin conexión. Los cambios recientes pueden no aparecer hasta reconectar.'}
        </p>
      </div>
    </div>
  );
};

export function useClinicalCacheMeta(userId?: string) {
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setLastSyncedAt(null);
      return;
    }

    getClinicalCacheMeta(userId).then((meta) => {
      setLastSyncedAt(meta?.lastSyncedAt ?? null);
    });
  }, [userId]);

  return {
    lastSyncedAt,
    isOffline: !isOnline(),
  };
}

export default StaleDataNotice;
