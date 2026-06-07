import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import ScheduleConsultationModal from '../components/ScheduleConsultationModal';
import VisitTypeBadge from '../components/VisitTypeBadge';
import {
  fetchUpcoming,
  getCurrentUserId,
  getPatientFromConsultation,
  cancelConsultation,
  markConsultationInProgress,
  completeConsultation,
} from '../hooks/useConsultations';
import StaleDataNotice, { useClinicalCacheMeta } from '../components/StaleDataNotice';
import type { Consultation, ConsultationStatus } from '../types/clinical';
import { CONSULTATION_STATUS_LABELS } from '../types/clinical';
import {
  startOfDay,
  startOfWeek,
  addDays,
  toQueryFrom,
  toQueryTo,
} from '../utils/dateRange';

type ViewMode = 'upcoming' | 'day' | 'week';
type StatusFilter = 'scheduled' | 'all';

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
  const openModalOnMount = (location.state as { openModal?: boolean } | null)?.openModal;

  const [viewMode, setViewMode] = useState<ViewMode>('upcoming');
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('scheduled');
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [actionConsultation, setActionConsultation] = useState<Consultation | null>(null);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheUserId, setCacheUserId] = useState<string | undefined>();
  const { lastSyncedAt } = useClinicalCacheMeta(cacheUserId);

  const statusList = useMemo((): ConsultationStatus[] | undefined => {
    if (statusFilter === 'scheduled') {
      return ['scheduled', 'in_progress'];
    }
    return undefined;
  }, [statusFilter]);

  const loadConsultations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const userId = await getCurrentUserId();
      setCacheUserId(userId);

      let result;

      if (viewMode === 'upcoming') {
        result = await fetchUpcoming(userId, {
          from: new Date().toISOString(),
          status: statusList,
          limit: 50,
        });
      } else if (viewMode === 'day') {
        result = await fetchUpcoming(userId, {
          from: toQueryFrom(selectedDate),
          to: toQueryTo(selectedDate),
          status: statusList,
        });
      } else {
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = addDays(weekStart, 6);
        result = await fetchUpcoming(userId, {
          from: toQueryFrom(weekStart),
          to: toQueryTo(weekEnd),
          status: statusList,
        });
      }

      setConsultations(result.data);
      setUsingCachedData(result.fromCache);
    } catch (err) {
      console.error(err);
      setLoadError(getErrorMessage(err));
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedDate, statusList]);

  useEffect(() => {
    loadConsultations();
  }, [loadConsultations]);

  useEffect(() => {
    if (openModalOnMount) {
      setShowModal(true);
      navigate('/agenda', { replace: true, state: {} });
    }
  }, [openModalOnMount, navigate]);

  const handleSaved = (savedDate?: string) => {
    if (savedDate) {
      setSelectedDate(startOfDay(new Date(savedDate)));
      if (viewMode === 'upcoming') {
        setViewMode('day');
      }
    }
    loadConsultations();
  };

  const groupedByDay = useMemo(() => {
    const groups: Record<string, Consultation[]> = {};
    consultations.forEach((c) => {
      const key = startOfDay(new Date(c.consultation_date)).toISOString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [consultations]);

  const navigateDate = (direction: -1 | 1) => {
    const step = viewMode === 'day' ? 1 : 7;
    setSelectedDate(addDays(selectedDate, direction * step));
  };

  const handleStartConsultation = async (consultation: Consultation) => {
    try {
      await markConsultationInProgress(consultation.id);
      const patient = getPatientFromConsultation(consultation);
      navigate('/calculator', {
        state: {
          patientId: consultation.patient_id,
          patientName: patient?.full_name,
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

  const renderConsultationCard = (consultation: Consultation) => {
    const patient = getPatientFromConsultation(consultation);
    const date = new Date(consultation.consultation_date);
    const time = date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const dateLabel = date.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    return (
      <div
        key={consultation.id}
        className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm"
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm text-text-main dark:text-white truncate">
              {patient?.full_name ?? 'Paciente'}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {consultation.treatment_type || 'Sin motivo especificado'}
            </p>
          </div>
          <div className="text-right shrink-0">
            {viewMode === 'upcoming' && (
              <p className="text-[10px] font-bold text-slate-500 capitalize">{dateLabel}</p>
            )}
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
              {time}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <VisitTypeBadge visitType={consultation.visit_type} />
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
            {CONSULTATION_STATUS_LABELS[consultation.status]}
          </span>
        </div>

        {consultation.notes && (
          <p className="text-xs text-slate-500 mb-3 line-clamp-2">{consultation.notes}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/patient/${consultation.patient_id}`)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            Ver paciente
          </button>
          {(consultation.status === 'scheduled' || consultation.status === 'in_progress') && (
            <button
              onClick={() => handleStartConsultation(consultation)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white"
            >
              {consultation.status === 'in_progress' ? 'Continuar' : 'Iniciar'}
            </button>
          )}
          <button
            onClick={() => setActionConsultation(consultation)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500"
          >
            Más
          </button>
        </div>
      </div>
    );
  };

  const headerLabel =
    viewMode === 'day'
      ? selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
      : viewMode === 'week'
        ? `${startOfWeek(selectedDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — ${addDays(startOfWeek(selectedDate), 6).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
        : 'Todas las citas próximas';

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
              onClick={() => {
                setEditingConsultation(null);
                setShowModal(true);
              }}
              className="flex items-center gap-1 px-3 py-2 bg-primary text-white text-xs font-bold rounded-xl"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Nueva cita
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          {(['upcoming', 'day', 'week'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                viewMode === mode ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
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

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setStatusFilter('scheduled')}
            className={`px-3 py-1 text-[10px] font-bold rounded-md ${
              statusFilter === 'scheduled'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-[10px] font-bold rounded-md ${
              statusFilter === 'all'
                ? 'bg-primary/10 text-primary'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            Todas
          </button>
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

        <StaleDataNotice
          visible={usingCachedData}
          lastSyncedAt={lastSyncedAt}
          className="mb-4"
        />

        {loading ? (
          <p className="text-center text-text-muted animate-pulse py-8">Cargando citas...</p>
        ) : consultations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">event_busy</span>
            <p className="text-sm font-bold text-slate-500 text-center">
              {viewMode === 'upcoming'
                ? 'No tienes citas pendientes programadas'
                : 'No hay citas en este periodo'}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl"
            >
              Agendar cita
            </button>
          </div>
        ) : viewMode === 'week' || viewMode === 'upcoming' ? (
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
                  {dayConsultations.map(renderConsultationCard)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">{consultations.map(renderConsultationCard)}</div>
        )}
        </PageContainer>
      </main>

      <ScheduleConsultationModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingConsultation(null);
        }}
        onSaved={handleSaved}
        editingConsultation={editingConsultation}
      />

      {actionConsultation && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setActionConsultation(null)}
        >
          <div
            className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-t-2xl p-4 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-center mb-2">Acciones de cita</p>
            <button
              onClick={() => {
                setEditingConsultation(actionConsultation);
                setShowModal(true);
                setActionConsultation(null);
              }}
              className="w-full py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              Editar cita
            </button>
            {actionConsultation.status !== 'completed' && actionConsultation.status !== 'cancelled' && (
              <button
                onClick={() => handleComplete(actionConsultation)}
                className="w-full py-3 text-sm font-bold rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700"
              >
                Marcar completada
              </button>
            )}
            {actionConsultation.status === 'scheduled' && (
              <button
                onClick={() => handleCancel(actionConsultation)}
                className="w-full py-3 text-sm font-bold rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600"
              >
                Cancelar cita
              </button>
            )}
            <button
              onClick={() => setActionConsultation(null)}
              className="w-full py-3 text-sm font-bold rounded-xl text-slate-500"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
