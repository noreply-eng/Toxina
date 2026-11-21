import type {
  BillingMode,
  FeatureKey,
  SubscriptionOrigin,
  SubscriptionPlanRecord,
  SubscriptionTier,
  UserRole,
} from '../entitlements/planCatalog';

export interface PlatformSettingsAdmin {
  id: number;
  billing_mode: BillingMode;
  launch_promo_banner_enabled: boolean;
  launch_promo_banner_text: string;
  launch_promo_ends_at: string | null;
  launch_default_grant_days: number | null;
  founder_discount_percent: number;
  enterprise_batch_size: number;
  enforce_entitlements: boolean;
  stripe_ready_checked_at: string | null;
  updated_at: string;
}

export interface GlobalKpis {
  platform_settings: PlatformSettingsAdmin;
  users: {
    total: number;
    active_30d: number;
    new_7d: number;
    enterprise_users: number;
    by_tier: { free: number; plus: number; premium: number };
    by_origin: {
      launch_promo: number;
      admin_grant: number;
      enterprise_license: number;
      paid: number;
    };
  };
  billing: {
    mrr_collected_cents: number;
    mrr_projected_launch_cents: number;
    past_due_count: number;
    stripe_plans_total: number;
    stripe_plans_linked: number;
  };
  clinics: { total: number; active: number };
  enterprise: {
    accounts: number;
    licenses_sold: number;
    licenses_active: number;
    licenses_available: number;
  };
  clinical: {
    patients_total: number;
    treatments_30d: number;
    consultations_30d: number;
    brand_breakdown: { brand: string; count: number }[];
  };
  compliance: { arco_pending: number };
}

export interface AccountLimits {
  max_team_users?: number | null;
  max_patients?: number | null;
  max_clinics_owned?: number | null;
  max_templates?: number | null;
  max_enterprise_batches?: number | null;
  can_create_clinic?: boolean;
  can_invite_team?: boolean;
  can_export_all_data?: boolean;
  can_remove_branding?: boolean;
  early_access_beta?: boolean;
}

export interface UpdateUserAccountPayload {
  full_name?: string | null;
  specialty?: string | null;
  phone?: string | null;
  general_license?: string | null;
  specialist_license?: string | null;
  role?: UserRole;
  is_active?: boolean;
  status?: 'active' | 'pending' | 'suspended';
  feature_overrides?: Partial<Record<FeatureKey, boolean>>;
  account_limits?: AccountLimits;
  admin_notes?: string | null;
  reset_legal_consent?: boolean;
}

export interface AdminUserSubscriptionSummary {
  id: string;
  plan_slug: string;
  plan_name: string;
  tier: SubscriptionTier;
  status: string;
  origin: SubscriptionOrigin;
  billing_interval: string;
  seat_limit?: number;
  price_cents_at_signup?: number;
  payment_processor?: string | null;
  cancel_at_period_end?: boolean;
  notes?: string | null;
  current_period_end: string | null;
  is_founder: boolean;
  protected_from_auto_downgrade: boolean;
  grant_reason: string | null;
  sponsor_name: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  specialty: string | null;
  phone: string | null;
  general_license: string | null;
  specialist_license: string | null;
  role: UserRole;
  is_active: boolean;
  status: 'active' | 'pending' | 'suspended';
  subscription_tier: SubscriptionTier;
  feature_overrides: Partial<Record<FeatureKey, boolean>>;
  account_limits?: AccountLimits;
  admin_notes: string | null;
  terms_accepted_at: string | null;
  privacy_sensitive_accepted_at: string | null;
  consent_revoked_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  patients_count: number;
  treatments_count: number;
  clinics?: {
    clinic_id: string;
    name: string;
    role_in_clinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
    status: string;
    members_count?: number;
    active_seat_limit?: number | null;
    active_plan_name?: string | null;
  }[];
  enterprise_orgs?: {
    id: string;
    name: string;
    brand_display_name: string;
    organization_type: string;
    role_in_org: 'owner' | 'manager' | 'billing';
    status: string;
    total_licenses?: number;
    active_licenses?: number;
  }[];
  active_subscription: AdminUserSubscriptionSummary | null;
}

export type EnterpriseOrgType =
  | 'pharma'
  | 'aesthetic_school'
  | 'university'
  | 'medical_society'
  | 'hospital_group'
  | 'other';

export interface EnterpriseAccountRow {
  id: string;
  name: string;
  slug: string;
  organization_type: EnterpriseOrgType;
  brand_display_name: string;
  logo_url?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tax_id: string | null;
  status: 'active' | 'trial' | 'suspended' | 'archived';
  allow_license_reassignment: boolean;
  default_license_duration_days: number | null;
  notes: string | null;
  created_at: string;
  total_licenses: number;
  pending_licenses: number;
  active_licenses: number;
  vouchers_count: number;
  managers: { user_id: string; email: string | null; full_name: string | null; role_in_org: string }[];
}

export interface EnterpriseBatchRow {
  id: string;
  enterprise_account_id: string;
  batch_count: number;
  licenses_per_batch: number;
  total_licenses: number;
  billing_interval: 'monthly' | 'annual' | 'custom' | 'pilot_free';
  unit_batch_price_cents: number;
  amount_total_cents: number;
  currency: string;
  status: 'pending_payment' | 'active' | 'past_due' | 'expired' | 'canceled';
  payment_processor: 'comped' | 'manual' | 'stripe' | 'mercadopago';
  starts_at: string;
  expires_at: string | null;
  purchase_order_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface EnterpriseVoucherRow {
  id: string;
  enterprise_account_id: string;
  code: string;
  campaign_name: string | null;
  voucher_type: 'single_use' | 'multi_use';
  max_redemptions: number;
  times_redeemed: number;
  license_duration_days: number | null;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EnterpriseLicenseRow {
  id: string;
  user_id: string;
  doctor_name: string | null;
  doctor_email: string | null;
  doctor_specialty: string | null;
  voucher_code: string | null;
  campaign_name: string | null;
  status: 'active' | 'revoked' | 'expired';
  activated_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface EnterprisePortalData {
  has_account: boolean;
  account?: EnterpriseAccountRow;
  summary?: {
    total_licenses: number;
    active_licenses: number;
    available_licenses: number;
    batch_size: number;
  };
  batch_pricing?: {
    price_monthly_cents: number;
    price_annual_cents: number;
    currency: string;
    billing_mode: BillingMode;
  };
  batches?: EnterpriseBatchRow[];
  vouchers?: EnterpriseVoucherRow[];
  licenses?: EnterpriseLicenseRow[];
  managers?: { id: string; user_id: string; role_in_org: string; full_name: string | null; email: string | null }[];
}

export interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
  break_start?: string;
  break_end?: string;
}

export type WorkingHoursMap = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  DaySchedule
>;

export interface ClinicSummaryRow {
  id: string;
  name: string;
  slug: string | null;
  type: 'solo_practice' | 'clinic' | 'hospital' | 'aesthetic_center' | 'rehab_center';
  city: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  director_name: string | null;
  is_active: boolean;
  created_at: string;
  members_count: number;
  patients_count: number;
  active_subscription: {
    id: string;
    plan_slug: string;
    plan_name: string;
    tier: SubscriptionTier;
    status: string;
    seat_limit: number;
    current_period_end: string | null;
  } | null;
}

export interface ClinicDetailData {
  clinic: ClinicSummaryRow & { address?: string | null; license_number?: string | null };
  configuration: {
    id: string;
    working_hours: WorkingHoursMap;
    holidays: { date: string; label: string }[];
    default_appointment_duration: number;
    buffer_minutes: number;
    allow_cross_doctor_patient_view: boolean;
  } | null;
  members: {
    id: string;
    user_id: string;
    role_in_clinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
    status: string;
    is_active: boolean;
    full_name: string | null;
    email: string | null;
    specialty: string | null;
  }[];
  patients_count: number;
  treatments_count: number;
  subscriptions: {
    id: string;
    plan_slug: string;
    plan_name: string;
    tier: SubscriptionTier;
    status: string;
    origin: string;
    seat_limit: number;
    current_period_end: string | null;
    created_at: string;
  }[];
}

export interface GlobalPatientRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  user_id: string;
  doctor_name: string | null;
  doctor_email: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  created_at: string;
  treatments_count: number;
  last_treatment_date: string | null;
}

export type SubscriptionStatusValue =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'expired';

export type SubscriptionIntervalValue = 'monthly' | 'annual' | 'lifetime' | 'custom';
export type PaymentProcessorValue = 'comped' | 'manual' | 'stripe' | 'mercadopago';

export interface AdminSubscriptionRow {
  id: string;
  subscriber_type: 'individual' | 'clinic';
  user_id: string | null;
  clinic_id?: string | null;
  user_name: string | null;
  user_email: string | null;
  clinic_name: string | null;
  sponsor_name: string | null;
  plan_id?: string;
  plan_slug: string;
  plan_name: string;
  tier: SubscriptionTier;
  status: SubscriptionStatusValue | string;
  origin: SubscriptionOrigin;
  billing_interval: SubscriptionIntervalValue | string;
  seat_limit?: number;
  price_cents_at_signup: number;
  is_founder: boolean;
  protected_from_auto_downgrade: boolean;
  cancel_at_period_end?: boolean;
  grant_reason: string | null;
  notes?: string | null;
  current_period_start?: string | null;
  current_period_end: string | null;
  payment_processor: PaymentProcessorValue | string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface UpdateSubscriptionPayload {
  plan_slug?: string;
  status?: SubscriptionStatusValue;
  origin?: SubscriptionOrigin;
  billing_interval?: SubscriptionIntervalValue;
  payment_processor?: PaymentProcessorValue;
  seat_limit?: number;
  price_cents_at_signup?: number;
  is_founder?: boolean;
  protected_from_auto_downgrade?: boolean;
  cancel_at_period_end?: boolean;
  grant_reason?: string | null;
  notes?: string | null;
  current_period_end?: string | null;
}

export interface BillingOverviewData {
  subscriptions: AdminSubscriptionRow[];
  payments: {
    id: string;
    invoice_number: string | null;
    user_email: string | null;
    clinic_name: string | null;
    enterprise_name: string | null;
    amount_cents: number;
    currency: string;
    payment_method: string;
    processor: string;
    reference_code: string | null;
    status: string;
    paid_at: string;
  }[];
  promo_codes: {
    id: string;
    code: string;
    description: string | null;
    discount_type: 'percent' | 'fixed_cents' | 'trial_days' | 'free_months';
    discount_value: number;
    applicable_tiers: string[];
    stripe_coupon_id: string | null;
    max_redemptions: number | null;
    times_redeemed: number;
    valid_until: string | null;
    is_active: boolean;
  }[];
  webhooks: {
    id: string;
    processor: string;
    external_event_id: string;
    event_type: string;
    status: string;
    error_message: string | null;
    processed_at: string | null;
    created_at: string;
  }[];
}

export interface ArcoRequestRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  request_type: 'access' | 'rectification' | 'cancellation' | 'opposition';
  description: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  created_at: string;
  resolved_at: string | null;
}

export interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
}

export type { SubscriptionPlanRecord };

