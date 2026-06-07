import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getAuthUser } from '../utils/auth';
import { searchPatients } from '../hooks/usePatients';
import { pathologiesData } from '../data/pathologyData';
import {
  createConsultation,
  updateConsultation,
  cancelConsultation,
} from '../hooks/useConsultations';
import type { Consultation, VisitType } from '../types/clinical';
import { VISIT_TYPE_LABELS } from '../types/clinical';

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
  onSaved: (savedDate?: string) => void;
  preselectedPatientId?: string;
  preselectedPatientName?: string;
  editingConsultation?: Consultation | null;
  defaultVisitType?: VisitType;
  defaultLinkedTreatmentId?: string;
  defaultDate?: string;
}

function toLocalDatetimeValue(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
}) => {
  const [patientId, setPatientId] = useState(preselectedPatientId ?? '');
  const [patientSearch, setPatientSearch] = useState(preselectedPatientName ?? '');
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);
  const [consultationDate, setConsultationDate] = useState(toLocalDatetimeValue(defaultDate));
  const [visitType, setVisitType] = useState<VisitType>(defaultVisitType ?? 'new_application');
  const [pathologyId, setPathologyId] = useState('');
  const [customTreatmentType, setCustomTreatmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [linkedTreatmentId, setLinkedTreatmentId] = useState(defaultLinkedTreatmentId ?? '');
  const [patientTreatments, setPatientTreatments] = useState<TreatmentOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(editingConsultation);
  const isPatientLocked = Boolean(preselectedPatientId);

  useEffect(() => {
    if (!isOpen) return;

    if (editingConsultation) {
      setPatientId(editingConsultation.patient_id);
      setConsultationDate(toLocalDatetimeValue(editingConsultation.consultation_date));
      setVisitType(editingConsultation.visit_type);
      setPathologyId(editingConsultation.pathology_id ?? '');
      setCustomTreatmentType(
        editingConsultation.pathology_id ? '' : (editingConsultation.treatment_type ?? '')
      );
      setNotes(editingConsultation.notes ?? '');
      setLinkedTreatmentId(editingConsultation.linked_treatment_id ?? '');
    } else {
      setPatientId(preselectedPatientId ?? '');
      setPatientSearch(preselectedPatientName ?? '');
      setConsultationDate(toLocalDatetimeValue(defaultDate));
      setVisitType(defaultVisitType ?? 'new_application');
      setPathologyId('');
      setCustomTreatmentType('');
      setNotes('');
      setLinkedTreatmentId(defaultLinkedTreatmentId ?? '');
    }
    setError(null);
  }, [isOpen, editingConsultation, preselectedPatientId, preselectedPatientName, defaultVisitType, defaultLinkedTreatmentId, defaultDate]);

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

  const selectedPathology = pathologiesData.find((p) => p.id === pathologyId);
  const treatmentType = selectedPathology?.title ?? (customTreatmentType.trim() || null);

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
      };

      const savedIso = payload.consultation_date;

      if (isEditing && editingConsultation) {
        await updateConsultation(editingConsultation.id, payload);
      } else {
        await createConsultation(payload);
      }

      onSaved(savedIso);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar la cita';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelConsultation = async () => {
    if (!editingConsultation) return;
    setSaving(true);
    setError(null);
    try {
      await cancelConsultation(editingConsultation.id);
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
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Patient */}
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Paciente *</label>
            {isPatientLocked ? (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium">
                {preselectedPatientName || 'Paciente seleccionado'}
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

          {/* Date/time */}
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2">Fecha y hora *</label>
            <input
              type="datetime-local"
              value={consultationDate}
              onChange={(e) => setConsultationDate(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            />
          </div>

          {/* Visit type */}
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

          {/* Pathology */}
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

          {/* Linked treatment for post-application review */}
          {visitType === 'post_application_review' && (
            <div>
              <label className="block text-sm font-bold text-text-muted mb-2">
                Tratamiento previo *
              </label>
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
              {patientId && patientTreatments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Este paciente no tiene tratamientos previos registrados.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
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
          {isEditing && editingConsultation?.status === 'scheduled' && (
            <button
              onClick={handleCancelConsultation}
              disabled={saving}
              className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 font-bold rounded-xl disabled:opacity-50"
            >
              Cancelar cita
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleConsultationModal;
