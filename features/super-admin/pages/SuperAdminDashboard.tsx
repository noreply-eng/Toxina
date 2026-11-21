import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEntitlements } from '../../entitlements/EntitlementContext';
import { formatMoney, type BillingMode, type SubscriptionTier } from '../../entitlements/planCatalog';
import AuditLogPanel from '../components/AuditLogPanel';
import BillingPanel from '../components/BillingPanel';
import ClinicManagementTable from '../components/ClinicManagementTable';
import EnterpriseAdminPanel from '../components/EnterpriseAdminPanel';
import GlobalPatientsPanel from '../components/GlobalPatientsPanel';
import PremiumCmsPanel from '../components/PremiumCmsPanel';
import UsersRolesPanel from '../components/UsersRolesPanel';
import {
  getGlobalKpis,
  listAnnouncements,
  updatePlatformSettings,
  upsertAnnouncement,
} from '../services/superAdminService';
import type { GlobalKpis } from '../types';

type AdminTab = 'overview' | 'users' | 'enterprise' | 'billing' | 'clinics' | 'patients' | 'cms' | 'audit';

const NAV_TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Control Maestro', icon: 'dashboard' },
  { id: 'users', label: 'Usuarios y Permisos', icon: 'group' },
  { id: 'enterprise', label: 'Enterprise (Lotes x20)', icon: 'corporate_fare' },
  { id: 'billing', label: 'Planes, Cobros y Stripe', icon: 'payments' },
  { id: 'clinics', label: 'Clínicas y Horarios', icon: 'local_hospital' },
  { id: 'patients', label: 'Pacientes Globales', icon: 'personal_injury' },
  { id: 'cms', label: 'CMS Contenido Premium', icon: 'photo_library' },
  { id: 'audit', label: 'ARCO y Auditoría', icon: 'policy' },
];

const BILLING_MODE_META: Record<BillingMode, { label: string; badge: string; desc: string }> = {
  free_launch: {
    label: 'Lanzamiento Gratuito ($0)',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    desc: 'Todos los usuarios pueden activar Plus o Premium sin costo ($0) y quedan marcados como Fundadores.',
  },
  manual_billing: {
    label: 'Cobro Manual / Cupones',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    desc: 'Se cierra el alta gratis automática. Solo acceso vía asignación manual del Admin, cupones o licencias Enterprise.',
  },
  stripe_live: {
    label: 'Stripe Activo (Cobro Real)',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
    desc: 'El checkout redirige a Stripe Checkout. Los permisos manuales protegidos y licencias Enterprise siguen intactos.',
  },
};

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { simulatedTier, setSimulatedTier, refresh: refreshMyEntitlements, rpcAvailable } = useEntitlements();

  const initialTab = (searchParams.get('tab') as AdminTab) || 'overview';
  const [activeTab, setActiveTab] = useState<AdminTab>(NAV_TABS.some((t) => t.id === initialTab) ? initialTab : 'overview');
  const [kpis, setKpis] = useState<GlobalKpis | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [billingModeDraft, setBillingModeDraft] = useState<BillingMode>('free_launch');
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerText, setBannerText] = useState('');
  const [enforceEntitlements, setEnforceEntitlements] = useState(true);
  const [founderDiscount, setFounderDiscount] = useState(40);
  const [grantDays, setGrantDays] = useState<string>('');

  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annVariant, setAnnVariant] = useState<'promo' | 'info' | 'warning'>('promo');
  const [annTargetLaunchOnly, setAnnTargetLaunchOnly] = useState(false);

  const selectTab = (tab: AdminTab) => { setActiveTab(tab); setSearchParams({ tab }, { replace: true }); };

  const loadOverview = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [data, anns] = await Promise.all([getGlobalKpis(), listAnnouncements()]);
      setKpis(data); setAnnouncements(anns);
      if (data.platform_settings) {
        setBillingModeDraft(data.platform_settings.billing_mode);
        setBannerEnabled(data.platform_settings.launch_promo_banner_enabled);
        setBannerText(data.platform_settings.launch_promo_banner_text || '');
        setEnforceEntitlements(data.platform_settings.enforce_entitlements);
        setFounderDiscount(data.platform_settings.founder_discount_percent ?? 40);
        setGrantDays(data.platform_settings.launch_default_grant_days ? String(data.platform_settings.launch_default_grant_days) : '');
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las métricas globales. Verifica que las 4 migraciones SQL estén aplicadas en Supabase.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const handleSavePlatformSettings = async () => {
    setSavingSettings(true); setError(null); setFeedback(null);
    try {
      await updatePlatformSettings({
        billing_mode: billingModeDraft, launch_promo_banner_enabled: bannerEnabled, launch_promo_banner_text: bannerText,
        enforce_entitlements: enforceEntitlements, founder_discount_percent: founderDiscount,
        launch_default_grant_days: grantDays.trim() ? Number(grantDays) : null,
      });
      setFeedback('Configuración maestra de la plataforma actualizada en vivo.');
      await Promise.all([loadOverview(), refreshMyEntitlements()]);
    } catch (err: any) { setError(err?.message || 'Error guardando configuración.'); }
    finally { setSavingSettings(false); }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMsg.trim()) return;
    try {
      await upsertAnnouncement({
        title: annTitle.trim(), message: annMsg.trim(), variant: annVariant,
        target_origins: annTargetLaunchOnly ? ['launch_promo'] : null, cta_label: 'Ver Planes', cta_path: '/subscription', is_active: true,
      });
      setAnnTitle(''); setAnnMsg(''); setFeedback('Anuncio publicado en la plataforma.');
      await Promise.all([loadOverview(), refreshMyEntitlements()]);
    } catch (err: any) { setError(err?.message || 'Error publicando anuncio.'); }
  };

  const currentMode = kpis?.platform_settings?.billing_mode || 'free_launch';
  const stripeLinked = kpis?.billing.stripe_plans_linked ?? 0;
  const stripeTotal = kpis?.billing.stripe_plans_total ?? 0;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-slate-900 text-slate-100 border-r border-slate-800 sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-xl">admin_panel_settings</span>
            </div>
            <div>
              <p className="font-black text-sm tracking-tight">SONOTOX Admin</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">SuperAdmin Console</p>
            </div>
          </div>
          <div className={`mt-4 px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider text-center ${BILLING_MODE_META[currentMode].badge}`}>
            {BILLING_MODE_META[currentMode].label}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => selectTab(t.id)} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${activeTab === t.id ? 'bg-primary text-white shadow-md shadow-primary/25' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              <span className="truncate">{t.label}</span>
              {t.id === 'audit' && (kpis?.compliance.arco_pending ?? 0) > 0 && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">{kpis!.compliance.arco_pending}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="text-[10px] uppercase font-bold text-slate-400">Simular vista como plan</div>
          <select value={simulatedTier || 'real'} onChange={(e) => setSimulatedTier(e.target.value === 'real' ? null : (e.target.value as SubscriptionTier))} className="w-full rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold px-2.5 py-1.5 text-white">
            <option value="real">SuperAdmin (Real)</option>
            <option value="free">Simular Plan Free</option>
            <option value="plus">Simular Plan Plus</option>
            <option value="premium">Simular Plan Premium</option>
          </select>
          <button type="button" onClick={() => navigate('/dashboard')} className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-base">arrow_back</span>Volver a App Clínica
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5">
          <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black tracking-tight truncate">
                {NAV_TABS.find((t) => t.id === activeTab)?.label}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                Consola exclusiva del SuperAdministrador · Invisible para usuarios regulares
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadOverview}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">refresh</span>Refrescar
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="lg:hidden px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
              >
                App Clínica
              </button>
            </div>
          </div>
          <div className="max-w-7xl mx-auto w-full flex lg:hidden gap-1.5 overflow-x-auto no-scrollbar mt-3 pb-1">
            {NAV_TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => selectTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${activeTab === t.id ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>{t.label}</button>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {!rpcAvailable && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-4 text-xs text-amber-900 dark:text-amber-200">
              <strong>Migraciones pendientes en Supabase:</strong> Aplica las 4 migraciones en <code>supabase/migrations/20261120*</code> en orden para activar todas las RPCs de SuperAdmin, Lanzamiento Gratuito y Enterprise x20.
            </div>
          )}
          {error && <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3.5 text-xs font-bold text-red-700 dark:text-red-300">{error}</div>}
          {feedback && <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{feedback}</div>}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <button type="button" onClick={() => selectTab('users')} className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-black uppercase text-slate-400">Usuarios Totales</span><span className="material-symbols-outlined text-primary">group</span></div>
                  <p className="text-3xl font-black mt-2">{loading ? '…' : kpis?.users.total ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Free: <strong>{kpis?.users.by_tier.free ?? 0}</strong> · Plus: <strong>{kpis?.users.by_tier.plus ?? 0}</strong> · Prem: <strong className="text-amber-600">{kpis?.users.by_tier.premium ?? 0}</strong></p>
                  <p className="text-[11px] text-emerald-600 font-bold mt-1">+{kpis?.users.new_7d ?? 0} esta semana · {kpis?.users.by_origin.admin_grant ?? 0} cortesías VIP</p>
                </button>
                <button type="button" onClick={() => selectTab('billing')} className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-black uppercase text-slate-400">MRR Cobrado / Proyectado</span><span className="material-symbols-outlined text-emerald-500">payments</span></div>
                  <p className="text-3xl font-black mt-2">{loading ? '…' : formatMoney(kpis?.billing.mrr_collected_cents ?? 0)}</p>
                  <p className="text-xs text-slate-500 mt-1">Valor base Launch ($0): <strong>{formatMoney(kpis?.billing.mrr_projected_launch_cents ?? 0)}/mes</strong></p>
                  <p className="text-[11px] text-sky-600 font-bold mt-1">Stripe IDs listos: {stripeLinked} / {stripeTotal} planes</p>
                </button>
                <button type="button" onClick={() => selectTab('enterprise')} className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-emerald-400/50 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-black uppercase text-slate-400">Enterprise (Lotes x20)</span><span className="material-symbols-outlined text-teal-500">corporate_fare</span></div>
                  <p className="text-3xl font-black mt-2">{loading ? '…' : kpis?.enterprise.accounts ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Licencias activas: <strong>{kpis?.enterprise.licenses_active ?? 0}</strong> / <strong>{kpis?.enterprise.licenses_sold ?? 0}</strong></p>
                  <p className="text-[11px] text-teal-600 font-bold mt-1">{kpis?.enterprise.licenses_available ?? 0} disponibles para canje</p>
                </button>
                <button type="button" onClick={() => selectTab('patients')} className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-black uppercase text-slate-400">Actividad Clínica & ARCO</span><span className="material-symbols-outlined text-purple-500">monitoring</span></div>
                  <p className="text-3xl font-black mt-2">{loading ? '…' : kpis?.clinical.patients_total ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">{kpis?.clinical.treatments_30d ?? 0} aplicaciones (30d) · {kpis?.clinical.consultations_30d ?? 0} citas</p>
                  <p className={`text-[11px] font-bold mt-1 ${(kpis?.compliance.arco_pending ?? 0) > 0 ? 'text-red-500' : 'text-slate-400'}`}>ARCO pendientes: {kpis?.compliance.arco_pending ?? 0}</p>
                </button>
              </div>

              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Crear / Gestionar Usuarios', icon: 'person_add', tab: 'users' as AdminTab, color: 'text-primary' },
                  { label: 'Crear Clínica + Owner', icon: 'add_business', tab: 'clinics' as AdminTab, color: 'text-teal-500' },
                  { label: 'Gestionar Suscripciones', icon: 'card_membership', tab: 'billing' as AdminTab, color: 'text-amber-500' },
                  { label: 'Empresas Enterprise x20', icon: 'corporate_fare', tab: 'enterprise' as AdminTab, color: 'text-indigo-500' },
                ].map((qa) => (
                  <button
                    key={qa.label}
                    type="button"
                    onClick={() => selectTab(qa.tab)}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all text-left cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-xl ${qa.color}`}>{qa.icon}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{qa.label}</span>
                  </button>
                ))}
              </section>

              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                <div>
                  <h2 className="text-base font-black flex items-center gap-2"><span className="material-symbols-outlined text-primary">tune</span>Control Maestro de Monetización y Lanzamiento Gratuito</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Cambia de lanzamiento gratuito ($0) a cobro manual o Stripe en vivo sin redesplegar código.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(['free_launch', 'manual_billing', 'stripe_live'] as BillingMode[]).map((mode) => {
                    const selected = billingModeDraft === mode;
                    return (
                      <button key={mode} type="button" onClick={() => setBillingModeDraft(mode)} className={`text-left p-4 rounded-2xl border-2 transition-all ${selected ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}>
                        <div className="flex items-center justify-between mb-1"><span className="font-black text-sm">{BILLING_MODE_META[mode].label}</span>{selected && <span className="material-symbols-outlined text-primary text-lg">check_circle</span>}</div>
                        <p className="text-xs text-slate-500 leading-relaxed">{BILLING_MODE_META[mode].desc}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2.5 font-bold cursor-pointer"><input type="checkbox" checked={bannerEnabled} onChange={(e) => setBannerEnabled(e.target.checked)} className="size-4 accent-primary" />Mostrar banner de acceso gratuito de lanzamiento</label>
                    <input value={bannerText} onChange={(e) => setBannerText(e.target.value)} placeholder="Texto del banner..." className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" />
                    <label className="flex items-center gap-2.5 font-bold cursor-pointer"><input type="checkbox" checked={enforceEntitlements} onChange={(e) => setEnforceEntitlements(e.target.checked)} className="size-4 accent-primary" />Aplicar control de planes (Feature Gates + RLS)</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block font-bold text-slate-500 mb-1">Duración promo (días)</label><input type="number" min={1} value={grantDays} onChange={(e) => setGrantDays(e.target.value)} placeholder="Vacío = sin vencimiento" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" /></div>
                    <div><label className="block font-bold text-slate-500 mb-1">Descuento Fundadores (%)</label><input type="number" min={0} max={100} value={founderDiscount} onChange={(e) => setFounderDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold" /></div>
                    <div className="col-span-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                      <p className="font-black text-[11px] uppercase text-slate-500 mb-1">Checklist Pre-Flight Stripe</p>
                      <p className="text-xs">{stripeTotal > 0 && stripeLinked === stripeTotal ? <span className="text-emerald-600 font-bold">✓ Todos los planes pagos ({stripeLinked}/{stripeTotal}) tienen Stripe Price ID.</span> : <span className="text-amber-600 font-bold">• Faltan {Math.max(stripeTotal - stripeLinked, 0)} planes por vincular con Stripe Price ID.</span>}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" disabled={savingSettings} onClick={handleSavePlatformSettings} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-xs shadow-md disabled:opacity-50">{savingSettings ? 'Guardando...' : 'Guardar Configuración Maestra'}</button>
                </div>
              </section>

              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h3 className="text-base font-black flex items-center gap-2"><span className="material-symbols-outlined text-amber-500">campaign</span>Anuncios In-App Segmentados</h3>
                <form onSubmit={handleCreateAnnouncement} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <input required value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Título" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold" />
                  <input required value={annMsg} onChange={(e) => setAnnMsg(e.target.value)} placeholder="Mensaje..." className="md:col-span-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2" />
                  <select value={annVariant} onChange={(e) => setAnnVariant(e.target.value as any)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold">
                    <option value="promo">Promocional</option><option value="info">Informativo</option><option value="warning">Aviso</option>
                  </select>
                  <label className="md:col-span-3 flex items-center gap-2 font-semibold"><input type="checkbox" checked={annTargetLaunchOnly} onChange={(e) => setAnnTargetLaunchOnly(e.target.checked)} className="accent-primary" />Mostrar solo a usuarios en promoción de lanzamiento</label>
                  <button type="submit" className="py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold">Publicar Anuncio</button>
                </form>
                {announcements.length > 0 && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs pt-2">
                    {announcements.map((a) => (
                      <div key={a.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div><span className="font-bold">{a.title}:</span> <span className="text-slate-500">{a.message}</span></div>
                        <button type="button" onClick={async () => { await upsertAnnouncement({ id: a.id, is_active: !a.is_active }); await loadOverview(); }} className={`px-2.5 py-1 rounded-lg font-bold shrink-0 ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{a.is_active ? 'Visible' : 'Oculto'}</button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'users' && <UsersRolesPanel onDataChanged={loadOverview} />}
          {activeTab === 'enterprise' && <EnterpriseAdminPanel onDataChanged={loadOverview} />}
          {activeTab === 'billing' && (
            <BillingPanel
              onDataChanged={() => {
                loadOverview();
                refreshMyEntitlements();
              }}
            />
          )}
          {activeTab === 'clinics' && <ClinicManagementTable onDataChanged={loadOverview} />}
          {activeTab === 'patients' && <GlobalPatientsPanel />}
          {activeTab === 'cms' && <PremiumCmsPanel />}
          {activeTab === 'audit' && <AuditLogPanel onDataChanged={loadOverview} />}
        </main>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
