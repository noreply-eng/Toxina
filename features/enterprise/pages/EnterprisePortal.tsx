import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitlements } from '../../entitlements/EntitlementContext';
import { formatMoney } from '../../entitlements/planCatalog';
import {
  exportVouchersToCsv,
  generateEnterpriseVouchers,
  getEnterprisePortalData,
  requestEnterpriseBatch,
  revokeEnterpriseLicense,
} from '../../super-admin/services/superAdminService';
import type { EnterprisePortalData } from '../../super-admin/types';

const EnterprisePortal: React.FC = () => {
  const navigate = useNavigate();
  const { entitlements, isSuperAdmin } = useEntitlements();
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(entitlements.enterprise_accounts[0]?.id);
  const [data, setData] = useState<EnterprisePortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [voucherType, setVoucherType] = useState<'multi_use' | 'single_use'>('single_use');
  const [campaignName, setCampaignName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [prefix, setPrefix] = useState('ENT');
  const [count, setCount] = useState(20);
  const [maxRedemptions, setMaxRedemptions] = useState(20);

  const [reqBatchCount, setReqBatchCount] = useState(1);
  const [reqInterval, setReqInterval] = useState<'annual' | 'monthly'>('annual');
  const [reqPoRef, setReqPoRef] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await getEnterprisePortalData(selectedAccountId);
      setData(res);
      if (res.account?.name) setPrefix(res.account.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'ENT');
    } catch (err: any) { setError(err?.message || 'No se pudo cargar el portal Enterprise.'); }
    finally { setLoading(false); }
  }, [selectedAccountId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerateVouchers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.account?.id) return;
    setBusy(true); setFeedback(null); setError(null);
    try {
      const created = await generateEnterpriseVouchers({
        enterpriseAccountId: data.account.id, voucherType, campaignName: campaignName.trim() || 'Programa de Licencias',
        prefix, count: voucherType === 'single_use' ? count : 1,
        maxRedemptions: voucherType === 'multi_use' ? maxRedemptions : 1,
        customCode: voucherType === 'multi_use' ? customCode.trim() : undefined,
      });
      setCustomCode('');
      setFeedback(`¡Listo! Se generaron ${created.length} cupón(es) listos para compartir con médicos.`);
      await load();
    } catch (err: any) { setError(err?.message || 'Error generando cupones.'); }
    finally { setBusy(false); }
  };

  const handleRequestBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.account?.id) return;
    setBusy(true); setFeedback(null); setError(null);
    try {
      await requestEnterpriseBatch({ enterpriseAccountId: data.account.id, batchCount: reqBatchCount, billingInterval: reqInterval, purchaseOrderRef: reqPoRef.trim() || undefined });
      setReqPoRef('');
      setFeedback(data.batch_pricing?.billing_mode === 'free_launch' ? `¡Se activó un lote piloto de ${reqBatchCount * 20} licencias sin costo!` : `Solicitud registrada por ${reqBatchCount * 20} licencias (${reqBatchCount} lote(s) de 20).`);
      await load();
    } catch (err: any) { setError(err?.message || 'Error solicitando lote.'); }
    finally { setBusy(false); }
  };

  const handleRevoke = async (licenseId: string) => {
    if (!window.confirm('¿Revocar esta licencia? El médico mantendrá sus pacientes privados en modo solo lectura.')) return;
    setBusy(true);
    try { await revokeEnterpriseLicense(licenseId, 'Revocada desde Portal Enterprise'); await load(); }
    catch (err: any) { setError(err?.message || 'No se pudo revocar la licencia.'); }
    finally { setBusy(false); }
  };

  const unitBatchPrice = reqInterval === 'monthly' ? data?.batch_pricing?.price_monthly_cents ?? 799000 : data?.batch_pricing?.price_annual_cents ?? 7990000;
  const isFreeLaunch = data?.batch_pricing?.billing_mode === 'free_launch';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md"><span className="material-symbols-outlined">corporate_fare</span></div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{data?.account?.brand_display_name || 'Portal Enterprise SONOTOX'}</h1>
              <p className="text-[11px] text-slate-500">Gestión de Licencias Premium por Lotes (x20) · Consultorios Privados Aislados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entitlements.enterprise_accounts.length > 1 && (
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold">
                {entitlements.enterprise_accounts.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            )}
            {isSuperAdmin && <button type="button" onClick={() => navigate('/super-admin?tab=enterprise')} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold">SuperAdmin</button>}
            <button type="button" onClick={() => navigate('/settings')} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Ajustes</button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-600 shrink-0">verified_user</span>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
            <strong>Privacidad Clínica Zero-PHI (LFPDPPP):</strong> Cada médico que canjea uno de tus cupones crea su <strong>propio consultorio privado con Plan Premium</strong>. Esta organización administra exclusivamente el inventario de licencias y cupones, sin acceso a pacientes ni expedientes clínicos.
          </p>
        </div>
        {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-700">{error}</div>}
        {feedback && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-700">{feedback}</div>}
        {loading ? (
          <div className="py-16 text-center text-slate-400">Cargando inventario de licencias...</div>
        ) : !data?.has_account ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">domain_disabled</span>
            <h2 className="font-black text-lg">Tu cuenta aún no está vinculada a una organización Enterprise</h2>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-[11px] font-black uppercase text-slate-400">Licencias Totales (x20)</p><p className="text-3xl font-black mt-1">{data.summary?.total_licenses ?? 0}</p><p className="text-xs text-slate-500 mt-1">{(data.summary?.total_licenses ?? 0) / 20} lote(s) activos de 20</p></div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-[11px] font-black uppercase text-emerald-600">Médicos Activos</p><p className="text-3xl font-black text-emerald-600 mt-1">{data.summary?.active_licenses ?? 0}</p><p className="text-xs text-slate-500 mt-1">Consultorios privados Premium</p></div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-[11px] font-black uppercase text-sky-600">Disponibles</p><p className="text-3xl font-black text-sky-600 mt-1">{data.summary?.available_licenses ?? 0}</p><p className="text-xs text-slate-500 mt-1">Listas para entregar vía cupón</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form onSubmit={handleGenerateVouchers} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-base flex items-center gap-2"><span className="material-symbols-outlined text-primary">confirmation_number</span>Generar Cupones de Marca</h2>
                  {(data.vouchers?.length ?? 0) > 0 && <button type="button" onClick={() => exportVouchersToCsv(data.account!.brand_display_name, data.vouchers || [])} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1"><span className="material-symbols-outlined text-sm">download</span>CSV</button>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setVoucherType('single_use')} className={`p-2.5 rounded-xl border text-xs font-bold ${voucherType === 'single_use' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700'}`}>Códigos Únicos (1 uso c/u)</button>
                  <button type="button" onClick={() => setVoucherType('multi_use')} className={`p-2.5 rounded-xl border text-xs font-bold ${voucherType === 'multi_use' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700'}`}>Código Campaña (Multi-uso)</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Nombre campaña / generación" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2" />
                  {voucherType === 'single_use' ? <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="Prefijo" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono font-bold uppercase" /> : <input value={customCode} onChange={(e) => setCustomCode(e.target.value.toUpperCase())} placeholder="Código (ej. MERZ-2026)" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono font-bold uppercase" />}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  {voucherType === 'single_use' ? <label className="flex items-center gap-2 font-bold"><span>Códigos:</span><input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 20)))} className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 font-black" /></label> : <label className="flex items-center gap-2 font-bold"><span>Tope usos:</span><input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(Math.max(1, Number(e.target.value) || 20))} className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 font-black" /></label>}
                  <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-primary text-white font-bold">Generar</button>
                </div>
                {(data.vouchers?.length ?? 0) > 0 && (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl text-xs">
                    {data.vouchers!.map((v) => <div key={v.id} className="px-3 py-2 flex items-center justify-between gap-2"><div><code className="font-black text-primary">{v.code}</code>{v.campaign_name && <span className="ml-2 text-slate-400">{v.campaign_name}</span>}</div><span className="font-bold">{v.times_redeemed} / {v.max_redemptions}</span></div>)}
                  </div>
                )}
              </form>
              <form onSubmit={handleRequestBatch} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <h2 className="font-black text-base flex items-center gap-2"><span className="material-symbols-outlined text-emerald-600">add_shopping_cart</span>Ampliar Lotes (de 20 en 20)</h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Número de lotes (x20)</label>
                    <input type="number" min={1} max={500} value={reqBatchCount} onChange={(e) => setReqBatchCount(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-base font-black" />
                    <p className="text-[11px] font-bold text-emerald-600 mt-1">+{reqBatchCount * 20} licencias Premium privadas</p>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Facturación</label>
                    <select value={reqInterval} onChange={(e) => setReqInterval(e.target.value as any)} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-bold"><option value="annual">Anual</option><option value="monthly">Mensual</option></select>
                  </div>
                </div>
                <input value={reqPoRef} onChange={(e) => setReqPoRef(e.target.value)} placeholder="Orden de Compra (PO) opcional" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" />
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Total ({reqBatchCount * 20} licencias):</span>
                  <div className="text-right">
                    {isFreeLaunch ? (<><span className="text-xs line-through text-slate-400 mr-2">{formatMoney(unitBatchPrice * reqBatchCount, data.batch_pricing?.currency)}</span><span className="text-base font-black text-emerald-600">$0 (Piloto)</span></>) : <span className="text-base font-black">{formatMoney(unitBatchPrice * reqBatchCount, data.batch_pricing?.currency)}</span>}
                  </div>
                </div>
                <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md">
                  {isFreeLaunch ? `Activar Lote Piloto (+${reqBatchCount * 20} licencias a $0)` : `Solicitar +${reqBatchCount * 20} Licencias`}
                </button>
              </form>
            </div>
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800"><h2 className="font-black text-base">Médicos Beneficiados ({data.licenses?.length ?? 0})</h2><p className="text-xs text-slate-500">Solo estatus de activación de licencia — cero información clínica de pacientes.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400"><th className="py-3 px-4">Especialista</th><th className="py-3 px-3">Cupón</th><th className="py-3 px-3">Activación</th><th className="py-3 px-3">Estado</th><th className="py-3 px-4 text-right">Gestión</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(data.licenses?.length ?? 0) === 0 ? <tr><td colSpan={5} className="py-10 text-center text-slate-400">Comparte tus cupones para ver activaciones aquí.</td></tr> : data.licenses!.map((lic) => (
                      <tr key={lic.id}>
                        <td className="py-2.5 px-4"><p className="font-bold text-sm">{lic.doctor_name || lic.doctor_email}</p><p className="text-slate-400">{lic.doctor_email}</p></td>
                        <td className="py-2.5 px-3"><code className="font-bold text-primary">{lic.voucher_code || '—'}</code></td>
                        <td className="py-2.5 px-3 text-slate-500">{new Date(lic.activated_at).toLocaleDateString('es-MX')}</td>
                        <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${lic.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{lic.status}</span></td>
                        <td className="py-2.5 px-4 text-right">{lic.status === 'active' && data.account?.allow_license_reassignment && <button type="button" disabled={busy} onClick={() => handleRevoke(lic.id)} className="text-red-500 hover:underline font-bold">Revocar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default EnterprisePortal;
