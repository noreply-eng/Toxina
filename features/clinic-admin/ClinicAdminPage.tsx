import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/PageContainer';
import { useEntitlements } from '../entitlements/EntitlementContext';
import { ORIGIN_LABELS, TIER_LABELS } from '../entitlements/planCatalog';
import WorkingHoursEditor, { DEFAULT_WORKING_HOURS } from '../super-admin/components/WorkingHoursEditor';
import type { ClinicSummaryRow, WorkingHoursMap } from '../super-admin/types';
import {
  addOrUpdateOwnClinicMember,
  fetchClinicAdminDetail,
  removeOwnClinicMember,
  updateOwnClinicInfo,
  updateOwnClinicSchedule,
  type ClinicAdminDetail,
} from './clinicAdminService';

type ClinicTab = 'overview' | 'info' | 'schedule' | 'team' | 'plan';

const CLINIC_TYPE_LABELS: Record<ClinicSummaryRow['type'], string> = {
  solo_practice: 'Consultorio Individual',
  clinic: 'Clínica Multi-especialista',
  hospital: 'Hospital',
  aesthetic_center: 'Centro Estético',
  rehab_center: 'Centro de Rehabilitación',
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner (Propietario)',
  director: 'Director Médico',
  clinic_admin: 'Admin Clínica',
  specialist: 'Especialista',
  assistant: 'Asistente',
};

const ClinicAdminPage: React.FC = () => {
  const { clinicId: routeClinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const { entitlements, refresh: refreshEntitlements } = useEntitlements();

  const managedClinics = entitlements.clinics.filter((c) =>
    ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
  );
  const activeClinicId = routeClinicId || managedClinics[0]?.clinic_id || '';

  const [detail, setDetail] = useState<ClinicAdminDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<ClinicTab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Clinic general fields
  const [name, setName] = useState('');
  const [type, setType] = useState<ClinicSummaryRow['type']>('clinic');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [directorName, setDirectorName] = useState('');

  // Operational schedule & holidays
  const [workingHours, setWorkingHours] = useState<WorkingHoursMap>(DEFAULT_WORKING_HOURS);
  const [holidays, setHolidays] = useState<{ date: string; label: string }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(10);
  const [allowCrossView, setAllowCrossView] = useState(true);

  // Team member form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<
    'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant'
  >('specialist');

  const load = useCallback(async () => {
    if (!activeClinicId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await fetchClinicAdminDetail(activeClinicId);
      setDetail(d);
      setName(d.clinic.name || '');
      setType(d.clinic.type || 'clinic');
      setCity(d.clinic.city || '');
      setAddress(d.clinic.address || '');
      setPhone(d.clinic.phone || '');
      setEmail(d.clinic.email || '');
      setTaxId(d.clinic.tax_id || '');
      setLicenseNumber(d.clinic.license_number || '');
      setDirectorName(d.clinic.director_name || '');

      if (d.configuration?.working_hours) setWorkingHours(d.configuration.working_hours);
      setHolidays(Array.isArray(d.configuration?.holidays) ? d.configuration.holidays : []);
      setDuration(d.configuration?.default_appointment_duration ?? 30);
      setBuffer(d.configuration?.buffer_minutes ?? 10);
      setAllowCrossView(d.configuration?.allow_cross_doctor_patient_view ?? true);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la configuración de tu clínica.');
    } finally {
      setLoading(false);
    }
  }, [activeClinicId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClinicId || !name.trim()) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await updateOwnClinicInfo(activeClinicId, {
        name: name.trim(),
        type,
        city: city.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        tax_id: taxId.trim() || null,
        license_number: licenseNumber.trim() || null,
        director_name: directorName.trim() || null,
      });
      setFeedback('Datos generales de tu clínica guardados correctamente.');
      await Promise.all([load(), refreshEntitlements()]);
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la información de la clínica.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!activeClinicId) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await updateOwnClinicSchedule({
        clinicId: activeClinicId,
        workingHours,
        holidays,
        duration,
        buffer,
        allowCrossView,
      });
      setFeedback('Horarios operativos, días festivos y privacidad entre médicos actualizados.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudieron guardar los horarios.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) return;
    const next = [
      ...holidays.filter((h) => h.date !== newHolidayDate),
      { date: newHolidayDate, label: newHolidayLabel.trim() || 'Día inhábil' },
    ].sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(next);
    setNewHolidayDate('');
    setNewHolidayLabel('');
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClinicId || !inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await addOrUpdateOwnClinicMember({
        clinicId: activeClinicId,
        userEmail: inviteEmail.trim(),
        roleInClinic: inviteRole,
        isActive: true,
      });
      setInviteEmail('');
      setFeedback('Integrante agregado y asiento asignado en tu clínica.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo agregar al integrante.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangeMemberRole = async (
    memberEmail: string | null,
    nextRole: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant'
  ) => {
    if (!activeClinicId || !memberEmail) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await addOrUpdateOwnClinicMember({
        clinicId: activeClinicId,
        userEmail: memberEmail,
        roleInClinic: nextRole,
        isActive: true,
      });
      setFeedback(`Puesto actualizado a ${ROLE_LABELS[nextRole]}.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar el puesto.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (userId: string, label: string) => {
    if (!activeClinicId) return;
    if (!window.confirm(`¿Desvincular a ${label} de tu clínica y liberar su asiento?`)) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await removeOwnClinicMember(activeClinicId, userId);
      setFeedback(`${label} fue desvinculado y su asiento quedó disponible.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo desvincular al integrante.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!activeClinicId) {
    return (
      <PageContainer maxWidth="max-w-3xl" className="py-12">
        <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-slate-400">local_hospital</span>
          <h2 className="text-xl font-black">No administras ninguna clínica todavía</h2>
          <p className="text-sm text-text-muted">
            Cuando seas designado Owner, Director o Administrador de una clínica podrás configurar aquí sus datos, horarios y equipo.
          </p>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer"
          >
            Volver a Ajustes
          </button>
        </div>
      </PageContainer>
    );
  }

  const activeSub = detail?.active_subscription;
  const seatLimit = activeSub?.seat_limit ?? 0;
  const membersCount = detail?.members.length ?? 0;
  const seatPct = seatLimit > 0 ? Math.min(100, Math.round((membersCount / seatLimit) * 100)) : 0;
  const currentMembership = managedClinics.find((c) => c.clinic_id === activeClinicId);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32 lg:pb-12 overflow-y-auto no-scrollbar">
      <header className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60">
        <PageContainer maxWidth="max-w-5xl" className="pt-12 lg:pt-6 pb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="mr-1 rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Volver a Ajustes"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                    {detail?.clinic.name || currentMembership?.name || 'Mi Clínica'}
                  </h1>
                  {currentMembership && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-teal-500/15 text-teal-700 dark:text-teal-300">
                      {currentMembership.role_in_clinic}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">
                  Configuración de Sede, Horarios, Equipo Médico y Asientos
                </p>
              </div>
            </div>

            {managedClinics.length > 1 && (
              <select
                value={activeClinicId}
                onChange={(e) => navigate(`/clinic-admin/${e.target.value}`)}
                className="rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
              >
                {managedClinics.map((c) => (
                  <option key={c.clinic_id} value={c.clinic_id}>
                    {c.name} ({c.role_in_clinic})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: 'overview', label: 'Resumen', icon: 'dashboard' },
              { id: 'info', label: 'Datos de Clínica', icon: 'domain' },
              { id: 'schedule', label: 'Horarios y Agenda', icon: 'schedule' },
              { id: 'team', label: `Equipo y Asientos (${membersCount}${seatLimit ? `/${seatLimit}` : ''})`, icon: 'group' },
              { id: 'plan', label: 'Mi Plan Clínico', icon: 'verified' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as ClinicTab)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  tab === t.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-primary/40'
                }`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </PageContainer>
      </header>

      <main className="flex-1">
        <PageContainer maxWidth="max-w-5xl" className="space-y-5 pt-6">
          {error && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="cursor-pointer">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {feedback && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{feedback}</span>
              </div>
              <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          )}

          {/* TAB 1: RESUMEN */}
          {tab === 'overview' && detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Equipo / Asientos
                  </p>
                  <p className="text-3xl font-black mt-1">
                    {membersCount}
                    {seatLimit > 0 && <span className="text-sm font-bold text-text-muted"> / {seatLimit}</span>}
                  </p>
                  {seatLimit > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${seatPct}%` }} />
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Pacientes de Sede
                  </p>
                  <p className="text-3xl font-black mt-1">{detail.patients_count}</p>
                  <p className="text-[11px] text-text-muted mt-1">
                    {allowCrossView ? 'Compartidos entre tu equipo' : 'Privados por médico'}
                  </p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Aplicaciones Toxina
                  </p>
                  <p className="text-3xl font-black mt-1">{detail.treatments_count}</p>
                  <p className="text-[11px] text-text-muted mt-1">Sesiones en sede</p>
                </div>

                <div className="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Plan Activo
                  </p>
                  <p className="text-base font-black text-primary mt-1.5">
                    {activeSub ? activeSub.plan_name : 'Sin plan de clínica'}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1">
                    {activeSub?.current_period_end
                      ? `Vigente hasta ${new Date(activeSub.current_period_end).toLocaleDateString('es-MX')}`
                      : activeSub
                      ? 'Sin vencimiento automático'
                      : 'Contacta administración'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    tab: 'info' as ClinicTab,
                    title: 'Editar Datos de Clínica',
                    desc: 'Nombre, dirección, RFC, COFEPRIS y contacto',
                    icon: 'domain',
                  },
                  {
                    tab: 'schedule' as ClinicTab,
                    title: 'Configurar Horarios',
                    desc: `${duration} min/cita · ${holidays.length} festivo(s) · Expedientes compartidos`,
                    icon: 'schedule',
                  },
                  {
                    tab: 'team' as ClinicTab,
                    title: 'Agregar Médicos / Asistentes',
                    desc: `${Math.max(seatLimit - membersCount, 0)} asiento(s) disponible(s)`,
                    icon: 'person_add',
                  },
                ].map((card) => (
                  <button
                    key={card.tab}
                    type="button"
                    onClick={() => setTab(card.tab)}
                    className="text-left rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 hover:border-primary/50 p-5 transition-all cursor-pointer space-y-2"
                  >
                    <span className="material-symbols-outlined text-primary text-2xl">{card.icon}</span>
                    <p className="font-black text-sm">{card.title}</p>
                    <p className="text-xs text-text-muted">{card.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: DATOS DE LA CLÍNICA */}
          {tab === 'info' && (
            <form
              onSubmit={handleSaveInfo}
              className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-6 space-y-4 text-xs"
            >
              <h2 className="text-base font-black">Información General y Fiscal de la Clínica</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-text-muted mb-1">Nombre de la Clínica *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted mb-1">Tipo de Sede</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold"
                  >
                    {Object.entries(CLINIC_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-text-muted mb-1">Ciudad</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. Mérida / CDMX / Monterrey"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted mb-1">Dirección completa</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, número, colonia, C.P."
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted mb-1">Teléfono de recepción</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted mb-1">Correo de contacto</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-text-muted mb-1">Director Médico / Responsable</label>
                  <input
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-text-muted mb-1">RFC / Tax ID</label>
                    <input
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-text-muted mb-1">Aviso COFEPRIS</label>
                    <input
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Guardando...' : 'Guardar Datos de la Clínica'}
              </button>
            </form>
          )}

          {/* TAB 3: HORARIOS Y FESTIVOS */}
          {tab === 'schedule' && (
            <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-6 space-y-5 text-xs">
              <div>
                <h2 className="text-base font-black">Horarios de Operación y Reglas de Agenda</h2>
                <p className="text-text-muted mt-0.5">
                  Define los horarios de apertura, descanso, duración de consulta y visibilidad de expedientes entre médicos de la clínica.
                </p>
              </div>

              <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />

              <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 font-bold">
                  <span>Duración cita (min):</span>
                  <input
                    type="number"
                    min={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value) || 30)}
                    className="w-20 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2 font-bold">
                  <span>Buffer entre citas (min):</span>
                  <input
                    type="number"
                    min={0}
                    value={buffer}
                    onChange={(e) => setBuffer(Number(e.target.value) || 0)}
                    className="w-20 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowCrossView}
                    onChange={(e) => setAllowCrossView(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Compartir expedientes entre médicos de esta clínica
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h3 className="font-black text-sm">Días Inhábiles / Festivos ({holidays.length})</h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                  />
                  <input
                    value={newHolidayLabel}
                    onChange={(e) => setNewHolidayLabel(e.target.value)}
                    placeholder="Motivo (ej. Día festivo, Congreso médico...)"
                    className="flex-1 min-w-[180px] rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleAddHoliday}
                    disabled={!newHolidayDate}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white font-bold disabled:opacity-40 cursor-pointer"
                  >
                    + Agregar Fecha
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
                        <span className="text-text-muted">· {h.label}</span>
                        <button
                          type="button"
                          onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))}
                          className="text-red-500 font-black cursor-pointer"
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
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Guardando...' : 'Guardar Horarios y Reglas'}
              </button>
            </div>
          )}

          {/* TAB 4: EQUIPO Y ASIENTOS */}
          {tab === 'team' && detail && (
            <div className="space-y-4 text-xs">
              <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black">Equipo Médico y Asientos de Suscripción</h2>
                    <p className="text-text-muted mt-0.5">
                      Cada miembro activo ocupa 1 asiento de tu clínica y hereda las funciones de{' '}
                      <strong>{activeSub?.plan_name || 'tu plan clínico'}</strong>.
                    </p>
                  </div>
                  {seatLimit > 0 && (
                    <div className="px-3.5 py-2 rounded-xl bg-primary/10 text-primary font-black text-sm">
                      {membersCount} / {seatLimit} asientos ocupados
                    </div>
                  )}
                </div>

                {seatLimit > 0 && (
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${seatPct}%` }} />
                  </div>
                )}

                <form onSubmit={handleInviteMember} className="flex flex-wrap gap-2 pt-2">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Correo del médico o asistente registrado en SonoTox..."
                    className="flex-1 min-w-[220px] rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                  >
                    <option value="specialist">Especialista</option>
                    <option value="assistant">Asistente</option>
                    <option value="clinic_admin">Admin Clínica</option>
                    <option value="director">Director Médico</option>
                    <option value="owner">Co-Owner</option>
                  </select>
                  <button
                    type="submit"
                    disabled={busy || (seatLimit > 0 && membersCount >= seatLimit)}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Agregando...' : '+ Agregar Miembro'}
                  </button>
                </form>

                {seatLimit > 0 && membersCount >= seatLimit && (
                  <p className="text-amber-600 dark:text-amber-400 font-bold">
                    Alcanzaste el límite de {seatLimit} asientos. Libera un asiento o solicita ampliación de cupo a administración.
                  </p>
                )}

                <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2">
                  {detail.members.length === 0 ? (
                    <p className="py-6 text-center text-text-muted">Aún no hay otros miembros registrados.</p>
                  ) : (
                    detail.members.map((m) => {
                      const isSelf = m.user_id === entitlements.user_id;
                      return (
                        <div key={m.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm">{m.full_name || m.email || 'Usuario'}</p>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase">
                                  Tú
                                </span>
                              )}
                              {m.role_in_clinic === 'owner' && (
                                <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-black uppercase">
                                  OWNER
                                </span>
                              )}
                            </div>
                            <p className="text-text-muted">
                              {m.email || m.user_id.slice(0, 8)}
                              {m.specialty ? ` · ${m.specialty}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={m.role_in_clinic}
                              disabled={busy || isSelf}
                              onChange={(e) => handleChangeMemberRole(m.email, e.target.value as any)}
                              className="rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold disabled:opacity-60"
                            >
                              <option value="owner">Owner</option>
                              <option value="director">Director Médico</option>
                              <option value="clinic_admin">Admin Clínica</option>
                              <option value="specialist">Especialista</option>
                              <option value="assistant">Asistente</option>
                            </select>
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRemoveMember(m.user_id, m.full_name || m.email || 'este miembro')}
                                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white font-bold cursor-pointer"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MI PLAN CLÍNICO (STATUS ONLY — NO FORCED SALES GRID) */}
          {tab === 'plan' && (
            <div className="rounded-3xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-slate-800 p-6 space-y-5">
              {activeSub ? (
                <div className="rounded-2xl bg-gradient-to-br from-primary via-teal-600 to-cyan-700 text-white p-6 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/75">
                        Suscripción de Clínica Activa
                      </p>
                      <h2 className="text-2xl font-black mt-1">{activeSub.plan_name}</h2>
                      <p className="text-xs text-white/85 mt-1">
                        Nivel: <strong>{TIER_LABELS[activeSub.tier]}</strong> · Origen:{' '}
                        <strong>{ORIGIN_LABELS[activeSub.origin] || activeSub.origin}</strong>
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-black uppercase">
                      {activeSub.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="rounded-xl bg-white/15 p-3">
                      <span className="block text-white/75 text-[10px] uppercase font-bold">Asientos Incluidos</span>
                      <strong className="text-lg font-black">
                        {membersCount} / {activeSub.seat_limit}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white/15 p-3">
                      <span className="block text-white/75 text-[10px] uppercase font-bold">Vigencia</span>
                      <strong className="text-sm font-black">
                        {activeSub.current_period_end
                          ? new Date(activeSub.current_period_end).toLocaleDateString('es-MX')
                          : 'Sin vencimiento'}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-white/15 p-3 col-span-2 sm:col-span-1">
                      <span className="block text-white/75 text-[10px] uppercase font-bold">Modalidad</span>
                      <strong className="text-sm font-black capitalize">{activeSub.billing_interval}</strong>
                    </div>
                  </div>
                  {activeSub.grant_reason && (
                    <p className="text-xs bg-black/20 rounded-xl px-3 py-2 inline-block">
                      Nota: {activeSub.grant_reason}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-100 dark:bg-slate-800/60 p-6 text-center space-y-2">
                  <p className="font-black text-base">Esta clínica no tiene un plan grupal activo</p>
                  <p className="text-xs text-text-muted">
                    Puedes activar un plan de clínica o solicitar la asignación de asientos al administrador.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <p className="text-text-muted">
                  ¿Necesitas ampliar el número de asientos o canjear un cupón?
                </p>
                <div className="flex gap-2">
                  <a
                    href="mailto:contacto@deepluxmed.mx?subject=Ampliar%20asientos%20cl%C3%ADnica%20SonoTox"
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Solicitar Más Asientos
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate('/subscription')}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:border-primary cursor-pointer"
                  >
                    Ver Catálogo y Cupones
                  </button>
                </div>
              </div>
            </div>
          )}
        </PageContainer>
      </main>
    </div>
  );
};

export default ClinicAdminPage;
