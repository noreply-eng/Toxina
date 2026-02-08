import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

type FontSizeOption = 'small' | 'medium' | 'large';

interface FontOption {
  id: FontSizeOption;
  name: string;
  description: string;
  icon: string;
}

const FontSize: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSize, setSelectedSize] = useState<FontSizeOption>('medium');

  const fontOptions: FontOption[] = [
    {
      id: 'small',
      name: 'Pequeño',
      description: 'Para pantallas grandes y usuarios que prefieren más contenido visible',
      icon: 'text_decrease'
    },
    {
      id: 'medium',
      name: 'Mediano',
      description: 'Tamaño estándar recomendado para la mayoría de usuarios',
      icon: 'text_fields'
    },
    {
      id: 'large',
      name: 'Grande',
      description: 'Mejor legibilidad, ideal para accesibilidad',
      icon: 'text_increase'
    }
  ];

  useEffect(() => {
    loadFontSize();
  }, []);

  const loadFontSize = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('font_size')
        .eq('id', user.id)
        .single();

      if (data && !error) {
        const size = (data.font_size || 'medium') as FontSizeOption;
        setSelectedSize(size);
        applyFontSize(size);
      }
    } catch (error) {
      console.error('Error loading font size:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFontSize = (size: FontSizeOption) => {
    // Remove all font size classes
    document.body.classList.remove('font-small', 'font-large');
    
    // Add the selected class
    if (size === 'small') {
      document.body.classList.add('font-small');
    } else if (size === 'large') {
      document.body.classList.add('font-large');
    }
    // medium is the default, no class needed
  };

  const handleSelect = (size: FontSizeOption) => {
    setSelectedSize(size);
    applyFontSize(size);
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
        .update({ font_size: selectedSize })
        .eq('id', user.id);

      if (error) throw error;

      alert('✅ Tamaño de fuente guardado correctamente');
    } catch (error: any) {
      console.error('Error saving font size:', error);
      alert('Error al guardar el tamaño de fuente: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-muted">Cargando preferencias...</p>
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
          Tamaño de Fuente
        </h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Info Card */}
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 p-6 border border-blue-100 dark:border-blue-900">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
              <span className="material-symbols-outlined text-2xl text-blue-600 dark:text-blue-400">accessibility</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">Accesibilidad</h2>
              <p className="text-xs text-text-muted">Ajusta el tamaño del texto según tu preferencia</p>
            </div>
          </div>
        </div>

        {/* Font Size Options */}
        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Selecciona un Tamaño
          </h2>
          <div className="space-y-3">
            {fontOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`w-full rounded-2xl p-5 border-2 transition-all text-left ${
                  selectedSize === option.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-lg'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      selectedSize === option.id 
                        ? 'bg-primary text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-xl">{option.icon}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{option.name}</h3>
                      <p className="text-xs text-text-muted">{option.description}</p>
                    </div>
                  </div>
                  {selectedSize === option.id && (
                    <span className="material-symbols-outlined text-primary">check_circle</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Preview Section */}
        <section>
          <h2 className="mb-3 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Vista Previa
          </h2>
          <div className="rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800 p-6 space-y-4">
            <div>
              <h3 className="font-bold text-lg mb-2">Encabezado Principal</h3>
              <p className="text-base text-text-main dark:text-white mb-3">
                Este es un ejemplo de cómo se verá el texto en la aplicación con el tamaño que has seleccionado.
              </p>
              <p className="text-sm text-text-muted">
                Los textos secundarios y descripciones se ajustarán proporcionalmente para mantener una buena jerarquía visual.
              </p>
            </div>
            
            {/* Sample Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div>
                  <p className="font-semibold text-sm">Paciente Ejemplo</p>
                  <p className="text-xs text-text-muted">Última consulta: 15/01/2026</p>
                </div>
              </div>
              <p className="text-xs mt-2">
                Este es un ejemplo de cómo se verá una tarjeta de paciente con el tamaño de fuente seleccionado.
              </p>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="sticky bottom-20 pt-4">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 px-4 rounded-2xl bg-primary text-white font-bold text-sm transition-all shadow-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Preferencia'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default FontSize;
