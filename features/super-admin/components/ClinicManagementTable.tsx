import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  grantClinicAccessToUser,
  listClinics,
  listUsers,
  upsertClinic,
} from '../services/superAdminService';
import type { AdminUserRow, ClinicSummaryRow } from '../types';

const CLINIC_TYPE_LABELS: Record<ClinicSummaryRow['type'], string> = {
  solo_practice: 'Consultorio Individual',
  clinic: 'Clínica Multi-especialista',
  hospital: 'Hospital',
  aesthetic_center: 'Centro Estético',
  rehab_center: 'Centro de Rehabilitación',
};

const ClinicManagementTable: React.FC<{ onDataChanged?: () => void }> = ({ onDataChanged }) => {
  const navigate = useNavigate();
  const [clinics, setClinics] = useState<ClinicSummaryRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Create Clinic Wizard state
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ClinicSummaryRow['type']>('clinic');
  const [city, setCity] = useState('');
  const [taxId, setTaxId] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Owner assignment during creation
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [initialPlanSlug, setInitialPlanSlug] = useState<'premium_clinic' | 'plus_clinic' | 'none'>('premium_clinic');
  const [initialSeatLimit, setInitialSeatLimit] = useState(5);
  const [initialDurationDays, setInitialDurationDays] = useState<number | null>(365);
  const [initialLifetime, setInitialLifetime] = useState(false);

  // Quick Assign Owner modal for existing clinics
  const [assignOwnerClinic, setAssignOwnerClinic] = useState<ClinicSummaryRow | null>(null);
  const [quickOwnerSearch, setQuickOwnerSearch] = useState('');
  const [quickOwnerUserId, setQuickOwnerUserId] = useState('');
  const [quickOwnerRole, setQuickOwnerRole] = useState<'owner' | 'director' | 'clinic_admin' | 'specialist'>('owner');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, u] = await Promise.all([listClinics(), listUsers({ limit: 250 })]);
      setClinics(c);
      setUsers(u);
    } catch (err: any) {
      setError(err?.message || 'Error cargando clínicas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    let active = 0;
    let totalMembers = 0;
    let totalPatients = 0;
    let withPlan = 0;
    for (const c of clinics) {
      if (c.is_active) active++;
      totalMembers += c.members_count || 0;
      totalPatients += c.patients_count || 0;
      if (c.active_subscription) withPlan++;
    }
    return { total: clinics.length, active, totalMembers, totalPatients, withPlan };
  }, [clinics]);

  const filteredClinics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clinics.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (q) {
        const hay = `${c.name} ${c.city || ''} ${c.director_name || ''} ${c.email || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clinics, search, typeFilter]);

  const filterUsersList = (q: string) => {
    const clean = q.trim().toLowerCase();
    if (!clean) return users.slice(0, 60);
    return users
      .filter((u) => `${u.full_name || ''} ${u.email || ''} ${u.specialty || ''}`.toLowerCase().includes(clean))
      .slice(0, 60);
  };

  const ownerCandidates = useMemo(() => filterUsersList(ownerSearch), [users, ownerSearch]);
  const quickOwnerCandidates = useMemo(() => filterUsersList(quickOwnerSearch), [users, quickOwnerSearch]);

  const handleSelectOwnerInWizard = (uid: string) => {
    setOwnerUserId(uid);
    const picked = users.find((u) => u.id === uid);
    if (picked) {
      if (!directorName.trim() && picked.full_name) setDirectorName(picked.full_name);
      if (!email.trim() && picked.email) setEmail(picked.email);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const pickedOwner = ownerUserId ? users.find((u) => u.id === ownerUserId) : null;

      if (pickedOwner) {
        await grantClinicAccessToUser({
          userId: pickedOwner.id,
          userEmail: pickedOwner.email,
          newClinic: {
            name: name.trim(),
            type,
            city: city.trim() || undefined,
            directorName: directorName.trim() || pickedOwner.full_name || undefined,
          },
          roleInClinic: 'owner',
          planSlug: initialPlanSlug === 'none' ? null : initialPlanSlug,
          seatLimit: initialSeatLimit,
          durationDays: initialLifetime ? null : initialDurationDays,
          isLifetime: initialLifetime,
          grantReason: 'Clínica creada con Owner por SuperAdmin',
          protectedFromAutoDowngrade: true,
        });
      } else {
        const created = (await upsertClinic({
          name: name.trim(),
          type,
          city: city.trim() || null,
          tax_id: taxId.trim() || null,
          director_name: directorName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
        })) as { id?: string };

        if (created?.id && initialPlanSlug !== 'none') {
          const { grantSubscription, updateSubscription } = await import('../services/superAdminService');
          const res = (await grantSubscription({
            clinicId: created.id,
            planSlug: initialPlanSlug,
            billingInterval: initialLifetime ? 'lifetime' : 'custom',
            durationDays: initialLifetime ? null : initialDurationDays,
            isLifetime: initialLifetime,
            grantReason: 'Plan inicial asignado al crear clínica',
            protectedFromAutoDowngrade: true,
          })) as { subscription_id?: string };
          if (res?.subscription_id && initialSeatLimit !== 5) {
            await updateSubscription(res.subscription_id, { seat_limit: initialSeatLimit });
          }
        }
      }

      setFeedback(
        pickedOwner
          ? `Clínica "${name.trim()}" creada con ${pickedOwner.full_name || pickedOwner.email} como Propietario (Owner) y ${initialSeatLimit} asientos.`
          : `Clínica "${name.trim()}" creada correctamente.`
      );
      setName('');
      setCity('');
      setTaxId('');
      setDirectorName('');
      setEmail('');
      setPhone('');
      setOwnerUserId('');
      setOwnerSearch('');
      setShowCreate(false);
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la clínica.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickAssignOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignOwnerClinic || !quickOwnerUserId) return;
    const picked = users.find((u) => u.id === quickOwnerUserId);
    if (!picked) return;

    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await grantClinicAccessToUser({
        userId: picked.id,
        userEmail: picked.email,
        clinicId: assignOwnerClinic.id,
        roleInClinic: quickOwnerRole,
        planSlug: 'keep',
      });
      setFeedback(
        `${picked.full_name || picked.email} asignado como ${quickOwnerRole.toUpperCase()} en "${assignOwnerClinic.name}".`
      );
      setAssignOwnerClinic(null);
      setQuickOwnerUserId('');
      setQuickOwnerSearch('');
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'No se pudo asignar el propietario.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleClinicActive = async (c: ClinicSummaryRow) => {
    setBusy(true);
    setError(null);
    try {
      await upsertClinic({ id: c.id, is_active: !c.is_active });
      setFeedback(`Clínica "${c.name}" marcada como ${!c.is_active ? 'Activa' : 'Inactiva'}.`);
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar el estado de la clínica.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Clínicas Activas</p>
          <p className="text-2xl font-black mt-1">
            {stats.active} <span className="text-xs font-semibold text-slate-400">/ {stats.total}</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Con Plan Clínico</p>
          <p className="text-2xl font-black mt-1 text-primary">{stats.withPlan}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Miembros en Sedes</p>
          <p className="text-2xl font-black mt-1 text-teal-500">{stats.totalMembers}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pacientes Compartidos</p>
          <p className="text-2xl font-black mt-1">{stats.totalPatients}</p>
        </div>
      </div>

      {/* Header + Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar clínica por nombre, ciudad o director..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
        >
          <option value="all">Todos los tipos</option>
          {Object.entries(CLINIC_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto"
        >
          <span className="material-symbols-outlined text-base">{showCreate ? 'close' : 'add_business'}</span>
          {showCreate ? 'Cerrar Formulario' : 'Nueva Clínica + Owner'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 p-3 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
      {feedback && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Enhanced Create Clinic Wizard */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-primary/30 p-5 space-y-5 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h4 className="font-black text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_business</span>
                Crear Clínica y Asignar Propietario (Owner) + Plan en 1 paso
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Puedes vincular de inmediato un médico existente como Owner y definir cuántos usuarios podrá agregar.
              </p>
            </div>
          </div>

          {/* Step 1: Clinic Info */}
          <div className="space-y-2.5 text-xs">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">1. Datos de la Sede</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la clínica *"
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
              >
                {Object.entries(CLINIC_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ciudad (ej. Mérida / CDMX)"
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
              />
              <input
                value={directorName}
                onChange={(e) => setDirectorName(e.target.value)}
                placeholder="Director médico"
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo de contacto"
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono / RFC"
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
              />
            </div>
          </div>

          {/* Step 2: Existing User as Clinic Owner */}
          <div className="space-y-2.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-black uppercase tracking-wider text-teal-500">
              2. Propietario (Owner de Clínica) — Seleccionar Usuario Existente
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                  person_search
                </span>
                <input
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder="Filtrar usuarios registrados por nombre o correo..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <select
                value={ownerUserId}
                onChange={(e) => handleSelectOwnerInWizard(e.target.value)}
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
              >
                <option value="">(Opcional) Sin Owner por ahora — asignar después</option>
                {ownerCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || 'Sin nombre'} ({u.email || u.id.slice(0, 8)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Plan & Custom Seat Limit */}
          <div className="space-y-2.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              3. Plan Inicial y Límite de Usuarios (Asientos)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={initialPlanSlug}
                onChange={(e) => setInitialPlanSlug(e.target.value as any)}
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
              >
                <option value="premium_clinic">Premium Clínica (Acceso Total)</option>
                <option value="plus_clinic">Plus Clínica (Expedientes + Agenda)</option>
                <option value="none">Sin suscripción clínica aún</option>
              </select>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-500 shrink-0">Asientos:</span>
                {[5, 10, 20].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setInitialSeatLimit(n)}
                    className={`px-2 py-1.5 rounded-lg font-bold border cursor-pointer ${
                      initialSeatLimit === n
                        ? 'bg-primary text-white border-primary'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={initialSeatLimit}
                  onChange={(e) => setInitialSeatLimit(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-black text-center"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {[
                  { label: '90d', days: 90, lt: false },
                  { label: '1 año', days: 365, lt: false },
                  { label: 'Vitalicio', days: null, lt: true },
                ].map((d) => {
                  const active = d.lt ? initialLifetime : !initialLifetime && initialDurationDays === d.days;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => {
                        setInitialLifetime(d.lt);
                        setInitialDurationDays(d.days);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black shadow-md disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Creando...' : ownerUserId ? 'Crear Clínica + Asignar Owner' : 'Crear Clínica'}
            </button>
          </div>
        </form>
      )}

      {/* Clinics Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Clínica / Sede</th>
                <th className="py-3 px-3">Plan y Cupo</th>
                <th className="py-3 px-3">Equipo / Pacientes</th>
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Cargando clínicas...
                  </td>
                </tr>
              ) : filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No hay clínicas registradas con ese criterio.
                  </td>
                </tr>
              ) : (
                filteredClinics.map((c) => {
                  const seatLimit = c.active_subscription?.seat_limit;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{c.name}</p>
                        <p className="text-slate-400">
                          {CLINIC_TYPE_LABELS[c.type]}
                          {c.city ? ` · ${c.city}` : ''}
                          {c.director_name ? ` · Dir. ${c.director_name}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        {c.active_subscription ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-bold">
                              {c.active_subscription.plan_name}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Cupo: <strong>{c.members_count}</strong> / <strong>{seatLimit}</strong> asientos
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sin suscripción clínica</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={c.members_count === 0 ? 'text-amber-500 font-bold' : 'font-semibold'}>
                          {c.members_count} miembro(s)
                        </span>{' '}
                        · {c.patients_count} pacientes
                      </td>
                      <td className="py-3 px-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleClinicActive(c)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase cursor-pointer ${
                            c.is_active
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                              : 'bg-red-500/15 text-red-600 dark:text-red-300'
                          }`}
                        >
                          {c.is_active ? 'Activa' : 'Inactiva'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAssignOwnerClinic(c);
                              setQuickOwnerSearch('');
                              setQuickOwnerUserId('');
                              setQuickOwnerRole('owner');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 hover:bg-teal-600 hover:text-white font-bold transition-colors cursor-pointer"
                          >
                            + Owner / Miembro
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/super-admin/clinics/${c.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer"
                          >
                            Detalle Profundo
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Assign Owner Modal */}
      {assignOwnerClinic && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleQuickAssignOwner}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-base">Asignar Owner / Miembro</h4>
                <p className="text-slate-400">Clínica: {assignOwnerClinic.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignOwnerClinic(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Buscar usuario registrado</label>
                <input
                  value={quickOwnerSearch}
                  onChange={(e) => setQuickOwnerSearch(e.target.value)}
                  placeholder="Filtrar por nombre o correo..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Usuario *</label>
                <select
                  required
                  value={quickOwnerUserId}
                  onChange={(e) => setQuickOwnerUserId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                >
                  <option value="">Selecciona un usuario...</option>
                  {quickOwnerCandidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || 'Sin nombre'} ({u.email || u.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Puesto en la Clínica</label>
                <select
                  value={quickOwnerRole}
                  onChange={(e) => setQuickOwnerRole(e.target.value as any)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                >
                  <option value="owner">Owner (Propietario · Control total)</option>
                  <option value="director">Director Médico</option>
                  <option value="clinic_admin">Admin de Clínica</option>
                  <option value="specialist">Especialista</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignOwnerClinic(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy || !quickOwnerUserId}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Asignando...' : 'Asignar a Clínica'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClinicManagementTable;
