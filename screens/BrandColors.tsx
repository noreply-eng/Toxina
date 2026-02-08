import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ColorPicker from '../components/ColorPicker';

const BrandColors: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const defaultPrimary = '#3b82f6';
  const defaultSecondary = '#8b5cf6';
  
  const [primaryColor, setPrimaryColor] = useState(defaultPrimary);
  const [secondaryColor, setSecondaryColor] = useState(defaultSecondary);

  useEffect(() => {
    loadUserColors();
  }, []);

  const loadUserColors = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('primary_color, secondary_color')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        setPrimaryColor(data.primary_color || defaultPrimary);
        setSecondaryColor(data.secondary_color || defaultSecondary);
        applyColors(data.primary_color || defaultPrimary, data.secondary_color || defaultSecondary);
      }
    } catch (error) {
      console.error('Error loading colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyColors = (primary: string, secondary: string) => {
    document.documentElement.style.setProperty('--color-primary', primary);
    document.documentElement.style.setProperty('--color-secondary', secondary);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debe iniciar sesión');
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          primary_color: primaryColor,
          secondary_color: secondaryColor
        })
        .eq('id', user.id);

      if (error) throw error;

      // Apply colors immediately
      applyColors(primaryColor, secondaryColor);
      
      alert('✅ Colores guardados correctamente');
    } catch (error: any) {
      console.error('Error saving colors:', error);
      alert('Error al guardar los colores: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('¿Restaurar colores por defecto?')) {
      setPrimaryColor(defaultPrimary);
      setSecondaryColor(defaultSecondary);
      applyColors(defaultPrimary, defaultSecondary);
    }
  };

  // Live preview effect
  useEffect(() => {
    applyColors(primaryColor, secondaryColor);
  }, [primaryColor, secondaryColor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Cargando colores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-28">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-surface-dark/90 px-4 py-3 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)} 
          className="flex size-10 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-bold leading-tight text-text-main dark:text-white">
          Colores de Marca
        </h1>
        <button
          onClick={handleReset}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Restaurar
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Info Card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 p-6 border border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/50 dark:bg-black/20">
              <span className="material-symbols-outlined text-2xl" style={{ color: primaryColor }}>palette</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">Personaliza tu Marca</h2>
              <p className="text-xs text-text-muted">Los cambios se aplican en tiempo real</p>
            </div>
          </div>
        </div>

        {/* Color Pickers */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Color Primario
          </h2>
          <div className="rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-4">
            <ColorPicker
              label="Color Principal de la Aplicación"
              color={primaryColor}
              onChange={setPrimaryColor}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Color Secundario
          </h2>
          <div className="rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-4">
            <ColorPicker
              label="Color de Acento"
              color={secondaryColor}
              onChange={setSecondaryColor}
            />
          </div>
        </section>

        {/* Preview Section */}
        <section>
          <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Vista Previa
          </h2>
          <div className="rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-6 space-y-4">
            {/* Button Preview */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Botones</p>
              <div className="flex gap-2 flex-wrap">
                <button 
                  className="px-4 py-2 rounded-xl text-white font-semibold text-sm transition-transform hover:scale-105"
                  style={{ backgroundColor: primaryColor }}
                >
                  Botón Primario
                </button>
                <button 
                  className="px-4 py-2 rounded-xl text-white font-semibold text-sm transition-transform hover:scale-105"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Botón Secundario
                </button>
              </div>
            </div>

            {/* Badge Preview */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Badges</p>
              <div className="flex gap-2 flex-wrap">
                <span 
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Activo
                </span>
                <span 
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: secondaryColor }}
                >
                  Premium
                </span>
              </div>
            </div>

            {/* Card Preview */}
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Tarjeta de Ejemplo</p>
              <div className="rounded-xl p-4 border-2" style={{ borderColor: primaryColor }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <span className="material-symbols-outlined" style={{ color: primaryColor }}>
                      favorite
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Título de Tarjeta</h3>
                    <p className="text-xs text-text-muted">Con tu color de marca</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="sticky bottom-20 pt-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {saving ? 'Guardando...' : 'Guardar Colores'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default BrandColors;
