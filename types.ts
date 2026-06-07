
export enum Screen {
  Dashboard = 'dashboard',
  Search = 'search',
  Calculator = 'calculator',
  MotorPoints = 'motor-points',
  MotorPointDetail = 'motor-point-detail',
  Settings = 'settings',
  PatientProfile = 'patient-profile',
  Subscription = 'subscription',
  Login = 'login',
  Signup = 'signup'
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  specialty: string | null;
  avatar_url: string | null;
  subscription_tier: string;
  general_license?: string | null;
  specialist_license?: string | null;
  default_brand?: string;
  unit_system?: string;
  default_dose_option?: string;
  default_dilution?: string;
  language?: string;
  dark_mode?: boolean;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  privacy_sensitive_accepted_at?: string | null;
  privacy_version?: string | null;
  secondary_purposes_accepted_at?: string | null;
  consent_revoked_at?: string | null;
}

export interface BucketListItem {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'done';
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  weight?: number;
  height?: number;
  lastTreatmentDate?: string;
  lastProduct?: string;
  history: Treatment[];
}

export interface Treatment {
  id: string;
  date: string;
  product: string;
  totalUnits: number;
  zones: {
    name: string;
    units: number;
  }[];
}

export interface MuscleZone {
  id: string;
  name: string;
  latinName: string;
  maxDose: number;
  defaultDose: number;
  category: 'superior' | 'inferior' | 'face' | 'neck';
}
