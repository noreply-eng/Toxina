import React from 'react';
import { getAuthUser } from '../utils/auth';
import AutoResizeTextarea from './AutoResizeTextarea';
import {
  createPatientClinicalNote,
  deletePatientClinicalNote,
  fetchPatientClinicalNotes,
  updatePatientClinicalNote,
} from '../services/patientClinicalNotes';
import {
  CLINICAL_NOTE_TYPE_LABELS,
  type ClinicalNoteType,
  type PatientClinicalNote,
  type PatientClinicalNoteInput,
} from '../types/patientClinicalNotes';

interface PatientClinicalNotesProps {
  patientId: string;
}

const NOTE_TYPES = Object.keys(CLINICAL_NOTE_TYPE_LABELS) as ClinicalNoteType[];

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatNoteDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const EMPTY_FORM: PatientClinicalNoteInput = {
  note_date: todayIsoDate(),
  content: '',
  note_type: 'evolution',
};

const NOTE_PREVIEW_CHARS = 160;

function NoteBody({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const needsTruncate = content.length > NOTE_PREVIEW_CHARS;
  const visible =
    !needsTruncate || expanded ? content : `${content.slice(0, NOTE_PREVIEW_CHARS).trimEnd()}…`;

  return (
    <div className="mt-2">
      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{visible}</p>
      {needsTruncate && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[11px] font-bold text-primary"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}

const PatientClinicalNotes: React.FC<PatientClinicalNotesProps> = ({ patientId }) => {
  const [notes, setNotes] = React.useState<PatientClinicalNote[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [listExpanded, setListExpanded] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<PatientClinicalNoteInput>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const loadNotes = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const user = await getAuthUser();
      if (!user) return;
      const data = await fetchPatientClinicalNotes(user.id, patientId);
      setNotes(data);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('patient_clinical_notes')) {
        setLoadError(
          'Aplica la migración de notas de seguimiento en Supabase para habilitar esta sección.'
        );
      } else {
        setLoadError('No se pudieron cargar las notas de seguimiento.');
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, note_date: todayIsoDate() });
    setEditingId(null);
    setShowForm(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!form.content.trim() || !form.note_date) return;
    setSaving(true);
    setSaveError(null);
    try {
      const user = await getAuthUser();
      if (!user) return;

      const payload: PatientClinicalNoteInput = {
        note_date: form.note_date,
        content: form.content.trim(),
        note_type: form.note_type ?? 'evolution',
      };

      if (editingId) {
        const updated = await updatePatientClinicalNote(user.id, editingId, payload);
        setNotes((prev) =>
          [...prev.map((n) => (n.id === editingId ? updated : n))].sort((a, b) => {
            const byDate = b.note_date.localeCompare(a.note_date);
            if (byDate !== 0) return byDate;
            return b.created_at.localeCompare(a.created_at);
          })
        );
      } else {
        const created = await createPatientClinicalNote(user.id, patientId, payload);
        setNotes((prev) =>
          [created, ...prev].sort((a, b) => {
            const byDate = b.note_date.localeCompare(a.note_date);
            if (byDate !== 0) return byDate;
            return b.created_at.localeCompare(a.created_at);
          })
        );
      }
      resetForm();
    } catch (err) {
      console.error(err);
      setSaveError('No se pudo guardar la nota. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('¿Eliminar esta nota de seguimiento?')) return;
    try {
      const user = await getAuthUser();
      if (!user) return;
      await deletePatientClinicalNote(user.id, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (editingId === noteId) resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (note: PatientClinicalNote) => {
    setForm({
      note_date: note.note_date,
      content: note.content,
      note_type: note.note_type,
    });
    setEditingId(note.id);
    setShowForm(true);
    setListExpanded(true);
    setSaveError(null);
  };

  const latestNote = notes[0];
  const showList = listExpanded || showForm;

  return (
    <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Notas de seguimiento
            {!loading && notes.length > 0 && (
              <span className="ml-2 text-slate-300 dark:text-slate-600 normal-case tracking-normal font-semibold">
                ({notes.length})
              </span>
            )}
          </h3>
          <p className="text-xs text-text-muted mt-1 max-w-prose">
            Registro cronológico de la evolución clínica entre visitas.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM, note_date: todayIsoDate() });
              setEditingId(null);
              setShowForm(true);
              setListExpanded(true);
              setSaveError(null);
            }}
            className="shrink-0 text-xs font-bold text-primary flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nueva
          </button>
        )}
      </div>

      {loadError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-4">
          {loadError}
        </p>
      )}

      {showForm && (
        <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Fecha</label>
              <input
                type="date"
                value={form.note_date}
                onChange={(e) => setForm((prev) => ({ ...prev, note_date: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Tipo</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {NOTE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, note_type: type }))}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      form.note_type === type
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {CLINICAL_NOTE_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Nota clínica</label>
            <AutoResizeTextarea
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Evolución, respuesta al tratamiento, plan de seguimiento..."
              minRows={3}
              className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 py-2 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.content.trim() || !form.note_date}
              className="flex-1 py-2 text-xs font-bold rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted italic py-2">Cargando notas...</p>
      ) : notes.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted italic text-center py-4">
          Sin notas de seguimiento. Agrega la primera para documentar la evolución.
        </p>
      ) : notes.length > 0 ? (
        <>
          {!showList && latestNote && (
            <button
              type="button"
              onClick={() => setListExpanded(true)}
              className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-500">
                    Última nota · {formatNoteDate(latestNote.note_date)}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 line-clamp-2">
                    {latestNote.content}
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-400 shrink-0">expand_more</span>
              </div>
            </button>
          )}

          {showList && (
            <>
              <ol className="relative space-y-0 border-l border-slate-200 dark:border-slate-700 ml-2 pl-4">
                {notes.map((note) => (
                  <li key={note.id} className="relative pb-5 last:pb-0">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white dark:ring-surface-dark" />
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">
                          {formatNoteDate(note.note_date)}
                        </p>
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {CLINICAL_NOTE_TYPE_LABELS[note.note_type] ?? note.note_type}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(note)}
                          className="p-1.5 text-slate-400 hover:text-primary rounded-lg"
                          aria-label="Editar nota"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                          aria-label="Eliminar nota"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                    <NoteBody content={note.content} />
                  </li>
                ))}
              </ol>
              {!showForm && (
                <button
                  type="button"
                  onClick={() => setListExpanded(false)}
                  className="mt-3 text-xs font-bold text-slate-500 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">expand_less</span>
                  Ocultar historial
                </button>
              )}
            </>
          )}
        </>
      ) : null}
    </section>
  );
};

export default PatientClinicalNotes;
