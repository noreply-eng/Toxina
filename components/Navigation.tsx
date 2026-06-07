
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/dashboard', icon: 'home', label: 'Inicio' },
  { path: '/search', icon: 'search', label: 'Pacientes' },
  { path: '/pathologies', icon: 'medical_information', label: 'Patologías' },
  { path: '/calculator', icon: 'calculate', label: 'Calculadora', isPrimary: true },
  { path: '/agenda', icon: 'event', label: 'Agenda' },
  { path: '/motor-points', icon: 'ads_click', label: 'P. Motor' },
  { path: '/settings', icon: 'settings', label: 'Ajustes' },
] as const;

function isNavActive(pathname: string, path: string): boolean {
  if (pathname === path) return true;
  if (path === '/pathologies' && pathname.startsWith('/pathology/')) return true;
  return path !== '/dashboard' && pathname.startsWith(path);
}

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 z-50 shadow-sm">
        <div className="px-5 py-6 border-b border-slate-100 dark:border-slate-800">
          <p className="text-lg font-bold text-text-main dark:text-white tracking-tight">Toxina</p>
          <p className="text-xs text-text-muted dark:text-slate-400 mt-0.5">Asistente clínico</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(location.pathname, item.path);

            if (item.isPrimary) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'bg-primary/10 text-primary hover:bg-primary/15'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="text-sm font-bold">{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl ${
                    isActive ? 'material-symbols-filled' : ''
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 pb-safe pt-2 min-h-[85px] z-50 px-2 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.2)]">
        <div className="flex justify-between items-end max-w-lg mx-auto h-full relative">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(location.pathname, item.path);

            if (item.isPrimary) {
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="relative -top-8 flex flex-col items-center group z-10 mx-1 cursor-pointer"
                >
                  <div
                    className={`size-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl active:scale-90 ${
                      isActive
                        ? 'bg-primary text-white scale-110 shadow-primary/40 rotate-12'
                        : 'bg-primary text-white shadow-primary/20 group-hover:shadow-primary/30 group-hover:scale-105'
                    }`}
                  >
                    <span className="material-symbols-outlined text-4xl font-bold">{item.icon}</span>
                  </div>
                  <span
                    className={`text-[10px] mt-2 transition-all duration-300 ${
                      isActive
                        ? 'text-primary font-bold opacity-100'
                        : 'text-slate-400 group-hover:text-primary font-medium opacity-80'
                    }`}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="absolute -bottom-2 w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  )}
                </button>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-1 py-1.5 transition-all duration-300 rounded-2xl relative min-w-0 flex-1 cursor-pointer ${
                  isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[22px] transition-transform duration-300 ${
                    isActive ? 'material-symbols-filled scale-110 -translate-y-0.5' : ''
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-[9px] font-bold leading-none tracking-tight truncate max-w-full">
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 w-1 h-1 bg-primary rounded-full animate-bounce" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Navigation;
