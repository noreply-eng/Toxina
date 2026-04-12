import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[120] animate-slide-up">
      <div className="bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl border border-primary/30 p-4 rounded-2xl shadow-2xl max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            needRefresh ? 'bg-primary/20 text-primary' : 'bg-green-100 dark:bg-green-900/30 text-green-600'
          }`}>
            <span className="material-symbols-outlined">
              {needRefresh ? 'system_update' : 'cloud_done'}
            </span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-text-main dark:text-white">
              {needRefresh ? '¡Nueva versión disponible!' : 'Lista para usar offline'}
            </h4>
            <p className="text-xs text-text-muted dark:text-slate-400">
              {needRefresh 
                ? 'Actualiza para obtener las últimas calculadoras.' 
                : 'Las calculadoras ya funcionan sin internet.'}
            </p>
          </div>
        </div>
        
        <div className="mt-4 flex gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary-dark transition-colors"
            >
              Actualizar ahora
            </button>
          )}
          <button
            onClick={close}
            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors ${
              needRefresh 
                ? 'bg-slate-100 dark:bg-slate-800 text-text-muted hover:bg-slate-200' 
                : 'bg-primary text-white font-bold'
            }`}
          >
            {needRefresh ? 'Más tarde' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
