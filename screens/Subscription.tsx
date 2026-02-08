
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Subscription: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32 overflow-y-auto no-scrollbar">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md px-5 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/settings')} className="mr-2 rounded-full p-1 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Suscripción</h1>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-6">
        {/* Active Plan Card */}
        <section>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-blue-600 p-6 text-white shadow-xl shadow-primary/20">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80">Plan Actual</p>
                <h2 className="text-2xl font-extrabold text-white">Profesional Activo - Plan Pro</h2>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black backdrop-blur-md border border-emerald-400/30">
                <span className="material-symbols-outlined text-[14px] filled">check_circle</span>
                ACTIVO
              </span>
            </div>
            <div className="relative z-10 mt-10 flex items-end justify-between">
              <div>
                <p className="text-blue-100 text-[10px] font-bold mb-1 opacity-80">PRÓXIMA FACTURACIÓN</p>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-blue-200">calendar_month</span>
                  <p className="font-bold text-white">24 Oct, 2023</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">$29.99<span className="text-sm font-medium opacity-70">/mes</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* Management Options */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Gestionar Suscripción</h2>
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
                  <span className="material-symbols-outlined">swap_horiz</span>
                </div>
                <div>
                  <p className="font-bold text-sm">Cambiar Plan</p>
                  <p className="text-[10px] text-text-muted">Actualizar a Anual o Básico</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </div>
            <div className="h-px w-full bg-slate-50 dark:bg-slate-800" />
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 group transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 group-hover:text-red-600">
                  <span className="material-symbols-outlined">cancel</span>
                </div>
                <div>
                  <p className="font-bold text-sm text-red-600">Cancelar Suscripción</p>
                  <p className="text-[10px] text-red-400/80">Perderás acceso a funciones Pro</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-red-300">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Promo Code */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Código de Promoción</h2>
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">local_offer</span>
                <input className="block w-full pl-10 pr-3 py-3 border-none rounded-xl bg-slate-50 dark:bg-slate-900/50 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary" placeholder="Ingresa tu código" type="text" />
              </div>
              <button className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black transition-colors shadow-lg shadow-primary/25">
                Aplicar
              </button>
            </div>
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Historial de Facturación</h2>
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm">24 {['Sep', 'Ago', 'Jul'][i-1]}, 2023</p>
                    <p className="text-[10px] font-medium text-text-muted">Mensualidad Pro</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-black text-sm">$29.99</span>
                  <span className="text-[8px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Pagado</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Subscription;
