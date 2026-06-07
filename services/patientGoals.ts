import { supabase } from '../supabaseClient';
import type { PatientGoal, PatientGoalInput, PatientGoalUpdate } from '../types/patientGoals';

const GOAL_SELECT = '*';

export async function fetchPatientGoals(
  userId: string,
  patientId: string
): Promise<PatientGoal[]> {
  const { data, error } = await supabase
    .from('patient_goals')
    .select(GOAL_SELECT)
    .eq('user_id', userId)
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as PatientGoal[];
}

export async function createPatientGoal(
  userId: string,
  patientId: string,
  input: PatientGoalInput
): Promise<PatientGoal> {
  const { data, error } = await supabase
    .from('patient_goals')
    .insert({
      user_id: userId,
      patient_id: patientId,
      ...input,
      status: input.status ?? 'active',
    })
    .select(GOAL_SELECT)
    .single();

  if (error) throw error;
  return data as PatientGoal;
}

export async function updatePatientGoal(
  userId: string,
  goalId: string,
  input: PatientGoalUpdate
): Promise<PatientGoal> {
  const { data, error } = await supabase
    .from('patient_goals')
    .update(input)
    .eq('user_id', userId)
    .eq('id', goalId)
    .select(GOAL_SELECT)
    .single();

  if (error) throw error;
  return data as PatientGoal;
}

export async function deletePatientGoal(userId: string, goalId: string): Promise<void> {
  const { error } = await supabase
    .from('patient_goals')
    .delete()
    .eq('user_id', userId)
    .eq('id', goalId);

  if (error) throw error;
}
