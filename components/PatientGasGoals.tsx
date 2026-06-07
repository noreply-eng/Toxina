import React from 'react';
import { getAuthUser } from '../utils/auth';
import AutoResizeTextarea from './AutoResizeTextarea';
import {
  createPatientGoal,
  deletePatientGoal,
  fetchPatientGoals,
  updatePatientGoal,
} from '../services/patientGoals';
import {
  GAS_DESCRIPTOR_FIELDS,
  GAS_SCORE_LABELS,
  GAS_SCORE_SHORT,
  GAS_SCORES,
  SMART_FIELDS,
  type GasScore,
} from '../constants/gasScale';
import {
  applyGasTemplate,
  formatSuggestedDate,
  GAS_GOAL_TEMPLATES,
  GAS_TEMPLATE_CATEGORIES,
  type GasGoalTemplate,
} from '../constants/gasGoalTemplates';
import type { PatientGoal, PatientGoalInput } from '../types/patientGoals';

interface PatientGasGoalsProps {
  patientId: string;
}

const EMPTY_FORM: PatientGoalInput = {
  title: '',
  smart_specific: '',
  smart_measurable: '',
  smart_achievable: '',
  smart_relevant: '',
  smart_timebound: '',
  gas_minus2: '',
  gas_minus1: '',
  gas_zero: '',
  gas_plus1: '',
  gas_plus2: '',
  target_date: '',
};

function scoreButtonClass(score: GasScore, current: GasScore | null | undefined, interactive: boolean) {
  const base =
    'flex-1 min-w-0 py-2 px-1 rounded-lg text-center transition-all border text-[11px] font-bold leading-tight';
  const isActive = current === score;

  if (score <= -1) {
    return `${base} ${isActive ? 'bg-red-500 text-white border-red-500 shadow-sm' : interactive ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/40 hover:bg-red-100' : 'bg-red-50/50 dark:bg-red-900/10 text-red-400 border-red-50 dark:border-red-900/20'}`;
  }
  if (score === 0) {
    return `${base} ${isActive ? 'bg-primary text-white border-primary shadow-sm' : interactive ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' : 'bg-primary/5 text-primary/60 border-primary/10'}`;
  }
  return `${base} ${isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : interactive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/40 hover:bg-emerald-100' : 'bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-400 border-emerald-50 dark:border-emerald-900/20'}`;
}

function goalToForm(goal: PatientGoal): PatientGoalInput {
  return {
    title: goal.title,
    smart_specific: goal.smart_specific ?? '',
    smart_measurable: goal.smart_measurable ?? '',
    smart_achievable: goal.smart_achievable ?? '',
    smart_relevant: goal.smart_relevant ?? '',
    smart_timebound: goal.smart_timebound ?? '',
    gas_minus2: goal.gas_minus2 ?? '',
    gas_minus1: goal.gas_minus1 ?? '',
    gas_zero: goal.gas_zero,
    gas_plus1: goal.gas_plus1 ?? '',
    gas_plus2: goal.gas_plus2 ?? '',
    target_date: goal.target_date ?? '',
  };
}

function getGasDescriptor(goal: PatientGoal, score: GasScore): string | null {
  const map: Record<GasScore, string | null | undefined> = {
    [-2]: goal.gas_minus2,
    [-1]: goal.gas_minus1,
    [0]: goal.gas_zero,
    [1]: goal.gas_plus1,
    [2]: goal.gas_plus2,
  };
  return map[score]?.trim() || null;
}

const PatientGasGoals: React.FC<PatientGasGoalsProps> = ({ patientId }) => {
  const [goals, setGoals] = React.useState<PatientGoal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<PatientGoalInput>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [updatingScoreId, setUpdatingScoreId] = React.useState<string | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const [templateCategory, setTemplateCategory] = React.useState<string>('Todos');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null);

  const loadGoals = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const user = await getAuthUser();
      if (!user) return;
      const data = await fetchPatientGoals(user.id, patientId);
      setGoals(data);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('patient_goals')) {
        setLoadError('Aplica la migración de objetivos GAS en Supabase para habilitar esta sección.');
      } else {
        setLoadError('No se pudieron cargar los objetivos.');
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setSelectedTemplateId(null);
    setTemplateCategory('Todos');
  };

  const applyTemplate = (template: GasGoalTemplate) => {
    setForm(applyGasTemplate(template));
    setSelectedTemplateId(template.id);
  };

  const filteredTemplates =
    templateCategory === 'Todos'
      ? GAS_GOAL_TEMPLATES
      : GAS_GOAL_TEMPLATES.filter((t) => t.category === templateCategory);

  const handleSave = async () => {
    if (!form.title.trim() || !form.gas_zero.trim()) return;
    setSaving(true);
    try {
      const user = await getAuthUser();
      if (!user) return;

      const payload: PatientGoalInput = {
        title: form.title.trim(),
        gas_zero: form.gas_zero.trim(),
        smart_specific: form.smart_specific?.trim() || null,
        smart_measurable: form.smart_measurable?.trim() || null,
        smart_achievable: form.smart_achievable?.trim() || null,
        smart_relevant: form.smart_relevant?.trim() || null,
        smart_timebound: form.smart_timebound?.trim() || null,
        gas_minus2: form.gas_minus2?.trim() || null,
        gas_minus1: form.gas_minus1?.trim() || null,
        gas_plus1: form.gas_plus1?.trim() || null,
        gas_plus2: form.gas_plus2?.trim() || null,
        target_date: form.target_date || null,
      };

      if (editingId) {
        const updated = await updatePatientGoal(user.id, editingId, payload);
        setGoals((prev) => prev.map((g) => (g.id === editingId ? updated : g)));
      } else {
        const created = await createPatientGoal(user.id, patientId, payload);
        setGoals((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleScoreUpdate = async (goalId: string, score: GasScore) => {
    setUpdatingScoreId(goalId);
    try {
      const user = await getAuthUser();
      if (!user) return;
      const updated = await updatePatientGoal(user.id, goalId, { current_score: score });
      setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingScoreId(null);
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!window.confirm('¿Eliminar este objetivo?')) return;
    try {
      const user = await getAuthUser();
      if (!user) return;
      await deletePatientGoal(user.id, goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      if (expandedId === goalId) setExpandedId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (goal: PatientGoal) => {
    setForm(goalToForm(goal));
    setEditingId(goal.id);
    setShowForm(true);
  };

  const updateField = (key: keyof PatientGoalInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="bg-white dark:bg-surface-dark rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Objetivos SMART · Escala GAS
          </h3>
          <p className="text-xs text-text-muted mt-1 max-w-prose">
            Define la meta esperada (nivel 0) y califica el logro en cada visita (-2 a +2).
          </p>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-[11px] font-bold text-primary mt-2 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">help</span>
            {showHelp ? 'Ocultar guía rápida' : '¿Cómo funciona GAS + SMART?'}
          </button>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 text-xs font-bold text-primary flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Nuevo
          </button>
        )}
      </div>

      {loadError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-4">
          {loadError}
        </p>
      )}

      {showHelp && (
        <div className="mb-4 p-4 rounded-xl bg-blue-50/80 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/30 text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <p>
            <strong>SMART</strong> ayuda a redactar una meta clara con el paciente.{' '}
            <strong>GAS</strong> mide cuánto se logró comparado con esa meta.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>Nivel 0</strong> = resultado esperado (la meta). Es el único campo obligatorio además del título.
            </li>
            <li>
              <strong>-2 / -1</strong> = peor de lo esperado (sin cambio o mejora parcial).
            </li>
            <li>
              <strong>+1 / +2</strong> = mejor de lo esperado (resultado superior a la meta).
            </li>
          </ul>
          <p className="text-text-muted">
            Tip: usa una plantilla, ajusta con el paciente y guarda. En cada revaloración, selecciona el nivel alcanzado.
          </p>
        </div>
      )}

      {showForm && (
        <div className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 space-y-4">
          {!editingId && (
            <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Plantillas clínicas</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Escenarios reales prellenados. Selecciona uno y personaliza con el paciente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Todos', ...GAS_TEMPLATE_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTemplateCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                      templateCategory === cat
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedTemplateId === template.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/40'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase text-primary">{template.category}</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-white mt-0.5">{template.label}</p>
                    <p className="text-[10px] text-text-muted mt-1 line-clamp-2">{template.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Meta sugerida: {formatSuggestedDate(template.suggestedDays)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Objetivo principal</label>
            <AutoResizeTextarea
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Ej. Mejorar apertura de mano para agarrar un vaso"
              minRows={1}
              className="mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Criterios SMART</p>
              <div className="space-y-3">
                {SMART_FIELDS.map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className="text-[11px] font-bold text-primary">{label}</label>
                    <AutoResizeTextarea
                      value={(form[key] as string) ?? ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={hint}
                      minRows={1}
                      className="mt-1 w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Descriptores GAS</p>
              <p className="text-[10px] text-text-muted mb-2">
                Describe qué verías en cada nivel. El nivel 0 es la meta acordada.
              </p>
              <div className="space-y-2">
                {GAS_DESCRIPTOR_FIELDS.map(({ key, label, hint, score }) => (
                  <div key={key}>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {label}
                      {score === 0 && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <AutoResizeTextarea
                      value={(form[key] as string) ?? ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={hint}
                      minRows={1}
                      className="mt-1 w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Fecha meta</label>
            <p className="text-[10px] text-text-muted mb-1">
              Usualmente 2–6 semanas post-toxina (estética: ~14 días; migraña: ~8 semanas).
            </p>
            <input
              type="date"
              value={form.target_date ?? ''}
              onChange={(e) => updateField('target_date', e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.gas_zero.trim()}
              className="flex-1 py-2 text-xs font-bold rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar objetivo'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted italic text-center py-4">Cargando objetivos...</p>
      ) : goals.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted italic text-center py-4">
          Sin objetivos registrados. Agrega metas SMART con la escala GAS.
        </p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const isExpanded = expandedId === goal.id;
            const activeDescriptor =
              goal.current_score != null ? getGasDescriptor(goal, goal.current_score) : null;

            return (
              <article
                key={goal.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden"
              >
                <div className="p-4 bg-slate-50/70 dark:bg-slate-800/30">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">{goal.title}</h4>
                      {goal.target_date && (
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Meta: {new Date(goal.target_date + 'T12:00:00').toLocaleDateString('es-MX')}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(goal)}
                        className="p-1.5 text-slate-400 hover:text-primary rounded-lg"
                        aria-label="Editar objetivo"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                        aria-label="Eliminar objetivo"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                    Logro actual
                  </p>
                  <div className="flex gap-1.5">
                    {GAS_SCORES.map((score) => (
                      <button
                        key={score}
                        type="button"
                        disabled={updatingScoreId === goal.id}
                        onClick={() => handleScoreUpdate(goal.id, score)}
                        className={scoreButtonClass(score, goal.current_score, true)}
                        title={GAS_SCORE_LABELS[score]}
                      >
                        <span className="block">{GAS_SCORE_SHORT[score]}</span>
                        <span className="block font-medium normal-case mt-0.5 hidden sm:block truncate">
                          {GAS_SCORE_LABELS[score]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {goal.current_score != null && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                      <span className="font-bold">{GAS_SCORE_LABELS[goal.current_score]}</span>
                      {activeDescriptor ? `: ${activeDescriptor}` : ''}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : goal.id)}
                  className="w-full px-4 py-2 text-[11px] font-bold text-slate-500 flex items-center justify-center gap-1 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-surface-dark"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                  {isExpanded ? 'Ocultar detalle SMART/GAS' : 'Ver detalle SMART/GAS'}
                </button>

                {isExpanded && (
                  <div className="p-4 space-y-4 bg-white dark:bg-surface-dark border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SMART_FIELDS.map(({ key, label }) => {
                        const value = goal[key as keyof PatientGoal] as string | null | undefined;
                        if (!value?.trim()) return null;
                        return (
                          <div key={key}>
                            <p className="text-[10px] font-bold uppercase text-primary">{label}</p>
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      {GAS_DESCRIPTOR_FIELDS.map(({ score, label }) => {
                        const value = getGasDescriptor(goal, score);
                        if (!value) return null;
                        return (
                          <div
                            key={score}
                            className={`p-2.5 rounded-lg text-xs border ${
                              goal.current_score === score
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-slate-100 dark:border-slate-800'
                            }`}
                          >
                            <span className="font-bold text-slate-500">{label}: </span>
                            {value}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PatientGasGoals;
