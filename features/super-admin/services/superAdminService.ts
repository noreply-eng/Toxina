import { supabase } from '../../../supabaseClient';
import type { FeatureKey, SubscriptionPlanRecord, UserRole } from '../../entitlements/planCatalog';
import type {
  AccountLimits,
  AdminSubscriptionRow,
  AdminUserRow,
  ArcoRequestRow,
  AuditLogRow,
  BillingOverviewData,
  ClinicDetailData,
  ClinicSummaryRow,
  EnterpriseAccountRow,
  EnterprisePortalData,
  EnterpriseVoucherRow,
  GlobalKpis,
  GlobalPatientRow,
  PlatformSettingsAdmin,
  UpdateSubscriptionPayload,
  UpdateUserAccountPayload,
  WorkingHoursMap,
} from '../types';

export async function getGlobalKpis(): Promise<GlobalKpis> {
  const { data, error } = await supabase.rpc('super_admin_get_global_kpis');
  if (error) throw error;
  return data as GlobalKpis;
}

export async function updatePlatformSettings(
  payload: Partial<PlatformSettingsAdmin> & { force_stripe_live?: boolean }
): Promise<PlatformSettingsAdmin> {
  const { data, error } = await supabase.rpc('super_admin_update_platform_settings', {
    p_payload: payload,
  });
  if (error) throw error;
  return data as PlatformSettingsAdmin;
}

export async function listUsers(params: {
  search?: string;
  role?: string;
  tier?: string;
  origin?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('super_admin_list_users', {
    p_search: params.search || null,
    p_role: params.role && params.role !== 'all' ? params.role : null,
    p_tier: params.tier && params.tier !== 'all' ? params.tier : null,
    p_origin: params.origin && params.origin !== 'all' ? params.origin : null,
    p_limit: params.limit ?? 150,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as AdminUserRow[];
}

export async function grantSubscription(params: {
  userId?: string | null;
  clinicId?: string | null;
  planSlug: string;
  billingInterval?: 'monthly' | 'annual' | 'lifetime' | 'custom';
  durationDays?: number | null;
  customPeriodEnd?: string | null;
  isLifetime?: boolean;
  grantReason?: string;
  protectedFromAutoDowngrade?: boolean;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc('super_admin_grant_subscription', {
    p_user_id: params.userId ?? null,
    p_clinic_id: params.clinicId ?? null,
    p_plan_slug: params.planSlug,
    p_billing_interval: params.billingInterval ?? 'custom',
    p_duration_days: params.durationDays ?? null,
    p_custom_period_end: params.customPeriodEnd ?? null,
    p_is_lifetime: params.isLifetime ?? false,
    p_grant_reason: params.grantReason ?? 'Cortesía administrativa',
    p_protected: params.protectedFromAutoDowngrade ?? true,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function revokeSubscription(subscriptionId: string, reason = 'Revocado por SuperAdmin') {
  const { error } = await supabase.rpc('super_admin_revoke_subscription', {
    p_subscription_id: subscriptionId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function updateSubscription(
  subscriptionId: string,
  payload: UpdateSubscriptionPayload
) {
  const { data, error } = await supabase.rpc('super_admin_update_subscription', {
    p_subscription_id: subscriptionId,
    p_payload: payload,
  });

  if (!error) {
    return data;
  }

  // Seamless fallback if Migration 5 RPC is not yet applied in Supabase SQL Editor:
  // SuperAdmin already holds FOR ALL RLS policy on public.subscriptions, and
  // trg_subscriptions_sync_tier keeps user_profiles.subscription_tier in sync automatically.
  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('super_admin_update_subscription');

  if (!isMissingRpc) {
    throw error;
  }

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.plan_slug) {
    const { data: planRow, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', payload.plan_slug)
      .single();
    if (planError || !planRow) {
      throw new Error(`Plan "${payload.plan_slug}" no encontrado en el catálogo.`);
    }
    updateFields.plan_id = planRow.id;
  }

  if (payload.status !== undefined) {
    updateFields.status = payload.status;
    if (payload.status === 'active' || payload.status === 'trialing') {
      updateFields.canceled_at = null;
    } else if (payload.status === 'canceled') {
      updateFields.canceled_at = new Date().toISOString();
    }
  }
  if (payload.origin !== undefined) updateFields.origin = payload.origin;
  if (payload.billing_interval !== undefined) updateFields.billing_interval = payload.billing_interval;
  if (payload.payment_processor !== undefined) updateFields.payment_processor = payload.payment_processor;
  if (payload.seat_limit !== undefined) updateFields.seat_limit = Math.max(1, payload.seat_limit);
  if (payload.price_cents_at_signup !== undefined) {
    updateFields.price_cents_at_signup = Math.max(0, payload.price_cents_at_signup);
  }
  if (payload.is_founder !== undefined) updateFields.is_founder = payload.is_founder;
  if (payload.protected_from_auto_downgrade !== undefined) {
    updateFields.protected_from_auto_downgrade = payload.protected_from_auto_downgrade;
  }
  if (payload.cancel_at_period_end !== undefined) {
    updateFields.cancel_at_period_end = payload.cancel_at_period_end;
  }
  if (payload.grant_reason !== undefined) {
    updateFields.grant_reason = payload.grant_reason?.trim() || null;
  }
  if (payload.notes !== undefined) {
    updateFields.notes = payload.notes?.trim() || null;
  }
  if ('current_period_end' in payload) {
    updateFields.current_period_end = payload.current_period_end || null;
  }

  const { data: updated, error: updateErr } = await supabase
    .from('subscriptions')
    .update(updateFields)
    .eq('id', subscriptionId)
    .select()
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

export function exportSubscriptionsToCsv(rows: AdminSubscriptionRow[]) {
  const header = [
    'ID',
    'Titular',
    'Correo / Tipo',
    'Plan',
    'Nivel',
    'Origen',
    'Patrocinador',
    'Estado',
    'Intervalo',
    'Vencimiento',
    'Fundador',
    'Protegida',
    'Motivo',
    'Creada',
  ];
  const csvRows = [
    header,
    ...rows.map((s) => [
      s.id,
      s.user_name || s.clinic_name || 'Sin nombre',
      s.user_email || s.subscriber_type,
      s.plan_name,
      s.tier,
      s.origin,
      s.sponsor_name || '',
      s.status,
      s.billing_interval,
      s.current_period_end ? new Date(s.current_period_end).toISOString().slice(0, 10) : 'Sin vencimiento',
      s.is_founder ? 'Si' : 'No',
      s.protected_from_auto_downgrade ? 'Si' : 'No',
      s.grant_reason || '',
      new Date(s.created_at).toISOString().slice(0, 10),
    ]),
  ];
  const csv = csvRows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sonotox_suscripciones_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function updateUserOverrides(
  userId: string,
  featureOverrides: Partial<Record<FeatureKey, boolean>>,
  adminNotes: string | null
) {
  const { error } = await supabase.rpc('super_admin_update_user_overrides', {
    p_user_id: userId,
    p_feature_overrides: featureOverrides,
    p_admin_notes: adminNotes,
  });
  if (error) throw error;
}

export async function setUserRole(userId: string, role: UserRole) {
  const { error } = await supabase.rpc('super_admin_set_user_role', {
    p_user_id: userId,
    p_new_role: role,
  });
  if (error) throw error;
}

export async function toggleUserActive(
  userId: string,
  isActive: boolean,
  status?: 'active' | 'pending' | 'suspended'
) {
  const { error } = await supabase.rpc('super_admin_toggle_user_active', {
    p_user_id: userId,
    p_is_active: isActive,
    p_status: status ?? (isActive ? 'active' : 'suspended'),
  });
  if (error) throw error;
}

export async function updateUserAccount(userId: string, payload: UpdateUserAccountPayload) {
  const { data, error } = await supabase.rpc('super_admin_update_user_account', {
    p_user_id: userId,
    p_payload: payload,
  });

  if (!error) return data;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('super_admin_update_user_account');

  if (!isMissingRpc) throw error;

  // Seamless fallback before Migration 5 is executed in Supabase SQL Editor
  if (payload.role) {
    await setUserRole(userId, payload.role);
  }
  if (payload.is_active !== undefined || payload.status !== undefined) {
    await toggleUserActive(userId, payload.is_active ?? payload.status === 'active', payload.status);
  }
  if (payload.feature_overrides !== undefined || payload.admin_notes !== undefined) {
    await updateUserOverrides(userId, payload.feature_overrides ?? {}, payload.admin_notes ?? null);
  }

  const profilePatch: Record<string, unknown> = {};
  if (payload.full_name !== undefined) profilePatch.full_name = payload.full_name;
  if (payload.specialty !== undefined) profilePatch.specialty = payload.specialty;
  if (payload.phone !== undefined) profilePatch.phone = payload.phone;
  if (payload.general_license !== undefined) profilePatch.general_license = payload.general_license;
  if (payload.specialist_license !== undefined) profilePatch.specialist_license = payload.specialist_license;
  if (payload.reset_legal_consent) {
    profilePatch.terms_accepted_at = null;
    profilePatch.privacy_sensitive_accepted_at = null;
    profilePatch.consent_revoked_at = null;
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: patchErr } = await supabase
      .from('user_profiles')
      .update(profilePatch)
      .eq('id', userId);
    if (patchErr) throw patchErr;
  }

  return null;
}

export async function updateClinicSeatLimit(clinicId: string, seatLimit: number) {
  const safeLimit = Math.max(1, Math.round(seatLimit || 1));
  const { data, error } = await supabase.rpc('super_admin_update_clinic_seat_limit', {
    p_clinic_id: clinicId,
    p_seat_limit: safeLimit,
  });

  if (!error) return data;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('super_admin_update_clinic_seat_limit');

  if (!isMissingRpc) throw error;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('clinic_id', clinicId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    throw new Error('Esta clínica aún no tiene una suscripción activa para modificar asientos.');
  }

  const { error: upErr } = await supabase
    .from('subscriptions')
    .update({ seat_limit: safeLimit, updated_at: new Date().toISOString() })
    .eq('id', sub.id);
  if (upErr) throw upErr;
  return sub;
}

export async function removeClinicMember(clinicId: string, userId: string) {
  const { error } = await supabase.rpc('super_admin_remove_clinic_member', {
    p_clinic_id: clinicId,
    p_user_id: userId,
  });

  if (!error) return;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('super_admin_remove_clinic_member');

  if (!isMissingRpc) throw error;

  const { error: relErr } = await supabase
    .from('clinic_user_relationships')
    .update({ is_active: false, status: 'suspended' })
    .eq('clinic_id', clinicId)
    .eq('user_id', userId);
  if (relErr) throw relErr;
}

export async function removeEnterpriseManager(enterpriseAccountId: string, userId: string) {
  const { error } = await supabase.rpc('super_admin_remove_enterprise_manager', {
    p_enterprise_account_id: enterpriseAccountId,
    p_user_id: userId,
  });

  if (!error) return;

  const isMissingRpc =
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (error.message || '').includes('super_admin_remove_enterprise_manager');

  if (!isMissingRpc) throw error;

  const { error: mgrErr } = await supabase
    .from('enterprise_account_managers')
    .update({ is_active: false })
    .eq('enterprise_account_id', enterpriseAccountId)
    .eq('user_id', userId);
  if (mgrErr) throw mgrErr;
}

export async function createUserAccountManually(params: {
  email: string;
  password: string;
  fullName?: string;
  specialty?: string;
  phone?: string;
  generalLicense?: string;
  specialistLicense?: string;
  role: UserRole;
  planSlug?: string;
  durationDays?: number | null;
  isLifetime?: boolean;
  protectedFromAutoDowngrade?: boolean;
  grantReason?: string;
  accountLimits?: AccountLimits;
}): Promise<{ user_id: string; email: string; role: UserRole; message: string }> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: params.email.trim().toLowerCase(),
      password: params.password,
      full_name: params.fullName?.trim() || undefined,
      specialty: params.specialty?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
      general_license: params.generalLicense?.trim() || undefined,
      specialist_license: params.specialistLicense?.trim() || undefined,
      role: params.role,
      plan_slug: params.planSlug || 'premium_solo',
      duration_days: params.isLifetime ? null : params.durationDays ?? 365,
      is_lifetime: Boolean(params.isLifetime),
      protected_from_auto_downgrade: params.protectedFromAutoDowngrade ?? true,
      grant_reason: params.grantReason || 'Cuenta creada manualmente por SuperAdmin',
      account_limits: params.accountLimits || {},
    },
  });

  if (error) {
    const rawMsg = error.message || '';
    if (
      rawMsg.includes('Failed to send a request') ||
      rawMsg.includes('FunctionsFetchError') ||
      rawMsg.includes('404') ||
      rawMsg.includes('not found')
    ) {
      throw new Error(
        'EDGE_FUNCTION_NOT_DEPLOYED: Despliega la Edge Function "admin-create-user" en Supabase (`supabase functions deploy admin-create-user`) para crear cuentas con contraseña directamente desde el panel.'
      );
    }
    throw new Error(rawMsg || 'No se pudo crear la cuenta.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as { user_id: string; email: string; role: UserRole; message: string };
}

export async function ensureClinicMemberSeat(clinicId: string, userId: string) {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('clinic_id', clinicId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub?.id) {
    await supabase.from('subscription_seats').upsert(
      {
        subscription_id: sub.id,
        user_id: userId,
        is_active: true,
        revoked_at: null,
      },
      { onConflict: 'subscription_id,user_id' }
    );
  }
}

export async function upsertSubscriptionPlan(plan: Partial<SubscriptionPlanRecord>) {
  const { data, error } = await supabase.rpc('super_admin_upsert_plan', {
    p_plan: plan,
  });
  if (error) throw error;
  return data as SubscriptionPlanRecord;
}

export async function getBillingOverview(): Promise<BillingOverviewData> {
  const { data, error } = await supabase.rpc('super_admin_list_billing_overview');
  if (error) throw error;
  return data as BillingOverviewData;
}

export async function recordManualPayment(params: {
  subscriptionId?: string | null;
  userId?: string | null;
  clinicId?: string | null;
  enterpriseAccountId?: string | null;
  amountCents: number;
  currency?: string;
  method: 'card' | 'spei' | 'transfer' | 'cash' | 'oxxo' | 'purchase_order' | 'comped' | 'other';
  reference?: string;
  extendDays?: number;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc('super_admin_record_manual_payment', {
    p_subscription_id: params.subscriptionId ?? null,
    p_user_id: params.userId ?? null,
    p_clinic_id: params.clinicId ?? null,
    p_enterprise_account_id: params.enterpriseAccountId ?? null,
    p_amount_cents: params.amountCents,
    p_currency: params.currency ?? 'MXN',
    p_method: params.method,
    p_reference: params.reference ?? null,
    p_extend_days: params.extendDays ?? 30,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function upsertPromoCode(promo: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('super_admin_upsert_promo_code', {
    p_promo: promo,
  });
  if (error) throw error;
  return data;
}

export async function listAnnouncements() {
  const { data, error } = await supabase
    .from('platform_announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertAnnouncement(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('super_admin_upsert_announcement', {
    p_payload: payload,
  });
  if (error) throw error;
  return data;
}

export async function listEnterpriseAccounts(): Promise<EnterpriseAccountRow[]> {
  const { data, error } = await supabase.rpc('super_admin_list_enterprise_accounts');
  if (error) throw error;
  return (data ?? []) as EnterpriseAccountRow[];
}

export async function upsertEnterpriseAccount(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('super_admin_upsert_enterprise_account', {
    p_payload: payload,
  });
  if (error) throw error;
  return data;
}

export async function assignEnterpriseManager(
  enterpriseAccountId: string,
  userEmail: string,
  roleInOrg: 'owner' | 'manager' | 'billing' = 'owner',
  setEnterpriseRole = true
) {
  const { data, error } = await supabase.rpc('super_admin_assign_enterprise_manager', {
    p_enterprise_account_id: enterpriseAccountId,
    p_user_email: userEmail,
    p_role_in_org: roleInOrg,
    p_set_enterprise_role: setEnterpriseRole,
  });
  if (error) throw error;
  return data;
}

export async function addEnterpriseBatch(params: {
  enterpriseAccountId: string;
  batchCount: number;
  billingInterval: 'monthly' | 'annual' | 'custom' | 'pilot_free';
  unitBatchPriceCents: number;
  paymentProcessor?: 'comped' | 'manual' | 'stripe' | 'mercadopago';
  status?: 'pending_payment' | 'active';
  expiresAt?: string | null;
  purchaseOrderRef?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc('super_admin_add_enterprise_batch', {
    p_enterprise_account_id: params.enterpriseAccountId,
    p_batch_count: params.batchCount,
    p_billing_interval: params.billingInterval,
    p_unit_batch_price_cents: params.unitBatchPriceCents,
    p_payment_processor: params.paymentProcessor ?? 'comped',
    p_status: params.status ?? 'active',
    p_expires_at: params.expiresAt ?? null,
    p_purchase_order_ref: params.purchaseOrderRef ?? null,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function getEnterprisePortalData(enterpriseAccountId?: string): Promise<EnterprisePortalData> {
  const { data, error } = await supabase.rpc('enterprise_get_portal_data', {
    p_enterprise_account_id: enterpriseAccountId ?? null,
  });
  if (error) throw error;
  return data as EnterprisePortalData;
}

export async function generateEnterpriseVouchers(params: {
  enterpriseAccountId: string;
  voucherType: 'single_use' | 'multi_use';
  campaignName?: string;
  prefix?: string;
  count?: number;
  maxRedemptions?: number;
  customCode?: string;
  durationDays?: number | null;
  validUntil?: string | null;
}): Promise<EnterpriseVoucherRow[]> {
  const { data, error } = await supabase.rpc('enterprise_generate_vouchers', {
    p_enterprise_account_id: params.enterpriseAccountId,
    p_voucher_type: params.voucherType,
    p_campaign_name: params.campaignName ?? null,
    p_prefix: params.prefix ?? 'STX',
    p_count: params.count ?? 1,
    p_max_redemptions: params.maxRedemptions ?? 20,
    p_custom_code: params.customCode ?? null,
    p_duration_days: params.durationDays ?? null,
    p_valid_until: params.validUntil ?? null,
  });
  if (error) throw error;
  return (data ?? []) as EnterpriseVoucherRow[];
}

export async function revokeEnterpriseLicense(licenseId: string, reason = 'Revocada') {
  const { error } = await supabase.rpc('enterprise_revoke_license', {
    p_license_id: licenseId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function requestEnterpriseBatch(params: {
  enterpriseAccountId: string;
  batchCount: number;
  billingInterval?: 'monthly' | 'annual';
  purchaseOrderRef?: string;
  notes?: string;
}) {
  const { data, error } = await supabase.rpc('enterprise_request_license_batch', {
    p_enterprise_account_id: params.enterpriseAccountId,
    p_batch_count: params.batchCount,
    p_billing_interval: params.billingInterval ?? 'annual',
    p_purchase_order_ref: params.purchaseOrderRef ?? null,
    p_notes: params.notes ?? null,
  });
  if (error) throw error;
  return data;
}

export function exportVouchersToCsv(brandName: string, vouchers: EnterpriseVoucherRow[]) {
  const origin = window.location.origin;
  const rows = [
    ['Organizacion', 'Campana', 'Codigo', 'Tipo', 'Usados', 'Maximo', 'Estado', 'Enlace Directo'],
    ...vouchers.map((v) => [
      brandName,
      v.campaign_name || '',
      v.code,
      v.voucher_type === 'single_use' ? 'Uso unico' : 'Multi-uso',
      String(v.times_redeemed),
      String(v.max_redemptions),
      v.is_active ? 'Activo' : 'Inactivo',
      `${origin}/subscription?code=${encodeURIComponent(v.code)}`,
    ]),
  ];
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cupones_${brandName.replace(/[^\w]+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function listClinics(): Promise<ClinicSummaryRow[]> {
  const { data, error } = await supabase.rpc('super_admin_list_clinics');
  if (error) throw error;
  return (data ?? []) as ClinicSummaryRow[];
}

export async function upsertClinic(payload: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('super_admin_upsert_clinic', { p_payload: payload });
  if (error) throw error;
  return data;
}

export async function getClinicDetail(clinicId: string): Promise<ClinicDetailData> {
  const { data, error } = await supabase.rpc('super_admin_get_clinic_detail', { p_clinic_id: clinicId });
  if (error) throw error;
  return data as ClinicDetailData;
}

export async function upsertClinicSchedule(params: {
  clinicId: string;
  workingHours: WorkingHoursMap;
  holidays?: { date: string; label: string }[];
  duration?: number;
  buffer?: number;
  allowCrossView?: boolean;
}) {
  const { data, error } = await supabase.rpc('super_admin_upsert_clinic_schedule', {
    p_clinic_id: params.clinicId,
    p_working_hours: params.workingHours,
    p_holidays: params.holidays ?? [],
    p_duration: params.duration ?? 30,
    p_buffer: params.buffer ?? 10,
    p_allow_cross_view: params.allowCrossView ?? true,
  });
  if (error) throw error;
  return data;
}

export async function manageClinicMember(params: {
  clinicId: string;
  userEmail: string;
  roleInClinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
  status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  isActive?: boolean;
}) {
  const { data, error } = await supabase.rpc('super_admin_manage_clinic_member', {
    p_clinic_id: params.clinicId,
    p_user_email: params.userEmail,
    p_role_in_clinic: params.roleInClinic,
    p_status: params.status ?? 'approved',
    p_is_active: params.isActive ?? true,
  });
  if (error) throw error;
  return data;
}

export async function grantClinicAccessToUser(params: {
  userId: string;
  userEmail: string | null;
  clinicId?: string | null;
  newClinic?: {
    name: string;
    type: 'solo_practice' | 'clinic' | 'hospital' | 'aesthetic_center' | 'rehab_center';
    city?: string;
    directorName?: string;
  };
  roleInClinic: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant';
  planSlug?: string | null;
  seatLimit?: number | null;
  durationDays?: number | null;
  isLifetime?: boolean;
  grantReason?: string;
  protectedFromAutoDowngrade?: boolean;
  notes?: string | null;
}): Promise<{ clinicId: string; clinicName: string; subscriptionId?: string }> {
  let targetClinicId = params.clinicId || '';
  let clinicName = params.newClinic?.name || 'Clínica';

  if (!targetClinicId && params.newClinic?.name?.trim()) {
    const created = (await upsertClinic({
      name: params.newClinic.name.trim(),
      type: params.newClinic.type || 'clinic',
      city: params.newClinic.city?.trim() || null,
      director_name: params.newClinic.directorName?.trim() || null,
      email: params.userEmail || null,
      is_active: true,
    })) as { id: string; name: string };
    targetClinicId = created.id;
    clinicName = created.name;
  }

  if (!targetClinicId) {
    throw new Error('Selecciona una clínica existente o ingresa el nombre para crear una nueva.');
  }

  if (params.userEmail) {
    await manageClinicMember({
      clinicId: targetClinicId,
      userEmail: params.userEmail,
      roleInClinic: params.roleInClinic,
      status: 'approved',
      isActive: true,
    });
  } else {
    const { error: relErr } = await supabase.from('clinic_user_relationships').upsert(
      {
        clinic_id: targetClinicId,
        user_id: params.userId,
        role_in_clinic: params.roleInClinic,
        status: 'approved',
        is_active: true,
      },
      { onConflict: 'clinic_id,user_id' }
    );
    if (relErr) throw relErr;
  }

  let activeSubId: string | undefined;
  if (params.planSlug && params.planSlug !== 'keep') {
    const granted = (await grantSubscription({
      clinicId: targetClinicId,
      planSlug: params.planSlug,
      billingInterval: params.isLifetime ? 'lifetime' : 'custom',
      durationDays: params.isLifetime ? null : params.durationDays ?? 365,
      isLifetime: params.isLifetime ?? false,
      grantReason: params.grantReason || 'Acceso Clínica otorgado por SuperAdmin',
      protectedFromAutoDowngrade: params.protectedFromAutoDowngrade ?? true,
      notes: params.notes ?? null,
    })) as { subscription_id?: string };
    activeSubId = granted?.subscription_id;
  } else {
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('clinic_id', targetClinicId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    activeSubId = existingSub?.id;
  }

  // Apply custom seat limit if specified by SuperAdmin
  if (activeSubId && params.seatLimit && params.seatLimit >= 1) {
    await updateSubscription(activeSubId, { seat_limit: Math.round(params.seatLimit) });
  }

  // Ensure the user holds an active seat on the clinic's subscription so entitlements resolve immediately
  if (activeSubId) {
    await supabase.from('subscription_seats').upsert(
      {
        subscription_id: activeSubId,
        user_id: params.userId,
        is_active: true,
        revoked_at: null,
      },
      { onConflict: 'subscription_id,user_id' }
    );
  }

  return { clinicId: targetClinicId, clinicName, subscriptionId: activeSubId };
}

export async function grantEnterpriseAccessToUser(params: {
  userId: string;
  userEmail: string | null;
  enterpriseAccountId?: string | null;
  newOrg?: {
    name: string;
    brandDisplayName?: string;
    organizationType: 'pharma' | 'aesthetic_school' | 'university' | 'medical_society' | 'hospital_group' | 'other';
    contactName?: string;
  };
  roleInOrg: 'owner' | 'manager' | 'billing';
  setEnterpriseRole: boolean;
  initialBatchCount: number;
  batchMode: 'pilot_free' | 'manual';
  batchDurationDays?: number | null;
}): Promise<{ enterpriseAccountId: string; orgName: string; licensesAdded: number }> {
  let accountId = params.enterpriseAccountId || '';
  let orgName = params.newOrg?.name || 'Organización Enterprise';

  if (!accountId && params.newOrg?.name?.trim()) {
    const created = (await upsertEnterpriseAccount({
      name: params.newOrg.name.trim(),
      brand_display_name: params.newOrg.brandDisplayName?.trim() || params.newOrg.name.trim(),
      organization_type: params.newOrg.organizationType || 'pharma',
      contact_name: params.newOrg.contactName?.trim() || null,
      contact_email: params.userEmail || null,
      status: 'active',
      allow_license_reassignment: true,
      default_license_duration_days: 365,
    })) as { id: string; name: string };
    accountId = created.id;
    orgName = created.name;
  }

  if (!accountId) {
    throw new Error('Selecciona una empresa Enterprise existente o ingresa el nombre para crear una nueva.');
  }

  if (params.userEmail) {
    await assignEnterpriseManager(accountId, params.userEmail, params.roleInOrg, params.setEnterpriseRole);
  } else {
    const { error: mgrErr } = await supabase.from('enterprise_account_managers').upsert(
      {
        enterprise_account_id: accountId,
        user_id: params.userId,
        role_in_org: params.roleInOrg,
        is_active: true,
      },
      { onConflict: 'enterprise_account_id,user_id' }
    );
    if (mgrErr) throw mgrErr;
    if (params.setEnterpriseRole) {
      await setUserRole(params.userId, 'enterprise');
    }
  }

  let licensesAdded = 0;
  if (params.initialBatchCount > 0) {
    const expiresAt =
      params.batchDurationDays && params.batchDurationDays > 0
        ? new Date(Date.now() + params.batchDurationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
    await addEnterpriseBatch({
      enterpriseAccountId: accountId,
      batchCount: params.initialBatchCount,
      billingInterval: params.batchMode === 'pilot_free' ? 'pilot_free' : 'annual',
      unitBatchPriceCents: params.batchMode === 'pilot_free' ? 0 : 7990000,
      paymentProcessor: params.batchMode === 'pilot_free' ? 'comped' : 'manual',
      status: 'active',
      expiresAt,
      notes: 'Lote inicial asignado desde perfil de usuario (SuperAdmin)',
    });
    licensesAdded = params.initialBatchCount * 20;
  }

  return { enterpriseAccountId: accountId, orgName, licensesAdded };
}

export async function listGlobalPatients(search?: string, limit = 100): Promise<GlobalPatientRow[]> {
  const { data, error } = await supabase.rpc('super_admin_list_patients', {
    p_search: search || null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as GlobalPatientRow[];
}

export async function reassignPatient(patientId: string, newDoctorId: string, newClinicId?: string | null) {
  const { error } = await supabase.rpc('super_admin_reassign_patient', {
    p_patient_id: patientId,
    p_new_doctor_id: newDoctorId,
    p_new_clinic_id: newClinicId ?? null,
  });
  if (error) throw error;
}

export async function listArcoRequests(): Promise<ArcoRequestRow[]> {
  const { data, error } = await supabase.rpc('super_admin_list_arco_requests');
  if (error) throw error;
  return (data ?? []) as ArcoRequestRow[];
}

export async function resolveArcoRequest(
  requestId: string,
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected'
) {
  const { error } = await supabase.rpc('super_admin_resolve_arco_request', {
    p_request_id: requestId,
    p_status: status,
  });
  if (error) throw error;
}

export async function listAuditLogs(limit = 120): Promise<AuditLogRow[]> {
  const { data, error } = await supabase.rpc('super_admin_list_audit_logs', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}
