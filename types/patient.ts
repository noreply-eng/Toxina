export interface PatientRecord {
  id: string;
  user_id: string;
  full_name: string;
  birth_date?: string | null;
  email?: string | null;
  phone?: string | null;
  weight?: number | null;
  age?: number | null;
  height?: number | null;
  gender?: string | null;
  avatar_url?: string | null;
  medical_summary?: string | null;
  medical_history?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  notes?: string | null;
  created_at?: string;
  offlinePending?: boolean;
}
