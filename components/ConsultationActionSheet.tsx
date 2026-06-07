import React from 'react';
import type { Consultation } from '../types/clinical';
import { CONSULTATION_STATUS_LABELS } from '../types/clinical';
import { getPatientFromConsultation } from '../hooks/useConsultations';

interface ConsultationActionSheetProps {
  consultation: Consultation;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onStart?: () => void;
}

const ConsultationActionSheet: React.FC<ConsultationActionSheetProps> = ({
  consultation,
  onClose,
  onEdit,
  onComplete,
  onCancel,
  onNoShow,
  onStart,
}) => {
  const patient = getPatientFromConsultation(consultation);
  const isActive =
    consultation.status === 'scheduled' || consultation.status === 'in_progress';
  const isPast = new Date(consultation.consultation_date) < new Date();
  const canNoShow =
    consultation.status === 'scheduled' && isPast;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-t-2xl p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-2">
          <p className="text-sm font-bold">{patient?.full_name ?? 'Paciente'}</p>
          <p className="text-xs text-text-muted">
            {CONSULTATION_STATUS_LABELS[consultation.status]}
          </p>
        </div>

        <button
          onClick={onEdit}
          className="w-full py-3 text-sm font-bold rounded-xl bg-slate-100 dark:bg-slate-800"
        >
          Editar cita
        </button>

        {onStart && isActive && (
          <button
            onClick={onStart}
            className="w-full py-3 text-sm font-bold rounded-xl bg-primary text-white"
          >
            {consultation.status === 'in_progress' ? 'Continuar consulta' : 'Iniciar consulta'}
          </button>
        )}

        {isActive && consultation.visit_type === 'post_application_review' && (
          <button
            onClick={onComplete}
            className="w-full py-3 text-sm font-bold rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700"
          >
            Marcar completada (sin tratamiento)
          </button>
        )}

        {isActive && consultation.visit_type === 'new_application' && (
          <button
            onClick={onComplete}
            className="w-full py-3 text-sm font-bold rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700"
          >
            Marcar completada manualmente
          </button>
        )}

        {canNoShow && (
          <button
            onClick={onNoShow}
            className="w-full py-3 text-sm font-bold rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700"
          >
            Marcar no asistió
          </button>
        )}

        {consultation.status === 'scheduled' && (
          <button
            onClick={onCancel}
            className="w-full py-3 text-sm font-bold rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600"
          >
            Cancelar cita
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-bold rounded-xl text-slate-500"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default ConsultationActionSheet;
