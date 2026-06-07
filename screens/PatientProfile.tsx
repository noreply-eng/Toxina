
import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { fetchAllPatients, fetchPatientById } from '../hooks/usePatients';
import { updatePatientMutation } from '../services/clinicalMutations';
import PageContainer from '../components/PageContainer';
import PatientGasGoals from '../components/PatientGasGoals';
import ScheduleConsultationModal from '../components/ScheduleConsultationModal';
import TreatmentDetailModal from '../components/TreatmentDetailModal';
import VisitTypeBadge from '../components/VisitTypeBadge';
import {
  fetchByPatient,
  formatRelativeAppointmentDate,
  markConsultationInProgress,
} from '../hooks/useConsultations';
import type { Consultation } from '../types/clinical';
import { CONSULTATION_STATUS_LABELS } from '../types/clinical';
import type { TreatmentReportData } from '../utils/treatmentReport';

interface PatientRecord {
  id: string;
  full_name: string;
  birth_date?: string;
  email?: string;
  phone?: string;
  weight?: number;
  height?: number;
  gender?: string;
  avatar_url?: string;
  medical_summary?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  notes?: string;
}

interface TreatmentRecord {
  id: string;
  date: string;
  product_name: string;
  total_units: number;
  dilution?: number | null;
  notes?: string;
  clinical_summary?: string;
  pathology_title?: string;
  treatment_details?: Array<{
    muscle_name: string;
    side: string;
    units: number;
  }>;
}

const PatientProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const patientId = id || null;

  const [patient, setPatient] = React.useState<PatientRecord | null>(null);
  const [treatments, setTreatments] = React.useState<TreatmentRecord[]>([]);
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [treatmentReport, setTreatmentReport] = React.useState<TreatmentReportData | null>(null);
  const [showTreatmentModal, setShowTreatmentModal] = React.useState(false);
  const [showConsultationModal, setShowConsultationModal] = React.useState(false);
  const [editingConsultation, setEditingConsultation] = React.useState<Consultation | null>(null);
  const [followUpTreatmentId, setFollowUpTreatmentId] = React.useState<string | undefined>();
  const [showPastConsultations, setShowPastConsultations] = React.useState(false);
  const [editingSummary, setEditingSummary] = React.useState(false);
  const [summaryDraft, setSummaryDraft] = React.useState('');
  const [savingSummary, setSavingSummary] = React.useState(false);

  const loadConsultations = React.useCallback(async (pid: string) => {
    try {
      const result = await fetchByPatient(pid);
      setConsultations(result.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  React.useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const user = await getAuthUser();
        if (!user) {
          setLoading(false);
          return;
        }

        if (!patientId) {
          const result = await fetchAllPatients(user.id);
          const recent = [...result.data].sort((a, b) =>
            (b.created_at ?? '').localeCompare(a.created_at ?? '')
          )[0];
          if (recent) {
            setPatient(recent);
            await fetchTreatments(recent.id);
            await loadConsultations(recent.id);
          }
          setLoading(false);
          return;
        }

        const result = await fetchPatientById(user.id, patientId);
        const patientData = result.data;

        if (patientData) {
          setPatient(patientData);
          setSummaryDraft(patientData.medical_summary || '');
          await fetchTreatments(patientId);
          await loadConsultations(patientId);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchTreatments = async (pid: string) => {
      const { data } = await supabase
        .from('treatments')
        .select('*, treatment_details(*)')
        .eq('patient_id', pid)
        .order('date', { ascending: false });
      if (data) setTreatments(data);
    };

    fetchPatientData();
  }, [patientId, loadConsultations]);

  React.useEffect(() => {
    const state = location.state as { scheduleFollowUp?: boolean } | null;
    if (state?.scheduleFollowUp && patient && treatments.length > 0) {
      setFollowUpTreatmentId(treatments[0].id);
      setEditingConsultation(null);
      setShowConsultationModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, patient, treatments, navigate, location.pathname]);

  const parseNotes = (notes: string) => {
    if (!notes) return {};
    const parts = notes.split(' | ');
    const pathologyPart = parts.find((p) => p.startsWith('Patología:'));
    const doctorPart = parts.find((p) => p.startsWith('Médico:'));

    return {
      pathology: pathologyPart ? pathologyPart.replace('Patología: ', '') : null,
      doctor: doctorPart ? doctorPart.replace('Médico: ', '') : null,
      cleanNotes: parts
        .filter((p) => !p.startsWith('Patología:') && !p.startsWith('Médico:') && !p.startsWith('Factor'))
        .join(' | '),
    };
  };

  const getPathologyTitle = (treatment: TreatmentRecord) => {
    return treatment.pathology_title || parseNotes(treatment.notes || '').pathology;
  };

  const buildTreatmentReport = (treatment: TreatmentRecord): TreatmentReportData => {
    const { doctor, cleanNotes } = parseNotes(treatment.notes || '');
    const age = patient?.birth_date
      ? new Date().getFullYear() - new Date(patient.birth_date).getFullYear()
      : null;

    return {
      patientName: patient?.full_name ?? 'Paciente',
      patientAge: age,
      patientWeight: patient?.weight ?? null,
      sessionDate: treatment.date,
      productName: treatment.product_name,
      dilution: treatment.dilution ?? null,
      pathologyTitle: getPathologyTitle(treatment),
      clinicalSummary: treatment.clinical_summary ?? null,
      notes: cleanNotes || null,
      doctorName: doctor,
      totalUnits: treatment.total_units,
      details: treatment.treatment_details ?? [],
      treatmentId: treatment.id,
    };
  };

  const handleSaveSummary = async () => {
    if (!patientId) return;
    setSavingSummary(true);
    try {
      const user = await getAuthUser();
      if (!user) return;

      const updated = await updatePatientMutation(user.id, patientId, {
        medical_summary: summaryDraft.trim() || null,
      });
      setPatient((prev) => (prev ? { ...prev, medical_summary: updated.medical_summary ?? undefined } : prev));
      setEditingSummary(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSummary(false);
    }
  };

  const upcomingConsultations = consultations.filter(
    (c) => c.status === 'scheduled' || c.status === 'in_progress'
  );
  const pastConsultations = consultations.filter(
    (c) => c.status === 'completed' || c.status === 'cancelled' || c.status === 'no_show'
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark">
        <p className="text-text-muted font-bold animate-pulse">Cargando perfil...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background-light dark:bg-background-dark p-4">
        <p className="text-text-main dark:text-white font-bold text-lg mb-2">Paciente no encontrado</p>
        <button onClick={() => navigate('/dashboard')} className="text-primary font-bold">
          Volver al Inicio
        </button>
      </div>
    );
  }

  const age = patient.birth_date
    ? new Date().getFullYear() - new Date(patient.birth_date).getFullYear()
    : '--';

  const lastVisitLabel =
    treatments.length > 0 ? new Date(treatments[0].date).toLocaleDateString('es-MX') : '--';

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32">
      <header className="bg-white dark:bg-surface-dark pb-4 pt-12 sticky top-0 z-10 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <PageContainer maxWidth="max-w-5xl">
          <div className="flex justify-between items-start gap-4 mb-4 lg:mb-0">
            <button
              onClick={() => navigate(-1)}
              className="shrink-0 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button
              onClick={() => navigate(`/patient/${patientId}/edit`)}
              className="shrink-0 p-2 text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 lg:order-last"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          </div>

          <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left lg:gap-5 lg:-mt-10">
            {patient.avatar_url ? (
              <div
                className="w-20 h-20 lg:w-16 lg:h-16 shrink-0 rounded-full bg-cover bg-center mb-3 lg:mb-0 shadow-md border-2 border-white dark:border-slate-700"
                style={{ backgroundImage: `url('${patient.avatar_url}')` }}
              />
            ) : (
              <div className="w-20 h-20 lg:w-16 lg:h-16 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 lg:mb-0 text-slate-300 border-2 border-white dark:border-slate-700 shadow-sm">
                <span className="material-symbols-outlined text-4xl lg:text-3xl">person</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-xl font-bold text-slate-800 dark:text-white leading-tight mb-1">
                {patient.full_name}
              </h1>
              <p className="text-sm text-text-muted truncate">{patient.email || 'Paciente Registrado'}</p>
            </div>

            <div className="hidden lg:grid grid-cols-2 gap-3 w-full max-w-sm shrink-0">
              <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                  <span className="material-symbols-outlined text-lg">history</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800 dark:text-white leading-none">{treatments.length}</p>
                  <p className="text-[10px] text-text-muted font-medium uppercase tracking-wide">Sesiones</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">{lastVisitLabel}</p>
                  <p className="text-[10px] text-text-muted font-medium uppercase tracking-wide">Última visita</p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </header>

      <main className="flex-1 py-6 pb-24">
        <PageContainer maxWidth="max-w-5xl" className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:hidden">
          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 mb-2">
              <span className="material-symbols-outlined text-lg">history</span>
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{treatments.length}</p>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Sesiones</p>
          </div>
          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 mb-2">
              <span className="material-symbols-outlined text-lg">calendar_month</span>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">{lastVisitLabel}</p>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Última Visita</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">

        {/* Medical summary */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Resumen Médico</h3>
            {!editingSummary && (
              <button
                onClick={() => {
                  setSummaryDraft(patient.medical_summary || '');
                  setEditingSummary(true);
                }}
                className="text-xs font-bold text-primary"
              >
                {patient.medical_summary ? 'Editar' : 'Agregar resumen'}
              </button>
            )}
          </div>
          {editingSummary ? (
            <div className="space-y-3">
              <textarea
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                rows={4}
                placeholder="Resumen clínico general del expediente..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingSummary(false)}
                  className="flex-1 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSummary}
                  disabled={savingSummary}
                  className="flex-1 py-2 text-xs font-bold rounded-lg bg-primary text-white disabled:opacity-50"
                >
                  {savingSummary ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : patient.medical_summary ? (
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {patient.medical_summary}
            </p>
          ) : (
            <p className="text-sm text-text-muted italic">Sin resumen médico registrado.</p>
          )}
        </section>

        {/* Clinical info */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
            Información Clínica
          </h3>

          {patient.allergies && (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-2">
              <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">warning</span>
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Alergias</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{patient.allergies}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-muted mb-0.5">Edad</p>
              <p className="font-medium">{age !== '--' ? `${age} años` : 'No registrada'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted mb-0.5">Teléfono</p>
              <p className="font-medium">{patient.phone || 'No registrado'}</p>
            </div>
            {patient.weight && (
              <div>
                <p className="text-xs text-text-muted mb-0.5">Peso</p>
                <p className="font-medium">{patient.weight} kg</p>
              </div>
            )}
            {patient.height && (
              <div>
                <p className="text-xs text-text-muted mb-0.5">Altura</p>
                <p className="font-medium">{patient.height} cm</p>
              </div>
            )}
            {patient.birth_date && (
              <div>
                <p className="text-xs text-text-muted mb-0.5">Fecha Nacimiento</p>
                <p className="font-medium">{new Date(patient.birth_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {patient.medical_history && (
            <div>
              <p className="text-xs text-text-muted mb-1">Historial Médico</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{patient.medical_history}</p>
            </div>
          )}
          {patient.current_medications && (
            <div>
              <p className="text-xs text-text-muted mb-1">Medicamentos Actuales</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{patient.current_medications}</p>
            </div>
          )}
          {patient.notes && (
            <div>
              <p className="text-xs text-text-muted mb-1">Notas</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 italic">{patient.notes}</p>
            </div>
          )}
        </section>

        {patientId && <PatientGasGoals patientId={patientId} />}
          </div>

          <div className="lg:col-span-5 space-y-6">
        {/* Appointments */}
        <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Citas</h3>
            <button
              onClick={() => {
                setEditingConsultation(null);
                setFollowUpTreatmentId(undefined);
                setShowConsultationModal(true);
              }}
              className="text-xs font-bold text-primary flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Agendar
            </button>
          </div>

          {upcomingConsultations.length === 0 ? (
            <p className="text-sm text-text-muted italic text-center py-4">Sin citas pendientes</p>
          ) : (
            <div className="space-y-3">
              {upcomingConsultations.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10"
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-bold text-primary">
                      {formatRelativeAppointmentDate(c.consultation_date)}
                    </p>
                    <span className="text-[10px] font-bold text-slate-500">
                      {CONSULTATION_STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-2">
                    {c.treatment_type || 'Sin motivo especificado'}
                  </p>
                  <VisitTypeBadge visitType={c.visit_type} />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={async () => {
                        await markConsultationInProgress(c.id);
                        navigate('/calculator', {
                          state: {
                            patientId: patient.id,
                            patientName: patient.full_name,
                            consultationId: c.id,
                          },
                        });
                      }}
                      className="text-[10px] font-bold px-2 py-1 bg-primary text-white rounded-md"
                    >
                      {c.status === 'in_progress' ? 'Continuar' : 'Iniciar'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingConsultation(c);
                        setShowConsultationModal(true);
                      }}
                      className="text-[10px] font-bold px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-md"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pastConsultations.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowPastConsultations(!showPastConsultations)}
                className="text-xs font-bold text-slate-500 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">
                  {showPastConsultations ? 'expand_less' : 'expand_more'}
                </span>
                Historial de citas ({pastConsultations.length})
              </button>
              {showPastConsultations && (
                <div className="mt-2 space-y-2">
                  {pastConsultations.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                      <p className="font-medium">
                        {new Date(c.consultation_date).toLocaleDateString('es-MX')}
                      </p>
                      <p className="text-xs text-text-muted">{c.treatment_type}</p>
                      <div className="flex gap-2 mt-1">
                        <VisitTypeBadge visitType={c.visit_type} />
                        <span className="text-[10px] text-slate-400">
                          {CONSULTATION_STATUS_LABELS[c.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Treatment history */}
        <section>
          <h3 className="text-lg font-bold mb-3 px-1">Historial de Tratamientos</h3>
          <div className="bg-white dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
            {treatments.length === 0 ? (
              <div className="p-8 text-center text-text-muted italic">Sin tratamientos previos</div>
            ) : (
              treatments.map((t) => {
                const pathology = getPathologyTitle(t);
                const { doctor } = parseNotes(t.notes || '');
                return (
                  <div
                    key={t.id}
                    onClick={() => {
                      setTreatmentReport(buildTreatmentReport(t));
                      setShowTreatmentModal(true);
                    }}
                    className="bg-primary/5 dark:bg-primary/10 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:bg-primary/10 transition-colors last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary truncate">{t.product_name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-text-muted">{new Date(t.date).toLocaleDateString('es-MX')}</p>
                        {pathology && <p className="text-[10px] text-slate-400 truncate">• {pathology}</p>}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2 shrink-0">
                      <p className="font-bold text-sm">{t.total_units} U</p>
                      <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
          </div>
        </div>
        </PageContainer>
      </main>

      <button
        onClick={() =>
          navigate('/calculator', {
            state: {
              patientId: patient.id,
              patientName: patient.full_name,
              patientAge: age !== '--' ? String(age) : '',
              patientWeight: patient.weight ? String(patient.weight) : '',
            },
          })
        }
        className="fixed bottom-28 right-5 z-40 bg-primary text-white rounded-full p-4 shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 group transition-all"
      >
        <span className="material-symbols-outlined text-[28px] group-hover:rotate-90 transition-transform">add</span>
        <span className="ml-2 font-bold pr-1 hidden group-hover:block transition-all">Nuevo Tratamiento</span>
      </button>

      <ScheduleConsultationModal
        isOpen={showConsultationModal}
        onClose={() => {
          setShowConsultationModal(false);
          setEditingConsultation(null);
          setFollowUpTreatmentId(undefined);
        }}
        onSaved={() => {
          if (patientId) loadConsultations(patientId);
          setEditingConsultation(null);
          setFollowUpTreatmentId(undefined);
        }}
        preselectedPatientId={patient.id}
        preselectedPatientName={patient.full_name}
        editingConsultation={editingConsultation}
        defaultVisitType={followUpTreatmentId ? 'post_application_review' : undefined}
        defaultLinkedTreatmentId={followUpTreatmentId}
        defaultSource={followUpTreatmentId ? 'calculator_followup' : 'manual'}
      />

      <TreatmentDetailModal
        isOpen={showTreatmentModal}
        onClose={() => {
          setShowTreatmentModal(false);
          setTreatmentReport(null);
        }}
        report={treatmentReport}
      />
    </div>
  );
};

export default PatientProfile;
