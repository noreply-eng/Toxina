import { supabase } from '../supabaseClient';
import type { PatientGoal } from '../types/patientGoals';
import type {
  PatientGoalScore,
  PatientGoalScoreInput,
  PatientGoalScoreUpdate,
} from '../types/patientGoalScores';

const SCORE_SELECT = '*';

export async function fetchPatientGoalScores(
  userId: string,
  patientId: string
): Promise<PatientGoalScore[]> {
  const { data, error } = await supabase
    .from('patient_goal_scores')
    .select(SCORE_SELECT)
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .order('scored_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PatientGoalScore[];
}

export async function fetchGoalScores(
  userId: string,
  goalId: string
): Promise<PatientGoalScore[]> {
  const { data, error } = await supabase
    .from('patient_goal_scores')
    .select(SCORE_SELECT)
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .order('scored_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PatientGoalScore[];
}

/** Upsert today's (or dated) evaluation and keep patient_goals.current_score in sync. */
export async function recordPatientGoalScore(
  userId: string,
  patientId: string,
  goalId: string,
  input: PatientGoalScoreInput
): Promise<{ score: PatientGoalScore; goal: PatientGoal }> {
  const payload = {
    user_id: userId,
    patient_id: patientId,
    goal_id: goalId,
    score: input.score,
    scored_at: input.scored_at,
    consultation_id: input.consultation_id ?? null,
    treatment_id: input.treatment_id ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data: scoreRow, error: scoreError } = await supabase
    .from('patient_goal_scores')
    .upsert(payload, { onConflict: 'goal_id,scored_at' })
    .select(SCORE_SELECT)
    .single();

  if (scoreError) throw scoreError;

  const { data: goalRow, error: goalError } = await supabase
    .from('patient_goals')
    .update({ current_score: input.score })
    .eq('user_id', userId)
    .eq('id', goalId)
    .select('*')
    .single();

  if (goalError) throw goalError;

  return {
    score: scoreRow as PatientGoalScore,
    goal: goalRow as PatientGoal,
  };
}

export async function updatePatientGoalScore(
  userId: string,
  scoreId: string,
  input: PatientGoalScoreUpdate
): Promise<PatientGoalScore> {
  const { data, error } = await supabase
    .from('patient_goal_scores')
    .update({
      ...input,
      notes: input.notes !== undefined ? input.notes?.trim() || null : undefined,
    })
    .eq('user_id', userId)
    .eq('id', scoreId)
    .select(SCORE_SELECT)
    .single();

  if (error) throw error;
  return data as PatientGoalScore;
}

export async function deletePatientGoalScore(userId: string, scoreId: string): Promise<void> {
  const { error } = await supabase
    .from('patient_goal_scores')
    .delete()
    .eq('user_id', userId)
    .eq('id', scoreId);

  if (error) throw error;
}
