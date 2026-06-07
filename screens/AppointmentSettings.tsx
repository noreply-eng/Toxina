import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { requestNotificationPermission } from '../services/appointmentReminders';
import { DEFAULT_APPOINTMENT_DURATION } from '../utils/consultationHelpers';

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90];

const AppointmentSettings: React.FC = () => {
  const navigate = useNavigate();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [defaultDuration, setDefaultDuration] = useState(DEFAULT_APPOINTMENT_DURATION);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await getAuthUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('appointment_reminders, default_appointment_duration')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setRemindersEnabled(data.appointment_reminders ?? true);
        setDefaultDuration(data.default_appointment_duration ?? DEFAULT_APPOINTMENT_DURATION);
      }

      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
      }
    };
    load();
  }, []);

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await getAuthUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_profiles')
        .update({
          appointment_reminders: remindersEnabled,
          default_appointment_duration: defaultDuration,
        })
        .eq('id', user.id);

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert('Error al guardar preferencias');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-24">
      <header className="bg-white dark:bg-surface-dark px-4 py-4 pt-12 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10">
        <PageContainer maxWidth="max-w-lg">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 text-slate-400 rounded-full">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-xl font-bold">Preferencias de agenda</h1>
          </div>
        </PageContainer>
      </header>

      <main className="flex-1 py-6">
        <PageContainer maxWidth="max-w-lg" className="space-y-6">
          <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold mb-4">Recordatorios</h2>
            <label className="flex items-center justify-between gap-4 mb-4">
              <span className="text-sm">Activar recordatorios de citas</span>
              <input
                type="checkbox"
                checked={remindersEnabled}
                onChange={(e) => setRemindersEnabled(e.target.checked)}
                className="size-5 accent-primary"
              />
            </label>
            <p className="text-xs text-text-muted mb-3">
              Recibirás avisos 24 h y 1 h antes de cada cita cuando la app esté abierta.
            </p>
            {'Notification' in window && notificationPermission !== 'granted' && (
              <button
                onClick={handleEnableNotifications}
                className="w-full py-2.5 text-sm font-bold bg-primary/10 text-primary rounded-xl"
              >
                Permitir notificaciones del navegador
              </button>
            )}
            {'Notification' in window && notificationPermission === 'granted' && (
              <p className="text-xs text-green-600 font-medium">Notificaciones permitidas</p>
            )}
          </section>

          <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold mb-4">Duración predeterminada</h2>
            <select
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutos
                </option>
              ))}
            </select>
          </section>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50"
          >
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar preferencias'}
          </button>
        </PageContainer>
      </main>
    </div>
  );
};

export default AppointmentSettings;
