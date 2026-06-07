import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { AppLanguage, LANGUAGE_LABELS } from '../utils/userPreferences';

const LanguageSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('es');

  const languages: { id: AppLanguage; name: string; native: string; flag: string }[] = [
    { id: 'es', name: 'Español', native: 'Español', flag: '🇪🇸' },
    { id: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
  ];

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    setLoading(true);
    try {
      const user = await getAuthUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('language')
        .eq('id', user.id)
        .single();

      if (data?.language && !error) {
        setLanguage(data.language as AppLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await getAuthUser();
      if (!user) {
        alert('Debe iniciar sesión');
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({ language })
        .eq('id', user.id);

      if (error) throw error;
      alert('✅ Idioma guardado correctamente');
      navigate('/settings');
    } catch (error: any) {
      console.error('Error saving language:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-28">
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-surface-dark/90 px-4 py-3 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-text-main dark:text-white">Idioma</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 p-5 border border-blue-100 dark:border-blue-900">
          <p className="text-sm text-text-muted leading-relaxed">
            Selecciona el idioma de la interfaz. Tu preferencia se guardará en tu perfil.
          </p>
        </div>

        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Idiomas Disponibles
          </h2>
          <div className="space-y-3">
            {languages.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setLanguage(lang.id)}
                className={`w-full rounded-2xl p-4 border-2 transition-all text-left ${
                  language === lang.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div>
                      <p className="font-bold text-sm">{lang.name}</p>
                      <p className="text-xs text-text-muted">{lang.native}</p>
                    </div>
                  </div>
                  {language === lang.id && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {language === 'en' && (
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-100 dark:border-amber-900">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              English interface is in progress. Medical content and clinical data remain in Spanish for now.
            </p>
          </div>
        )}

        <div className="sticky bottom-20 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg disabled:opacity-50"
          >
            {saving ? 'Guardando...' : `Guardar — ${LANGUAGE_LABELS[language]}`}
          </button>
        </div>
      </main>
    </div>
  );
};

export default LanguageSettings;
