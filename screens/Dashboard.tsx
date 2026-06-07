
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { pathologiesData, PathologyData } from '../data/pathologyData';
import VisitTypeBadge from '../components/VisitTypeBadge';
import PageContainer from '../components/PageContainer';
import {
  fetchUpcoming,
  getPatientFromConsultation,
  formatRelativeAppointmentDate,
} from '../hooks/useConsultations';
import StaleDataNotice, { useClinicalCacheMeta } from '../components/StaleDataNotice';
import type { Consultation, VisitType } from '../types/clinical';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [doctorName, setDoctorName] = useState('Dr. Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [randomPathologies, setRandomPathologies] = useState<PathologyData[]>([]);

  const [todayStats, setTodayStats] = useState({ completed: 0, pending: 0 });
  const [nextAppointment, setNextAppointment] = useState<{
    patientName: string;
    treatment: string;
    time: string;
    patientId: string;
    visitType: VisitType;
  } | null>(null);
  const [pendingAppointments, setPendingAppointments] = useState<Consultation[]>([]);
  const [todayDate, setTodayDate] = useState('');
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [cacheUserId, setCacheUserId] = useState<string | undefined>();
  const { lastSyncedAt } = useClinicalCacheMeta(cacheUserId);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = await getAuthUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (data?.full_name) {
        setDoctorName(data.full_name);
      }
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };

    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const shuffled = [...pathologiesData].sort(() => 0.5 - Math.random());
    setRandomPathologies(shuffled.slice(0, 4));
  }, []);

  useEffect(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    setTodayDate(now.toLocaleDateString('es-MX', options));

    const fetchConsultationData = async () => {
      const user = await getAuthUser();
      if (!user) return;
      setCacheUserId(user.id);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      try {
        const todayResult = await fetchUpcoming(user.id, {
          from: today.toISOString(),
          to: tomorrow.toISOString(),
        });
        const todayConsultations = todayResult.data;

        const completed = todayConsultations.filter((c) => c.status === 'completed').length;
        const pending = todayConsultations.filter((c) => c.status !== 'completed').length;
        setTodayStats({ completed, pending });

        const nextPending = todayConsultations.find(
          (c) => c.status !== 'completed' && new Date(c.consultation_date) >= now
        );

        if (nextPending) {
          const patient = getPatientFromConsultation(nextPending);
          if (patient) {
            setNextAppointment({
              patientName: patient.full_name || 'Paciente',
              treatment: nextPending.treatment_type || 'Tratamiento',
              time: new Date(nextPending.consultation_date).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              patientId: patient.id,
              visitType: nextPending.visit_type,
            });
          }
        } else {
          setNextAppointment(null);
        }

        const upcomingResult = await fetchUpcoming(user.id, {
          from: now.toISOString(),
          status: 'scheduled',
          limit: 15,
        });
        setPendingAppointments(upcomingResult.data);
        setUsingCachedData(todayResult.fromCache || upcomingResult.fromCache);
      } catch (err) {
        console.error('Error loading consultations:', err);
      }
    };

    fetchConsultationData();
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-28 lg:pb-8 overflow-y-auto no-scrollbar">
      <header className="bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm sticky top-0 z-10">
        <PageContainer className="flex items-center justify-between py-4 pt-6 lg:py-6">
          <div className="flex items-center gap-3">
            <div
              className="relative cursor-pointer"
              onClick={() => navigate('/settings')}
            >
              {avatarUrl ? (
                <div
                  className="bg-center bg-no-repeat bg-cover rounded-full size-12 lg:size-14 shadow-sm border-2 border-white dark:border-slate-800"
                  style={{ backgroundImage: `url('${avatarUrl}')` }}
                />
              ) : (
                <div
                  className="bg-center bg-no-repeat bg-cover rounded-full size-12 lg:size-14 shadow-sm border-2 border-white dark:border-slate-800"
                  style={{ backgroundImage: `url('https://picsum.photos/seed/doctor/200')` }}
                />
              )}
              <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background-light dark:border-background-dark" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-text-main dark:text-white text-lg lg:text-2xl font-bold leading-tight">
                Hola, {doctorName}
              </h2>
              <p className="text-text-muted dark:text-slate-400 text-xs lg:text-sm font-medium">
                Bienvenido a su asistente.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/agenda')}
            className="flex items-center justify-center size-10 lg:size-11 rounded-full bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">event</span>
          </button>
        </PageContainer>
      </header>

      <PageContainer className="mt-4 lg:mt-6">
        <StaleDataNotice
          visible={usingCachedData}
          lastSyncedAt={lastSyncedAt}
          className="mb-4"
        />
        {/* Quick actions */}
        <section>
          <h3 className="text-text-main dark:text-white text-lg font-bold mb-4">Acciones Rápidas</h3>
          <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 snap-x md:overflow-visible md:grid md:grid-cols-3 md:gap-4">
            <button
              onClick={() => navigate('/calculator')}
              className="snap-start flex flex-col items-center justify-center gap-3 min-w-[120px] md:min-w-0 h-[110px] bg-primary text-white rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <div className="bg-white/20 p-2 rounded-full">
                <span className="material-symbols-outlined text-2xl">calculate</span>
              </div>
              <span className="text-xs font-bold">Nuevo Cálculo</span>
            </button>

            <button
              onClick={() => navigate('/patient/new')}
              className="snap-start flex flex-col items-center justify-center gap-3 min-w-[120px] md:min-w-0 h-[110px] bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 text-text-main dark:text-white rounded-2xl shadow-sm active:scale-95 transition-transform group cursor-pointer"
            >
              <div className="bg-blue-50 dark:bg-slate-800 p-2 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-slate-700 transition-colors">
                <span className="material-symbols-outlined text-primary dark:text-blue-400 text-2xl">person_add</span>
              </div>
              <span className="text-xs font-bold">Nuevo Paciente</span>
            </button>

            <button
              onClick={() => navigate('/agenda', { state: { openModal: true } })}
              className="snap-start flex flex-col items-center justify-center gap-3 min-w-[120px] md:min-w-0 h-[110px] bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 text-text-main dark:text-white rounded-2xl shadow-sm active:scale-95 transition-transform group cursor-pointer"
            >
              <div className="bg-purple-50 dark:bg-slate-800 p-2 rounded-full group-hover:bg-purple-100 dark:group-hover:bg-slate-700 transition-colors">
                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-2xl">event</span>
              </div>
              <span className="text-xs font-bold">Agendar Cita</span>
            </button>
          </div>
        </section>

        {/* Two-column layout on desktop */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 auto-rows-min">
          {/* Pending appointments */}
          <section className="order-2 lg:order-none lg:col-span-5 lg:col-start-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-main dark:text-white text-lg font-bold">Citas Pendientes</h3>
              <button
                onClick={() => navigate('/agenda')}
                className="text-primary text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                Ver agenda
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {pendingAppointments.length === 0 ? (
              <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 text-center border border-slate-100 dark:border-slate-800">
                <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">event_available</span>
                <p className="text-sm text-text-muted">No tienes citas pendientes programadas</p>
                <button
                  onClick={() => navigate('/agenda', { state: { openModal: true } })}
                  className="mt-3 text-xs font-bold text-primary cursor-pointer"
                >
                  Agendar primera cita
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] lg:max-h-none overflow-y-auto no-scrollbar">
                {pendingAppointments.map((consultation) => {
                  const patient = getPatientFromConsultation(consultation);
                  return (
                    <div
                      key={consultation.id}
                      onClick={() => navigate(`/patient/${consultation.patient_id}`)}
                      className="bg-white dark:bg-surface-dark rounded-xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm cursor-pointer hover:border-primary/30 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text-main dark:text-white truncate">
                            {patient?.full_name ?? 'Paciente'}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {consultation.treatment_type || 'Sin motivo especificado'}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-primary shrink-0">
                          {formatRelativeAppointmentDate(consultation.consultation_date)}
                        </span>
                      </div>
                      <VisitTypeBadge visitType={consultation.visit_type} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Frequent pathologies */}
          <section className="order-3 lg:order-none lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:row-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-text-main dark:text-white text-lg font-bold">Patologías Frecuentes</h3>
              <button
                onClick={() => navigate('/pathologies')}
                className="text-primary text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                Ver todas
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-2 gap-3 md:gap-4">
              {randomPathologies.map((path, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(`/pathology/${path.id}`)}
                  className="bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="w-full aspect-[4/3] rounded-lg bg-slate-100 dark:bg-slate-800 mb-3 overflow-hidden">
                    <img src={path.image} className="w-full h-full object-cover" alt={path.title} loading="lazy" />
                  </div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-sm text-text-main dark:text-white">{path.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{path.subtitle}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Day summary */}
          <section className="order-4 lg:order-none lg:col-span-5 lg:col-start-8 mt-0">
            <h3 className="text-text-main dark:text-white text-lg font-bold mb-4">Resumen del Día</h3>
            <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-6 mb-6">
                <div className="relative size-20 shrink-0">
                  <div
                    className="size-full rounded-full"
                    style={{
                      background:
                        todayStats.completed + todayStats.pending > 0
                          ? `conic-gradient(#137fec ${(todayStats.completed / (todayStats.completed + todayStats.pending)) * 100}%, #e2e8f0 0)`
                          : '#e2e8f0',
                    }}
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-surface-dark rounded-full size-16 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {todayStats.completed}/{todayStats.completed + todayStats.pending}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <h4 className="text-base font-bold text-text-main dark:text-white">Pacientes Tratados</h4>
                  <p className="text-sm text-text-muted">Hoy, {todayDate}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="bg-green-50 dark:bg-green-900/30 px-2 py-1 text-[10px] font-bold text-green-700 dark:text-green-400 rounded-md">
                      {todayStats.completed} Completado{todayStats.completed !== 1 ? 's' : ''}
                    </span>
                    <span className="bg-blue-50 dark:bg-blue-900/30 px-2 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 rounded-md">
                      {todayStats.pending} Pendiente{todayStats.pending !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Próxima Cita de Hoy</p>
                {nextAppointment ? (
                  <div className="flex items-start gap-3 relative before:absolute before:left-[5px] before:top-2 before:bottom-0 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-700">
                    <div className="relative z-10 size-3 rounded-full bg-primary mt-1.5 ring-4 ring-white dark:ring-surface-dark" />
                    <div
                      onClick={() => navigate(`/patient/${nextAppointment.patientId}`)}
                      className="flex-1 bg-background-light dark:bg-slate-800/50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-bold text-text-main dark:text-white">{nextAppointment.patientName}</p>
                          <p className="text-xs text-text-muted mt-0.5">{nextAppointment.treatment}</p>
                        </div>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                          {nextAppointment.time}
                        </span>
                      </div>
                      <VisitTypeBadge visitType={nextAppointment.visitType} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-background-light dark:bg-slate-800/50 rounded-xl p-4 text-center">
                    <span className="material-symbols-outlined text-2xl text-slate-400 mb-2">event_available</span>
                    <p className="text-sm text-text-muted">No hay más citas programadas para hoy</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </PageContainer>
    </div>
  );
};

export default Dashboard;
