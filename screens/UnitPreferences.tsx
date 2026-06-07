import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import {
  ToxinBrand,
  UnitSystem,
  BRAND_LABELS,
  UNIT_SYSTEM_LABELS,
} from '../utils/userPreferences';

const UnitPreferences: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultBrand, setDefaultBrand] = useState<ToxinBrand>('Botox');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('allergan');

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
        .select('default_brand, unit_system')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        if (data.default_brand) setDefaultBrand(data.default_brand as ToxinBrand);
        if (data.unit_system) setUnitSystem(data.unit_system as UnitSystem);
      }
    } catch (error) {
      console.error('Error loading unit preferences:', error);
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
        .update({ default_brand: defaultBrand, unit_system: unitSystem })
        .eq('id', user.id);

      if (error) throw error;
      alert('✅ Preferencias de unidades guardadas');
      navigate('/settings');
    } catch (error: any) {
      console.error('Error saving unit preferences:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const brands: ToxinBrand[] = ['Botox', 'Dysport', 'Xeomin'];
  const unitSystems: UnitSystem[] = ['allergan', 'speywood'];

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
        <h1 className="text-base font-bold text-text-main dark:text-white">Preferencias de Unidades</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 p-5 border border-blue-100 dark:border-blue-900">
          <p className="text-sm text-text-muted leading-relaxed">
            Configura la marca de toxina predeterminada en la calculadora y el sistema de unidades que prefieres ver en tus reportes.
          </p>
        </div>

        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Marca Predeterminada
          </h2>
          <div className="space-y-3">
            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => setDefaultBrand(brand)}
                className={`w-full rounded-2xl p-4 border-2 transition-all text-left ${
                  defaultBrand === brand
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{brand}</p>
                    <p className="text-xs text-text-muted mt-0.5">{BRAND_LABELS[brand]}</p>
                  </div>
                  {defaultBrand === brand && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Sistema de Unidades
          </h2>
          <div className="space-y-3">
            {unitSystems.map((system) => (
              <button
                key={system}
                onClick={() => setUnitSystem(system)}
                className={`w-full rounded-2xl p-4 border-2 transition-all text-left ${
                  unitSystem === system
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm">{UNIT_SYSTEM_LABELS[system]}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {system === 'allergan'
                        ? 'Estándar para Botox y Xeomin (1 U = 1 U Allergan)'
                        : 'Estándar para Dysport (relación ~2.5:1 vs Allergan)'}
                    </p>
                  </div>
                  {unitSystem === system && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </div>
              </button>
            ))}
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

export default UnitPreferences;
