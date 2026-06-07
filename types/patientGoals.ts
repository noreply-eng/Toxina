import type { GasScore, PatientGoalStatus } from '../constants/gasScale';

export interface PatientGoal {
  id: string;
  user_id: string;
  patient_id: string;
  title: string;
  smart_specific?: string | null;
  smart_measurable?: string | null;
  smart_achievable?: string | null;
  smart_relevant?: string | null;
  smart_timebound?: string | null;
  gas_minus2?: string | null;
  gas_minus1?: string | null;
  gas_zero: string;
  gas_plus1?: string | null;
  gas_plus2?: string | null;
  current_score?: GasScore | null;
  target_date?: string | null;
  status: PatientGoalStatus;
  created_at: string;
  updated_at: string;
}

export interface PatientGoalInput {
  title: string;
  smart_specific?: string | null;
  smart_measurable?: string | null;
  smart_achievable?: string | null;
  smart_relevant?: string | null;
  smart_timebound?: string | null;
  gas_minus2?: string | null;
  gas_minus1?: string | null;
  gas_zero: string;
  gas_plus1?: string | null;
  gas_plus2?: string | null;
  current_score?: GasScore | null;
  target_date?: string | null;
  status?: PatientGoalStatus;
}

export type PatientGoalUpdate = Partial<PatientGoalInput>;
