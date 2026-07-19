import type { GasScore } from '../constants/gasScale';

export interface PatientGoalScore {
  id: string;
  user_id: string;
  patient_id: string;
  goal_id: string;
  score: GasScore;
  scored_at: string;
  consultation_id?: string | null;
  treatment_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientGoalScoreInput {
  score: GasScore;
  scored_at: string;
  consultation_id?: string | null;
  treatment_id?: string | null;
  notes?: string | null;
}

export type PatientGoalScoreUpdate = Partial<PatientGoalScoreInput>;
