import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { completeConsultation } from '../hooks/useConsultations';
import ScheduleConsultationModal from '../components/ScheduleConsultationModal';
import { getSuggestedFollowUpDate, toLocalDatetimeValue } from '../utils/followUpIntervals';
import { dosisData, puntosMotoresData } from '../constants/toxinData';
import {
  pathologiesData,
  getPathologyTemplate,
  getPathologyProtocolVariants,
  getPathologyById,
  resolveProtocolSuggestedDose,
  type ProtocolVariant,
  type ToxinBrand,
} from '../data/pathologyData';
import { findMuscleForCalculatorName } from '../data/muscleData';
import { FACIAL_ANATOMY_IMAGE } from '../constants/facialAestheticMap';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { searchPatients, fetchPatientById } from '../hooks/usePatients';
import { saveTreatmentMutation } from '../services/clinicalMutations';
import { Copy, Save, CheckCircle2, User, Search, UserPlus, Printer, FileText } from 'lucide-react';
import { usePrintPreferences } from '../hooks/usePrintPreferences';
import { guiaUsgData } from '../constants/usgData';

import { useCalculatorState, MuscleSelection, Patient } from '../hooks/useCalculatorState';
import FacialPlannerModal from '../components/facial/FacialPlannerModal';
import type { FacialPlanExport } from '../hooks/useFacialPlan';



const Calculator: React.FC = () => {
  const location = useLocation();
  const pendingAutoLoad = useRef(false);
  const pendingAutoLoadVariant = useRef<ProtocolVariant>('A');
  const pathologyNavHandled = useRef(false);
  const importPlanHandled = useRef(false);
  const [facialPlannerOpen, setFacialPlannerOpen] = useState(false);
  const [protocolVariant, setProtocolVariant] = useState<ProtocolVariant>('A');
  const [templateLoadMessage, setTemplateLoadMessage] = useState<string | null>(null);

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
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [savedTreatmentId, setSavedTreatmentId] = useState<string | null>(null);
  const [followUpDefaultDate, setFollowUpDefaultDate] = useState<string | undefined>();

  // Step 2: Muscles
  // Step 2: Muscles (Local UI)
  const [selectedMuscleName, setSelectedMuscleName] = useState('');
  const [selectedSide, setSelectedSide] = useState<'Izquierdo' | 'Derecho' | 'Ambos'>('Ambos');

  // Print Preferences
  const { preferences } = usePrintPreferences();
  const userPrefsLoaded = useRef(false);

  // Calculation Results
  const [isCalculated, setIsCalculated] = useState(false);
  const [totalUnits, setTotalUnits] = useState(0);

  // Derived Values
  // ... (keep useMemo and adjustmentFactor)
  
  // Effects
  useEffect(() => {
    const fetchUser = async () => {
      const user = await getAuthUser();
      if (user) {
        const { data } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).single();
        if (data?.full_name) setDoctorName(data.full_name);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const navState = location.state as {
      patientId?: string;
      patientName?: string;
      patientAge?: string;
      patientWeight?: string;
      consultationId?: string;
    } | null;

    if (!navState?.patientId || !isLoaded) return;

    const loadPatient = async () => {
      const user = await getAuthUser();
      if (!user) return;

      const result = await fetchPatientById(user.id, navState.patientId!);
      const data = result.data;

      if (data) {
        updateState({
          selectedPatient: data,
          patientName: data.full_name,
          patientAge: data.age ? data.age.toString() : '',
          patientWeight: data.weight ? data.weight.toString() : '',
        });
      } else if (navState.patientName) {
        updateState({
          selectedPatient: { id: navState.patientId!, full_name: navState.patientName },
          patientName: navState.patientName,
          patientAge: navState.patientAge || '',
          patientWeight: navState.patientWeight || '',
        });
      }

      if (navState.consultationId) {
        setConsultationId(navState.consultationId);
      }
    };

    loadPatient();
  }, [location.state, isLoaded]);

  useEffect(() => {
    if (searchQuery.length > 1) {
      const searchPatientsList = async () => {
        const user = await getAuthUser();
        if (!user) return;

        const result = await searchPatients(user.id, searchQuery, 10);
        if (result.data) {
          setPatients(
            result.data.map((patient) => ({
              id: patient.id,
              full_name: patient.full_name,
              age: patient.age ?? undefined,
              weight: patient.weight ?? undefined,
            }))
          );
        }
      };
      searchPatientsList();
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
    if (pathologyTitle) {
      text += `🏥 Patología: ${pathologyTitle}`;
      if (protocolVariants.length > 0) text += ` (Protocolo ${protocolVariant})`;
      text += `\n`;
    }
    text += `--------------------------\n`;
    text += `*DETALLE DE MÚSCULOS:*\n`;
    
    selectedMuscles.forEach(m => {
      text += `• ${m.name} (${m.side}): ${m.customDose} U / ${getVolumeToApply(m.customDose ?? 0)}\n`;
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
      ...(pathologyTitle
        ? [['Patología', protocolVariants.length > 0 ? `${pathologyTitle} (Protocolo ${protocolVariant})` : pathologyTitle]]
        : []),
      [''],
      ['Músculo', 'Lado', 'Dosis (U)', 'Vol. (ml)'],
      ...selectedMuscles.map(m => [m.name, m.side, m.customDose, getVolumeToApply(m.customDose ?? 0)]),
      [''],
      ['TOTAL APLICADO', '', `${totalUnits} U`, getVolumeToApply(totalUnits)],
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
      const user = await getAuthUser();
      if (!user) throw new Error('No user found');

      const sessionNotes = [
        pathologyTitle ? `Patología: ${pathologyTitle}` : '',
        adjustmentFactor !== 1 ? `Factor pediátrico: ${adjustmentFactor.toFixed(2)}` : '',
        doctorName ? `Médico: Dr. ${doctorName}` : ''
      ].filter(Boolean).join(' | ');

      const createPatientPayload =
        !selectedPatient?.id && patientName.trim()
          ? {
              full_name: patientName.trim(),
              ...(patientAge && !isNaN(parseInt(patientAge)) ? { age: parseInt(patientAge) } : {}),
              ...(patientWeight && !isNaN(parseFloat(patientWeight))
                ? { weight: parseFloat(patientWeight) }
                : {}),
            }
          : undefined;

      const result = await saveTreatmentMutation(user.id, {
        patientId: selectedPatient?.id,
        createPatient: createPatientPayload,
        treatment: {
          product_name: selectedBrand,
          total_units: totalUnits,
          dilution: parseFloat(dilution) || null,
          notes: sessionNotes || 'Cálculo generado via Calculadora',
          clinical_summary: clinicalSummary.trim() || null,
          pathology_id: selectedPathology || null,
          pathology_title: pathologyTitle || null,
          adjustment_factor: adjustmentFactor !== 1 ? adjustmentFactor : null,
          consultation_id: consultationId || null,
        },
        details: selectedMuscles.map((m) => ({
          muscle_name: m.name,
          side: m.side,
          units: m.customDose || 0,
        })),
        completeConsultationId: consultationId || null,
      });

      if (createPatientPayload && result.patientId) {
        updateState({
          selectedPatient: { id: result.patientId, full_name: patientName.trim() },
        });
      }

      if (consultationId) {
        setConsultationId(null);
      }

      setSavedTreatmentId(result.treatmentId);

      const suggestedFollowUp = getSuggestedFollowUpDate(new Date(), selectedPathology || null);
      setFollowUpDefaultDate(toLocalDatetimeValue(suggestedFollowUp));
      setShowFollowUpModal(true);

      setSaveSuccess(true);
      if (result.queued) {
        alert('Tratamiento guardado localmente. Se sincronizará al reconectar.');
      }
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

  const pathologyTitle = useMemo(() => {
    if (!selectedPathology) return '';
    return getPathologyById(selectedPathology)?.title ?? selectedPathology;
  }, [selectedPathology]);

  const protocolVariants = useMemo(() => {
    if (!selectedPathology) return [] as ProtocolVariant[];
    return getPathologyProtocolVariants(selectedPathology);
  }, [selectedPathology]);

  const handleLoadPathologyTemplate = useCallback(
    (options?: { replace?: boolean; variant?: ProtocolVariant }) => {
      if (!selectedBrand || !selectedPathology) return;

      const brand = selectedBrand as ToxinBrand;
      const variant = options?.variant ?? protocolVariant;
      const template = getPathologyTemplate(selectedPathology, variant);
      if (!template || template.muscles.length === 0) {
        setTemplateLoadMessage('No hay músculos para esta variante de protocolo.');
        return;
      }

      const newMuscles: MuscleSelection[] = [];
      const timestamp = Date.now();
      const skippedMuscles: string[] = [];

      template.muscles.forEach((muscle, idx) => {
        if (!dosisData[brand][muscle.muscleName]) {
          console.warn(`Muscle ${muscle.muscleName} not found in ${brand}`);
          skippedMuscles.push(muscle.displayName);
          return;
        }

        const { customDose, doseOption } = resolveProtocolSuggestedDose(muscle.protocol, brand);
        const adjustedDose = Math.round(customDose * adjustmentFactor);

        const addMuscle = (side: MuscleSelection['side'], sideIdx: number) => {
          newMuscles.push({
            id: `${muscle.muscleName}_${side}_${timestamp}_${idx}_${sideIdx}`,
            name: muscle.muscleName,
            side,
            doseOption,
            customDose: adjustedDose,
          });
        };

        if (muscle.bilateral) {
          addMuscle('Izquierdo', 0);
          addMuscle('Derecho', 1);
        } else {
          addMuscle('Ambos', 0);
        }
      });

      if (newMuscles.length === 0) {
        setTemplateLoadMessage(
          skippedMuscles.length
            ? `Ningún músculo disponible en ${brand}: ${skippedMuscles.join(', ')}`
            : 'No se pudo cargar la plantilla.'
        );
        return;
      }

      updateState({
        selectedMuscles: options?.replace !== false ? newMuscles : [...selectedMuscles, ...newMuscles],
      });
      setIsCalculated(false);
      setTotalUnits(0);

      const loadedNames = newMuscles.map((m) => m.name).join(', ');
      let msg = `Cargados ${newMuscles.length} músculo(s) — Protocolo ${variant}: ${loadedNames}.`;
      if (skippedMuscles.length) {
        msg += ` Omitidos (no en ${brand}): ${skippedMuscles.join(', ')}.`;
      }
      setTemplateLoadMessage(msg);
    },
    [selectedBrand, selectedPathology, protocolVariant, adjustmentFactor, selectedMuscles, updateState]
  );

  // Importar plan desde planificador facial
  useEffect(() => {
    if (!isLoaded) return;
    const navState = location.state as { importPlan?: FacialPlanExport } | null;
    if (!navState?.importPlan || importPlanHandled.current) return;
    importPlanHandled.current = true;

    const { brand, dilution: planDilution, pathologyId, muscles } = navState.importPlan;
    const importedTotal = muscles.reduce((s, m) => s + (m.customDose ?? 0), 0);
    updateState({
      selectedBrand: brand,
      dilution: planDilution,
      selectedPathology: pathologyId,
      selectedMuscles: muscles,
    });
    setTotalUnits(importedTotal);
    setTemplateLoadMessage(
      `Plan facial importado: ${muscles.length} músculo(s), ${importedTotal} U total.`
    );
    setIsCalculated(true);
    window.history.replaceState({}, document.title);
  }, [isLoaded, location.state, updateState]);

  // Entrada desde detalle de patología (botón calculadora)
  useEffect(() => {
    if (!isLoaded) return;
    const navState = location.state as {
      pathologyId?: string;
      autoLoadTemplate?: boolean;
      protocolVariant?: ProtocolVariant;
      defaultBrand?: ToxinBrand;
      importPlan?: FacialPlanExport;
    } | null;

    if (navState?.importPlan) return;

    if (!navState?.pathologyId || pathologyNavHandled.current) return;
    pathologyNavHandled.current = true;

    updateState({
      selectedPathology: navState.pathologyId,
      ...(navState.defaultBrand && !selectedBrand ? { selectedBrand: navState.defaultBrand } : {}),
    });
    if (navState.protocolVariant) {
      setProtocolVariant(navState.protocolVariant);
      pendingAutoLoadVariant.current = navState.protocolVariant;
    }
    if (navState.autoLoadTemplate) {
      pendingAutoLoad.current = true;
    }

    window.history.replaceState({}, document.title);
  }, [isLoaded, location.state, selectedBrand, updateState]);

  useEffect(() => {
    if (!pendingAutoLoad.current || !isLoaded || !selectedBrand || !selectedPathology) return;
    pendingAutoLoad.current = false;
    handleLoadPathologyTemplate({ replace: true, variant: pendingAutoLoadVariant.current });
  }, [isLoaded, selectedBrand, selectedPathology, handleLoadPathologyTemplate]);

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

  useEffect(() => {
    if (!isLoaded || userPrefsLoaded.current) return;
    userPrefsLoaded.current = true;

    const loadUserPrefs = async () => {
      const user = await getAuthUser();
      if (!user) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('default_brand, default_dilution')
        .eq('id', user.id)
        .single();

      if (!data) return;

      if (!selectedBrand && data.default_brand) {
        updateState({ selectedBrand: data.default_brand });
      }
      if (!dilution && data.default_dilution) {
        updateState({ dilution: data.default_dilution });
      }
    };

    loadUserPrefs();
  }, [isLoaded, updateState]);

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
      updateState({ selectedMuscles: [...selectedMuscles, ...musclesToAdd] });
      setIsCalculated(false); // Invalidate calculation
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

    // Reveal post-calc actions in the scroll flow (no longer stacked in the fixed bar)
    requestAnimationFrame(() => {
      document.getElementById('calc-post-actions')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
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

  const printCalcId = useRef(`CALC-${Date.now().toString(36).toUpperCase()}`);

  const uniqueMusclesForPrint = useMemo(() => {
    const seen = new Set<string>();
    return selectedMuscles
      .map((m) => m.name)
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .map((name) => {
        const muscle = findMuscleForCalculatorName(name);
        const faceFallback =
          muscle?.category === 'face' && !muscle.motorPoint.imageUrl
            ? FACIAL_ANATOMY_IMAGE
            : undefined;
        return {
          name,
          displayName: muscle?.name || name,
          latinName: muscle?.latinName || name,
          motorDescription:
            muscle?.motorPoint.description || puntosMotoresData[name] || 'Sin descripción de punto motor disponible.',
          techniqueNotes: muscle?.motorPoint.techniqueNotes ?? [],
          imageUrl: muscle?.motorPoint.imageUrl || faceFallback,
          region: muscle?.region,
        };
      });
  }, [selectedMuscles]);

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
       {/* Header */}
       <header className="px-4 sm:px-6 py-4 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white truncate">Calculadora Médica</h1>
          <div className="flex shrink-0 gap-2 print:hidden">
            {(selectedPathology === 'estetica-facial' ||
              selectedPathology === 'sincinesias-faciales') && (
              <button
                type="button"
                onClick={() => setFacialPlannerOpen(true)}
                className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Abrir planificador facial"
              >
                <span className="material-symbols-outlined text-xl">face</span>
              </button>
            )}
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

      {/* Print document: page 1 clinical + page 2 student motor-point reference */}
      <div className="hidden print:block bg-white text-black">
        {/* PAGE 1 — Clinical report */}
        <section className="p-8">
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tight">Reporte de Aplicación de Toxina</h1>
              <p className="text-sm text-slate-500">Documento Clínico - Generado por Toxina App</p>
            </div>
            <div className="text-right">
              <p className="font-bold">{new Date().toLocaleDateString()}</p>
              <p className="text-xs">ID de Cálculo: {printCalcId.current}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="space-y-1">
              <p className="text-xs uppercase font-bold text-slate-500">Información del Paciente</p>
              <p className="text-lg font-bold">{patientName || 'No especificado'}</p>
              <p className="text-sm">
                {preferences.showPatientAge ? `Edad: ${patientAge || '--'} años` : ''}
                {preferences.showPatientAge && patientWeight ? ' | ' : ''}
                {patientWeight ? `Peso: ${patientWeight} kg` : ''}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase font-bold text-slate-500">Configuración de Producto</p>
              {preferences.showProductBrand && <p className="text-lg font-bold">{selectedBrand}</p>}
              <p className="text-sm">
                {preferences.showDilution ? `Dilución: ${dilution} ml` : ''}
                {preferences.showDilution && pathologyTitle ? ' | ' : ''}
                {pathologyTitle ? `Patología: ${pathologyTitle}` : ''}
              </p>
            </div>
          </div>

          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-900">
                <th className="py-2 px-4 text-left font-bold uppercase text-xs">Músculo</th>
                <th className="py-2 px-4 text-left font-bold uppercase text-xs">Lado</th>
                <th className="py-2 px-4 text-right font-bold uppercase text-xs">Dosis (U)</th>
                <th className="py-2 px-4 text-right font-bold uppercase text-xs">Vol. (ml)</th>
              </tr>
            </thead>
            <tbody>
              {selectedMuscles.map((m) => (
                <tr key={m.id} className="border-b border-slate-200">
                  <td className="py-2 px-4 font-medium">{m.name}</td>
                  <td className="py-2 px-4">{m.side}</td>
                  <td className="py-2 px-4 text-right font-bold">{m.customDose} U</td>
                  <td className="py-2 px-4 text-right font-bold">{getVolumeToApply(m.customDose ?? 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="py-3 px-4 text-right font-bold uppercase">Total Aplicado</td>
                <td className="py-3 px-4 text-right font-bold text-xl">{totalUnits} U</td>
                <td className="py-3 px-4 text-right font-bold text-xl">{getVolumeToApply(totalUnits)}</td>
              </tr>
            </tfoot>
          </table>

          {preferences.includeMotorPoints && uniqueMusclesForPrint.length > 0 && (
            <div className="mb-8 break-inside-avoid">
              <h3 className="font-bold uppercase text-sm border-b border-slate-900 mb-3 pb-1">Guía de Puntos Motores</h3>
              <div className="grid grid-cols-1 gap-3 text-xs">
                {uniqueMusclesForPrint.map((muscle) => (
                  <div key={muscle.name} className="text-justify">
                    <span className="font-bold text-slate-900">{muscle.name}: </span>
                    <span className="text-slate-700">{muscle.motorDescription}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preferences.includeUsgGuide && uniqueMusclesForPrint.length > 0 && (
            <div className="mb-8 break-inside-avoid">
              <h3 className="font-bold uppercase text-sm border-b border-slate-900 mb-3 pb-1">Guía Ecográfica (USG)</h3>
              <div className="grid grid-cols-1 gap-3 text-xs">
                {uniqueMusclesForPrint.map((muscle) =>
                  guiaUsgData[muscle.name] ? (
                    <div key={`usg-${muscle.name}`} className="text-justify">
                      <span className="font-bold text-slate-900">{muscle.name}: </span>
                      <span className="text-slate-700">{guiaUsgData[muscle.name]}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          <div className="mt-16 pt-8 border-t border-slate-200 flex justify-between items-end">
            <div className="max-w-md italic text-xs text-slate-400">
              Este reporte es una guía técnica basada en las dosis sugeridas por el fabricante y las patologías seleccionadas. El médico tratante es el único responsable de la aplicación final.
            </div>
            <div className="w-64 text-center">
              <div className="h-px bg-slate-900 mb-2" />
              {preferences.includeDoctorSignature && (
                <>
                  <p className="font-bold text-sm">Dr. {doctorName || '________________'}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">Firma y Sello</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* PAGE 2 — Student anatomical reference */}
        {uniqueMusclesForPrint.length > 0 && (
          <section className="p-8 break-before-page">
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <h1 className="text-2xl font-bold uppercase tracking-tight">Referencia de Puntos Motores</h1>
              <p className="text-sm text-slate-500 mt-1">
                Guía educativa para aplicación — {patientName || 'Paciente'} · {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-6">
              {uniqueMusclesForPrint.map((muscle) => (
                <article
                  key={`ref-${muscle.name}`}
                  className="break-inside-avoid border border-slate-300 rounded-lg overflow-hidden"
                >
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                    <h2 className="font-bold text-base text-slate-900">{muscle.displayName}</h2>
                    <p className="text-xs text-slate-500 italic">
                      {muscle.latinName}
                      {muscle.region ? ` · ${muscle.region}` : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-[1fr_11rem] gap-0">
                    <div className="p-4 space-y-2 text-xs leading-relaxed">
                      <div>
                        <p className="font-bold uppercase text-[10px] tracking-wide text-slate-500 mb-1">Punto motor</p>
                        <p className="text-slate-800 text-justify">{muscle.motorDescription}</p>
                      </div>
                      {muscle.techniqueNotes.length > 0 && (
                        <div>
                          <p className="font-bold uppercase text-[10px] tracking-wide text-slate-500 mb-1">Técnica</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                            {muscle.techniqueNotes.map((note, idx) => (
                              <li key={idx}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="border-l border-slate-200 bg-slate-50 flex items-center justify-center p-2 min-h-[9rem]">
                      {muscle.imageUrl ? (
                        <img
                          src={muscle.imageUrl}
                          alt={`Punto motor anatómico — ${muscle.displayName}`}
                          className="max-h-40 max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center px-2">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Sin imagen</p>
                          <p className="text-[9px] text-slate-400 mt-1">Referencia anatómica no disponible</p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <p className="mt-8 text-[10px] text-slate-400 italic border-t border-slate-200 pt-3">
              Material de referencia para estudiantes. Verificar siempre landmarks clínicos y, cuando aplique, guía ecográfica antes de inyectar.
            </p>
          </section>
        )}
      </div>

      <main className="flex-1 px-4 py-6 space-y-6 overflow-x-hidden overflow-y-auto no-scrollbar print:hidden pb-36 lg:pb-28 max-w-3xl mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white leading-tight">
            Cálculo de Dosis <br/><span className="text-primary">Toxina Botulínica</span>
          </h2>
        </div>

        {/* Step 1: Config */}
        <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rounded-l-2xl"></div>
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
          
          <div className="flex flex-col gap-3">
            {protocolVariants.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 mb-1 uppercase tracking-wide">
                  Variante de protocolo
                </label>
                <select
                  value={protocolVariant}
                  onChange={(e) => {
                    setProtocolVariant(e.target.value as ProtocolVariant);
                    setTemplateLoadMessage(null);
                  }}
                  disabled={!selectedPathology}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-700 text-sm text-slate-800 dark:text-white"
                >
                  <option value="A">A — Aducción / rotación interna (estándar)</option>
                  <option value="B">B — Subescapular dominante (Yelnik)</option>
                  <option value="C">C — Extensión espástica del hombro</option>
                </select>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <select 
              value={selectedPathology || ''}
              onChange={(e) => {
                updateState({ selectedPathology: e.target.value || null });
                setProtocolVariant('A');
                setTemplateLoadMessage(null);
              }}
              disabled={!selectedBrand}
              className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-700 focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Seleccione una patología...</option>
              {pathologiesData.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            
            <button
              onClick={() => handleLoadPathologyTemplate()}
              disabled={!selectedBrand || !selectedPathology}
              className="shrink-0 px-5 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors active:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span>Cargar</span>
            </button>
          </div>

          {templateLoadMessage && (
            <p className="text-xs text-purple-800 dark:text-purple-200 bg-white/60 dark:bg-slate-900/40 rounded-lg px-3 py-2 leading-relaxed break-words">
              {templateLoadMessage}
            </p>
          )}
          </div>
        </section>

        {/* Step 3: Muscles */}
        <section className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-5 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-400 rounded-l-2xl"></div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-400 text-white flex items-center justify-center text-xs font-bold">3</div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Dosis por Músculo</h3>
            </div>
          </div>

          <div className="space-y-4 min-w-0">
            {/* Muscle Adder */}
            <div className="flex flex-col gap-3">
                <div className="relative min-w-0">
                    <select 
                        value={selectedMuscleName}
                        onChange={(e) => setSelectedMuscleName(e.target.value)}
                        disabled={!selectedBrand}
                        className="w-full min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 appearance-none disabled:opacity-50"
                    >
                        <option value="">{selectedBrand ? 'Seleccione un músculo...' : 'Seleccione una marca primero'}</option>
                        {availableMuscles.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                
                <div className="grid grid-cols-[7.5rem_1fr] gap-2">
                     <select 
                        value={selectedSide}
                        onChange={(e) => setSelectedSide(e.target.value as any)}
                        className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-slate-800 dark:text-slate-100 appearance-none font-medium"
                    >
                        <option value="Izquierdo">Izq.</option>
                        <option value="Derecho">Der.</option>
                        <option value="Ambos">Ambos</option>
                    </select>
                    <button 
                        onClick={handleAddMuscle}
                        disabled={!selectedMuscleName}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-3"
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
                    <div key={muscle.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 p-4 pr-10 relative group min-w-0">
                        <button 
                             onClick={() => handleRemoveMuscle(muscle.id)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"
                        >
                            <span className="material-icons-round text-lg">close</span>
                        </button>
                        
                        <div className="mb-2 min-w-0">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 break-words pr-2">{muscle.name}</h4>
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md font-medium">
                                {muscle.side}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm mb-3">
                             <label className="flex items-center gap-1.5 cursor-pointer">
                                <input 
                                    type="radio" 
                                    checked={muscle.doseOption === 'min'} 
                                    onChange={() => handleDoseOptionChange(muscle.id, 'min')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-slate-600 dark:text-slate-400">Min ({range.min})</span>
                             </label>
                             <label className="flex items-center gap-1.5 cursor-pointer">
                                <input 
                                    type="radio" 
                                    checked={muscle.doseOption === 'max'} 
                                    onChange={() => handleDoseOptionChange(muscle.id, 'max')}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="text-slate-600 dark:text-slate-400">Max ({range.max})</span>
                             </label>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Dosis:</span>
                            <div className="flex items-center gap-1">
                                <button 
                                    type="button"
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
                                    type="button"
                                     onClick={() => handleCustomDoseChange(muscle.id, displayDose + 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600"
                                >+</button>
                            </div>
                            <span className="font-bold text-slate-800 dark:text-white">U</span>
                        </div>

                         {motorPoint && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 min-w-0">
                                <p className="text-xs text-slate-500 dark:text-slate-400 break-words leading-relaxed">
                                    <strong className="text-primary">Punto Motor:</strong> {motorPoint}
                                </p>
                            </div>
                        )}
                    </div>
                )})}
            </div>
          </div>
        </section>

        {/* Post-calculate: summary + actions (in flow, avoids overlay clipping) */}
        {isCalculated && (
          <section id="calc-post-actions" className="bg-white dark:bg-surface-dark p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Resumen clínico de la sesión (opcional)
              </label>
              <textarea
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                rows={3}
                placeholder="Evolución, observaciones, plan de seguimiento..."
                className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-y min-h-[5rem] text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copySummaryToClipboard}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold transition-all min-w-0 ${
                  copySuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {copySuccess ? <CheckCircle2 size={16} className="shrink-0" /> : <Copy size={16} className="shrink-0" />}
                <span className="truncate">{copySuccess ? 'Copiado' : 'Copiar'}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveTreatment}
                disabled={isSaving || saveSuccess}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold transition-all min-w-0 ${
                  saveSuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-primary text-white shadow-md shadow-primary/20'
                }`}
              >
                {isSaving ? (
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                ) : saveSuccess ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                  <Save size={16} className="shrink-0" />
                )}
                <span className="truncate">{saveSuccess ? 'Guardado' : isSaving ? 'Guardando…' : 'Guardar'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 min-w-0"
              >
                <Printer size={16} className="shrink-0" />
                <span className="truncate">Imprimir</span>
              </button>
              <button
                type="button"
                onClick={exportToExcel}
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 min-w-0"
              >
                <FileText size={16} className="shrink-0" />
                <span className="truncate">Excel</span>
              </button>
            </div>
          </section>
        )}
        
        {/* Warnings */}
        {limitWarning && (
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                <span className="material-icons-round text-red-500 mt-0.5 shrink-0">error_outline</span>
                <p className="text-red-700 dark:text-red-300 font-medium text-sm break-words min-w-0">
                    {limitWarning}
                </p>
             </div>
        )}

      </main>

      {/* Sticky calculate CTA — stays compact so it never covers muscle cards */}
      <div className="fixed bottom-[85px] lg:bottom-4 left-0 lg:left-64 right-0 z-40 px-4 print:hidden pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <button
            type="button"
            onClick={calculateTotal}
            disabled={!selectedBrand || selectedMuscles.length === 0}
            className="w-full bg-primary hover:bg-primary-dark disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3.5 sm:py-4 px-4 rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-between gap-3 border border-white/10 min-w-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="material-icons-round shrink-0">calculate</span>
              <span className="text-base sm:text-lg truncate">Calcular Total</span>
            </span>
            {isCalculated && (
              <span className="flex items-center gap-2 shrink-0 leading-none">
                <span className="bg-white/20 px-2.5 py-1 rounded-lg text-sm font-bold">{totalUnits} U</span>
                <span className="text-xs opacity-80">{getVolumeToApply(totalUnits)}</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {showFollowUpModal && savedTreatmentId && selectedPatient?.id && (
        <ScheduleConsultationModal
          isOpen={showFollowUpModal}
          onClose={() => {
            setShowFollowUpModal(false);
            setSavedTreatmentId(null);
            setFollowUpDefaultDate(undefined);
          }}
          onSaved={() => {
            setShowFollowUpModal(false);
            setSavedTreatmentId(null);
            setFollowUpDefaultDate(undefined);
          }}
          preselectedPatientId={selectedPatient.id}
          preselectedPatientName={selectedPatient.full_name ?? patientName}
          defaultVisitType="post_application_review"
          defaultLinkedTreatmentId={savedTreatmentId}
          defaultDate={followUpDefaultDate}
          defaultPathologyId={selectedPathology || undefined}
          defaultTreatmentType={pathologyTitle || undefined}
          defaultSource="calculator_followup"
        />
      )}

      <FacialPlannerModal
        isOpen={facialPlannerOpen}
        onClose={() => setFacialPlannerOpen(false)}
        mode={selectedPathology === 'sincinesias-faciales' ? 'asymmetric' : 'aesthetic'}
        pathologyId={selectedPathology || 'estetica-facial'}
        initialBrand={(selectedBrand as 'Botox' | 'Dysport' | 'Xeomin') || 'Botox'}
        initialDilution={dilution || '2.5'}
      />
    </div>
  );
};

export default Calculator;
