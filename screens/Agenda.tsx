import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import PageContainer from '../components/PageContainer';
import ScheduleConsultationModal from '../components/ScheduleConsultationModal';
import ConsultationCard from '../components/ConsultationCard';
import ConsultationActionSheet from '../components/ConsultationActionSheet';
import WeekTimelineView from '../components/WeekTimelineView';
import {
  fetchUpcoming,
  fetchPatientsNeedingFollowUp,
  fetchById,
  getCurrentUserId,
  cancelConsultation,
  markConsultationInProgress,
  completeConsultation,
  markConsultationNoShow,
  isActiveConsultationStatus,
} from '../hooks/useConsultations';
import { useConsultationRealtime } from '../hooks/useConsultationRealtime';
import StaleDataNotice, { useClinicalCacheMeta } from '../components/StaleDataNotice';
import type { Consultation, ConsultationStatus, VisitType } from '../types/clinical';
import {
  filterConsultationsBySearch,
  filterConsultationsByStatus,
  filterConsultationsByVisitType,
  getNextActiveConsultation,
  getMinutesUntilConsultation,
} from '../utils/consultationHelpers';
import { toLocalDatetimeValue } from '../utils/followUpIntervals';
import {
  processAppointmentReminders,
  requestNotificationPermission,
  updateAppBadge,
} from '../services/appointmentReminders';
import {
  startOfDay,
  startOfWeek,
  addDays,
  toQueryFrom,
  toQueryTo,
} from '../utils/dateRange';

type ViewMode = 'upcoming' | 'day' | 'week';
type StatusFilter = 'active' | 'all' | ConsultationStatus;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('consultations') || err.message.includes('schema cache')) {
      return 'La tabla de citas no está disponible. Aplica la migración de Supabase (consultations) y recarga.';
    }
    return err.message;
  }
  return 'No se pudieron cargar las citas.';
}

const Agenda: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const openModalOnMount = (location.state as { openModal?: boolean; editConsultationId?: string } | null)?.openModal;
  const editConsultationIdFromNav = (location.state as { editConsultationId?: string } | null)?.editConsultationId;

  const [viewMode, setViewMode] = useState<ViewMode>('upcoming');
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [visitTypeFilter, setVisitTypeFilter] = useState<VisitType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [actionConsultation, setActionConsultation] = useState<Consultation | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>();
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheUserId, setCacheUserId] = useState<string | undefined>();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [needsFollowUp, setNeedsFollowUp] = useState<
    { patientId: string; patientName: string; lastTreatmentDate: string; daysSince: number }[]
  >([]);
  const { lastSyncedAt } = useClinicalCacheMeta(cacheUserId);

  const loadConsultations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const userId = await getCurrentUserId();
      setCacheUserId(userId);

      const profileResult = await supabase
        .from('user_profiles')
        .select('appointment_reminders')
        .eq('id', userId)
        .maybeSingle();
      const enabled = profileResult.data?.appointment_reminders ?? true;
      setRemindersEnabled(enabled);

      let result;

      if (viewMode === 'upcoming') {
        result = await fetchUpcoming(userId, {
          from: new Date().toISOString(),
          limit: 50,
        });
      } else if (viewMode === 'day') {
        result = await fetchUpcoming(userId, {
          from: toQueryFrom(selectedDate),
          to: toQueryTo(selectedDate),
        });
      } else {
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = addDays(weekStart, 6);
        result = await fetchUpcoming(userId, {
          from: toQueryFrom(weekStart),
          to: toQueryTo(weekEnd),
        });
      }

      setConsultations(result.data);
      setUsingCachedData(result.fromCache);

      const followUp = await fetchPatientsNeedingFollowUp(userId);
      setNeedsFollowUp(followUp);

      const activeToday = result.data.filter((c) => isActiveConsultationStatus(c.status));
      await updateAppBadge(activeToday.length);
      processAppointmentReminders(result.data, enabled);
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err));
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedDate]);

  useConsultationRealtime(cacheUserId, loadConsultations);

  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (consultations.length > 0) {
        processAppointmentReminders(consultations, remindersEnabled);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [consultations, remindersEnabled]);

  useEffect(() => {
    if (openModalOnMount) {
      setShowModal(true);
      navigate('/agenda', { replace: true, state: {} });
    }
  }, [openModalOnMount, navigate]);

  useEffect(() => {
    if (!editConsultationIdFromNav) return;
    const loadForEdit = async () => {
      try {
        const consultation = await fetchById(editConsultationIdFromNav);
        if (consultation) {
          setEditingConsultation(consultation);
          setShowModal(true);
        }
      } catch (err) {
        console.error(err);
      }
      navigate('/agenda', { replace: true, state: {} });
    };
    loadForEdit();
  }, [editConsultationIdFromNav, navigate]);

  const filteredConsultations = useMemo(() => {
    let list = consultations;
    list = filterConsultationsByStatus(list, statusFilter);
    list = filterConsultationsByVisitType(list, visitTypeFilter);
    list = filterConsultationsBySearch(list, searchQuery);
    return list;
  }, [consultations, statusFilter, visitTypeFilter, searchQuery]);

  const groupedByDay = useMemo(() => {
    const groups: Record<string, Consultation[]> = {};
    filteredConsultations.forEach((c) => {
      const key = startOfDay(new Date(c.consultation_date)).toISOString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredConsultations]);

  const nextConsultation = useMemo(
    () => getNextActiveConsultation(consultations),
    [consultations]
  );

  const minutesUntilNext = nextConsultation
    ? getMinutesUntilConsultation(nextConsultation.consultation_date)
    : null;

  const handleSaved = (savedDate?: string) => {
    if (savedDate) {
      setSelectedDate(startOfDay(new Date(savedDate)));
      if (viewMode === 'upcoming') {
        setViewMode('day');
      }
    }
    setEditingConsultation(null);
    setModalDefaultDate(undefined);
    loadConsultations();
  };

  const openNewModal = (date?: Date) => {
    setEditingConsultation(null);
    setModalDefaultDate(date ? toLocalDatetimeValue(date) : undefined);
    setShowModal(true);
  };

  const navigateDate = (direction: -1 | 1) => {
    const step = viewMode === 'day' ? 1 : 7;
    setSelectedDate(addDays(selectedDate, direction * step));
  };

  const handleStartConsultation = async (consultation: Consultation) => {
    try {
      await markConsultationInProgress(consultation.id);
      const patient = consultation.patients;
      const p = Array.isArray(patient) ? patient[0] : patient;
      navigate('/calculator', {
        state: {
          patientId: consultation.patient_id,
          patientName: p?.full_name,
          consultationId: consultation.id,
        },
      });
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err));
    }
  };

  const handleComplete = async (consultation: Consultation) => {
    try {
      await completeConsultation(consultation.id);
      setActionConsultation(null);
      loadConsultations();
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err));
    }
  };

  const handleCancel = async (consultation: Consultation) => {
    try {
      await cancelConsultation(consultation.id);
      setActionConsultation(null);
      loadConsultations();
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err));
    }
  };

  const handleNoShow = async (consultation: Consultation) => {
    try {
      await markConsultationNoShow(consultation.id);
      setActionConsultation(null);
      loadConsultations();
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err));
    }
  };

  const headerLabel =
    viewMode === 'day'
      ? selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      : viewMode === 'week'
        ? `${startOfWeek(selectedDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — ${addDays(startOfWeek(selectedDate), 6).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
        : 'Todas las citas próximas';

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'active', label: 'Pendientes' },
    { id: 'all', label: 'Todas' },
    { id: 'completed', label: 'Completadas' },
    { id: 'cancelled', label: 'Canceladas' },
    { id: 'no_show', label: 'No asistió' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32 lg:pb-8">
      <header className="bg-white dark:bg-surface-dark pb-3 pt-12 lg:pt-6 sticky top-0 z-10 shadow-sm border-b border-slate-100 dark:border-slate-800">
        <PageContainer maxWidth="max-w-5xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-text-main dark:text-white">Agenda</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={loadConsultations}
                className="p-2 text-slate-400 hover:text-primary rounded-lg"
                title="Actualizar"
              >
                <span className="material-symbols-outlined text-xl">refresh</span>
              </button>
              <button
                onClick={() => openNewModal()}
                className="flex items-center gap-1 px-3 py-2 bg-primary text-white text-xs font-bold rounded-xl"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Nueva cita
              </button>
            </div>
          </div>

          {nextConsultation && minutesUntilNext !== null && minutesUntilNext >= 0 && (
            <div className="mb-3 p-3 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-primary">Próxima cita</p>
                <p className="text-sm font-bold truncate">
                  {minutesUntilNext <= 60
                    ? `En ${minutesUntilNext} min`
                    : `Hoy a las ${new Date(nextConsultation.consultation_date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
              <button
                onClick={() => handleStartConsultation(nextConsultation)}
                className="shrink-0 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg"
              >
                Iniciar
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            {(['upcoming', 'day', 'week'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                  viewMode === mode
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {mode === 'upcoming' ? 'Próximas' : mode === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>

          {viewMode !== 'upcoming' && (
            <div className="flex items-center justify-between">
              <button onClick={() => navigateDate(-1)} className="p-2 text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                onClick={() => setSelectedDate(startOfDay(new Date()))}
                className="text-sm font-bold text-text-main dark:text-white capitalize"
              >
                {headerLabel}
              </button>
              <button onClick={() => navigateDate(1)} className="p-2 text-slate-400 hover:text-primary">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}

          {viewMode === 'upcoming' && (
            <p className="text-xs text-text-muted text-center mt-1">{headerLabel}</p>
          )}

          <div className="mt-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar paciente o motivo..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mb-2"
            />
          </div>

          <div className="flex gap-2 mt-2 overflow-x-auto hide-scrollbar pb-1">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`shrink-0 px-3 py-1 text-[10px] font-bold rounded-md ${
                  statusFilter === f.id
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            {(
              [
                { id: 'all', label: 'Todos los tipos' },
                { id: 'new_application', label: 'Nueva aplicación' },
                { id: 'post_application_review', label: 'Revaloración' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setVisitTypeFilter(f.id)}
                className={`px-3 py-1 text-[10px] font-bold rounded-md ${
                  visitTypeFilter === f.id
                    ? 'bg-slate-800 dark:bg-slate-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </PageContainer>
      </header>

      <main className="flex-1">
        <PageContainer maxWidth="max-w-5xl" className="py-4">
          {loadError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">{loadError}</p>
              <button
                onClick={loadConsultations}
                className="mt-2 text-xs font-bold text-red-600 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          <StaleDataNotice visible={usingCachedData} lastSyncedAt={lastSyncedAt} className="mb-4" />

          {needsFollowUp.length > 0 && viewMode === 'upcoming' && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                Pacientes sin revaloración programada
              </p>
              <div className="space-y-2">
                {needsFollowUp.slice(0, 3).map((item) => (
                  <div key={item.patientId} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.patientName}</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">
                        Último tratamiento hace {item.daysSince} días
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        navigate(`/patient/${item.patientId}`, { state: { scheduleFollowUp: true } })
                      }
                      className="shrink-0 text-[10px] font-bold px-2 py-1 bg-amber-200 dark:bg-amber-800 rounded-md"
                    >
                      Agendar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : filteredConsultations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">event_busy</span>
              <p className="text-sm font-bold text-slate-500 text-center">
                {viewMode === 'upcoming'
                  ? 'No tienes citas pendientes programadas'
                  : 'No hay citas en este periodo'}
              </p>
              <button
                onClick={() => openNewModal()}
                className="mt-4 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl"
              >
                Agendar cita
              </button>
            </div>
          ) : viewMode === 'week' ? (
            <WeekTimelineView
              selectedDate={selectedDate}
              consultations={filteredConsultations}
              onSelectConsultation={setActionConsultation}
              onSlotClick={(date) => openNewModal(date)}
            />
          ) : viewMode === 'upcoming' ? (
            <div className="space-y-6">
              {groupedByDay.map(([dayKey, dayConsultations]) => (
                <div key={dayKey}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2 capitalize">
                    {new Date(dayKey).toLocaleDateString('es-MX', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </h3>
                  <div className="space-y-3">
                    {dayConsultations.map((consultation) => (
                      <ConsultationCard
                        key={consultation.id}
                        consultation={consultation}
                        showDate={viewMode === 'upcoming'}
                        onViewPatient={() => navigate(`/patient/${consultation.patient_id}`)}
                        onStart={() => handleStartConsultation(consultation)}
                        onEdit={() => {
                          setEditingConsultation(consultation);
                          setShowModal(true);
                        }}
                        onMore={() => setActionConsultation(consultation)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConsultations.map((consultation) => (
                <ConsultationCard
                  key={consultation.id}
                  consultation={consultation}
                  onViewPatient={() => navigate(`/patient/${consultation.patient_id}`)}
                  onStart={() => handleStartConsultation(consultation)}
                  onEdit={() => {
                    setEditingConsultation(consultation);
                    setShowModal(true);
                  }}
                  onMore={() => setActionConsultation(consultation)}
                />
              ))}
            </div>
          )}
        </PageContainer>
      </main>

      <ScheduleConsultationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingConsultation(null);
          setModalDefaultDate(undefined);
        }}
        onSaved={handleSaved}
        editingConsultation={editingConsultation}
        defaultDate={modalDefaultDate}
      />

      {actionConsultation && (
        <ConsultationActionSheet
          consultation={actionConsultation}
          onClose={() => setActionConsultation(null)}
          onEdit={() => {
            setEditingConsultation(actionConsultation);
            setShowModal(true);
            setActionConsultation(null);
          }}
          onStart={() => {
            handleStartConsultation(actionConsultation);
            setActionConsultation(null);
          }}
          onComplete={() => handleComplete(actionConsultation)}
          onCancel={() => handleCancel(actionConsultation)}
          onNoShow={() => handleNoShow(actionConsultation)}
        />
      )}
    </div>
  );
};

export default Agenda;
