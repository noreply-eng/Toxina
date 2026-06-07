import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { searchPatients } from '../hooks/usePatients';
import { pathologiesData } from '../data/pathologyData';
import {
  createConsultation,
  updateConsultation,
  cancelConsultation,
  fetchConsultationsForDay,
  getCurrentUserId,
} from '../hooks/useConsultations';
import type { Consultation, ConsultationSource, VisitType } from '../types/clinical';
import { VISIT_TYPE_LABELS } from '../types/clinical';
import {
  DEFAULT_APPOINTMENT_DURATION,
  findOverlappingConsultations,
} from '../utils/consultationHelpers';
import { toLocalDatetimeValue } from '../utils/followUpIntervals';

interface PatientOption {
  id: string;
  full_name: string;
}

interface TreatmentOption {
  id: string;
  date: string;
  product_name: string;
  total_units: number;
  pathology_title?: string | null;
}

interface ScheduleConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedDate?: string, consultation?: Consultation) => void;
  preselectedPatientId?: string;
  preselectedPatientName?: string;
  editingConsultation?: Consultation | null;
  defaultVisitType?: VisitType;
  defaultLinkedTreatmentId?: string;
  defaultDate?: string;
  defaultPathologyId?: string;
  defaultTreatmentType?: string;
  defaultSource?: ConsultationSource;
  defaultDurationMinutes?: number;
}

const DURATION_OPTIONS = [15, 20, 30, 45, 60, 90];

const ScheduleConsultationModal: React.FC<ScheduleConsultationModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  preselectedPatientId,
  preselectedPatientName,
  editingConsultation,
  defaultVisitType,
  defaultLinkedTreatmentId,
  defaultDate,
  defaultPathologyId,
  defaultTreatmentType,
  defaultSource = 'manual',
  defaultDurationMinutes = DEFAULT_APPOINTMENT_DURATION,
}) => {
  const [patientId, setPatientId] = useState(preselectedPatientId ?? '');
  const [patientSearch, setPatientSearch] = useState(preselectedPatientName ?? '');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [consultationDate, setConsultationDate] = useState(toLocalDatetimeValue(new Date()));
  const [durationMinutes, setDurationMinutes] = useState(defaultDurationMinutes);
  const [visitType, setVisitType] = useState<VisitType>(defaultVisitType ?? 'new_application');
  const [pathologyId, setPathologyId] = useState('');
  const [customTreatmentType, setCustomTreatmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [linkedTreatmentId, setLinkedTreatmentId] = useState(defaultLinkedTreatmentId ?? '');
  const [patientTreatments, setPatientTreatments] = useState<TreatmentOption[]>([]);
  const [linkedTreatmentSummary, setLinkedTreatmentSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [savedConsultation, setSavedConsultation] = useState<Consultation | null>(null);
  const [internalEditing, setInternalEditing] = useState<Consultation | null>(null);

  const activeEditing = editingConsultation ?? internalEditing;
  const isEditing = Boolean(activeEditing);
  const isPatientLocked = Boolean(preselectedPatientId);
  const showSuccessEdit = Boolean(savedConsultation && !activeEditing);

  useEffect(() => {
    if (!isOpen) {
      setInternalEditing(null);
      setSavedConsultation(null);
      setShowCancelReason(false);
      setCancellationReason('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || savedConsultation) return;

    setShowCancelReason(false);
    setCancellationReason('');

    const source = editingConsultation ?? internalEditing;
    if (source) {
      setPatientId(source.patient_id);
      setPatientSearch(
        Array.isArray(source.patients)
          ? (source.patients[0]?.full_name ?? '')
          : (source.patients?.full_name ?? preselectedPatientName ?? '')
      );
      setConsultationDate(toLocalDatetimeValue(new Date(source.consultation_date)));
      setDurationMinutes(source.duration_minutes ?? DEFAULT_APPOINTMENT_DURATION);
      setVisitType(source.visit_type);
      setPathologyId(source.pathology_id ?? '');
      setCustomTreatmentType(source.pathology_id ? '' : (source.treatment_type ?? ''));
      setNotes(source.notes ?? '');
      setLinkedTreatmentId(source.linked_treatment_id ?? '');
    } else {
      setPatientId(preselectedPatientId ?? '');
      setPatientSearch(preselectedPatientName ?? '');
      setConsultationDate(
        defaultDate ? toLocalDatetimeValue(new Date(defaultDate)) : toLocalDatetimeValue(new Date())
      );
      setDurationMinutes(defaultDurationMinutes);
      setVisitType(defaultVisitType ?? 'new_application');
      setPathologyId(defaultPathologyId ?? '');
      setCustomTreatmentType(defaultTreatmentType ?? '');
      setNotes('');
      setLinkedTreatmentId(defaultLinkedTreatmentId ?? '');
    }
    setError(null);
    setOverlapWarning(null);
  }, [
    isOpen,
    savedConsultation,
    editingConsultation,
    internalEditing,
    preselectedPatientId,
    preselectedPatientName,
    defaultVisitType,
    defaultLinkedTreatmentId,
    defaultDate,
    defaultPathologyId,
    defaultTreatmentType,
    defaultDurationMinutes,
  ]);

  useEffect(() => {
    if (!isOpen || patientSearch.length < 2 || isPatientLocked) {
      if (!isPatientLocked) setPatientOptions([]);
      return;
    }

    const searchPatientOptions = async () => {
      const user = await getAuthUser();
      if (!user) return;
      const result = await searchPatients(user.id, patientSearch, 8);
      if (result.data) {
        setPatientOptions(
          result.data.map((patient) => ({
            id: patient.id,
            full_name: patient.full_name,
          }))
        );
      }
    };
    searchPatientOptions();
  }, [patientSearch, isOpen, isPatientLocked]);

  useEffect(() => {
    if (!patientId || visitType !== 'post_application_review') {
      setPatientTreatments([]);
      return;
    }

    const loadTreatments = async () => {
      const { data } = await supabase
        .from('treatments')
        .select('id, date, product_name, total_units, pathology_title')
        .eq('patient_id', patientId)
        .order('date', { ascending: false })
        .limit(20);
      if (data) setPatientTreatments(data);
    };
    loadTreatments();
  }, [patientId, visitType]);

  useEffect(() => {
    if (!linkedTreatmentId) {
      setLinkedTreatmentSummary(null);
      return;
    }
    const treatment = patientTreatments.find((t) => t.id === linkedTreatmentId);
    if (treatment) {
      setLinkedTreatmentSummary(
        `${new Date(treatment.date).toLocaleDateString('es-MX')} — ${treatment.product_name} (${treatment.total_units} U)`
      );
    }
  }, [linkedTreatmentId, patientTreatments]);

  useEffect(() => {
    if (!isOpen || !consultationDate) {
      setOverlapWarning(null);
      return;
    }

    const checkOverlap = async () => {
      try {
        const userId = await getCurrentUserId();
        const dayConsultations = await fetchConsultationsForDay(
          userId,
          new Date(consultationDate),
          activeEditing?.id
        );
        const overlaps = findOverlappingConsultations(
          dayConsultations,
          new Date(consultationDate),
          durationMinutes,
          activeEditing?.id
        );
        if (overlaps.length > 0) {
          const names = overlaps
            .map((o) => o.patientName ?? 'Paciente')
            .join(', ');
          setOverlapWarning(`Posible solapamiento con: ${names}`);
        } else {
          setOverlapWarning(null);
        }
      } catch {
        setOverlapWarning(null);
      }
    };

    const timer = setTimeout(checkOverlap, 300);
    return () => clearTimeout(timer);
  }, [consultationDate, durationMinutes, isOpen, activeEditing?.id]);

  const selectedPathology = pathologiesData.find((p) => p.id === pathologyId);
  const treatmentType = selectedPathology?.title ?? (customTreatmentType.trim() || null);

  const applyDatePreset = (preset: 'tomorrow10' | 'twoWeeks' | 'followUp84') => {
    const date = new Date();
    if (preset === 'tomorrow10') {
      date.setDate(date.getDate() + 1);
      date.setHours(10, 0, 0, 0);
    } else if (preset === 'twoWeeks') {
      date.setDate(date.getDate() + 14);
      date.setHours(9, 0, 0, 0);
    } else {
      date.setDate(date.getDate() + 84);
      date.setHours(9, 0, 0, 0);
    }
    setConsultationDate(toLocalDatetimeValue(date));
  };

  const handleSave = async () => {
    if (!patientId) {
      setError('Selecciona un paciente.');
      return;
    }
    if (!consultationDate) {
      setError('Indica fecha y hora de la cita.');
      return;
    }
    if (visitType === 'post_application_review' && !linkedTreatmentId) {
      setError('Selecciona el tratamiento previo para la revaloración.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        patient_id: patientId,
        consultation_date: new Date(consultationDate).toISOString(),
        visit_type: visitType,
        treatment_type: treatmentType,
        pathology_id: pathologyId || null,
        notes: notes.trim() || null,
        linked_treatment_id: visitType === 'post_application_review' ? linkedTreatmentId : null,
        duration_minutes: durationMinutes,
        source: activeEditing?.source ?? defaultSource,
      };

      let result: Consultation;
      if (isEditing && activeEditing) {
        result = await updateConsultation(activeEditing.id, payload);
      } else {
        result = await createConsultation(payload);
        setSavedConsultation(result);
      }

      onSaved(payload.consultation_date, result);
      if (isEditing) {
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar la cita';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelConsultation = async () => {
    if (!activeEditing) return;
    if (!showCancelReason) {
      setShowCancelReason(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await cancelConsultation(activeEditing.id, cancellationReason);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cancelar la cita';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (showSuccessEdit && savedConsultation) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-green-500 mb-3">check_circle</span>
          <h3 className="text-lg font-bold mb-2">Cita agendada</h3>
          <p className="text-sm text-text-muted mb-4">
            Puedes editar la fecha, hora o detalles antes de cerrar.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                if (savedConsultation) {
                  setInternalEditing(savedConsultation);
                  setSavedConsultation(null);
                }
              }}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl"
            >
              Editar cita
            </button>
            <button
              onClick={() => {
                onClose();
              }}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-text-main dark:text-white">
            {isEditing ? 'Editar cita' : 'Agendar cita'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Paciente *</label>
            {isPatientLocked ? (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium">
                {preselectedPatientName || patientSearch || 'Paciente seleccionado'}
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setPatientId('');
                  }}
                  placeholder="Buscar paciente..."
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                />
                {patientOptions.length > 0 && !patientId && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                    {patientOptions.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPatientId(p.id);
                          setPatientSearch(p.full_name);
                          setPatientOptions([]);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {p.full_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Fecha y hora *</label>
            <input
              type="datetime-local"
              value={consultationDate}
              onChange={(e) => setConsultationDate(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => applyDatePreset('tomorrow10')}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600"
              >
                Mañana 10:00
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('twoWeeks')}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600"
              >
                En 2 semanas
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('followUp84')}
                className="text-[10px] font-bold px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700"
              >
                Revaloración (~12 sem)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Duración</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutos
                </option>
              ))}
            </select>
          </div>

          {overlapWarning && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">{overlapWarning}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Tipo de visita *</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(VISIT_TYPE_LABELS) as VisitType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVisitType(type)}
                  className={`px-4 py-3 rounded-xl text-left text-sm font-medium border transition-colors ${
                    visitType === type
                      ? type === 'new_application'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {VISIT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Patología / motivo</label>
            <select
              value={pathologyId}
              onChange={(e) => {
                setPathologyId(e.target.value);
                if (e.target.value) setCustomTreatmentType('');
              }}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm mb-2"
            >
              <option value="">Seleccionar patología...</option>
              {pathologiesData.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {!pathologyId && (
              <input
                type="text"
                value={customTreatmentType}
                onChange={(e) => setCustomTreatmentType(e.target.value)}
                placeholder="O escribe un motivo personalizado"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            )}
          </div>

          {visitType === 'post_application_review' && (
            <div>
              <label className="block text-sm font-bold text-text-muted mb-2">Tratamiento previo *</label>
              <select
                value={linkedTreatmentId}
                onChange={(e) => setLinkedTreatmentId(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              >
                <option value="">Seleccionar tratamiento...</option>
                {patientTreatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {new Date(t.date).toLocaleDateString('es-MX')} — {t.product_name} ({t.total_units} U)
                    {t.pathology_title ? ` — ${t.pathology_title}` : ''}
                  </option>
                ))}
              </select>
              {linkedTreatmentSummary && (
                <p className="text-xs text-slate-500 mt-1">Vinculado: {linkedTreatmentSummary}</p>
              )}
              {patientId && patientTreatments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Este paciente no tiene tratamientos previos registrados.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notas adicionales de la cita..."
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none"
            />
          </div>

          {showCancelReason && (
            <div>
              <label className="block text-sm font-bold text-text-muted mb-2">
                Motivo de cancelación (opcional)
              </label>
              <input
                type="text"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Agendar cita'}
          </button>
          {isEditing && activeEditing?.status === 'scheduled' && (
            <button
              onClick={handleCancelConsultation}
              disabled={saving}
              className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 font-bold rounded-xl disabled:opacity-50"
            >
              {showCancelReason ? 'Confirmar cancelación' : 'Cancelar cita'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleConsultationModal;
