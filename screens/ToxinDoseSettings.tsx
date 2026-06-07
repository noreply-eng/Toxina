import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { dosisData } from '../constants/toxinData';
import { DoseOption, ToxinBrand } from '../utils/userPreferences';

const ToxinDoseSettings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doseOption, setDoseOption] = useState<DoseOption>('min');
  const [dilution, setDilution] = useState('2.5');
  const [previewBrand, setPreviewBrand] = useState<ToxinBrand>('Botox');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const user = await getAuthUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('default_dose_option, default_dilution, default_brand')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        if (data.default_dose_option) setDoseOption(data.default_dose_option as DoseOption);
        if (data.default_dilution) setDilution(data.default_dilution);
        if (data.default_brand) setPreviewBrand(data.default_brand as ToxinBrand);
      }
    } catch (error) {
      console.error('Error loading dose preferences:', error);
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
        .update({
          default_dose_option: doseOption,
          default_dilution: dilution,
        })
        .eq('id', user.id);

      if (error) throw error;
      alert('✅ Preferencias de dosis guardadas');
      navigate('/settings');
    } catch (error: any) {
      console.error('Error saving dose preferences:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const previewMuscles = Object.keys(dosisData[previewBrand]).slice(0, 6);

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
        <h1 className="text-base font-bold text-text-main dark:text-white">Dosis de Toxina</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 p-5 border border-amber-100 dark:border-amber-900">
          <p className="text-sm text-text-muted leading-relaxed">
            Define cómo se cargan las dosis al seleccionar una patología y la dilución predeterminada del frasco.
            Las dosis por músculo provienen de guías clínicas integradas en la app.
          </p>
        </div>

        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Dosis Predeterminada al Cargar Patología
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {(['min', 'max'] as DoseOption[]).map((option) => (
              <button
                key={option}
                onClick={() => setDoseOption(option)}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  doseOption === option
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark'
                }`}
              >
                <p className="font-bold text-sm">{option === 'min' ? 'Dosis Mínima' : 'Dosis Máxima'}</p>
                <p className="text-xs text-text-muted mt-1">
                  {option === 'min' ? 'Conservadora, inicio de tratamiento' : 'Terapéutica alta del rango'}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Dilución Predeterminada (ml)
          </h2>
          <div className="rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 p-4">
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="10"
              value={dilution}
              onChange={(e) => setDilution(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-lg font-bold focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-text-muted mt-2">Volumen de diluyente por frasco (ej. 2.5 ml para 100 U Botox)</p>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Referencia de Dosis ({previewBrand})
            </h2>
            <select
              value={previewBrand}
              onChange={(e) => setPreviewBrand(e.target.value as ToxinBrand)}
              className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="Botox">Botox</option>
              <option value="Dysport">Dysport</option>
              <option value="Xeomin">Xeomin</option>
            </select>
          </div>
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-slate-800">
            {previewMuscles.map((muscle, idx) => {
              const range = dosisData[previewBrand][muscle];
              return (
                <React.Fragment key={muscle}>
                  <div className="flex items-center justify-between p-3.5">
                    <span className="text-sm font-medium truncate pr-2">{muscle}</span>
                    <span className="text-xs font-bold text-primary whitespace-nowrap">
                      {range.min}–{range.max} U
                    </span>
                  </div>
                  {idx < previewMuscles.length - 1 && (
                    <div className="ml-4 h-px bg-slate-50 dark:bg-slate-800" />
                  )}
                </React.Fragment>
              );
            })}
            <div className="p-3 text-center border-t border-slate-50 dark:border-slate-800">
              <button
                onClick={() => navigate('/motor-points')}
                className="text-xs font-bold text-primary hover:underline"
              >
                Ver todos los músculos y puntos motores →
              </button>
            </div>
          </div>
        </section>

        <div className="sticky bottom-20 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-primary text-white font-bold text-sm shadow-lg disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Preferencias'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default ToxinDoseSettings;
