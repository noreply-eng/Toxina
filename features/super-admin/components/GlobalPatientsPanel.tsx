import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listClinics,
  listGlobalPatients,
  listUsers,
  reassignPatient,
} from '../services/superAdminService';
import type { AdminUserRow, ClinicSummaryRow, GlobalPatientRow } from '../types';

const GlobalPatientsPanel: React.FC = () => {
  const [patients, setPatients] = useState<GlobalPatientRow[]>([]);
  const [doctors, setDoctors] = useState<AdminUserRow[]>([]);
  const [clinics, setClinics] = useState<ClinicSummaryRow[]>([]);
  const [search, setSearch] = useState('');
  const [clinicFilter, setClinicFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [reassignTarget, setReassignTarget] = useState<GlobalPatientRow | null>(null);
  const [newDoctorId, setNewDoctorId] = useState('');
  const [newClinicId, setNewClinicId] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pts, usrs, cls] = await Promise.all([
        listGlobalPatients(search, 150),
        doctors.length === 0 ? listUsers({ limit: 250 }) : Promise.resolve(doctors),
        clinics.length === 0 ? listClinics() : Promise.resolve(clinics),
      ]);
      setPatients(pts);
      if (doctors.length === 0) setDoctors(usrs);
      if (clinics.length === 0) setClinics(cls);
    } catch (err: any) {
      setError(err?.message || 'Error cargando pacientes globales.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (clinicFilter === 'private') return !p.clinic_id;
      if (clinicFilter !== 'all') return p.clinic_id === clinicFilter;
      return true;
    });
  }, [patients, clinicFilter]);

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    return doctors
      .filter((d) => {
        if (d.role === 'enterprise') return false;
        if (!q) return true;
        return `${d.full_name || ''} ${d.email || ''}`.toLowerCase().includes(q);
      })
      .slice(0, 60);
  }, [doctors, doctorSearch]);

  const openReassign = (patient: GlobalPatientRow) => {
    setReassignTarget(patient);
    setNewDoctorId(patient.user_id);
    setNewClinicId(patient.clinic_id || '');
    setDoctorSearch('');
    setFeedback(null);
  };

  const handleConfirmReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTarget || !newDoctorId) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await reassignPatient(reassignTarget.id, newDoctorId, newClinicId || null);
      setFeedback(
        `Expediente de "${reassignTarget.full_name}" (incluyendo tratamientos, citas y notas) reasignado correctamente.`
      );
      setReassignTarget(null);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error reasignando expediente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente por nombre o correo..."
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
          />
        </div>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
        >
          <option value="all">Todas las ubicaciones</option>
          <option value="private">Solo consultorio privado</option>
          {clinics.map((c) => (
            <option key={c.id} value={c.id}>
              Clínica: {c.name}
            </option>
          ))}
        </select>
        <span className="text-xs font-bold text-slate-400 shrink-0">
          {filteredPatients.length} registros
        </span>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/70 p-3 text-xs font-bold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[10px] font-black uppercase text-slate-400">
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-3">Médico Responsable</th>
                <th className="py-3 px-3">Clínica / Consultorio</th>
                <th className="py-3 px-3">Sesiones</th>
                <th className="py-3 px-3">Última Aplicación</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Cargando expedientes...
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No hay pacientes encontrados.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{p.full_name}</p>
                      <p className="text-slate-400">{p.email || p.phone || 'Sin contacto'}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold">{p.doctor_name || '—'}</p>
                      <p className="text-slate-400">{p.doctor_email}</p>
                    </td>
                    <td className="py-2.5 px-3">
                      {p.clinic_name ? (
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold">
                          {p.clinic_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Consultorio privado</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{p.treatments_count}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {p.last_treatment_date ? new Date(p.last_treatment_date).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openReassign(p)}
                        className="px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary hover:text-white font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                        Reasignar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reassignTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReassign}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-black text-base">Reasignar Expediente Clínico</h4>
                <p className="text-slate-400">
                  Paciente: <strong>{reassignTarget.full_name}</strong> ({reassignTarget.treatments_count} sesiones)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Filtrar médico destino</label>
                <input
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Médico Responsable *</label>
                <select
                  required
                  value={newDoctorId}
                  onChange={(e) => setNewDoctorId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                >
                  <option value="">Selecciona un médico...</option>
                  {filteredDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name || 'Sin nombre'} ({d.email || d.id.slice(0, 8)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Clínica (opcional)</label>
                <select
                  value={newClinicId}
                  onChange={(e) => setNewClinicId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                >
                  <option value="">Consultorio privado (sin clínica)</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                Se transferirán el expediente, tratamientos, consultas, notas clínicas y metas GAS al médico/clínica destino. Esta acción queda registrada en auditoría.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy || !newDoctorId}
                className="px-5 py-2 rounded-xl bg-primary text-white font-black disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Reasignando...' : 'Confirmar Reasignación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default GlobalPatientsPanel;
