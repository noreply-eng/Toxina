import { supabase } from '../../supabaseClient';
import type { ClinicSummaryRow, WorkingHoursMap } from '../super-admin/types';
import type { SubscriptionOrigin, SubscriptionTier } from '../entitlements/planCatalog';

export interface ClinicAdminMember {
  id: string;
  user_id: string;
  role_in_clinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
  status: string;
  is_active: boolean;
  full_name: string | null;
  email: string | null;
  specialty: string | null;
  has_seat: boolean;
}

export interface ClinicAdminDetail {
  clinic: {
    id: string;
    name: string;
    type: ClinicSummaryRow['type'];
    city: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_id: string | null;
    license_number: string | null;
    director_name: string | null;
    is_active: boolean;
  };
  configuration: {
    id: string;
    working_hours: WorkingHoursMap;
    holidays: { date: string; label: string }[];
    default_appointment_duration: number;
    buffer_minutes: number;
    allow_cross_doctor_patient_view: boolean;
  } | null;
  active_subscription: {
    id: string;
    plan_slug: string;
    plan_name: string;
    tier: SubscriptionTier;
    status: string;
    origin: SubscriptionOrigin;
    billing_interval: string;
    seat_limit: number;
    current_period_start: string;
    current_period_end: string | null;
    grant_reason: string | null;
  } | null;
  members: ClinicAdminMember[];
  patients_count: number;
  treatments_count: number;
}

export async function fetchClinicAdminDetail(clinicId: string): Promise<ClinicAdminDetail> {
  const { data, error } = await supabase.rpc('clinic_admin_get_detail', {
    p_clinic_id: clinicId,
  });

  if (!error && data) {
    return data as ClinicAdminDetail;
  }

  const isMissingRpc =
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    (error?.message || '').includes('clinic_admin_get_detail');

  if (!isMissingRpc && error) {
    throw error;
  }

  // Fallback query using clinic-scoped RLS policies if Migration 5 SQL hasn't been executed yet
  const [clinicRes, configRes, membersRes, subRes] = await Promise.all([
    supabase.from('clinics').select('*').eq('id', clinicId).single(),
    supabase.from('clinic_configurations').select('*').eq('clinic_id', clinicId).maybeSingle(),
    supabase
      .from('clinic_user_relationships')
      .select('id, user_id, role_in_clinic, status, is_active')
      .eq('clinic_id', clinicId)
      .eq('is_active', true),
    supabase
      .from('subscriptions')
      .select('id, status, origin, billing_interval, seat_limit, current_period_start, current_period_end, grant_reason, subscription_plans(slug, name, tier)')
      .eq('clinic_id', clinicId)
      .eq('subscriber_type', 'clinic')
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (clinicRes.error) throw clinicRes.error;

  const subRow: any = subRes.data;
  const activeSub = subRow
    ? {
        id: subRow.id,
        plan_slug: subRow.subscription_plans?.slug || 'premium_clinic',
        plan_name: subRow.subscription_plans?.name || 'Plan Clínica',
        tier: (subRow.subscription_plans?.tier || 'premium') as SubscriptionTier,
        status: subRow.status,
        origin: subRow.origin as SubscriptionOrigin,
        billing_interval: subRow.billing_interval,
        seat_limit: subRow.seat_limit || 5,
        current_period_start: subRow.current_period_start,
        current_period_end: subRow.current_period_end,
        grant_reason: subRow.grant_reason,
      }
    : null;

  return {
    clinic: clinicRes.data,
    configuration: configRes.data ?? null,
    active_subscription: activeSub,
    members: (membersRes.data || []).map((m: any) => ({
      ...m,
      full_name: null,
      email: null,
      specialty: null,
      has_seat: true,
    })),
    patients_count: 0,
    treatments_count: 0,
  };
}

export async function updateOwnClinicInfo(
  clinicId: string,
  payload: Partial<ClinicAdminDetail['clinic']>
) {
  const { data, error } = await supabase.rpc('clinic_admin_update_clinic', {
    p_clinic_id: clinicId,
    p_payload: payload,
  });

  if (!error) return data;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('clinic_admin_update_clinic');

  if (!isMissingRpc) throw error;

  const { data: updated, error: upErr } = await supabase
    .from('clinics')
    .update({
      name: payload.name,
      type: payload.type,
      city: payload.city ?? null,
      address: payload.address ?? null,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      tax_id: payload.tax_id ?? null,
      license_number: payload.license_number ?? null,
      director_name: payload.director_name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)
    .select()
    .single();
  if (upErr) throw upErr;
  return updated;
}

export async function updateOwnClinicSchedule(params: {
  clinicId: string;
  workingHours: WorkingHoursMap;
  holidays: { date: string; label: string }[];
  duration: number;
  buffer: number;
  allowCrossView: boolean;
}) {
  const { data, error } = await supabase.rpc('super_admin_upsert_clinic_schedule', {
    p_clinic_id: params.clinicId,
    p_working_hours: params.workingHours,
    p_holidays: params.holidays,
    p_duration: params.duration,
    p_buffer: params.buffer,
    p_allow_cross_view: params.allowCrossView,
  });
  if (error) throw error;
  return data;
}

export async function addOrUpdateOwnClinicMember(params: {
  clinicId: string;
  userEmail: string;
  roleInClinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
  isActive?: boolean;
}) {
  const { data, error } = await supabase.rpc('clinic_admin_manage_member', {
    p_clinic_id: params.clinicId,
    p_user_email: params.userEmail.trim(),
    p_role_in_clinic: params.roleInClinic,
    p_is_active: params.isActive ?? true,
  });

  if (!error) return data;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('clinic_admin_manage_member');

  if (!isMissingRpc) throw error;

  const { data: legacy, error: legErr } = await supabase.rpc('super_admin_manage_clinic_member', {
    p_clinic_id: params.clinicId,
    p_user_email: params.userEmail.trim(),
    p_role_in_clinic: params.roleInClinic,
    p_status: params.isActive === false ? 'suspended' : 'approved',
    p_is_active: params.isActive ?? true,
  });
  if (legErr) throw legErr;
  return legacy;
}

export async function removeOwnClinicMember(clinicId: string, userId: string) {
  const { error } = await supabase.rpc('clinic_admin_remove_member', {
    p_clinic_id: clinicId,
    p_user_id: userId,
  });

  if (!error) return;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('clinic_admin_remove_member');

  if (!isMissingRpc) throw error;

  const { error: relErr } = await supabase
    .from('clinic_user_relationships')
    .update({ is_active: false, status: 'suspended' })
    .eq('clinic_id', clinicId)
    .eq('user_id', userId);
  if (relErr) throw relErr;
}
