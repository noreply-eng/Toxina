import React from 'react';
import { isOnline } from '../utils/auth';

interface PendingSyncBannerProps {
  pendingCount: number;
  syncing: boolean;
  lastError?: string | null;
  onSync: () => void;
  onRetry?: () => void;
}

const PendingSyncBanner: React.FC<PendingSyncBannerProps> = ({
  pendingCount,
  syncing,
  lastError,
  onSync,
  onRetry,
}) => {
  if (pendingCount <= 0 && !lastError) return null;

  const online = isOnline();

  return (
    <div className="fixed top-0 left-0 right-0 z-[115] animate-slide-down">
      <div className="bg-sky-600/95 dark:bg-sky-700/95 backdrop-blur-md text-white py-2 px-4 shadow-lg border-b border-white/10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <span className={`material-symbols-outlined text-xl ${syncing ? 'animate-spin' : ''}`}>
            {syncing ? 'progress_activity' : 'sync'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">
              {syncing
                ? 'Sincronizando cambios...'
                : `${pendingCount} cambio${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`}
            </p>
            <p className="text-[10px] opacity-90 leading-tight truncate">
              {lastError
                ? lastError
                : online
                  ? 'Toca sincronizar para subir los datos al servidor'
                  : 'Se enviarán automáticamente al reconectar'}
            </p>
          </div>
          {online && !syncing && (
            <button
              type="button"
              onClick={lastError && onRetry ? onRetry : onSync}
              className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25 transition-colors"
            >
              {lastError ? 'Reintentar' : 'Sincronizar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingSyncBanner;
