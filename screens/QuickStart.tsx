import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import LegalFooterLinks from '../components/LegalFooterLinks';
import { APP_NAME } from '../constants/brand';

const ACTIONS = [
  {
    to: '/login',
    title: 'Iniciar sesión',
    description: 'Entre a la calculadora y al registro clínico.',
    icon: 'login',
    primary: true,
  },
  {
    to: '/signup',
    title: 'Crear cuenta',
    description: 'Registro gratuito para residentes e investigadores.',
    icon: 'person_add',
    primary: false,
  },
] as const;

const QuickStart: React.FC = () => {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-background-light dark:bg-background-dark px-6 py-8 pt-safe pb-safe overflow-x-hidden overscroll-none">
      <a
        href="#acceso"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-primary focus:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        Saltar al acceso
      </a>

      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-5" aria-hidden="true">
        <span className="material-symbols-outlined absolute -top-10 -right-10 text-[400px]">vaccines</span>
        <span className="material-symbols-outlined absolute -bottom-10 -left-10 text-[350px]">hub</span>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10">
        <header className="flex flex-col items-center text-center">
          <BrandLogo size={80} className="mb-6" />
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{APP_NAME}</h1>
          <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
            Acceso rápido a la calculadora clínica y al registro de toxina botulínica.
          </p>
        </header>

        <nav id="acceso" aria-label="Acceso a la plataforma" className="flex w-full flex-col gap-3">
          {ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={`group flex min-h-[56px] cursor-pointer items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 ${
                action.primary
                  ? 'bg-primary text-white shadow-xl shadow-primary/25 hover:bg-primary-dark'
                  : 'border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-primary/40 hover:bg-slate-50 dark:border-slate-700 dark:bg-surface-dark dark:text-white dark:hover:border-primary/50 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  action.primary
                    ? 'bg-white/15 text-white'
                    : 'bg-primary/10 text-primary'
                }`}
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-[22px]">{action.icon}</span>
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-base font-black leading-tight">{action.title}</span>
                <span
                  className={`mt-0.5 block text-sm font-medium leading-snug ${
                    action.primary ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {action.description}
                </span>
              </span>
              <span className="material-symbols-outlined text-[20px] opacity-70" aria-hidden="true">
                chevron_right
              </span>
            </Link>
          ))}

          <Link
            to="/landing"
            className="flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-primary"
          >
            Conocer la plataforma
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </nav>
      </div>

      <footer className="relative z-10 mt-8 w-full text-center">
        <LegalFooterLinks />
      </footer>
    </div>
  );
};

export default QuickStart;
