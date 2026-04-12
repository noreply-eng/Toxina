import React from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const PWAInstallBanner: React.FC = () => {
  const { showBanner, isIOS, install, dismiss } = usePWAInstall();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-slide-up">
      <div className="bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-primary/20 dark:border-primary/30 p-5 max-w-md mx-auto overflow-hidden relative group">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-3xl rounded-full group-hover:bg-primary/20 transition-colors duration-500"></div>
        
        {/* Close Button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-text-muted dark:text-slate-400"
          aria-label="Cerrar"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Content */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/25">
            <span className="material-symbols-outlined text-white text-3xl">download</span>
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-display font-bold text-lg text-text-main dark:text-white leading-snug">
              Instalar Toxina DLM
            </h3>
            <p className="text-sm text-text-muted dark:text-slate-400 mt-1 leading-relaxed">
              {isIOS
                ? 'Agrega acceso directo para usarla sin internet'
                : 'Úsala como una app nativa en tu dispositivo'}
            </p>
          </div>
        </div>

        {/* Action / Instructions */}
        <div className="mt-5 relative">
          {isIOS ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-primary/5 dark:bg-primary/10 rounded-xl p-3 border border-primary/10">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-primary text-xl">ios_share</span>
                </div>
                <p className="text-sm text-text-main dark:text-slate-200">
                  1. Toca el botón <strong>Compartir</strong>
                </p>
              </div>
              <div className="flex items-center gap-3 bg-primary/5 dark:bg-primary/10 rounded-xl p-3 border border-primary/10">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-primary text-xl">add_box</span>
                </div>
                <p className="text-sm text-text-main dark:text-slate-200">
                  2. Selecciona <strong>Agregar a inicio</strong>
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={install}
              className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-base py-3.5 rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <span className="material-symbols-outlined text-2xl group-hover:animate-bounce-y">install_mobile</span>
              Instalar Aplicación
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAInstallBanner;
