import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import LegalFooterLinks from '../LegalFooterLinks';
import { APP_NAME, APP_TAGLINE } from '../../constants/brand';

interface AuthHighlight {
  icon: string;
  title: string;
  description: string;
}

const DEFAULT_HIGHLIGHTS: AuthHighlight[] = [
  {
    icon: 'calculate',
    title: 'Cálculo clínico multi-marca',
    description: 'Conversión y dosificación exacta para Botox, Dysport y Xeomin con reportes imprimibles.',
  },
  {
    icon: 'view_in_ar',
    title: 'Anatomía 3D y guía ecográfica',
    description: 'Puntos motores, planificador facial interactivo y protocolos por patología clínica.',
  },
  {
    icon: 'verified_user',
    title: 'Privacidad LFPDPPP y Zero-PHI',
    description: 'Tus expedientes permanecen aislados en tu consultorio o clínica con respaldo seguro.',
  },
];

interface AuthSplitShellProps {
  backTo?: string;
  backLabel?: string;
  badge?: string;
  asideTitle?: string;
  asideDescription?: string;
  asideFooter?: React.ReactNode;
  highlights?: AuthHighlight[];
  maxContentWidth?: string;
  children: React.ReactNode;
}

const AuthSplitShell: React.FC<AuthSplitShellProps> = ({
  backTo = '/',
  backLabel = 'Inicio',
  badge = 'Plataforma Clínica · Toxina Botulínica',
  asideTitle = 'Precisión clínica en cada aplicación',
  asideDescription = 'Gestiona dosis, expedientes, agenda y anatomía funcional desde tu consultorio individual o en equipo con tu clínica.',
  asideFooter,
  highlights = DEFAULT_HIGHLIGHTS,
  maxContentWidth = 'max-w-md',
  children,
}) => {
  return (
    <div className="relative min-h-dvh w-full bg-background-light dark:bg-background-dark flex flex-col lg:grid lg:grid-cols-[minmax(360px,440px)_1fr]">
      {/* Desktop clinical identity sidebar */}
      <aside className="hidden lg:flex relative flex-col justify-between p-10 bg-gradient-to-br from-[#0b1929] via-[#0e243b] to-[#0a364a] text-white overflow-hidden border-r border-white/10">
        {/* Subtle blueprint grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-primary/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-cyan-500/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 space-y-8">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <BrandLogo size={44} rounded="xl" className="ring-white/20" />
              <div>
                <p className="text-lg font-black tracking-tight text-white leading-none">{APP_NAME}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/80 mt-1">
                  {APP_TAGLINE}
                </p>
              </div>
            </Link>
          </div>

          <div className="space-y-3 pt-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-bold text-sky-100">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {badge}
            </span>
            <h2 className="text-2xl xl:text-[1.75rem] font-black tracking-tight leading-snug text-white">
              {asideTitle}
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">{asideDescription}</p>
          </div>

          <ul className="space-y-4 pt-2">
            {highlights.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3.5 rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 backdrop-blur-sm"
              >
                <div className="size-9 rounded-xl bg-primary/25 text-sky-300 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">{item.title}</p>
                  <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 pt-8">
          {asideFooter ? (
            asideFooter
          ) : (
            <div className="flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-5">
              <span>Dirección clínica · Dr. Marcos Yocupicio</span>
              <span className="font-mono text-[11px] text-sky-300/80">v2.0</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main interactive column */}
      <div className="relative flex-1 flex flex-col min-h-dvh">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6 pb-2">
          <Link
            to={backTo}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              arrow_back
            </span>
            {backLabel}
          </Link>

          <Link to="/" className="flex lg:hidden items-center gap-2">
            <BrandLogo size={32} rounded="xl" />
            <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
              {APP_NAME}
            </span>
          </Link>

          <div className="hidden lg:block" />
        </header>

        {/* Scrollable centered content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-6 sm:py-10">
          <div className={`w-full ${maxContentWidth}`}>{children}</div>
        </main>

        {/* Legal footer */}
        <footer className="px-4 py-5 text-center border-t border-slate-200/60 dark:border-slate-800/60">
          <LegalFooterLinks />
        </footer>
      </div>
    </div>
  );
};

export default AuthSplitShell;
