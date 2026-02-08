
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { pathologiesData, PathologyData } from '../data/pathologyData';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [doctorName, setDoctorName] = useState('Dr. Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [randomPathologies, setRandomPathologies] = useState<PathologyData[]>([]);
  
  // Daily summary stats
  const [todayStats, setTodayStats] = useState({ completed: 0, pending: 0 });
  const [nextAppointment, setNextAppointment] = useState<{
    patientName: string;
    treatment: string;
    time: string;
    patientId: string;
  } | null>(null);
  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
  }, []);

  useEffect(() => {
    // Shuffle pathologies on mount/refresh
    const shuffled = [...pathologiesData].sort(() => 0.5 - Math.random());
    setRandomPathologies(shuffled.slice(0, 4));
  }, []);

  useEffect(() => {
    // Set today's date
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    setTodayDate(now.toLocaleDateString('es-MX', options));

    // Fetch today's summary
    const fetchTodaySummary = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch consultations for today
      const { data: consultations } = await supabase
        .from('consultations')
        .select('id, status, consultation_date, patients(id, first_name, last_name), treatment_type')
        .gte('consultation_date', today.toISOString())
        .lt('consultation_date', tomorrow.toISOString())
        .order('consultation_date', { ascending: true });

      if (consultations) {
        const completed = consultations.filter((c: { status?: string }) => c.status === 'completed').length;
        const pending = consultations.filter((c: { status?: string }) => c.status !== 'completed').length;
        setTodayStats({ completed, pending });

        // Find next pending appointment
        const now = new Date();
        const nextPending = consultations.find((c: { status?: string; consultation_date?: string }) => 
          c.status !== 'completed' && new Date(c.consultation_date || '') >= now
        ) as { patients?: { id: string; first_name?: string; last_name?: string } | { id: string; first_name?: string; last_name?: string }[]; treatment_type?: string; consultation_date?: string } | undefined;
        
        if (nextPending?.patients) {
          const patient = Array.isArray(nextPending.patients) ? nextPending.patients[0] : nextPending.patients;
          
          if (patient) {
            setNextAppointment({
              patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente',
              treatment: nextPending.treatment_type || 'Tratamiento',
              time: new Date(nextPending.consultation_date || '').toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
              patientId: patient.id
            });
          }
        } else {
          setNextAppointment(null);
        }
      }
    };

    fetchTodaySummary();
  }, []);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark pb-28 overflow-y-auto no-scrollbar">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pt-6 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative" onClick={() => navigate('/settings')}>
            {avatarUrl ? (
              <div 
                className="bg-center bg-no-repeat bg-cover rounded-full size-12 shadow-sm border-2 border-white dark:border-slate-800" 
                style={{backgroundImage: `url('${avatarUrl}')`}}
              />
            ) : (
              <div 
                className="bg-center bg-no-repeat bg-cover rounded-full size-12 shadow-sm border-2 border-white dark:border-slate-800" 
                style={{backgroundImage: `url('https://picsum.photos/seed/doctor/200')`}}
              />
            )}
            <div className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background-light dark:border-background-dark" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-text-main dark:text-white text-lg font-bold leading-tight">Hola, {doctorName}</h2>
            <p className="text-text-muted dark:text-slate-400 text-xs font-medium">Bienvenido a su asistente.</p>
          </div>
        </div>
        <button className="flex items-center justify-center size-10 rounded-full bg-white dark:bg-surface-dark text-text-main dark:text-white shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-xl">notifications</span>
        </button>
      </header>
      
      {/* Quick Actions */}
      <section className="mt-4 px-4">
        <h3 className="text-text-main dark:text-white text-lg font-bold mb-4">Acciones Rápidas</h3>
        <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 snap-x">
          <button 
            onClick={() => navigate('/calculator')}
            className="snap-start flex flex-col items-center justify-center gap-3 min-w-[120px] h-[110px] bg-primary text-white rounded-2xl shadow-md active:scale-95 transition-transform"
          >
            <div className="bg-white/20 p-2 rounded-full"><span className="material-symbols-outlined text-2xl">calculate</span></div>
            <span className="text-xs font-bold">Nuevo Cálculo</span>
          </button>
          
          <button 
            onClick={() => navigate('/patient/new')}
            className="snap-start flex flex-col items-center justify-center gap-3 min-w-[120px] h-[110px] bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800 text-text-main dark:text-white rounded-2xl shadow-sm active:scale-95 transition-transform group"
          >
            <div className="bg-blue-50 dark:bg-slate-800 p-2 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-slate-700 transition-colors">
              <span className="material-symbols-outlined text-primary dark:text-blue-400 text-2xl">person_add</span>
            </div>
            <span className="text-xs font-bold">Nuevo Paciente</span>
          </button>
        </div>
      </section>

      {/* Pathologies */}
      <section className="mt-6 px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-main dark:text-white text-lg font-bold">Patologías Frecuentes</h3>
          <button 
            onClick={() => navigate('/pathologies')}
            className="text-primary text-xs font-bold flex items-center gap-1 hover:underline"
          >
            Ver todas
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {randomPathologies.map((path, idx) => (
            <div 
              key={idx} 
              onClick={() => navigate(`/pathology/${path.id}`)}
              className="bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="w-full aspect-[4/3] rounded-lg bg-slate-100 dark:bg-slate-800 mb-3 overflow-hidden">
                <img src={path.image} className="w-full h-full object-cover" alt={path.title} />
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

      {/* Summary */}
      <section className="mt-8 px-4">
        <h3 className="text-text-main dark:text-white text-lg font-bold mb-4">Resumen del Día</h3>
        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-6 mb-6">
            <div className="relative size-20 shrink-0">
              {/* Progress circle */}
              <div 
                className="size-full rounded-full" 
                style={{ 
                  background: todayStats.completed + todayStats.pending > 0 
                    ? `conic-gradient(#137fec ${(todayStats.completed / (todayStats.completed + todayStats.pending)) * 100}%, #e2e8f0 0)` 
                    : '#e2e8f0' 
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
              <div className="flex gap-2 mt-2">
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
            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Próxima Cita</p>
            {nextAppointment ? (
              <div className="flex items-start gap-3 relative before:absolute before:left-[5px] before:top-2 before:bottom-0 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-700">
                <div className="relative z-10 size-3 rounded-full bg-primary mt-1.5 ring-4 ring-white dark:ring-surface-dark"></div>
                <div 
                  onClick={() => navigate(`/patient/${nextAppointment.patientId}`)}
                  className="flex-1 bg-background-light dark:bg-slate-800/50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-text-main dark:text-white">{nextAppointment.patientName}</p>
                      <p className="text-xs text-text-muted mt-0.5">{nextAppointment.treatment}</p>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{nextAppointment.time}</span>
                  </div>
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
  );
};

export default Dashboard;
