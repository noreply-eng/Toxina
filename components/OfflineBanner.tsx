import React, { useState, useEffect } from 'react';

const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[110] animate-slide-down">
      <div className="bg-amber-500/90 dark:bg-amber-600/90 backdrop-blur-md text-white py-2 px-4 shadow-lg border-b border-white/10">
        <div className="max-w-md mx-auto flex items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="material-symbols-outlined text-xl animate-pulse">cloud_off</span>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-tight">Sin conexión</span>
            <span className="text-[10px] opacity-90 leading-tight">Datos locales: pacientes, citas, calculadoras y guías</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineBanner;
