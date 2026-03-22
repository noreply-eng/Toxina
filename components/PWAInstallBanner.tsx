import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const PWAInstallBanner: React.FC = () => {
  const { showBanner, isIOS, install, dismiss } = usePWAInstall();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-primary/20 dark:border-primary/30 p-4 max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="material-symbols-outlined text-white text-2xl">download</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-base text-text-main dark:text-white">
              Instalar Toxina DLM
            </h3>
            <p className="text-xs text-text-muted dark:text-slate-400 mt-0.5">
              {isIOS
                ? 'Accede rápido desde tu pantalla de inicio'
                : 'Úsala como app nativa en tu celular'}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-text-muted text-xl">close</span>
          </button>
        </div>

        {/* Actions */}
        <div className="mt-3">
          {isIOS ? (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl px-3 py-2.5">
              <span className="material-symbols-outlined text-primary text-lg">ios_share</span>
              <p className="text-xs text-text-main dark:text-slate-200">
                Toca <strong>Compartir</strong> <span className="inline-block mx-0.5">→</span> <strong>Agregar a pantalla de inicio</strong>
              </p>
            </div>
          ) : (
            <button
              onClick={install}
              className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-semibold text-sm py-2.5 rounded-xl hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">install_mobile</span>
              Instalar App
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
