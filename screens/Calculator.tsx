import React, { useState, useMemo, useEffect } from 'react';
import { Screen } from '../types';
import { dosisData, puntosMotoresData } from '../constants/toxinData';
import { pathologiesData, getPathologyTemplate } from '../data/pathologyData';
import { supabase } from '../supabaseClient';
import { Copy, Save, CheckCircle2, User, Search, UserPlus, Printer, FileText } from 'lucide-react';
import { usePrintPreferences } from '../hooks/usePrintPreferences';
import { guiaUsgData } from '../constants/usgData';

import { useCalculatorState, MuscleSelection, Patient } from '../hooks/useCalculatorState';



const Calculator: React.FC = () => {
  // Step 1: Configuration
  // Step 1: Configuration & State
  const { state, updateState, resetState, isLoaded } = useCalculatorState();
  const {
      selectedBrand,
      dilution,
      selectedPatient,
      patientName,
      patientAge,
      patientWeight,
      selectedPathology,
      selectedMuscles
  } = state;
  
  const [doctorName, setDoctorName] = useState('');
  
  // Patient Data (Local UI)
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showPatientList, setShowPatientList] = useState(false);

  // UI State
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Step 2: Muscles
  // Step 2: Muscles (Local UI)
  const [selectedMuscleName, setSelectedMuscleName] = useState('');
  const [selectedSide, setSelectedSide] = useState<'Izquierdo' | 'Derecho' | 'Ambos'>('Ambos');

  // Print Preferences
  const { preferences } = usePrintPreferences();

  // Calculation Results
  const [isCalculated, setIsCalculated] = useState(false);
  const [totalUnits, setTotalUnits] = useState(0);

  // Derived Values
  // ... (keep useMemo and adjustmentFactor)
  
  // Effects
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).single();
        if (data?.full_name) setDoctorName(data.full_name);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const searchPatients = async () => {
        const { data } = await supabase
          .from('patients')
          .select('id, full_name, age, weight')
          .ilike('full_name', `%${searchQuery}%`)
          .limit(10);
        if (data) setPatients(data);
      };
      searchPatients();
    } else {
      setPatients([]);
    }
  }, [searchQuery]);

  const handleSelectPatient = (patient: Patient) => {
    updateState({
        selectedPatient: patient,
        patientName: patient.full_name,
        patientAge: patient.age ? patient.age.toString() : '',
        patientWeight: patient.weight ? patient.weight.toString() : ''
    });

    setSearchQuery('');
    setPatients([]);
    setShowPatientList(false);
  };

  const copySummaryToClipboard = () => {
    if (!isCalculated) return;
    
    const date = new Date().toLocaleDateString();
    let text = `*RESUMEN DE APLICACIÓN DE TOXINA*\n`;
    text += `📅 Fecha: ${date}\n`;
    text += `👤 Paciente: ${patientName || 'No especificado'}\n`;
    text += `💉 Marca: ${selectedBrand}\n`;
    text += `💧 Dilución: ${dilution} ml\n`;
    text += `--------------------------\n`;
    text += `*DETALLE DE MÚSCULOS:*\n`;
    
    selectedMuscles.forEach(m => {
      text += `• ${m.name} (${m.side}): ${m.customDose} U\n`;
    });
    
    text += `--------------------------\n`;
    text += `*TOTAL APLICADO: ${totalUnits} U*\n`;
    text += `*VOLUMEN: ${getVolumeToApply(totalUnits)}*\n`;
    
    if (doctorName) text += `\n👨‍⚕️ Dr. ${doctorName}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const exportToExcel = () => {
    if (!isCalculated) return;

    const rows = [
      ['RESUMEN DE APLICACIÓN DE TOXINA'],
      ['Fecha', new Date().toLocaleDateString()],
      ['Paciente', patientName || 'No especificado'],
      ['Marca', selectedBrand],
      ['Dilución', `${dilution} ml`],
      [''],
      ['Músculo', 'Lado', 'Dosis (U)'],
      ...selectedMuscles.map(m => [m.name, m.side, m.customDose]),
      [''],
      ['TOTAL APLICADO', '', `${totalUnits} U`],
      ['VOLUMEN TOTAL', '', getVolumeToApply(totalUnits)],
      [''],
      ['Médico', doctorName ? `Dr. ${doctorName}` : '']
    ];

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Calculo_Toxina_${patientName || 'Sin_Nombre'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveTreatment = async () => {
    if (!isCalculated || !selectedBrand) return;
    
    // Validate we have at least a patient name
    if (!patientName.trim()) {
      alert('Por favor ingresa el nombre del paciente para guardar.');
      return;
    }
    
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      let targetPatientId = selectedPatient?.id;

      // If no patient selected but name provided, create a new patient
      if (!targetPatientId && patientName.trim()) {
        const newPatientData: { 
          user_id: string; 
          full_name: string; 
          age?: number; 
          weight?: number;
        } = {
          user_id: user.id,
          full_name: patientName.trim(),
        };
        
        // Add age if provided
        if (patientAge && !isNaN(parseInt(patientAge))) {
          newPatientData.age = parseInt(patientAge);
        }
        
        // Add weight if provided
        if (patientWeight && !isNaN(parseFloat(patientWeight))) {
          newPatientData.weight = parseFloat(patientWeight);
        }
        
        const { data: newPatient, error: pError } = await supabase
          .from('patients')
          .insert(newPatientData)
          .select()
          .single();
        
        if (pError) {
          console.error('Error creating patient:', pError);
          alert('Error al crear el paciente: ' + pError.message);
          setIsSaving(false);
          return;
        }
        
        targetPatientId = newPatient.id;
        targetPatientId = newPatient.id;
        updateState({ selectedPatient: { id: newPatient.id, full_name: newPatient.full_name } });
      }

      if (!targetPatientId) {
        alert('Error: No se pudo determinar el ID del paciente.');
        setIsSaving(false);
        return;
      }

      // Build notes with full session info
      const sessionNotes = [
        selectedPathology ? `Patología: ${selectedPathology}` : '',
        adjustmentFactor !== 1 ? `Factor pediátrico: ${adjustmentFactor.toFixed(2)}` : '',
        doctorName ? `Médico: Dr. ${doctorName}` : ''
      ].filter(Boolean).join(' | ');

      // 1. Insert Treatment
      const { data: treatment, error: tError } = await supabase
        .from('treatments')
        .insert({
          user_id: user.id,
          patient_id: targetPatientId,
          product_name: selectedBrand,
          total_units: totalUnits,
          dilution: parseFloat(dilution) || null,
          notes: sessionNotes || 'Cálculo generado via Calculadora'
        })
        .select()
        .single();

      if (tError) throw tError;

      // 2. Insert Details for each muscle
      const details = selectedMuscles.map(m => ({
        treatment_id: treatment.id,
        muscle_name: m.name,
        side: m.side,
        units: m.customDose || 0
      }));

      const { error: dError } = await supabase.from('treatment_details').insert(details);
      if (dError) throw dError;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving treatment:', error);
      alert('Error al guardar el tratamiento');
    } finally {
      setIsSaving(false);
    }
  };


  // Derived Values
  const availableMuscles = useMemo(() => {
    if (!selectedBrand) return [];
    return Object.keys(dosisData[selectedBrand]).sort();
  }, [selectedBrand]);

  const adjustmentFactor = useMemo(() => {
    const age = parseFloat(patientAge);
    const weight = parseFloat(patientWeight);
    if (!isNaN(age) && age < 18 && !isNaN(weight) && weight > 0) {
      return weight / 40;
    }
    return 1.0;
  }, [patientAge, patientWeight]);

  const limitWarning = useMemo(() => {
    if (!selectedBrand || totalUnits === 0) return null;
    
    let limit = 0;
    if (selectedBrand === 'Dysport') {
      limit = 1000;
    } else {
      limit = 400; // Botox and Xeomin
    }

    if (totalUnits > limit) {
      return `Advertencia: Se ha excedido el límite por sesión (${limit} U)`;
    }
    return null;
  }, [selectedBrand, totalUnits]);

  // Effects
  useEffect(() => {
    // Recalculate if muscles exist on load (e.g. page refresh) and brand is selected
    if (isLoaded && selectedBrand && selectedMuscles.length > 0 && totalUnits === 0) {
        // Optional: Trigger calculation or just show "Calcular" state?
        // For now we leave it uncalculated so user confirms.
    }
  }, [isLoaded, selectedBrand, selectedMuscles]);

  // Handlers
  const handleAddMuscle = () => {
    if (!selectedBrand || !selectedMuscleName) return;

    const musclesToAdd: MuscleSelection[] = [];
    const timestamp = Date.now();

    if (selectedSide === 'Ambos') {
      // Check if not already added
      if (!selectedMuscles.some(m => m.name === selectedMuscleName && m.side === 'Izquierdo')) {
        musclesToAdd.push({
          id: `${selectedMuscleName}_Izquierdo_${timestamp}`,
          name: selectedMuscleName,
          side: 'Izquierdo',
          doseOption: 'min' // Default to min
        });
      }
      if (!selectedMuscles.some(m => m.name === selectedMuscleName && m.side === 'Derecho')) {
        musclesToAdd.push({
          id: `${selectedMuscleName}_Derecho_${timestamp}`,
          name: selectedMuscleName,
          side: 'Derecho',
          doseOption: 'min'
        });
      }
    } else {
       if (!selectedMuscles.some(m => m.name === selectedMuscleName && m.side === selectedSide)) {
        musclesToAdd.push({
          id: `${selectedMuscleName}_${selectedSide}_${timestamp}`,
          name: selectedMuscleName,
          side: selectedSide,
          doseOption: 'min'
        });
       }
    }

    if (musclesToAdd.length > 0) {
    if (musclesToAdd.length > 0) {
      updateState({ selectedMuscles: [...selectedMuscles, ...musclesToAdd] });
      setIsCalculated(false); // Invalidate calculation
    }
    }
  };

  const handleRemoveMuscle = (id: string) => {
    updateState({ selectedMuscles: selectedMuscles.filter(m => m.id !== id) });
    setIsCalculated(false);
  };

  const handleDoseOptionChange = (id: string, option: 'min' | 'max') => {
    updateState({ 
        selectedMuscles: selectedMuscles.map(m => 
            m.id === id ? { ...m, doseOption: option, customDose: undefined } : m
        )
    });
    setIsCalculated(false);
  };

  const handleCustomDoseChange = (id: string, dose: number) => {
     updateState({
        selectedMuscles: selectedMuscles.map(m => 
            m.id === id ? { ...m, customDose: dose } : m
        )
     });
  };

  const handleLoadPathologyTemplate = () => {
    if (!selectedBrand || !selectedPathology) return;
    
    const template = getPathologyTemplate(selectedPathology);
    if (!template) return;
    
    const newMuscles: MuscleSelection[] = [];
    const timestamp = Date.now();
    let skippedMuscles: string[] = [];
    
    template.muscles.forEach((muscle, idx) => {
      // Verify muscle exists in toxinData for selected brand
      if (!dosisData[selectedBrand][muscle.muscleName]) {
        console.warn(`Muscle ${muscle.muscleName} not found in ${selectedBrand}`);
        skippedMuscles.push(muscle.displayName);
        return;
      }
      
      if (muscle.bilateral) {
        // Add left side
        newMuscles.push({
          id: `${muscle.muscleName}_Izquierdo_${timestamp}_${idx}`,
          name: muscle.muscleName,
          side: 'Izquierdo',
          doseOption: 'min'
        });
        
        // Add right side
        newMuscles.push({
          id: `${muscle.muscleName}_Derecho_${timestamp}_${idx}`,
          name: muscle.muscleName,
          side: 'Derecho',
          doseOption: 'min'
        });
      } else {
        // Add single muscle (no side specified)
        newMuscles.push({
          id: `${muscle.muscleName}_Ambos_${timestamp}_${idx}`,
          name: muscle.muscleName,
          side: 'Ambos',
          doseOption: 'min'
        });
      }
    });
    
    if (newMuscles.length > 0) {
    if (newMuscles.length > 0) {
      updateState({ selectedMuscles: [...selectedMuscles, ...newMuscles] });
      setIsCalculated(false);
    }
    }
    
    if (skippedMuscles.length > 0) {
      console.log(`Skipped muscles not found in ${selectedBrand}:`, skippedMuscles);
    }
  };

  const calculateTotal = () => {
    if (!selectedBrand) return;
    
    let total = 0;
    const updatedMuscles = selectedMuscles.map(m => {
        const range = dosisData[selectedBrand][m.name];
        const baseDose = m.doseOption === 'min' ? range.min : range.max;
        const adjustedDose = Math.round(baseDose * adjustmentFactor);
        
        // Use custom dose if set, otherwise calculated adjusted dose
        const finalDose = m.customDose !== undefined ? m.customDose : adjustedDose;
        total += finalDose;
        
        // We ensure the custom dose is set to the calculated one if not already edited, for consistency
        return { ...m, customDose: finalDose };
    });

    updateState({ selectedMuscles: updatedMuscles });
    setTotalUnits(total);
    setIsCalculated(true);
  };

  const getLimitWarning = () => {
    if (!selectedBrand) return null;
    const limit = selectedBrand === 'Dysport' ? 1000 : 400;
    if (totalUnits > limit) {
      return `Advertencia: Se ha excedido el límite por sesión (${limit} U)`;
    }
    return null;
  };
    
  // Formatting Volume
  const getVolumeToApply = (units: number) => {
      const dilutionVal = parseFloat(dilution);
      if(!dilutionVal || isNaN(dilutionVal)) return "---";
      
      let unitsPerVial = 100;
      if (selectedBrand === 'Dysport') unitsPerVial = 500;
      
      const ml = ((units / unitsPerVial) * dilutionVal).toFixed(2);
      return `${ml} ml`;
  };


  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-32">
       {/* Header */}
       <header className="px-6 py-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white">Calculadora Médica</h1>
          <div className="flex gap-2 print:hidden">
            {isCalculated && (
              <>
                <button 
                  onClick={handlePrint}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Imprimir"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={exportToExcel}
                  className="p-2 text-slate-500 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Exportar a Excel"
                >
                  <FileText size={20} />
                </button>
              </>
            )}
             <button
                onClick={() => {
                    if(confirm('¿Estás seguro de reiniciar la calculadora? Se perderán los datos actuales.')) {
                        resetState();
                        setIsCalculated(false);
                        setTotalUnits(0);
                    }
                }}
                className="p-2 bg-red-500 text-white hover:bg-red-600 shadow-sm rounded-lg transition-all active:scale-95"
                title="Reiniciar"
            >
                <span className="material-icons-round text-[20px]">restart_alt</span>
            </button>
          </div>
        </div>
      </header>

      {/* Printable Report Section (Only visible during print) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black">
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">Reporte de Aplicación de Toxina</h1>
            <p className="text-sm text-slate-500">Documento Clínico - Generado por Toxina App</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{new Date().toLocaleDateString()}</p>
            <p className="text-xs">ID de Cálculo: {Date.now()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="space-y-1">
            <p className="text-xs uppercase font-bold text-slate-500">Información del Paciente</p>
            <p className="text-lg font-bold">{patientName || 'No especificado'}</p>
            <p className="text-sm">
                {preferences.showPatientAge ? `Edad: ${patientAge || '--'} años` : ''} 
                {preferences.showPatientAge && (patientWeight) ? ' | ' : ''}
                {patientWeight ? `Peso: ${patientWeight} kg` : ''}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase font-bold text-slate-500">Configuración de Producto</p>
            {preferences.showProductBrand && <p className="text-lg font-bold">{selectedBrand}</p>}
            <p className="text-sm">
                {preferences.showDilution ? `Dilución: ${dilution} ml` : ''} 
                {preferences.showDilution && selectedPathology ? ' | ' : ''}
                {selectedPathology ? `Patología: ${selectedPathology}` : ''}
            </p>
          </div>
        </div>

        <table className="w-full mb-8 border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-900">
              <th className="py-2 px-4 text-left font-bold uppercase text-xs">Músculo</th>
              <th className="py-2 px-4 text-left font-bold uppercase text-xs">Lado</th>
              <th className="py-2 px-4 text-right font-bold uppercase text-xs">Dosis (U)</th>
            </tr>
          </thead>
          <tbody>
            {selectedMuscles.map((m, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="py-2 px-4 font-medium">{m.name}</td>
                <td className="py-2 px-4">{m.side}</td>
                <td className="py-2 px-4 text-right font-bold">{m.customDose} U</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td colSpan={2} className="py-3 px-4 text-right font-bold uppercase">Total Aplicado</td>
              <td className="py-3 px-4 text-right font-bold text-xl">{totalUnits} U</td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1 px-4 text-right text-sm text-slate-500 italic">Volumen aproximado a aplicar</td>
              <td className="py-1 px-4 text-right text-sm font-medium">{getVolumeToApply(totalUnits)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Dynamic Sections based on Preferences */}
        
        {/* Motor Points */}
        {preferences.includeMotorPoints && selectedMuscles.length > 0 && (
            <div className="mb-8 break-inside-avoid">
                <h3 className="font-bold uppercase text-sm border-b border-slate-900 mb-3 pb-1">Guía de Puntos Motores</h3>
                <div className="grid grid-cols-1 gap-4 text-xs">
                    {Array.from(new Set(selectedMuscles.map(m => m.name))).map((muscleName: string) => (
                        puntosMotoresData[muscleName] && (
                            <div key={muscleName} className="text-justify">
                                <span className="font-bold text-slate-900">{muscleName}:</span> <span className="text-slate-700">{puntosMotoresData[muscleName]}</span>
                            </div>
                        )
                    ))}
                </div>
            </div>
        )}

        {/* USG Guide */}
        {preferences.includeUsgGuide && selectedMuscles.length > 0 && (
            <div className="mb-8 break-inside-avoid">
                <h3 className="font-bold uppercase text-sm border-b border-slate-900 mb-3 pb-1">Guía Ecográfica (USG)</h3>
                <div className="grid grid-cols-1 gap-4 text-xs">
                    {Array.from(new Set(selectedMuscles.map(m => m.name))).map((muscleName: string) => (
                        guiaUsgData[muscleName] && (
                            <div key={muscleName} className="text-justify">
                                <span className="font-bold text-slate-900">{muscleName}:</span> <span className="text-slate-700">{guiaUsgData[muscleName]}</span>
                            </div>
                        )
                    ))}
                </div>
            </div>
        )}

        <div className="mt-20 pt-8 border-t border-slate-200 flex justify-between items-end">
          <div className="max-w-md italic text-xs text-slate-400">
            Este reporte es una guía técnica basada en las dosis sugeridas por el fabricante y las patologías seleccionadas. El médico tratante es el único responsable de la aplicación final.
          </div>
          <div className="w-64 text-center">
            <div className="h-px bg-slate-900 mb-2"></div>
            {preferences.includeDoctorSignature && (
                <>
                    <p className="font-bold text-sm">Dr. {doctorName || '________________'}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">Firma y Sello</p>
                </>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 py-6 space-y-6 overflow-y-auto no-scrollbar print:hidden pb-96">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">
            Cálculo de Dosis <br/><span className="text-primary">Toxina Botulínica</span>
          </h2>
        </div>

        {/* Step 1: Config */}
        <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Configuración</h3>
            </div>
            <span className="material-symbols-outlined text-slate-300">medication_liquid</span>
          </div>
          
          <div className="space-y-4">
               {/* Brand Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Marca</label>
              <div className="relative">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">branding_watermark</span>
                <select 
                  value={selectedBrand}
                  onChange={(e) => {
                    const newBrand = e.target.value as any;
                    updateState({ selectedBrand: newBrand, selectedMuscles: [] });
                    setIsCalculated(false);
                  }}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 appearance-none font-medium"
                >
                  <option value="">Seleccione una marca</option>
                  <option value="Dysport">Dysport (Abobotulinumtoxina A)</option>
                  <option value="Botox">Botox (Onabotulinumtoxina A)</option>
                  <option value="Xeomin">Xeomin (Incobotulinumtoxina A)</option>
                </select>
                <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>
            
            {/* Dilution */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Dilución del frasco</label>
              <div className="relative">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">opacity</span>
                <input 
                  type="number" 
                  step="0.1"
                  value={dilution}
                  onChange={(e) => updateState({ dilution: e.target.value })}
                  placeholder="Ej. 2.5"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 font-medium" 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">ml</span>
              </div>
            </div>

             {/* Doctor Name */}
             <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Médico Tratante</label>
              <div className="relative">
                <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">person</span>
                <input 
                  type="text" 
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Nombre del médico"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 font-medium" 
                />
              </div>
            </div>
          </div>
        </section>

         {/* Step 2: Patient Data */}
        <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-300 dark:bg-slate-600 rounded-l-2xl"></div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Paciente</h3>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative">
              {/* Patient Search */}
              <div className="flex items-center gap-2 mb-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <Search size={16} className="text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar paciente existente..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowPatientList(true);
                  }}
                  onFocus={() => setShowPatientList(true)}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-white placeholder:text-slate-400"
                />
              </div>

              {/* Patient List Dropdown */}
              {showPatientList && patients.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center gap-3"
                    >
                      <User size={16} className="text-primary" />
                      <span className="text-sm font-medium text-slate-800 dark:text-white">{p.full_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Manual Patient Name Entry */}
              <div className="space-y-1.5 mt-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Nombre del Paciente</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={patientName}
                    onChange={(e) => updateState({ patientName: e.target.value })}
                    placeholder="Escribir nombre..."
                    className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 font-medium"
                  />
                </div>
              </div>

              {/* Patient Fields for Factor Calculation */}
              <div className="grid grid-cols-2 gap-4 mt-3">
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Edad (años)</label>
                    <input 
                      type="number" 
                      value={patientAge}
                      onChange={(e) => updateState({ patientAge: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 font-medium"
                      placeholder="Ej. 35"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Peso (kg)</label>
                    <input 
                      type="number" 
                      value={patientWeight}
                      onChange={(e) => updateState({ patientWeight: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 font-medium"
                      placeholder="Ej. 70"
                    />
                 </div>
              </div>

              {/* Adjustment Factor Display */}
               {adjustmentFactor !== 1.0 && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm rounded-lg flex items-center gap-2 border border-blue-200 dark:border-blue-800">
                  <span className="material-icons-round text-base">info</span>
                  <span>Factor Pediátrico: <strong>{adjustmentFactor.toFixed(2)}</strong> (Peso/40kg)</span>
                </div>
              )}

              {/* Safety Limit Warning */}
              {limitWarning && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm rounded-lg flex items-center gap-2 border border-amber-200 dark:border-amber-800">
                  <span className="material-icons-round text-base">warning</span>
                  <span>{limitWarning}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Pathology Template Auto-Fill */}
        {/* ... (template section stays similar, maybe add icons) ... */}
        <section className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-5 rounded-2xl border border-purple-200 dark:border-purple-800 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">auto_awesome</span>
            <h3 className="font-bold text-slate-800 dark:text-white">Cargar Plantilla de Patología</h3>
          </div>
          
          <div className="flex gap-2">
            <select 
              value={selectedPathology}
              onChange={(e) => updateState({ selectedPathology: e.target.value })}
              disabled={!selectedBrand}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-700 focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Seleccione una patología...</option>
              {pathologiesData.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            
            <button
              onClick={handleLoadPathologyTemplate}
              disabled={!selectedBrand || !selectedPathology}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors active:scale-95 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span className="hidden sm:inline">Cargar</span>
            </button>
          </div>
        </section>

        {/* Step 3: Muscles */}
        <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-400"></div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-400 text-white flex items-center justify-center text-xs font-bold">3</div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Dosis por Músculo</h3>
            </div>
          </div>

          <div className="space-y-4">
            {/* Muscle Adder */}
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <select 
                        value={selectedMuscleName}
                        onChange={(e) => setSelectedMuscleName(e.target.value)}
                        disabled={!selectedBrand}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 appearance-none disabled:opacity-50"
                    >
                        <option value="">{selectedBrand ? 'Seleccione un músculo manually...' : 'Seleccione una marca primero'}</option>
                        {availableMuscles.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex gap-2">
                     <select 
                        value={selectedSide}
                        onChange={(e) => setSelectedSide(e.target.value as any)}
                        className="w-1/3 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 appearance-none font-medium"
                    >
                        <option value="Izquierdo">Izq.</option>
                        <option value="Derecho">Der.</option>
                        <option value="Ambos">Ambos</option>
                    </select>
                    <button 
                        onClick={handleAddMuscle}
                        disabled={!selectedMuscleName}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Agregar
                    </button>
                </div>
            </div>

            {/* List of Selected Muscles */}
            <div className="space-y-3 mt-4">
                {selectedMuscles.map((muscle) => {
                     const range = selectedBrand ? dosisData[selectedBrand][muscle.name] : { min: 0, max: 0 };
                     const motorPoint = puntosMotoresData[muscle.name];
                      const baseDose = muscle.doseOption === 'min' ? range.min : range.max;
                      const adjusted = Math.round(baseDose * adjustmentFactor);
                      const displayDose = muscle.customDose !== undefined ? muscle.customDose : adjusted;
                     
                    return (
                    <div key={muscle.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 p-4 relative group">
                        <button 
                             onClick={() => handleRemoveMuscle(muscle.id)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"
                        >
                            <span className="material-icons-round text-lg">close</span>
                        </button>
                        
                        <div className="mb-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{muscle.name}</h4>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                                {muscle.side}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm mb-3">
                             <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    checked={muscle.doseOption === 'min'} 
                                    onChange={() => handleDoseOptionChange(muscle.id, 'min')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-slate-600 dark:text-slate-400">Min ({range.min})</span>
                             </label>
                             <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    checked={muscle.doseOption === 'max'} 
                                    onChange={() => handleDoseOptionChange(muscle.id, 'max')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-slate-600 dark:text-slate-400">Max ({range.max})</span>
                             </label>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Dosis:</span>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleCustomDoseChange(muscle.id, Math.max(1, displayDose - 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600"
                                >-</button>
                                <input 
                                    type="number"
                                    value={displayDose}
                                    onChange={(e) => handleCustomDoseChange(muscle.id, parseInt(e.target.value) || 0)}
                                    className="w-16 text-center bg-transparent border-b border-slate-300 focus:border-primary focus:outline-none font-bold text-lg text-slate-800 dark:text-white"
                                />
                                <button 
                                     onClick={() => handleCustomDoseChange(muscle.id, displayDose + 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600"
                                >+</button>
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white">U</span>
                        </div>

                         {motorPoint && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    <strong className="text-primary">Punto Motor:</strong> {motorPoint}
                                </p>
                            </div>
                        )}
                    </div>
                )})}
            </div>
          </div>
        </section>
        
        {/* Warnings */}
        {limitWarning && (
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                <span className="material-icons-round text-red-500 mt-0.5">error_outline</span>
                <p className="text-red-700 dark:text-red-300 font-medium text-sm">
                    {limitWarning}
                </p>
             </div>
        )}

      </main>

      {/* PRINT ONLY UI */}
      <div className="hidden print:block bg-white p-8 text-black">
         <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
            <div>
               <h1 className="text-3xl font-serif font-bold text-slate-900">Reporte Clínico</h1>
               <p className="text-lg text-slate-600">Aplicación de Toxina Botulínica</p>
            </div>
            <div className="text-right">
               <p className="font-bold text-slate-900 text-xl">{doctorName ? `Dr. ${doctorName}` : 'DeepLuxMed'}</p>
               <p className="text-sm text-slate-500">{new Date().toLocaleDateString()}</p>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-2">
               <h3 className="font-bold border-b border-slate-300 pb-1 mb-2">Datos del Paciente</h3>
               <p><span className="font-medium">Nombre:</span> {patientName || '___________________________'}</p>
               <p><span className="font-medium">Edad:</span> {patientAge ? `${patientAge} años` : '____'}</p>
               <p><span className="font-medium">Peso:</span> {patientWeight ? `${patientWeight} kg` : '____'}</p>
               {adjustmentFactor !== 1 && (
                  <p className="text-xs text-slate-500 mt-1">* Dosis ajustada por factor pediátrico ({adjustmentFactor.toFixed(2)})</p>
               )}
            </div>
            <div className="space-y-2">
               <h3 className="font-bold border-b border-slate-300 pb-1 mb-2">Detalles del Procedimiento</h3>
               <p><span className="font-medium">Producto:</span> {selectedBrand || '________________'}</p>
               <p><span className="font-medium">Dilución:</span> {dilution ? `${dilution} ml` : '____ ml'}</p>
               <p><span className="font-medium">Total Unidades:</span> <span className="font-bold text-lg">{totalUnits} U</span></p>
               <p><span className="font-medium">Volumen Total:</span> {getVolumeToApply(totalUnits)}</p>
            </div>
         </div>

         <div className="mb-8">
            <h3 className="font-bold border-b-2 border-slate-800 pb-2 mb-4">Esquema de Aplicación</h3>
            <table className="w-full text-left text-sm">
               <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                     <th className="py-2 px-3 font-bold text-slate-700">Músculo</th>
                     <th className="py-2 px-3 font-bold text-slate-700">Lado</th>
                     <th className="py-2 px-3 font-bold text-slate-700 text-right">Dosis (U)</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                  {selectedMuscles.map((m) => (
                     <tr key={m.id}>
                        <td className="py-2 px-3">{m.name}</td>
                        <td className="py-2 px-3">{m.side}</td>
                        <td className="py-2 px-3 text-right font-medium">{m.customDose} U</td>
                     </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                     <td className="py-3 px-3" colSpan={2}>TOTAL</td>
                     <td className="py-3 px-3 text-right">{totalUnits} U</td>
                  </tr>
               </tbody>
            </table>
         </div>

         <div className="mt-12 pt-8 border-t border-slate-300 flex justify-between items-end">
             <div className="w-1/2 pr-8">
                <div className="h-24 border-b border-slate-800 mb-2"></div>
                <p className="text-center font-medium">Firma del Médico</p>
             </div>
             <div className="w-1/2 pl-8 text-xs text-slate-500 text-justify">
                <p>
                   <strong>Consentimiento Informado:</strong> El paciente declara haber sido informado sobre el procedimiento,
                   beneficios y posibles efectos secundarios de la aplicación de toxina botulínica.
                </p>
             </div>
         </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-[85px] left-0 right-0 p-4 z-40 bg-gradient-to-t from-background-light via-background-light to-transparent dark:from-background-dark dark:via-background-dark pt-8 flex flex-col gap-3">
        
        {isCalculated && (
          <>
            <div className="flex gap-2 mb-1 animate-in slide-in-from-bottom-4 duration-300">
              <button 
                onClick={copySummaryToClipboard}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${copySuccess ? 'bg-green-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm'}`}
              >
                {copySuccess ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                <span>{copySuccess ? 'Copiado!' : 'Copiar Resumen'}</span>
              </button>
              <button 
                onClick={handleSaveTreatment}
                disabled={isSaving || saveSuccess}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${saveSuccess ? 'bg-green-500 text-white' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
              >
                {isSaving ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saveSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
                <span>{saveSuccess ? 'Guardado!' : isSaving ? 'Guardando...' : 'Guardar en Historial'}</span>
              </button>
            </div>
            <div className="flex gap-2 mb-1 animate-in slide-in-from-bottom-4 duration-300">
              <button 
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                <Printer size={18} />
                <span>Imprimir</span>
              </button>
              <button 
                onClick={exportToExcel}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                <FileText size={18} />
                <span>Exportar Excel</span>
              </button>
            </div>
          </>
        )}

        <button 
            onClick={calculateTotal}
            disabled={!selectedBrand || selectedMuscles.length === 0}
            className="w-full bg-primary hover:bg-primary-dark disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 border border-white/10"
        >
          <span className="material-icons-round">calculate</span>
          <span className="text-lg">Calcular Total</span>
          {isCalculated && (
              <div className="flex flex-col items-end leading-none ml-2">
                   <span className="bg-white/20 px-2 py-0.5 rounded text-sm text-white mb-0.5">{totalUnits} U</span>
                   <span className="text-[10px] opacity-80">{getVolumeToApply(totalUnits)}</span>
              </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default Calculator;
