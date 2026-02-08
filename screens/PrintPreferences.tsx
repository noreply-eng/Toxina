import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrintPreferences, PrintPreferences as IPrintPreferences } from '../hooks/usePrintPreferences';
import { Check } from 'lucide-react';

const PrintPreferences: React.FC = () => {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = usePrintPreferences();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  const handleToggle = (key: keyof IPrintPreferences) => {
    // @ts-ignore - dynamic key access
    updatePreferences({ [key]: !preferences[key] });
  };

  const handleSelect = (key: keyof IPrintPreferences, value: string) => {
    // @ts-ignore - dynamic key access
    updatePreferences({ [key]: value });
  };

  const handleSave = () => {
      // Preferences are auto-saved in localStorage by the hook, but we show feedback
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const sections = [
    {
      title: 'Información General',
      items: [
        { key: 'includeClinicLogo', label: 'Incluir logo de clínica', type: 'toggle' },
        { key: 'includeDoctorSignature', label: 'Incluir firma del médico', type: 'toggle' },
        { key: 'includeDate', label: 'Incluir fecha de impresión', type: 'toggle' }
      ]
    },
    {
      title: 'Información del Paciente',
      items: [
        { key: 'showPatientPhoto', label: 'Mostrar foto del paciente', type: 'toggle' },
        { key: 'showPatientAge', label: 'Mostrar edad', type: 'toggle' },
        { key: 'showPatientContact', label: 'Mostrar contacto', type: 'toggle' },
        { key: 'showMedicalHistory', label: 'Incluir historial médico', type: 'toggle' }
      ]
    },
    {
      title: 'Detalles del Tratamiento',
      items: [
        { key: 'showDilution', label: 'Mostrar dilución', type: 'toggle' },
        { key: 'showTotalUnits', label: 'Mostrar unidades totales', type: 'toggle' },
        { key: 'showMuscleDetails', label: 'Detalles por músculo', type: 'toggle' },
        { key: 'showProductBrand', label: 'Mostrar marca del producto', type: 'toggle' },
        { key: 'showLotNumber', label: 'Incluir número de lote', type: 'toggle' }
      ]
    },
    {
        title: 'Guías Clínicas (Nuevas)',
        items: [
            { key: 'includeMotorPoints', label: 'Incluir Puntos Motores', type: 'toggle' },
            { key: 'includeUsgGuide', label: 'Incluir Guía por USG', type: 'toggle' }
        ]
    },
    {
      title: 'Secciones Opcionales',
      items: [
        { key: 'includeConsentForm', label: 'Incluir consentimiento informado', type: 'toggle' },
        { key: 'includeInstructions', label: 'Incluir instrucciones post-tratamiento', type: 'toggle' },
        { key: 'includeFollowUpDate', label: 'Incluir fecha de seguimiento', type: 'toggle' },
        { key: 'includeNotes', label: 'Incluir notas adicionales', type: 'toggle' }
      ]
    },
    {
      title: 'Diseño y Formato',
      items: [
        { 
          key: 'paperSize', 
          label: 'Tamaño de papel', 
          type: 'select',
          options: [
            { value: 'letter', label: 'Carta (8.5" × 11")' },
            { value: 'a4', label: 'A4 (210mm × 297mm)' }
          ]
        },
        { 
          key: 'orientation', 
          label: 'Orientación', 
          type: 'select',
          options: [
            { value: 'portrait', label: 'Vertical' },
            { value: 'landscape', label: 'Horizontal' }
          ]
        },
        { 
          key: 'fontSize', 
          label: 'Tamaño de fuente', 
          type: 'select',
          options: [
            { value: 'small', label: 'Pequeña' },
            { value: 'medium', label: 'Mediana' },
            { value: 'large', label: 'Grande' }
          ]
        }
      ]
    },
    {
      title: 'Personalización',
      items: [
        { 
          key: 'headerStyle', 
          label: 'Estilo de encabezado', 
          type: 'select',
          options: [
            { value: 'modern', label: 'Moderno' },
            { value: 'classic', label: 'Clásico' },
            { value: 'minimal', label: 'Minimalista' }
          ]
        },
        { 
          key: 'colorScheme', 
          label: 'Esquema de color', 
          type: 'select',
          options: [
            { value: 'blue', label: 'Azul' },
            { value: 'green', label: 'Verde' },
            { value: 'purple', label: 'Morado' },
            { value: 'gray', label: 'Gris' }
          ]
        }
      ]
    }
  ];

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
          Preferencias de Impresión
        </h1>
        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 space-y-6">
        {/* Preview Card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 p-6 border border-primary/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">print</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">Vista Previa</h2>
              <p className="text-xs text-text-muted">Personaliza tus documentos médicos</p>
            </div>
          </div>
          <button className="w-full py-2.5 px-4 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">visibility</span>
            Ver ejemplo de impresión
          </button>
        </div>

        {/* Settings Sections */}
        {sections.map((section, idx) => (
          <section key={idx}>
            <h2 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {section.title}
            </h2>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-surface-dark shadow-sm border border-slate-100 dark:border-slate-800">
              {section.items.map((item: any, itemIdx) => (
                <React.Fragment key={itemIdx}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{item.label}</p>
                    </div>
                    
                    {item.type === 'toggle' && (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          // @ts-ignore
                          checked={preferences[item.key] === true}
                          // @ts-ignore
                          onChange={() => handleToggle(item.key)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                      </label>
                    )}
                    
                    {item.type === 'select' && (
                      <select 
                        // @ts-ignore
                        value={preferences[item.key] as string}
                        // @ts-ignore
                        onChange={(e) => handleSelect(item.key, e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {item.options.map((opt: any) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {itemIdx < section.items.length - 1 && (
                    <div className="ml-4 h-px bg-slate-50 dark:bg-slate-800" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>
        ))}

        {/* Save Button */}
        <div className="sticky bottom-4 pt-4 px-1">
          <button 
              onClick={handleSave}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2
              ${showSaveSuccess 
                  ? 'bg-green-500 text-white shadow-green-500/20' 
                  : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
              }`}
          >
            {showSaveSuccess ? (
                <>
                    <Check size={20} />
                    Guardado Correctamente
                </>
            ) : 'Guardar Preferencias'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default PrintPreferences;
