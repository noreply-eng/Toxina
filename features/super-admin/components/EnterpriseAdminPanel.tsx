import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../../entitlements/planCatalog';
import {
  addEnterpriseBatch,
  assignEnterpriseManager,
  exportVouchersToCsv,
  generateEnterpriseVouchers,
  getEnterprisePortalData,
  listEnterpriseAccounts,
  listUsers,
  removeEnterpriseManager,
  revokeEnterpriseLicense,
  upsertEnterpriseAccount,
} from '../services/superAdminService';
import type { AdminUserRow, EnterpriseAccountRow, EnterpriseOrgType, EnterprisePortalData } from '../types';

const ORG_TYPE_LABELS: Record<EnterpriseOrgType, string> = {
  pharma: 'Farmacéutica (Allergan / Ipsen / Merz)',
  aesthetic_school: 'Escuela de Medicina Estética',
  university: 'Universidad / Residencia',
  medical_society: 'Sociedad / Colegio Médico',
  hospital_group: 'Grupo Hospitalario',
  other: 'Institución Privada',
};

const EnterpriseAdminPanel: React.FC<{ onDataChanged?: () => void }> = ({ onDataChanged }) => {
  const [accounts, setAccounts] = useState<EnterpriseAccountRow[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [orgType, setOrgType] = useState<EnterpriseOrgType>('pharma');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [initialManagerEmail, setInitialManagerEmail] = useState('');
  const [initialBatches, setInitialBatches] = useState(1);
  const [defaultDurationDays, setDefaultDurationDays] = useState(365);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EnterprisePortalData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [addBatchCount, setAddBatchCount] = useState(1);
  const [addBatchPriceMxn, setAddBatchPriceMxn] = useState(0);
  const [addBatchInterval, setAddBatchInterval] = useState<'pilot_free' | 'annual' | 'monthly'>('pilot_free');
  const [addBatchPoRef, setAddBatchPoRef] = useState('');
  const [managerSearch, setManagerSearch] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerRole, setManagerRole] = useState<'owner' | 'manager' | 'billing'>('owner');

  const [voucherType, setVoucherType] = useState<'single_use' | 'multi_use'>('multi_use');
  const [campaignName, setCampaignName] = useState('');
  const [prefix, setPrefix] = useState('MERZ');
  const [customCode, setCustomCode] = useState('');
  const [voucherCount, setVoucherCount] = useState(20);
  const [maxRedemptions, setMaxRedemptions] = useState(20);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, usrs] = await Promise.all([listEnterpriseAccounts(), listUsers({ limit: 250 })]);
      setAccounts(accs);
      setDirectoryUsers(usrs);
    } catch (err: any) {
      setError(err?.message || 'Error cargando cuentas Enterprise.');
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredManagerCandidates = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    return directoryUsers
      .filter((u) => {
        if (!u.email) return false;
        if (!q) return true;
        return `${u.full_name || ''} ${u.email}`.toLowerCase().includes(q);
      })
      .slice(0, 60);
  }, [directoryUsers, managerSearch]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try { setDetail(await getEnterprisePortalData(id)); }
    catch (err: any) { setError(err?.message || 'Error cargando detalle Enterprise.'); }
    finally { setDetailLoading(false); }
  }, []);

  const openDetail = (acc: EnterpriseAccountRow) => {
    setSelectedId(acc.id);
    setFeedback(null);
    setPrefix(acc.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'ENT');
    loadDetail(acc.id);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await upsertEnterpriseAccount({
        name: orgName.trim(),
        brand_display_name: brandName.trim() || orgName.trim(),
        organization_type: orgType,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        default_license_duration_days: defaultDurationDays,
      });
      if (created?.id && initialBatches >= 1) {
        await addEnterpriseBatch({
          enterpriseAccountId: created.id,
          batchCount: initialBatches,
          billingInterval: 'pilot_free',
          unitBatchPriceCents: 0,
          paymentProcessor: 'comped',
          notes: `Lote inicial (${initialBatches * 20} licencias)`,
        });
      }
      if (created?.id && initialManagerEmail.trim()) {
        await assignEnterpriseManager(created.id, initialManagerEmail.trim(), 'owner', true);
      }
      setOrgName(''); setBrandName(''); setContactName(''); setContactEmail(''); setInitialManagerEmail(''); setInitialBatches(1); setShowCreate(false);
      await loadAccounts();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error creando organización Enterprise.');
    } finally { setBusy(false); }
  };

  const handleAddBatch = async () => {
    if (!selectedId) return;
    setBusy(true); setFeedback(null);
    try {
      await addEnterpriseBatch({
        enterpriseAccountId: selectedId,
        batchCount: addBatchCount,
        billingInterval: addBatchInterval,
        unitBatchPriceCents: Math.round(addBatchPriceMxn * 100),
        paymentProcessor: addBatchInterval === 'pilot_free' ? 'comped' : 'manual',
        purchaseOrderRef: addBatchPoRef.trim() || null,
      });
      setFeedback(`¡Se agregaron ${addBatchCount * 20} licencias (${addBatchCount} lote(s) de 20)!`);
      setAddBatchPoRef('');
      await Promise.all([loadDetail(selectedId), loadAccounts()]);
      onDataChanged?.();
    } catch (err: any) { setError(err?.message || 'Error agregando lote.'); }
    finally { setBusy(false); }
  };

  const handleAssignManager = async () => {
    if (!selectedId || !managerEmail.trim()) return;
    setBusy(true); setFeedback(null);
    try {
      await assignEnterpriseManager(selectedId, managerEmail.trim(), managerRole, true);
      setManagerEmail('');
      setManagerSearch('');
      setFeedback('Usuario asignado como gestor Enterprise (ahora tiene acceso al Portal /enterprise).');
      await Promise.all([loadDetail(selectedId), loadAccounts()]);
      onDataChanged?.();
    } catch (err: any) { setError(err?.message || 'Error asignando gestor.'); }
    finally { setBusy(false); }
  };

  const handleRemoveManager = async (userId: string, label: string) => {
    if (!selectedId) return;
    if (!window.confirm(`¿Revocar el acceso de gestor Enterprise a ${label}?`)) return;
    setBusy(true); setFeedback(null);
    try {
      await removeEnterpriseManager(selectedId, userId);
      setFeedback(`Acceso de gestor revocado para ${label}.`);
      await Promise.all([loadDetail(selectedId), loadAccounts()]);
      onDataChanged?.();
    } catch (err: any) { setError(err?.message || 'Error revocando gestor.'); }
    finally { setBusy(false); }
  };

  const handleGenerateVouchers = async () => {
    if (!selectedId) return;
    setBusy(true); setFeedback(null);
    try {
      const created = await generateEnterpriseVouchers({
        enterpriseAccountId: selectedId,
        voucherType,
        campaignName: campaignName.trim() || 'Campaña Enterprise',
        prefix,
        count: voucherType === 'single_use' ? voucherCount : 1,
        maxRedemptions: voucherType === 'multi_use' ? maxRedemptions : 1,
        customCode: voucherType === 'multi_use' ? customCode.trim() : undefined,
      });
      setCustomCode('');
      setFeedback(`¡Se generaron ${created.length} cupón(es) listos para distribuir!`);
      await Promise.all([loadDetail(selectedId), loadAccounts()]);
    } catch (err: any) { setError(err?.message || 'Error generando cupones.'); }
    finally { setBusy(false); }
  };

  const handleRevokeLicense = async (licenseId: string) => {
    if (!selectedId) return;
    if (!window.confirm('¿Revocar esta licencia Enterprise? El médico conservará sus pacientes privados en solo lectura.')) return;
    setBusy(true);
    try {
      await revokeEnterpriseLicense(licenseId, 'Revocada desde SuperAdmin');
      await Promise.all([loadDetail(selectedId), loadAccounts()]);
      onDataChanged?.();
    } catch (err: any) { setError(err?.message || 'Error revocando licencia.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-1">
            <span className="material-symbols-outlined text-sm">corporate_fare</span>
            B2B2C · Licenciamiento en Lotes de 20 en 20 · Zero-PHI
          </div>
          <h3 className="text-lg font-black">Empresas Farmacéuticas, Escuelas e Instituciones (Enterprise)</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Vende u otorga lotes en múltiplos de <strong>20 licencias Premium</strong> a marcas como Allergan, Ipsen, Merz o escuelas de medicina estética. Cada médico canjea su cupón para operar su <strong>consultorio privado aislado</strong> — la empresa patrocinadora jamás ve pacientes.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate((v) => !v)} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg">
          <span className="material-symbols-outlined text-base">add_business</span>
          Nueva Cuenta Enterprise
        </button>
      </div>

      {error && <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {showCreate && (
        <form onSubmit={handleCreateAccount} className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 p-5 space-y-4">
          <h4 className="font-black text-sm">Registrar Organización Enterprise</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nombre Empresa / Escuela *</label>
              <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ej. Merz Aesthetics México" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Sello visible al médico</label>
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Ej. Merz Aesthetics" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo</label>
              <select value={orgType} onChange={(e) => setOrgType(e.target.value as EnterpriseOrgType)} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
                {Object.entries(ORG_TYPE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Contacto principal</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Brand Manager / Director" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Correo de contacto</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contacto@empresa.com" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Lotes iniciales (x20)</label>
                <input type="number" min={1} max={500} value={initialBatches} onChange={(e) => setInitialBatches(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold" />
                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">= {initialBatches * 20} licencias</p>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Vigencia (días)</label>
                <input type="number" min={30} value={defaultDurationDays} onChange={(e) => setDefaultDurationDays(Math.max(30, Number(e.target.value) || 365))} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Asignar Usuario Existente como Owner Enterprise (opcional)
              </label>
              <select
                value={initialManagerEmail}
                onChange={(e) => setInitialManagerEmail(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
              >
                <option value="">(Opcional) Seleccionar usuario registrado para darle acceso a /enterprise...</option>
                {directoryUsers
                  .filter((u) => u.email)
                  .map((u) => (
                    <option key={u.id} value={u.email!}>
                      {u.full_name || 'Sin nombre'} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Cancelar</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black">
              {busy ? 'Creando...' : `Crear Cuenta + ${initialBatches * 20} Licencias`}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Cargando cuentas Enterprise...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">corporate_fare</span>
          <p className="font-bold text-slate-700 dark:text-slate-200">Aún no hay cuentas Enterprise registradas</p>
          <p className="text-xs text-slate-500 mt-1">Crea tu primera cuenta para Allergan, Ipsen, Merz o una escuela de medicina estética y genera sus primeros 20 cupones.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((acc) => {
            const avail = Math.max(acc.total_licenses - acc.active_licenses, 0);
            const pct = acc.total_licenses > 0 ? Math.round((acc.active_licenses / acc.total_licenses) * 100) : 0;
            return (
              <div key={acc.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4 hover:border-emerald-400/50 transition-colors">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{ORG_TYPE_LABELS[acc.organization_type]?.split(' (')[0]}</span>
                      <h4 className="text-base font-black mt-1.5 text-slate-900 dark:text-white">{acc.name}</h4>
                      <p className="text-xs text-slate-500">Sello visible: <strong>{acc.brand_display_name}</strong></p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-black">{acc.total_licenses} lic.</span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Activas: <strong>{acc.active_licenses}</strong> · Disponibles: <strong className="text-emerald-600">{avail}</strong></span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span>Cupones activos: <strong>{acc.vouchers_count}</strong></span>
                    <span>Gestores: <strong>{acc.managers.length}</strong></span>
                  </div>
                </div>
                <button type="button" onClick={() => openDetail(acc)} className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-base">tune</span>
                  Administrar Lotes x20, Cupones y Licencias
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black">{detail?.account?.name || 'Detalle Enterprise'}</h3>
                <p className="text-xs text-slate-500">Consultorios privados aislados · Cero acceso a pacientes de los médicos</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><span className="material-symbols-outlined">close</span></button>
            </div>
            {feedback && (
              <div className="rounded-xl p-3 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
                {feedback}
              </div>
            )}
            {detailLoading || !detail?.has_account ? (
              <div className="py-12 text-center text-slate-400 text-sm">Cargando datos corporativos...</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-center"><p className="text-[10px] font-bold uppercase text-slate-400">Compradas (x20)</p><p className="text-2xl font-black">{detail.summary?.total_licenses ?? 0}</p></div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center"><p className="text-[10px] font-bold uppercase text-emerald-600">Activas</p><p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{detail.summary?.active_licenses ?? 0}</p></div>
                  <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 p-3 text-center"><p className="text-[10px] font-bold uppercase text-sky-600">Disponibles</p><p className="text-2xl font-black text-sky-700 dark:text-sky-300">{detail.summary?.available_licenses ?? 0}</p></div>
                </div>

                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <h4 className="font-black text-sm">Agregar Lotes de Licencias (Múltiplos de 20)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Lotes (x20)</label>
                      <input type="number" min={1} max={500} value={addBatchCount} onChange={(e) => setAddBatchCount(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-black" />
                      <p className="text-[10px] text-emerald-600 font-bold mt-0.5">= {addBatchCount * 20} licencias</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Modalidad</label>
                      <select value={addBatchInterval} onChange={(e) => setAddBatchInterval(e.target.value as any)} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-bold">
                        <option value="pilot_free">Piloto ($0)</option>
                        <option value="annual">Anual</option>
                        <option value="monthly">Mensual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Precio/lote MXN</label>
                      <input type="number" min={0} value={addBatchPriceMxn} onChange={(e) => setAddBatchPriceMxn(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Orden Compra</label>
                      <input value={addBatchPoRef} onChange={(e) => setAddBatchPoRef(e.target.value)} placeholder="Opcional" className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" />
                    </div>
                  </div>
                  <button type="button" disabled={busy} onClick={handleAddBatch} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black">
                    + Agregar {addBatchCount * 20} Licencias ({formatMoney(addBatchPriceMxn * addBatchCount * 100)})
                  </button>
                </section>

                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <h4 className="font-black text-sm">Gestores de la Empresa (Portal /enterprise)</h4>
                  <div className="flex flex-wrap gap-2">
                    {(detail.managers || []).length === 0 ? (
                      <span className="text-xs text-slate-400">Sin gestores asignados aún.</span>
                    ) : (
                      (detail.managers || []).map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                        >
                          <span>
                            {m.full_name || m.email} <span className="text-primary uppercase text-[10px]">({m.role_in_org})</span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRemoveManager(m.user_id, m.full_name || m.email || 'gestor')}
                            className="text-red-500 hover:text-red-400 font-black cursor-pointer"
                            title="Revocar gestor"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <input
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                      placeholder="Buscar usuario registrado por nombre o correo..."
                      className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                    />
                    <select
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    >
                      <option value="">Selecciona un usuario existente...</option>
                      {filteredManagerCandidates.map((u) => (
                        <option key={u.id} value={u.email || ''}>
                          {u.full_name || 'Sin nombre'} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="email"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      placeholder="O escribe correo@empresa.com"
                      className="flex-1 min-w-[180px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                    />
                    <select
                      value={managerRole}
                      onChange={(e) => setManagerRole(e.target.value as any)}
                      className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-bold"
                    >
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="billing">Facturación</option>
                    </select>
                    <button
                      type="button"
                      disabled={busy || !managerEmail.trim()}
                      onClick={handleAssignManager}
                      className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      Asignar Gestor
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-black text-sm">Cupones de Marca ({detail.vouchers?.length ?? 0})</h4>
                    {(detail.vouchers?.length ?? 0) > 0 && (
                      <button type="button" onClick={() => exportVouchersToCsv(detail.account!.brand_display_name, detail.vouchers || [])} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">download</span>Exportar CSV
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select value={voucherType} onChange={(e) => setVoucherType(e.target.value as any)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold">
                      <option value="multi_use">Código Campaña (Multi-uso)</option>
                      <option value="single_use">Códigos Únicos (1 uso c/u)</option>
                    </select>
                    <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Nombre campaña" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs" />
                    {voucherType === 'multi_use' ? (
                      <input value={customCode} onChange={(e) => setCustomCode(e.target.value.toUpperCase())} placeholder="Código (MERZ-2026)" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono font-bold uppercase" />
                    ) : (
                      <input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="Prefijo (ALLERGAN)" className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono font-bold uppercase" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {voucherType === 'multi_use' ? (
                      <label className="text-xs flex items-center gap-2"><span>Máx. médicos:</span><input type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(Math.max(1, Number(e.target.value) || 20))} className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold" /></label>
                    ) : (
                      <label className="text-xs flex items-center gap-2"><span>Cantidad códigos:</span><input type="number" min={1} max={200} value={voucherCount} onChange={(e) => setVoucherCount(Math.max(1, Math.min(200, Number(e.target.value) || 20)))} className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold" /></label>
                    )}
                    <button type="button" disabled={busy} onClick={handleGenerateVouchers} className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">Generar Cupones</button>
                  </div>
                  {(detail.vouchers?.length ?? 0) > 0 && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                      {detail.vouchers!.map((v) => (
                        <div key={v.id} className="px-3 py-2 flex items-center justify-between text-xs gap-2">
                          <div className="min-w-0">
                            <code className="font-black text-primary">{v.code}</code>
                            {v.campaign_name && <span className="ml-2 text-slate-400">{v.campaign_name}</span>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold">
                              {v.times_redeemed} / {v.max_redemptions}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const link = `${window.location.origin}/subscription?code=${encodeURIComponent(v.code)}`;
                                navigator.clipboard?.writeText(link);
                                setFeedback(`Enlace directo del cupón ${v.code} copiado al portapapeles.`);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              Copiar link
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <h4 className="font-black text-sm">Médicos con Consultorio Privado Activo ({detail.licenses?.length ?? 0})</h4>
                  {(detail.licenses?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-400">Ningún médico ha canjeado cupones todavía.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {detail.licenses!.map((lic) => (
                        <div key={lic.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-bold">{lic.doctor_name || lic.doctor_email}</p>
                            <p className="text-slate-400">{lic.doctor_email} · Cupón <code>{lic.voucher_code || '—'}</code></p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${lic.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{lic.status}</span>
                            {lic.status === 'active' && <button type="button" onClick={() => handleRevokeLicense(lic.id)} className="text-red-500 hover:underline font-bold">Revocar</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseAdminPanel;
