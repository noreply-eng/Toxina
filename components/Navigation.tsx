
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 min-h-[85px] z-50 px-4">
      <div className="flex justify-between items-center max-w-lg mx-auto h-full">
        {navItems.map((item) => {
          // Simple active check: logic is active if pathname starts with item path (except root/dashboard overlap)
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          if (item.isCenter) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative -top-6 flex flex-col items-center group"
              >
                <div className={`size-14 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                  isActive ? 'bg-primary text-white shadow-primary/30' : 'bg-primary text-white shadow-primary/20 group-hover:bg-primary-dark'
                }`}>
                  <span className="material-symbols-outlined text-3xl font-bold">
                    {item.icon}
                  </span>
                </div>
                <span className={`text-[10px] mt-1.5 transition-colors ${
                  isActive ? 'text-primary font-bold' : 'text-slate-400 group-hover:text-primary font-medium'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 transition-all rounded-xl ${
                isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl ${isActive ? 'filled' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium leading-none`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
