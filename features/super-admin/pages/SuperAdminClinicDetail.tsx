import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import WorkingHoursEditor, { DEFAULT_WORKING_HOURS } from '../components/WorkingHoursEditor';
import {
  ensureClinicMemberSeat,
  getClinicDetail,
  grantSubscription,
  listUsers,
  manageClinicMember,
  removeClinicMember,
  revokeSubscription,
  updateClinicSeatLimit,
  updateSubscription,
  upsertClinic,
  upsertClinicSchedule,
} from '../services/superAdminService';
import type { AdminUserRow, ClinicDetailData, ClinicSummaryRow, WorkingHoursMap } from '../types';

const CLINIC_TYPE_LABELS: Record<ClinicSummaryRow['type'], string> = {
  solo_practice: 'Consultorio Individual',
  clinic: 'Clínica Multi-especialista',
  hospital: 'Hospital',
  aesthetic_center: 'Centro Estético',
  rehab_center: 'Centro de Rehabilitación',
};

const ROLE_LABELS_CLINIC: Record<string, string> = {
  owner: 'Owner (Propietario)',
  director: 'Director Médico',
  clinic_admin: 'Admin Clínica',
  specialist: 'Especialista',
  assistant: 'Asistente',
};

const SuperAdminClinicDetail: React.FC = () => {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ClinicDetailData | null>(null);
  const [directoryUsers, setDirectoryUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'info' | 'schedule' | 'members' | 'billing'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Info state
  const [clinicName, setClinicName] = useState('');
  const [clinicType, setClinicType] = useState<ClinicSummaryRow['type']>('clinic');
  const [clinicCity, setClinicCity] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicEmail, setClinicEmail] = useState('');
  const [clinicTaxId, setClinicTaxId] = useState('');
  const [clinicLicense, setClinicLicense] = useState('');
  const [clinicDirector, setClinicDirector] = useState('');
  const [clinicActive, setClinicActive] = useState(true);

  // Schedule & holidays state
  const [workingHours, setWorkingHours] = useState<WorkingHoursMap>(DEFAULT_WORKING_HOURS);
  const [holidays, setHolidays] = useState<{ date: string; label: string }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(10);
  const [allowCrossView, setAllowCrossView] = useState(true);

  // Members picker state
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<
    'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant'
  >('owner');

  // Billing / Plan state
  const [clinicPlanSlug, setClinicPlanSlug] = useState('premium_clinic');
  const [clinicSeatLimit, setClinicSeatLimit] = useState(5);
  const [clinicDurationDays, setClinicDurationDays] = useState<number | null>(365);
  const [clinicLifetime, setClinicLifetime] = useState(false);
  const [clinicProtected, setClinicProtected] = useState(true);
  const [liveSeatDraft, setLiveSeatDraft] = useState(5);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const [d, u] = await Promise.all([getClinicDetail(clinicId), listUsers({ limit: 250 })]);
      setDetail(d);
      setDirectoryUsers(u);

      setClinicName(d.clinic.name || '');
      setClinicType(d.clinic.type || 'clinic');
      setClinicCity(d.clinic.city || '');
      setClinicAddress(d.clinic.address || '');
      setClinicPhone(d.clinic.phone || '');
      setClinicEmail(d.clinic.email || '');
      setClinicTaxId(d.clinic.tax_id || '');
      setClinicLicense(d.clinic.license_number || '');
      setClinicDirector(d.clinic.director_name || '');
      setClinicActive(d.clinic.is_active ?? true);

      if (d.configuration?.working_hours) setWorkingHours(d.configuration.working_hours);
      setHolidays(Array.isArray(d.configuration?.holidays) ? d.configuration.holidays : []);
      setDuration(d.configuration?.default_appointment_duration ?? 30);
      setBuffer(d.configuration?.buffer_minutes ?? 10);
      setAllowCrossView(d.configuration?.allow_cross_doctor_patient_view ?? true);

      const activeSub = d.subscriptions.find((s) => s.status === 'active' || s.status === 'trialing');
      if (activeSub) {
        setLiveSeatDraft(activeSub.seat_limit || 5);
        setClinicSeatLimit(activeSub.seat_limit || 5);
        setClinicPlanSlug(activeSub.plan_slug || 'premium_clinic');
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la clínica.');
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeSub = useMemo(
    () => detail?.subscriptions.find((s) => s.status === 'active' || s.status === 'trialing') || null,
    [detail]
  );

  const activeMembers = useMemo(
    () => (detail?.members || []).filter((m) => m.is_active),
    [detail]
  );

  const owners = useMemo(
    () => activeMembers.filter((m) => m.role_in_clinic === 'owner'),
    [activeMembers]
  );

  const filteredDirectoryUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    const memberIds = new Set(activeMembers.map((m) => m.user_id));
    return directoryUsers
      .filter((u) => {
        if (!u.email) return false;
        if (!q) return true;
        return `${u.full_name || ''} ${u.email} ${u.specialty || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => Number(memberIds.has(a.id)) - Number(memberIds.has(b.id)))
      .slice(0, 60);
  }, [directoryUsers, memberSearch, activeMembers]);

  const handleSaveInfo = async () => {
    if (!clinicId) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await upsertClinic({
        id: clinicId,
        name: clinicName.trim(),
        type: clinicType,
        city: clinicCity.trim() || null,
        address: clinicAddress.trim() || null,
        phone: clinicPhone.trim() || null,
        email: clinicEmail.trim() || null,
        tax_id: clinicTaxId.trim() || null,
        license_number: clinicLicense.trim() || null,
        director_name: clinicDirector.trim() || null,
        is_active: clinicActive,
      });
      setFeedback('Ficha general de la clínica guardada correctamente.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error guardando clínica.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!clinicId) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await upsertClinicSchedule({
        clinicId,
        workingHours,
        holidays,
        duration,
        buffer,
        allowCrossView,
      });
      setFeedback('Horarios operativos y días festivos actualizados.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error guardando horarios.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) return;
    const next = [...holidays.filter((h) => h.date !== newHolidayDate), {
      date: newHolidayDate,
      label: newHolidayLabel.trim() || 'Día inhábil',
    }].sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(next);
    setNewHolidayDate('');
    setNewHolidayLabel('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !selectedUserEmail.trim()) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await manageClinicMember({
        clinicId,
        userEmail: selectedUserEmail.trim(),
        roleInClinic: newMemberRole,
        status: 'approved',
        isActive: true,
      });

      const matchedUser = directoryUsers.find(
        (u) => u.email?.toLowerCase() === selectedUserEmail.trim().toLowerCase()
      );
      if (matchedUser) {
        await ensureClinicMemberSeat(clinicId, matchedUser.id);
      }

      setSelectedUserEmail('');
      setMemberSearch('');
      setFeedback(`Miembro agregado como ${ROLE_LABELS_CLINIC[newMemberRole]} con asiento clínico activo.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error agregando miembro.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeMemberRole = async (
    email: string | null,
    role: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant'
  ) => {
    if (!clinicId || !email) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await manageClinicMember({
        clinicId,
        userEmail: email,
        roleInClinic: role,
        status: 'approved',
        isActive: true,
      });
      setFeedback(`Puesto actualizado a ${ROLE_LABELS_CLINIC[role]}.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error cambiando puesto.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string, label: string) => {
    if (!clinicId) return;
    if (!window.confirm(`¿Desvincular a ${label} de esta clínica y liberar su asiento?`)) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await removeClinicMember(clinicId, userId);
      setFeedback(`${label} desvinculado de la clínica.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error desvinculando miembro.');
    } finally {
      setBusy(false);
    }
  };

  const handleGrantClinicPlan = async () => {
    if (!clinicId) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      const granted = (await grantSubscription({
        clinicId,
        planSlug: clinicPlanSlug,
        billingInterval: clinicLifetime ? 'lifetime' : 'custom',
        durationDays: clinicLifetime ? null : clinicDurationDays,
        isLifetime: clinicLifetime,
        grantReason: 'Plan clínico asignado por SuperAdmin',
        protectedFromAutoDowngrade: clinicProtected,
      })) as { subscription_id?: string };

      if (granted?.subscription_id && clinicSeatLimit >= 1) {
        await updateSubscription(granted.subscription_id, { seat_limit: clinicSeatLimit });
      }
      setFeedback(`Suscripción clínica asignada correctamente (${clinicSeatLimit} asientos).`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error asignando plan clínico.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateLiveSeats = async () => {
    if (!clinicId) return;
    setBusy(true);
    setFeedback(null);
    setError(null);
    try {
      await updateClinicSeatLimit(clinicId, liveSeatDraft);
      setFeedback(`Cupo de asientos de la clínica actualizado a ${liveSeatDraft} usuarios.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error actualizando cupo de asientos.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  const seatLimit = activeSub?.seat_limit || 0;
  const seatPct = seatLimit > 0 ? Math.min(100, Math.round((activeMembers.length / seatLimit) * 100)) : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header with breadcrumbs & badges */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/super-admin?tab=clinics')}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-colors cursor-pointer"
              title="Volver a Clínicas y Horarios"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight">{detail?.clinic.name || 'Clínica'}</h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-primary/15 text-primary">
                  {CLINIC_TYPE_LABELS[clinicType] || clinicType}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    detail?.clinic.is_active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : 'bg-red-500/15 text-red-600 dark:text-red-300'
                  }`}
                >
                  {detail?.clinic.is_active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                SuperAdmin / Clínicas / {detail?.clinic.city || 'Sin ciudad'}
                {owners.length > 0
                  ? ` · Owner: ${owners[0].full_name || owners[0].email}`
                  : ' · Sin Owner asignado aún'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Actualizar
          </button>
        </div>

        {/* Polished dark-mode alert banners */}
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 p-3.5 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}
        {feedback && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{feedback}</span>
            </div>
            <button type="button" onClick={() => setFeedback(null)}>
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Resumen', icon: 'dashboard' },
            { id: 'info', label: 'Ficha General', icon: 'domain' },
            { id: 'schedule', label: 'Horarios y Festivos', icon: 'schedule' },
            { id: 'members', label: `Equipo y Owner (${activeMembers.length})`, icon: 'group' },
            { id: 'billing', label: 'Plan y Asientos', icon: 'card_membership' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                tab === t.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-primary/40'
              }`}
            >
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: RESUMEN */}
        {tab === 'overview' && detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Miembros / Asientos</p>
                <p className="text-3xl font-black mt-1">
                  {activeMembers.length}
                  {seatLimit > 0 && <span className="text-sm font-bold text-slate-400"> / {seatLimit}</span>}
                </p>
                {seatLimit > 0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${seatPct}%` }} />
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Pacientes Sede</p>
                <p className="text-3xl font-black mt-1">{detail.patients_count}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {allowCrossView ? 'Compartidos entre médicos' : 'Privados por médico'}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Aplicaciones Toxina</p>
                <p className="text-3xl font-black mt-1">{detail.treatments_count}</p>
                <p className="text-[11px] text-slate-400 mt-1">Sesiones registradas</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Plan Activo</p>
                <p className="text-base font-black mt-1.5 text-primary">
                  {activeSub ? activeSub.plan_name : 'Sin plan activo'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeSub?.current_period_end
                    ? `Vence: ${new Date(activeSub.current_period_end).toLocaleDateString('es-MX')}`
                    : activeSub
                    ? 'Sin vencimiento'
                    : 'Asigna un plan en Plan y Asientos'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-500">workspace_premium</span>
                    Propietario (Owner) y Liderazgo
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab('members')}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Gestionar Equipo →
                  </button>
                </div>
                {owners.length === 0 ? (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-amber-600 dark:text-amber-300">Esta clínica aún no tiene Owner</p>
                      <p className="text-[11px] text-slate-400">
                        Asigna un usuario existente como Propietario para que pueda administrar su equipo y horarios.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewMemberRole('owner');
                        setTab('members');
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
                    >
                      Asignar Owner
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {owners.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                      >
                        <div>
                          <p className="font-bold">{o.full_name || o.email}</p>
                          <p className="text-slate-400">{o.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-300 font-black uppercase text-[10px]">
                          OWNER
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">info</span>
                    Información y Operación
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTab('info')}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Editar Ficha →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-500">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">Director</span>
                    <strong className="text-slate-800 dark:text-slate-200">{clinicDirector || '—'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">Ciudad</span>
                    <strong className="text-slate-800 dark:text-slate-200">{clinicCity || '—'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">RFC / Fiscal</span>
                    <strong className="text-slate-800 dark:text-slate-200">{clinicTaxId || '—'}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-400">Citas / Buffer</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {duration} min · +{buffer} min · {holidays.length} festivo(s)
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FICHA GENERAL */}
        {tab === 'info' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Nombre de la Clínica *</label>
                <input
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Tipo de Sede</label>
                <select
                  value={clinicType}
                  onChange={(e) => setClinicType(e.target.value as any)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold"
                >
                  {Object.entries(CLINIC_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Ciudad</label>
                <input
                  value={clinicCity}
                  onChange={(e) => setClinicCity(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Dirección</label>
                <input
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  placeholder="Calle, número, colonia..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Teléfono</label>
                <input
                  value={clinicPhone}
                  onChange={(e) => setClinicPhone(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={clinicEmail}
                  onChange={(e) => setClinicEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">RFC / Tax ID</label>
                <input
                  value={clinicTaxId}
                  onChange={(e) => setClinicTaxId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Licencia Sanitaria / COFEPRIS</label>
                <input
                  value={clinicLicense}
                  onChange={(e) => setClinicLicense(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Director Médico</label>
                <input
                  value={clinicDirector}
                  onChange={(e) => setClinicDirector(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer">
                  <span>Clínica activa en plataforma</span>
                  <input
                    type="checkbox"
                    checked={clinicActive}
                    onChange={(e) => setClinicActive(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveInfo}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black cursor-pointer"
            >
              {busy ? 'Guardando...' : 'Guardar Ficha General'}
            </button>
          </div>
        )}

        {/* TAB 3: HORARIOS Y FESTIVOS */}
        {tab === 'schedule' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />

            <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <label className="flex items-center gap-2 font-bold">
                <span>Duración cita (min):</span>
                <input
                  type="number"
                  min={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 30)}
                  className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2 font-bold">
                <span>Buffer (min):</span>
                <input
                  type="number"
                  min={0}
                  value={buffer}
                  onChange={(e) => setBuffer(Number(e.target.value) || 0)}
                  className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCrossView}
                  onChange={(e) => setAllowCrossView(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Compartir expedientes entre médicos de esta sede
              </label>
            </div>

            {/* Clinic Holidays Management */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <h4 className="font-black text-sm">Días Festivos / Cierres Programados ({holidays.length})</h4>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                />
                <input
                  value={newHolidayLabel}
                  onChange={(e) => setNewHolidayLabel(e.target.value)}
                  placeholder="Motivo (ej. Año Nuevo, Congreso...)"
                  className="flex-1 min-w-[180px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={handleAddHoliday}
                  disabled={!newHolidayDate}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white font-bold disabled:opacity-40 cursor-pointer"
                >
                  + Agregar Festivo
                </button>
              </div>
              {holidays.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {holidays.map((h) => (
                    <span
                      key={h.date}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold"
                    >
                      <span>{h.date}</span>
                      <span className="text-slate-400">· {h.label}</span>
                      <button
                        type="button"
                        onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))}
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleSaveSchedule}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black cursor-pointer"
            >
              {busy ? 'Guardando...' : 'Guardar Horarios y Festivos'}
            </button>
          </div>
        )}

        {/* TAB 4: EQUIPO Y OWNER (WITH SEARCHABLE USER PICKER!) */}
        {tab === 'members' && detail && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <form onSubmit={handleAddMember} className="space-y-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div>
                <h4 className="font-black text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">person_add</span>
                  Asignar Usuario Existente como Owner o Miembro de Clínica
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Busca entre los usuarios registrados en SonoTox o escribe su correo; se le asignará asiento clínico automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                    search
                  </span>
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Buscar usuario por nombre, correo o especialidad..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <select
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                >
                  <option value="">Selecciona un usuario existente ({filteredDirectoryUsers.length})...</option>
                  {filteredDirectoryUsers.map((u) => {
                    const alreadyIn = activeMembers.some((m) => m.user_id === u.id);
                    return (
                      <option key={u.id} value={u.email || ''}>
                        {u.full_name || 'Sin nombre'} ({u.email}){alreadyIn ? ' — ya es miembro' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <input
                  type="email"
                  required
                  value={selectedUserEmail}
                  onChange={(e) => setSelectedUserEmail(e.target.value)}
                  placeholder="O escribe correo@medico.com manualmente..."
                  className="flex-1 min-w-[200px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                >
                  <option value="owner">Owner (Propietario)</option>
                  <option value="director">Director Médico</option>
                  <option value="clinic_admin">Admin Clínica</option>
                  <option value="specialist">Especialista</option>
                  <option value="assistant">Asistente</option>
                </select>
                <button
                  type="submit"
                  disabled={busy || !selectedUserEmail.trim()}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-black disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Agregando...' : 'Agregar Miembro'}
                </button>
              </div>
            </form>

            {/* Member List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {activeMembers.length === 0 ? (
                <div className="py-10 text-center text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-1 block">group_off</span>
                  Aún no hay miembros en esta clínica. Selecciona arriba un usuario existente como <strong>Owner</strong>.
                </div>
              ) : (
                activeMembers.map((m) => (
                  <div key={m.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm">{m.full_name || m.email}</p>
                        {m.role_in_clinic === 'owner' && (
                          <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-300 font-black uppercase text-[10px]">
                            OWNER
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400">
                        {m.email} · {m.specialty || 'Sin especialidad'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role_in_clinic}
                        disabled={busy}
                        onChange={(e) => handleChangeMemberRole(m.email, e.target.value as any)}
                        className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold"
                      >
                        <option value="owner">Owner (Propietario)</option>
                        <option value="director">Director</option>
                        <option value="clinic_admin">Admin Clínica</option>
                        <option value="specialist">Especialista</option>
                        <option value="assistant">Asistente</option>
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemoveMember(m.user_id, m.full_name || m.email || 'este miembro')}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold transition-colors cursor-pointer"
                      >
                        Desvincular
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SUSCRIPCIÓN Y ASIENTOS DE LA CLÍNICA */}
        {tab === 'billing' && detail && (
          <div className="space-y-4 text-xs">
            {activeSub && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-primary/30 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary">
                    Suscripción Clínica Activa
                  </span>
                  <h4 className="text-base font-black mt-0.5">{activeSub.plan_name}</h4>
                  <p className="text-slate-400">
                    Estado: <strong className="uppercase">{activeSub.status}</strong> · Origen: {activeSub.origin} ·
                    Vencimiento:{' '}
                    {activeSub.current_period_end
                      ? new Date(activeSub.current_period_end).toLocaleDateString('es-MX')
                      : 'Sin vencimiento'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-500">Cupo de asientos:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={liveSeatDraft}
                    onChange={(e) => setLiveSeatDraft(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-black text-center"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUpdateLiveSeats}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-bold cursor-pointer"
                  >
                    Actualizar Asientos
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm('¿Revocar la suscripción activa de esta clínica?')) return;
                      setBusy(true);
                      try {
                        await revokeSubscription(activeSub.id, 'Revocada desde Detalle de Clínica');
                        setFeedback('Suscripción clínica revocada.');
                        await load();
                      } catch (err: any) {
                        setError(err?.message || 'Error revocando suscripción.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold cursor-pointer"
                  >
                    Revocar
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h4 className="font-black text-sm">Asignar / Cambiar Plan Clínico y Límite de Usuarios</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Plan</label>
                  <select
                    value={clinicPlanSlug}
                    onChange={(e) => setClinicPlanSlug(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                  >
                    <option value="premium_clinic">Premium Clínica (Guías USG + Protocolos)</option>
                    <option value="plus_clinic">Plus Clínica (Expedientes + Agenda)</option>
                    <option value="free">Sin plan clínico (Degradar a Free)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">
                    Asientos / Usuarios agregados permitidos
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[5, 10, 20, 50].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setClinicSeatLimit(n)}
                        className={`px-2.5 py-2 rounded-xl font-bold border cursor-pointer ${
                          clinicSeatLimit === n
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
                      value={clinicSeatLimit}
                      onChange={(e) => setClinicSeatLimit(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2 font-black text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-500">Vigencia:</span>
                {[
                  { label: '30 días', days: 30, lt: false },
                  { label: '90 días', days: 90, lt: false },
                  { label: '6 meses', days: 180, lt: false },
                  { label: '1 año', days: 365, lt: false },
                  { label: 'Vitalicio', days: null, lt: true },
                ].map((d) => {
                  const active = d.lt ? clinicLifetime : !clinicLifetime && clinicDurationDays === d.days;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => {
                        setClinicLifetime(d.lt);
                        setClinicDurationDays(d.days);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
                <label className="ml-auto flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clinicProtected}
                    onChange={(e) => setClinicProtected(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Proteger contra cobro automático
                </label>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGrantClinicPlan}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black cursor-pointer"
              >
                {busy ? 'Asignando...' : `Asignar Plan (${clinicSeatLimit} asientos)`}
              </button>

              {detail.subscriptions.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Historial de Suscripciones</p>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {detail.subscriptions.map((s) => (
                      <div key={s.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                        <span className="font-bold">
                          {s.plan_name} ({s.seat_limit} asientos)
                        </span>
                        <span className="uppercase font-bold text-slate-400">
                          {s.status} · {s.origin} · {new Date(s.created_at).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminClinicDetail;
