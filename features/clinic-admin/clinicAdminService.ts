import { supabase } from '../../supabaseClient';
import type { ClinicSummaryRow, WorkingHoursMap } from '../super-admin/types';
import type { SubscriptionOrigin, SubscriptionTier } from '../entitlements/planCatalog';
import type { EntitlementSnapshot } from '../entitlements/EntitlementContext';
import { DEFAULT_WORKING_HOURS } from '../super-admin/components/WorkingHoursEditor';

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

function getLocalWorkspaceStorageKey(userId: string): string {
  return `sonotox_private_workspace_v1_${userId}`;
}

export function isVirtualClinicId(clinicId: string): boolean {
  return clinicId.startsWith('virtual-');
}

function readLocalWorkspace(userId: string): Partial<ClinicAdminDetail> | null {
  try {
    const raw = localStorage.getItem(getLocalWorkspaceStorageKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ClinicAdminDetail>;
  } catch {
    return null;
  }
}

function writeLocalWorkspace(userId: string, patch: Partial<ClinicAdminDetail>): void {
  try {
    const current = readLocalWorkspace(userId) || {};
    const merged: Partial<ClinicAdminDetail> = {
      ...current,
      ...patch,
      clinic: patch.clinic
        ? { ...(current.clinic || {}), ...patch.clinic }
        : current.clinic,
      configuration: patch.configuration
        ? { ...(current.configuration || {}), ...patch.configuration }
        : current.configuration,
    };
    localStorage.setItem(getLocalWorkspaceStorageKey(userId), JSON.stringify(merged));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Ensures the user has a provisioned Consultorio Privado or Clínica Privada,
 * falling back to a persistent local/profile-backed workspace if the SQL migration
 * `ensure_my_clinic_workspace` hasn't been executed in Supabase yet.
 */
export async function ensureOwnClinicWorkspace(
  entitlements: EntitlementSnapshot,
  preferredType?: 'solo_practice' | 'clinic'
): Promise<ClinicAdminDetail> {
  const isClinicPlan =
    preferredType === 'clinic' ||
    (entitlements.plan_slug || '').includes('clinic');
  const desiredType: ClinicSummaryRow['type'] = isClinicPlan ? 'clinic' : 'solo_practice';

  // 1. Try server-side auto-provisioning RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_my_clinic_workspace', {
    p_preferred_type: desiredType,
  });

  if (!rpcError && rpcData) {
    return rpcData as ClinicAdminDetail;
  }

  // 2. If user already has a managed clinic in entitlements, fetch its detail
  const existingManaged = entitlements.clinics.find((c) =>
    ['owner', 'director', 'clinic_admin'].includes(c.role_in_clinic)
  );
  if (existingManaged) {
    return fetchClinicAdminDetail(existingManaged.clinic_id, entitlements);
  }

  // 3. Resilient fallback when SQL migration hasn't been executed in Supabase yet
  return buildVirtualWorkspaceDetail(entitlements, desiredType);
}

async function buildVirtualWorkspaceDetail(
  entitlements: EntitlementSnapshot,
  defaultType: ClinicSummaryRow['type']
): Promise<ClinicAdminDetail> {
  const userId = entitlements.user_id || 'current';
  const stored = readLocalWorkspace(userId);

  const [profileRes, subRes, patientsRes, treatmentsRes] = await Promise.all([
    userId !== 'current'
      ? supabase
          .from('user_profiles')
          .select('full_name, email, specialty, phone, general_license, specialist_license')
          .eq('id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId !== 'current'
      ? supabase
          .from('subscriptions')
          .select(
            'id, status, origin, billing_interval, seat_limit, current_period_start, current_period_end, grant_reason, subscription_plans(slug, name, tier, max_seats)'
          )
          .eq('user_id', userId)
          .in('status', ['active', 'trialing', 'past_due'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    userId !== 'current'
      ? supabase.from('patients').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      : Promise.resolve({ count: 0 }),
    userId !== 'current'
      ? supabase.from('treatments').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      : Promise.resolve({ count: 0 }),
  ]);

  const profile: any = profileRes.data;
  const subRow: any = subRes.data;
  const doctorName =
    profile?.full_name || entitlements.full_name || 'Dr. Especialista';
  const email = profile?.email || entitlements.email || null;
  const planSlug =
    subRow?.subscription_plans?.slug || entitlements.plan_slug || 'premium_solo';
  const isClinicScope =
    planSlug.includes('clinic') ||
    (subRow?.seat_limit ?? subRow?.subscription_plans?.max_seats ?? 1) > 1 ||
    defaultType === 'clinic';

  const resolvedType: ClinicSummaryRow['type'] =
    stored?.clinic?.type || (isClinicScope ? 'clinic' : 'solo_practice');
  const defaultWorkspaceName =
    resolvedType === 'solo_practice'
      ? `Consultorio de ${doctorName}`
      : `Clínica de ${doctorName}`;

  const seatLimit =
    subRow?.seat_limit ||
    subRow?.subscription_plans?.max_seats ||
    (resolvedType === 'solo_practice' ? 1 : 5);

  return {
    clinic: {
      id: `virtual-${userId}`,
      name: stored?.clinic?.name || defaultWorkspaceName,
      type: resolvedType,
      city: stored?.clinic?.city ?? null,
      address: stored?.clinic?.address ?? null,
      phone: stored?.clinic?.phone ?? profile?.phone ?? null,
      email: stored?.clinic?.email ?? email,
      tax_id: stored?.clinic?.tax_id ?? null,
      license_number:
        stored?.clinic?.license_number ??
        profile?.specialist_license ??
        profile?.general_license ??
        null,
      director_name: stored?.clinic?.director_name ?? doctorName,
      is_active: true,
    },
    configuration: {
      id: `config-${userId}`,
      working_hours: stored?.configuration?.working_hours || DEFAULT_WORKING_HOURS,
      holidays: stored?.configuration?.holidays || [],
      default_appointment_duration:
        stored?.configuration?.default_appointment_duration ?? 30,
      buffer_minutes: stored?.configuration?.buffer_minutes ?? 10,
      allow_cross_doctor_patient_view:
        stored?.configuration?.allow_cross_doctor_patient_view ??
        resolvedType !== 'solo_practice',
    },
    active_subscription: {
      id: subRow?.id || `sub-${userId}`,
      plan_slug: planSlug,
      plan_name:
        subRow?.subscription_plans?.name ||
        entitlements.plan_name ||
        (resolvedType === 'solo_practice'
          ? 'Plan Consultorio Privado Premium'
          : 'Plan Clínica Privada Premium'),
      tier: (subRow?.subscription_plans?.tier ||
        entitlements.effective_tier ||
        'premium') as SubscriptionTier,
      status: subRow?.status || entitlements.status || 'active',
      origin: (subRow?.origin || entitlements.origin || 'launch_promo') as SubscriptionOrigin,
      billing_interval: subRow?.billing_interval || 'monthly',
      seat_limit: seatLimit,
      current_period_start:
        subRow?.current_period_start || new Date().toISOString(),
      current_period_end:
        subRow?.current_period_end ?? entitlements.period_end ?? null,
      grant_reason: subRow?.grant_reason ?? entitlements.grant_reason ?? null,
    },
    members: [
      {
        id: `member-${userId}`,
        user_id: userId,
        role_in_clinic: 'owner',
        status: 'approved',
        is_active: true,
        full_name: doctorName,
        email,
        specialty: profile?.specialty || null,
        has_seat: true,
      },
    ],
    patients_count: (patientsRes as any)?.count ?? 0,
    treatments_count: (treatmentsRes as any)?.count ?? 0,
  };
}

export async function fetchClinicAdminDetail(
  clinicId: string,
  entitlements?: EntitlementSnapshot
): Promise<ClinicAdminDetail> {
  if (isVirtualClinicId(clinicId) && entitlements) {
    return buildVirtualWorkspaceDetail(
      entitlements,
      (entitlements.plan_slug || '').includes('clinic') ? 'clinic' : 'solo_practice'
    );
  }

  const { data, error } = await supabase.rpc('clinic_admin_get_detail', {
    p_clinic_id: clinicId,
  });

  if (!error && data) {
    const detail = data as ClinicAdminDetail;
    // If active_subscription was null (legacy RPC before Migration 6), enrich with user's individual subscription
    if (!detail.active_subscription && entitlements && entitlements.effective_tier !== 'free') {
      detail.active_subscription = {
        id: `sub-${entitlements.user_id || clinicId}`,
        plan_slug: entitlements.plan_slug,
        plan_name: entitlements.plan_name,
        tier: entitlements.effective_tier,
        status: entitlements.status,
        origin: entitlements.origin,
        billing_interval: 'monthly',
        seat_limit: (entitlements.plan_slug || '').includes('clinic') ? 5 : 1,
        current_period_start: new Date().toISOString(),
        current_period_end: entitlements.period_end,
        grant_reason: entitlements.grant_reason,
      };
    }
    return detail;
  }

  const isMissingRpc =
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    (error?.message || '').includes('clinic_admin_get_detail');

  if (!isMissingRpc && error) {
    throw error;
  }

  // Fallback query using clinic-scoped RLS policies
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
      .select(
        'id, status, origin, billing_interval, seat_limit, current_period_start, current_period_end, grant_reason, subscription_plans(slug, name, tier)'
      )
      .eq('clinic_id', clinicId)
      .eq('subscriber_type', 'clinic')
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (clinicRes.error) {
    if (entitlements) {
      return buildVirtualWorkspaceDetail(entitlements, 'solo_practice');
    }
    throw clinicRes.error;
  }

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
    : entitlements && entitlements.effective_tier !== 'free'
    ? {
        id: `sub-${entitlements.user_id || clinicId}`,
        plan_slug: entitlements.plan_slug,
        plan_name: entitlements.plan_name,
        tier: entitlements.effective_tier,
        status: entitlements.status,
        origin: entitlements.origin,
        billing_interval: 'monthly',
        seat_limit: clinicRes.data.type === 'solo_practice' ? 1 : 5,
        current_period_start: new Date().toISOString(),
        current_period_end: entitlements.period_end,
        grant_reason: entitlements.grant_reason,
      }
    : null;

  return {
    clinic: clinicRes.data,
    configuration: configRes.data ?? null,
    active_subscription: activeSub,
    members: (membersRes.data || []).map((m: any) => ({
      ...m,
      full_name: entitlements?.user_id === m.user_id ? entitlements?.full_name ?? null : null,
      email: entitlements?.user_id === m.user_id ? entitlements?.email ?? null : null,
      specialty: null,
      has_seat: true,
    })),
    patients_count: 0,
    treatments_count: 0,
  };
}

export async function updateOwnClinicInfo(
  clinicId: string,
  payload: Partial<ClinicAdminDetail['clinic']>,
  userId?: string
) {
  if (isVirtualClinicId(clinicId)) {
    const uid = userId || clinicId.replace(/^virtual-/, '');
    writeLocalWorkspace(uid, { clinic: payload as any });
    return payload;
  }

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
  userId?: string;
}) {
  if (isVirtualClinicId(params.clinicId)) {
    const uid = params.userId || params.clinicId.replace(/^virtual-/, '');
    writeLocalWorkspace(uid, {
      configuration: {
        id: `config-${uid}`,
        working_hours: params.workingHours,
        holidays: params.holidays,
        default_appointment_duration: params.duration,
        buffer_minutes: params.buffer,
        allow_cross_doctor_patient_view: params.allowCrossView,
      },
    });
    return { ok: true };
  }

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
  if (isVirtualClinicId(params.clinicId)) {
    throw new Error(
      'Para agregar miembros adicionales a tu equipo, aplica la migración SQL de clínicas en Supabase o activa un Plan de Clínica.'
    );
  }

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
  if (isVirtualClinicId(clinicId)) return;

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
