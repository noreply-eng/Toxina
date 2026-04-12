
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: 'home', label: 'Inicio' },
    { path: '/search', icon: 'search', label: 'Pacientes' },
    { path: '/calculator', icon: 'calculate', label: 'Calculadora', isCenter: true },
    { path: '/motor-points', icon: 'ads_click', label: 'Punto Motor' },
    { path: '/settings', icon: 'settings', label: 'Ajustes' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 pb-safe pt-2 min-h-[85px] z-50 px-4 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.2)]">
      <div className="flex justify-between items-center max-w-lg mx-auto h-full relative">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative -top-8 flex flex-col items-center group z-10"
              >
                <div className={`size-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl active:scale-90 ${
                  isActive 
                    ? 'bg-primary text-white scale-110 shadow-primary/40 rotate-12' 
                    : 'bg-primary text-white shadow-primary/20 group-hover:shadow-primary/30 group-hover:scale-105'
                }`}>
                  <span className="material-symbols-outlined text-4xl font-bold">
                    {item.icon}
                  </span>
                </div>
                <span className={`text-[11px] mt-2 transition-all duration-300 ${
                  isActive ? 'text-primary font-bold opacity-100' : 'text-slate-400 group-hover:text-primary font-medium opacity-80'
                }`}>
                  {item.label}
                </span>
                
                {isActive && (
                   <div className="absolute -bottom-2 w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
                )}
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1.5 px-4 py-1.5 transition-all duration-300 rounded-2xl relative ${
                isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl transition-transform duration-300 ${isActive ? 'material-symbols-filled scale-110 -translate-y-0.5' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-bold leading-none tracking-tight`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 w-1 h-1 bg-primary rounded-full animate-bounce"></div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
