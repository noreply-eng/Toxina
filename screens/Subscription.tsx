
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';

const Subscription: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('Free');
  const [promoCode, setPromoCode] = useState('');
  const [promoMessage, setPromoMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchTier = async () => {
      try {
        const user = await getAuthUser();
        if (!user) return;

        const { data } = await supabase
          .from('user_profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (data?.subscription_tier) setTier(data.subscription_tier);
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTier();
  }, []);

  const isPro = tier === 'Pro' || tier === 'Enterprise';

  const handleApplyPromo = () => {
    if (!promoCode.trim()) return;
    setPromoMessage('Los códigos promocionales estarán disponibles próximamente.');
    setTimeout(() => setPromoMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

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
        <section>
          <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl ${
            isPro
              ? 'bg-gradient-to-br from-primary to-blue-600 shadow-primary/20'
              : 'bg-gradient-to-br from-slate-600 to-slate-800 shadow-slate-500/20'
          }`}>
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Plan Actual</p>
                <h2 className="text-2xl font-extrabold text-white">
                  {isPro ? 'Profesional — Plan Pro' : 'Plan Básico — Gratuito'}
                </h2>
              </div>
              <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black backdrop-blur-md border ${
                isPro
                  ? 'bg-emerald-400/20 border-emerald-400/30'
                  : 'bg-white/10 border-white/20'
              }`}>
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {isPro ? 'ACTIVO' : 'GRATIS'}
              </span>
            </div>
            <div className="relative z-10 mt-8">
              {isPro ? (
                <p className="text-white/80 text-sm">
                  Acceso completo a calculadora, plantillas, exportación y personalización avanzada.
                </p>
              ) : (
                <p className="text-white/80 text-sm">
                  Funciones esenciales incluidas. Actualiza a Pro para desbloquear todas las herramientas clínicas.
                </p>
              )}
            </div>
          </div>
        </section>

        {!isPro && (
          <section>
            <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Actualizar Plan
            </h2>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-5">
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="font-bold text-lg">Plan Pro</p>
                  <p className="text-xs text-text-muted">Facturación mensual</p>
                </div>
                <p className="text-2xl font-black">$29.99<span className="text-sm font-medium text-text-muted">/mes</span></p>
              </div>
              <ul className="space-y-2 mb-4 text-sm text-text-muted">
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Plantillas ilimitadas</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Exportación avanzada</li>
                <li className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-sm">check</span> Personalización completa</li>
              </ul>
              <button
                onClick={() => setPromoMessage('La integración de pagos estará disponible próximamente.')}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25"
              >
                Actualizar a Pro
              </button>
            </div>
          </section>
        )}

        {isPro && (
          <section>
            <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Gestionar Suscripción</h2>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800">
              <div
                onClick={() => setPromoMessage('La gestión de planes estará disponible próximamente.')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
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
              <div
                onClick={() => setPromoMessage('Contacta soporte para cancelar tu suscripción.')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 group transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500">
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
        )}

        <section>
          <h2 className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Código de Promoción</h2>
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">local_offer</span>
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border-none rounded-xl bg-slate-50 dark:bg-slate-900/50 text-sm font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary"
                  placeholder="Ingresa tu código"
                  type="text"
                />
              </div>
              <button
                onClick={handleApplyPromo}
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl text-sm font-black transition-colors shadow-lg shadow-primary/25"
              >
                Aplicar
              </button>
            </div>
            {promoMessage && (
              <p className="text-xs text-text-muted mt-3 px-1">{promoMessage}</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Subscription;
