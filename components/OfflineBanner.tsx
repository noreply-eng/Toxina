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
    <div className="bg-amber-500 text-white text-center text-xs font-semibold py-1.5 px-4 flex items-center justify-center gap-2 z-50">
      <span className="material-symbols-outlined text-sm">cloud_off</span>
      Sin conexión — Usando datos guardados
    </div>
  );
};

export default OfflineBanner;
