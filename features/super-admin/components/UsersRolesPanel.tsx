import React, { useCallback, useEffect, useState } from 'react';
import {
  ALL_FEATURE_KEYS,
  ORIGIN_LABELS,
  ROLE_LABELS,
  TIER_LABELS,
  type FeatureKey,
  type SubscriptionOrigin,
  type UserRole,
} from '../../entitlements/planCatalog';
import {
  addEnterpriseBatch,
  createUserAccountManually,
  grantClinicAccessToUser,
  grantEnterpriseAccessToUser,
  grantSubscription,
  listClinics,
  listEnterpriseAccounts,
  listUsers,
  manageClinicMember,
  removeClinicMember,
  removeEnterpriseManager,
  revokeSubscription,
  updateClinicSeatLimit,
  updateSubscription,
  updateUserAccount,
} from '../services/superAdminService';
import type {
  AccountLimits,
  AdminUserRow,
  ClinicSummaryRow,
  EnterpriseAccountRow,
  EnterpriseOrgType,
  PaymentProcessorValue,
  SubscriptionIntervalValue,
  SubscriptionStatusValue,
} from '../types';

type DrawerTab = 'profile' | 'subscription' | 'clinic' | 'enterprise' | 'limits';

const GRANT_PRESETS = [
  { label: '14 días', days: 14, lifetime: false },
  { label: '30 días', days: 30, lifetime: false },
  { label: '90 días', days: 90, lifetime: false },
  { label: '6 meses', days: 180, lifetime: false },
  { label: '1 año', days: 365, lifetime: false },
  { label: 'Vitalicio', days: null, lifetime: true },
];

const GRANT_REASONS = [
  'Cortesía VIP / Fundador',
  'Beca Residente en Formación',
  'Docente / Ponente / Taller USG',
  'Convenio Institucional',
  'Pago Externo (SPEI / Transferencia)',
  'Beta Tester',
  'Ajuste manual SuperAdmin',
];

const CLINIC_ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño (Owner)',
  director: 'Director Médico',
  clinic_admin: 'Admin de Clínica',
  specialist: 'Especialista',
  assistant: 'Asistente',
};

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function addDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

const UsersRolesPanel: React.FC<{ onDataChanged?: () => void }> = ({ onDataChanged }) => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [clinicsList, setClinicsList] = useState<ClinicSummaryRow[]>([]);
  const [enterpriseList, setEnterpriseList] = useState<EnterpriseAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');

  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('profile');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Tab 1: Profile & Account Type state
  const [fullNameDraft, setFullNameDraft] = useState('');
  const [specialtyDraft, setSpecialtyDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [generalLicenseDraft, setGeneralLicenseDraft] = useState('');
  const [specialistLicenseDraft, setSpecialistLicenseDraft] = useState('');
  const [roleDraft, setRoleDraft] = useState<UserRole>('specialist');
  const [statusDraft, setStatusDraft] = useState<'active' | 'pending' | 'suspended'>('active');
  const [isActiveDraft, setIsActiveDraft] = useState(true);

  // Tab 2: Individual Subscription state (supports both in-place edit and new grant)
  const [subPlanSlug, setSubPlanSlug] = useState('premium_solo');
  const [subStatus, setSubStatus] = useState<SubscriptionStatusValue>('active');
  const [subOrigin, setSubOrigin] = useState<SubscriptionOrigin>('admin_grant');
  const [subInterval, setSubInterval] = useState<SubscriptionIntervalValue>('custom');
  const [subProcessor, setSubProcessor] = useState<PaymentProcessorValue>('comped');
  const [subPeriodEndDate, setSubPeriodEndDate] = useState('');
  const [subIsFounder, setSubIsFounder] = useState(false);
  const [subProtected, setSubProtected] = useState(true);
  const [subCancelAtEnd, setSubCancelAtEnd] = useState(false);
  const [subReason, setSubReason] = useState(GRANT_REASONS[0]);
  const [subNotes, setSubNotes] = useState('');

  // Tab 3: Clinic Access & Seat Limit state
  const [clinicSource, setClinicSource] = useState<'existing' | 'new'>('new');
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicType, setNewClinicType] = useState<
    'clinic' | 'aesthetic_center' | 'rehab_center' | 'hospital' | 'solo_practice'
  >('clinic');
  const [newClinicCity, setNewClinicCity] = useState('');
  const [clinicRoleDraft, setClinicRoleDraft] = useState<
    'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant'
  >('owner');
  const [clinicPlanSlug, setClinicPlanSlug] = useState('premium_clinic');
  const [clinicSeatLimit, setClinicSeatLimit] = useState(5);
  const [clinicDurationDays, setClinicDurationDays] = useState<number | null>(365);
  const [clinicLifetime, setClinicLifetime] = useState(false);
  const [clinicProtected, setClinicProtected] = useState(true);
  const [seatEdits, setSeatEdits] = useState<Record<string, number>>({});

  // Tab 4: Enterprise B2B Access state
  const [entSource, setEntSource] = useState<'existing' | 'new'>('new');
  const [selectedEntId, setSelectedEntId] = useState('');
  const [newEntName, setNewEntName] = useState('');
  const [newEntBrand, setNewEntBrand] = useState('');
  const [newEntType, setNewEntType] = useState<EnterpriseOrgType>('pharma');
  const [entRoleInOrg, setEntRoleInOrg] = useState<'owner' | 'manager' | 'billing'>('owner');
  const [entSetGlobalRole, setEntSetGlobalRole] = useState(true);
  const [entInitialBatches, setEntInitialBatches] = useState(1);
  const [entBatchMode, setEntBatchMode] = useState<'pilot_free' | 'manual'>('pilot_free');
  const [entDurationDays, setEntDurationDays] = useState<number | null>(365);

  // Tab 5: Account Limits, Granular Overrides & Admin Notes
  const [maxTeamUsersStr, setMaxTeamUsersStr] = useState('');
  const [maxPatientsStr, setMaxPatientsStr] = useState('');
  const [maxClinicsOwnedStr, setMaxClinicsOwnedStr] = useState('');
  const [maxTemplatesStr, setMaxTemplatesStr] = useState('');
  const [maxEntBatchesStr, setMaxEntBatchesStr] = useState('');
  const [canCreateClinic, setCanCreateClinic] = useState(true);
  const [canInviteTeam, setCanInviteTeam] = useState(true);
  const [canExportAllData, setCanExportAllData] = useState(true);
  const [canRemoveBranding, setCanRemoveBranding] = useState(false);
  const [earlyAccessBeta, setEarlyAccessBeta] = useState(false);
  const [overridesDraft, setOverridesDraft] = useState<Partial<Record<FeatureKey, boolean>>>({});
  const [adminNotesDraft, setAdminNotesDraft] = useState('');

  // Create Account Manually Modal State
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createShowPass, setCreateShowPass] = useState(true);
  const [createFullName, setCreateFullName] = useState('');
  const [createSpecialty, setCreateSpecialty] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createLicense, setCreateLicense] = useState('');
  const [createAccountType, setCreateAccountType] = useState<
    'specialist' | 'clinic_owner' | 'enterprise' | 'assistant' | 'super_admin'
  >('specialist');
  const [createPlanSlug, setCreatePlanSlug] = useState('premium_solo');
  const [createMaxTeamUsers, setCreateMaxTeamUsers] = useState('');
  const [createClinicName, setCreateClinicName] = useState('');
  const [createClinicSeats, setCreateClinicSeats] = useState(5);
  const [createEntOrgName, setCreateEntOrgName] = useState('');
  const [createEntBatches, setCreateEntBatches] = useState(1);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
    summary: string;
  } | null>(null);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
    let out = 'Stx';
    for (let i = 0; i < 9; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    setCreatePassword(out);
  };

  const openCreateUserModal = () => {
    setCreateEmail('');
    setCreateFullName('');
    setCreateSpecialty('');
    setCreatePhone('');
    setCreateLicense('');
    setCreateAccountType('specialist');
    setCreatePlanSlug('premium_solo');
    setCreateMaxTeamUsers('');
    setCreateClinicName('');
    setCreateClinicSeats(5);
    setCreateEntOrgName('');
    setCreateEntBatches(1);
    setCreateError(null);
    setCreatedCreds(null);
    generateTempPassword();
    setShowCreateUserModal(true);
    loadDirectories();
  };

  const handleCreateManualUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createPassword.trim()) return;
    setBusy(true);
    setCreateError(null);
    try {
      const globalRole: UserRole =
        createAccountType === 'clinic_owner' ? 'specialist' : createAccountType;
      const limits: AccountLimits = {
        max_team_users: parseOptionalInt(createMaxTeamUsers),
        can_create_clinic: true,
        can_invite_team: true,
      };

      const res = await createUserAccountManually({
        email: createEmail.trim(),
        password: createPassword,
        fullName: createFullName,
        specialty: createSpecialty,
        phone: createPhone,
        generalLicense: createLicense,
        role: globalRole,
        planSlug:
          createAccountType === 'enterprise' || createAccountType === 'clinic_owner'
            ? 'free'
            : createPlanSlug,
        durationDays: 365,
        isLifetime: false,
        protectedFromAutoDowngrade: true,
        accountLimits: limits,
      });

      let extraSummary = `Rol: ${ROLE_LABELS[globalRole]}`;

      if (createAccountType === 'clinic_owner') {
        const clinicLabel = createClinicName.trim() || `Clínica ${createFullName.trim() || createEmail.trim()}`;
        await grantClinicAccessToUser({
          userId: res.user_id,
          userEmail: res.email,
          newClinic: {
            name: clinicLabel,
            type: 'clinic',
            directorName: createFullName.trim() || undefined,
          },
          roleInClinic: 'owner',
          planSlug: createPlanSlug === 'plus_solo' ? 'plus_clinic' : 'premium_clinic',
          seatLimit: createClinicSeats,
          durationDays: 365,
          isLifetime: false,
          protectedFromAutoDowngrade: true,
        });
        extraSummary = `Owner de Clínica "${clinicLabel}" (${createClinicSeats} asientos)`;
      } else if (createAccountType === 'enterprise') {
        const orgLabel = createEntOrgName.trim() || createFullName.trim() || 'Organización Enterprise';
        await grantEnterpriseAccessToUser({
          userId: res.user_id,
          userEmail: res.email,
          newOrg: {
            name: orgLabel,
            brandDisplayName: orgLabel,
            organizationType: 'pharma',
            contactName: createFullName.trim() || undefined,
          },
          roleInOrg: 'owner',
          setEnterpriseRole: true,
          initialBatchCount: createEntBatches,
          batchMode: 'pilot_free',
          batchDurationDays: 365,
        });
        extraSummary = `Enterprise "${orgLabel}" (${createEntBatches * 20} licencias)`;
      } else {
        extraSummary += ` · Plan: ${createPlanSlug}`;
      }

      setCreatedCreds({
        email: res.email,
        password: createPassword,
        summary: extraSummary,
      });
      await refreshAll();
    } catch (err: any) {
      setCreateError(err?.message || 'Error creando cuenta manual.');
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUsers({ search, role: roleFilter, tier: tierFilter, origin: originFilter });
      setUsers(data);
      setSelected((prev) => (prev ? data.find((u) => u.id === prev.id) || prev : null));
    } catch (err: any) {
      setError(err?.message || 'Error cargando usuarios.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, tierFilter, originFilter]);

  const loadDirectories = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([listClinics(), listEnterpriseAccounts()]);
      setClinicsList(c);
      setEnterpriseList(e);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 220);
    return () => clearTimeout(t);
  }, [load]);

  const hydrateDrawerFromUser = (user: AdminUserRow, initialTab?: DrawerTab) => {
    setSelected(user);
    setFeedback(null);
    if (initialTab) setDrawerTab(initialTab);

    // Tab 1: Profile & Role
    setFullNameDraft(user.full_name || '');
    setSpecialtyDraft(user.specialty || '');
    setPhoneDraft(user.phone || '');
    setGeneralLicenseDraft(user.general_license || '');
    setSpecialistLicenseDraft(user.specialist_license || '');
    setRoleDraft(user.role);
    setStatusDraft(user.status || 'active');
    setIsActiveDraft(user.is_active);

    // Tab 2: Subscription
    const sub = user.active_subscription;
    setSubPlanSlug(
      sub?.plan_slug ||
        (user.subscription_tier === 'premium'
          ? 'premium_solo'
          : user.subscription_tier === 'plus'
          ? 'plus_solo'
          : 'free')
    );
    setSubStatus((sub?.status as SubscriptionStatusValue) || 'active');
    setSubOrigin(sub?.origin || 'admin_grant');
    setSubInterval((sub?.billing_interval as SubscriptionIntervalValue) || 'custom');
    setSubProcessor((sub?.payment_processor as PaymentProcessorValue) || 'comped');
    setSubPeriodEndDate(toDateInputValue(sub?.current_period_end));
    setSubIsFounder(Boolean(sub?.is_founder));
    setSubProtected(sub ? Boolean(sub.protected_from_auto_downgrade) : true);
    setSubCancelAtEnd(Boolean(sub?.cancel_at_period_end));
    setSubReason(sub?.grant_reason || GRANT_REASONS[0]);
    setSubNotes(sub?.notes || '');

    // Tab 3: Clinics
    setClinicSource(clinicsList.length > 0 ? 'existing' : 'new');
    setSelectedClinicId(user.clinics?.[0]?.clinic_id || clinicsList[0]?.id || '');
    setNewClinicName(user.full_name ? `Clínica ${user.full_name}` : '');
    setNewClinicType('clinic');
    setNewClinicCity('');
    setClinicRoleDraft('owner');
    setClinicPlanSlug('premium_clinic');
    setClinicSeatLimit(5);
    setClinicDurationDays(365);
    setClinicLifetime(false);
    setClinicProtected(true);

    const nextSeats: Record<string, number> = {};
    (user.clinics || []).forEach((c) => {
      nextSeats[c.clinic_id] = c.active_seat_limit ?? 5;
    });
    setSeatEdits(nextSeats);

    // Tab 4: Enterprise
    setEntSource(enterpriseList.length > 0 ? 'existing' : 'new');
    setSelectedEntId(user.enterprise_orgs?.[0]?.id || enterpriseList[0]?.id || '');
    setNewEntName('');
    setNewEntBrand('');
    setNewEntType('pharma');
    setEntRoleInOrg('owner');
    setEntSetGlobalRole(true);
    setEntInitialBatches(1);
    setEntBatchMode('pilot_free');
    setEntDurationDays(365);

    // Tab 5: Account Limits & Overrides
    const lim: AccountLimits = user.account_limits || {};
    setMaxTeamUsersStr(lim.max_team_users !== undefined && lim.max_team_users !== null ? String(lim.max_team_users) : '');
    setMaxPatientsStr(lim.max_patients !== undefined && lim.max_patients !== null ? String(lim.max_patients) : '');
    setMaxClinicsOwnedStr(
      lim.max_clinics_owned !== undefined && lim.max_clinics_owned !== null ? String(lim.max_clinics_owned) : ''
    );
    setMaxTemplatesStr(lim.max_templates !== undefined && lim.max_templates !== null ? String(lim.max_templates) : '');
    setMaxEntBatchesStr(
      lim.max_enterprise_batches !== undefined && lim.max_enterprise_batches !== null
        ? String(lim.max_enterprise_batches)
        : ''
    );
    setCanCreateClinic(lim.can_create_clinic ?? true);
    setCanInviteTeam(lim.can_invite_team ?? true);
    setCanExportAllData(lim.can_export_all_data ?? true);
    setCanRemoveBranding(lim.can_remove_branding ?? false);
    setEarlyAccessBeta(lim.early_access_beta ?? false);
    setOverridesDraft({ ...(user.feature_overrides || {}) });
    setAdminNotesDraft(user.admin_notes || '');

    loadDirectories();
  };

  useEffect(() => {
    if (selected && clinicSource === 'existing' && !selectedClinicId && clinicsList.length > 0) {
      setSelectedClinicId(clinicsList[0].id);
    }
  }, [selected, clinicSource, selectedClinicId, clinicsList]);

  useEffect(() => {
    if (selected && entSource === 'existing' && !selectedEntId && enterpriseList.length > 0) {
      setSelectedEntId(enterpriseList[0].id);
    }
  }, [selected, entSource, selectedEntId, enterpriseList]);

  const refreshAll = async () => {
    await Promise.all([load(), loadDirectories()]);
    onDataChanged?.();
  };

  const quickGrantPremium = async (user: AdminUserRow) => {
    setBusy(true);
    setError(null);
    try {
      await grantSubscription({
        userId: user.id,
        planSlug: 'premium_solo',
        billingInterval: 'lifetime',
        isLifetime: true,
        grantReason: 'Cortesía Premium Manual (SuperAdmin)',
        protectedFromAutoDowngrade: true,
      });
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || 'Error otorgando Premium.');
    } finally {
      setBusy(false);
    }
  };

  // TAB 1 SAVE: Profile, Role, Account Status
  const handleSaveProfileAndRole = async (resetLegal = false) => {
    if (!selected) return;
    if (
      resetLegal &&
      !window.confirm('¿Resetear la aceptación legal LFPDPPP de este usuario para exigir nueva firma al entrar?')
    ) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await updateUserAccount(selected.id, {
        full_name: fullNameDraft.trim() || null,
        specialty: specialtyDraft.trim() || null,
        phone: phoneDraft.trim() || null,
        general_license: generalLicenseDraft.trim() || null,
        specialist_license: specialistLicenseDraft.trim() || null,
        role: roleDraft,
        status: statusDraft,
        is_active: statusDraft === 'active' ? isActiveDraft : false,
        reset_legal_consent: resetLegal,
      });
      setFeedback({
        type: 'ok',
        text: resetLegal
          ? 'Consentimiento legal reseteado y perfil guardado.'
          : 'Perfil, tipo de usuario y estado de cuenta actualizados.',
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error guardando perfil y rol.' });
    } finally {
      setBusy(false);
    }
  };

  // TAB 2 SAVE: Modify existing subscription OR Grant new subscription
  const handleSaveSubscription = async (forceNewGrant = false) => {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      const periodEndIso = subPeriodEndDate
        ? new Date(`${subPeriodEndDate}T23:59:59.000Z`).toISOString()
        : null;

      if (selected.active_subscription && !forceNewGrant && subPlanSlug !== 'free') {
        await updateSubscription(selected.active_subscription.id, {
          plan_slug: subPlanSlug,
          status: subStatus,
          origin: subOrigin,
          billing_interval: subInterval,
          payment_processor: subProcessor,
          current_period_end: periodEndIso,
          is_founder: subIsFounder,
          protected_from_auto_downgrade: subProtected,
          cancel_at_period_end: subCancelAtEnd,
          grant_reason: subReason.trim() || null,
          notes: subNotes.trim() || null,
        });
        setFeedback({ type: 'ok', text: 'Suscripción actual modificada in-place correctamente.' });
      } else {
        await grantSubscription({
          userId: selected.id,
          planSlug: subPlanSlug,
          billingInterval: periodEndIso ? subInterval : 'lifetime',
          customPeriodEnd: periodEndIso,
          isLifetime: !periodEndIso,
          grantReason: subReason.trim() || 'Asignado por SuperAdmin',
          protectedFromAutoDowngrade: subProtected,
          notes: subNotes.trim() || null,
        });
        setFeedback({
          type: 'ok',
          text:
            subPlanSlug === 'free'
              ? 'Cuenta degradada a Plan Gratuito (Free). Sus datos se mantienen en solo lectura.'
              : 'Suscripción asignada y activada correctamente.',
        });
      }
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'No se pudo actualizar la suscripción.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeSub = async () => {
    if (!selected?.active_subscription?.id) return;
    if (!window.confirm('¿Revocar la suscripción activa de este usuario?')) return;
    setBusy(true);
    setFeedback(null);
    try {
      await revokeSubscription(selected.active_subscription.id, 'Revocación manual por SuperAdmin');
      setFeedback({ type: 'ok', text: 'Suscripción revocada.' });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error al revocar.' });
    } finally {
      setBusy(false);
    }
  };

  // TAB 3 SAVE: Clinic Access + Custom Seat Limit
  const handleGrantClinicAccess = async () => {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await grantClinicAccessToUser({
        userId: selected.id,
        userEmail: selected.email,
        clinicId: clinicSource === 'existing' ? selectedClinicId : null,
        newClinic:
          clinicSource === 'new'
            ? {
                name: newClinicName,
                type: newClinicType,
                city: newClinicCity,
                directorName: selected.full_name || undefined,
              }
            : undefined,
        roleInClinic: clinicRoleDraft,
        planSlug: clinicPlanSlug,
        seatLimit: clinicSeatLimit,
        durationDays: clinicLifetime ? null : clinicDurationDays,
        isLifetime: clinicLifetime,
        grantReason: `Acceso Clínica (${clinicRoleDraft}) · ${clinicSeatLimit} asientos`,
        protectedFromAutoDowngrade: clinicProtected,
      });
      setFeedback({
        type: 'ok',
        text: `Clínica "${result.clinicName}" asignada como ${CLINIC_ROLE_LABELS[clinicRoleDraft]} (límite: ${clinicSeatLimit} usuarios).`,
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error configurando acceso de clínica.' });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateExistingClinicRole = async (
    clinicId: string,
    newRole: 'owner' | 'director' | 'clinic_admin' | 'specialist' | 'assistant'
  ) => {
    if (!selected?.email) {
      setFeedback({ type: 'err', text: 'El usuario no tiene correo registrado para actualizar su rol en clínica.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await manageClinicMember({
        clinicId,
        userEmail: selected.email,
        roleInClinic: newRole,
        status: 'approved',
        isActive: true,
      });
      setFeedback({ type: 'ok', text: `Puesto en clínica actualizado a ${CLINIC_ROLE_LABELS[newRole]}.` });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error actualizando puesto en clínica.' });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateExistingClinicSeats = async (clinicId: string) => {
    const nextSeats = Math.max(1, seatEdits[clinicId] || 1);
    setBusy(true);
    setFeedback(null);
    try {
      await updateClinicSeatLimit(clinicId, nextSeats);
      setFeedback({ type: 'ok', text: `Cupo de usuarios de la clínica actualizado a ${nextSeats} asientos.` });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error actualizando cupo de asientos.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFromClinic = async (clinicId: string, clinicName: string) => {
    if (!selected) return;
    if (!window.confirm(`¿Desvincular a ${selected.full_name || selected.email} de "${clinicName}"?`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      await removeClinicMember(clinicId, selected.id);
      setFeedback({ type: 'ok', text: `Usuario desvinculado de "${clinicName}".` });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error desvinculando usuario.' });
    } finally {
      setBusy(false);
    }
  };

  // TAB 4 SAVE: Enterprise B2B
  const handleGrantEnterpriseAccess = async () => {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await grantEnterpriseAccessToUser({
        userId: selected.id,
        userEmail: selected.email,
        enterpriseAccountId: entSource === 'existing' ? selectedEntId : null,
        newOrg:
          entSource === 'new'
            ? {
                name: newEntName,
                brandDisplayName: newEntBrand || newEntName,
                organizationType: newEntType,
                contactName: selected.full_name || undefined,
              }
            : undefined,
        roleInOrg: entRoleInOrg,
        setEnterpriseRole: entSetGlobalRole,
        initialBatchCount: entInitialBatches,
        batchMode: entBatchMode,
        batchDurationDays: entDurationDays,
      });
      if (entSetGlobalRole && selected.role !== 'super_admin') {
        setRoleDraft('enterprise');
      }
      setFeedback({
        type: 'ok',
        text: `Acceso Enterprise otorgado en "${result.orgName}" (${entRoleInOrg})${
          result.licensesAdded > 0 ? ` + ${result.licensesAdded} licencias (${entInitialBatches} lote(s) x20)` : ''
        }.`,
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error otorgando acceso Enterprise.' });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickAddEnterpriseBatch = async (orgId: string, orgName: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await addEnterpriseBatch({
        enterpriseAccountId: orgId,
        batchCount: 1,
        billingInterval: 'pilot_free',
        unitBatchPriceCents: 0,
        paymentProcessor: 'comped',
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Lote rápido +20 licencias otorgado desde Gestión de Usuario',
      });
      setFeedback({ type: 'ok', text: `+20 licencias Premium agregadas a "${orgName}".` });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error agregando lote x20.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFromEnterprise = async (orgId: string, orgName: string) => {
    if (!selected) return;
    if (!window.confirm(`¿Revocar acceso de gestor Enterprise en "${orgName}"?`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      await removeEnterpriseManager(orgId, selected.id);
      setFeedback({ type: 'ok', text: `Acceso de gestor revocado en "${orgName}".` });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error revocando acceso Enterprise.' });
    } finally {
      setBusy(false);
    }
  };

  // TAB 5 SAVE: Quotas, Account Limits, Feature Overrides, Admin Notes
  const handleSaveLimitsAndOverrides = async () => {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      const limits: AccountLimits = {
        max_team_users: parseOptionalInt(maxTeamUsersStr),
        max_patients: parseOptionalInt(maxPatientsStr),
        max_clinics_owned: parseOptionalInt(maxClinicsOwnedStr),
        max_templates: parseOptionalInt(maxTemplatesStr),
        max_enterprise_batches: parseOptionalInt(maxEntBatchesStr),
        can_create_clinic: canCreateClinic,
        can_invite_team: canInviteTeam,
        can_export_all_data: canExportAllData,
        can_remove_branding: canRemoveBranding,
        early_access_beta: earlyAccessBeta,
      };
      await updateUserAccount(selected.id, {
        account_limits: limits,
        feature_overrides: overridesDraft,
        admin_notes: adminNotesDraft.trim() || null,
      });
      setFeedback({
        type: 'ok',
        text: 'Cuotas de usuarios, límites personalizados, overrides y notas guardados.',
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Error guardando cuotas y permisos.' });
    } finally {
      setBusy(false);
    }
  };

  const toggleOverride = (key: FeatureKey) => {
    setOverridesDraft((prev) => {
      const next = { ...prev };
      if (next[key] === undefined) next[key] = true;
      else if (next[key] === true) next[key] = false;
      else delete next[key];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo, especialidad o cédula..."
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
        >
          <option value="all">Todos los roles</option>
          <option value="specialist">Especialistas</option>
          <option value="enterprise">Enterprise (B2B)</option>
          <option value="assistant">Asistentes</option>
          <option value="support_admin">Soporte Admin</option>
          <option value="super_admin">SuperAdmin</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
        >
          <option value="all">Todos los planes</option>
          <option value="free">Free</option>
          <option value="plus">Plus</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
        >
          <option value="all">Todos los orígenes</option>
          <option value="launch_promo">Lanzamiento ($0 Fundador)</option>
          <option value="admin_grant">Otorgado por Admin</option>
          <option value="enterprise_license">Licencia Enterprise</option>
          <option value="stripe">Stripe</option>
          <option value="manual_payment">Pago Manual</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Actualizar
        </button>
        <button
          type="button"
          onClick={openCreateUserModal}
          className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          Crear Cuenta
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/70 dark:bg-slate-950/40">
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-3">Tipo / Organización</th>
                <th className="py-3 px-3">Suscripción y Cuotas</th>
                <th className="py-3 px-3">Uso Clínico</th>
                <th className="py-3 px-3">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No se encontraron usuarios con esos filtros.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const sub = u.active_subscription;
                  const tierBadge =
                    u.subscription_tier === 'premium'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : u.subscription_tier === 'plus'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                  const customTeamCap = u.account_limits?.max_team_users;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{u.full_name || 'Sin nombre'}</div>
                        <div className="text-xs text-slate-500">{u.email || u.id.slice(0, 8)}</div>
                        {u.specialty && (
                          <div className="text-[11px] text-slate-400">
                            {u.specialty} {u.general_license ? `· Céd. ${u.general_license}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              u.role === 'super_admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                : u.role === 'enterprise'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                          {u.clinics && u.clinics.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[12px]">local_hospital</span>
                              {u.clinics[0].name} ({u.clinics[0].role_in_clinic})
                              {u.clinics[0].active_seat_limit ? ` · ${u.clinics[0].active_seat_limit} asientos` : ''}
                            </span>
                          )}
                          {u.enterprise_orgs && u.enterprise_orgs.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                              <span className="material-symbols-outlined text-[12px]">corporate_fare</span>
                              {u.enterprise_orgs[0].brand_display_name} ({u.enterprise_orgs[0].role_in_org})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase ${tierBadge}`}>
                            {TIER_LABELS[u.subscription_tier]}
                          </span>
                          {sub?.protected_from_auto_downgrade && (
                            <span
                              title="Protegido contra cobro/downgrade automático"
                              className="material-symbols-outlined text-[15px] text-emerald-500"
                            >
                              verified_user
                            </span>
                          )}
                          {customTeamCap !== undefined && customTeamCap !== null && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500">
                              Máx {customTeamCap} usr.
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {sub ? ORIGIN_LABELS[sub.origin] || sub.origin : 'Sin suscripción individual'}
                          {sub?.sponsor_name ? ` · ${sub.sponsor_name}` : ''}
                        </div>
                        {sub?.current_period_end && (
                          <div className="text-[10px] text-slate-400">
                            Vence: {new Date(sub.current_period_end).toLocaleDateString('es-MX')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>
                          {u.patients_count} pac. · {u.treatments_count} ses.
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {u.terms_accepted_at ? 'LFPDPPP OK' : 'Sin consentimiento'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold ${
                            u.is_active && u.status === 'active'
                              ? 'text-emerald-600'
                              : u.status === 'pending'
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          <span
                            className={`size-2 rounded-full ${
                              u.is_active && u.status === 'active'
                                ? 'bg-emerald-500'
                                : u.status === 'pending'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                          />
                          {u.status === 'pending' ? 'Pendiente' : u.is_active ? 'Activa' : 'Suspendida'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {u.subscription_tier !== 'premium' && u.role !== 'enterprise' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => quickGrantPremium(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              + Premium
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => hydrateDrawerFromUser(u, 'profile')}
                            className="px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-white text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">tune</span>
                            Gestionar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MANUAL ACCOUNT MODAL */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">person_add</span>
                  Crear Cuenta Manualmente
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Crea una cuenta confirmada con rol, suscripción, clínica Owner o Empresa Enterprise en un solo paso.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {createdCreds ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
                  <p className="font-black text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined">check_circle</span>
                    ¡Cuenta creada y lista para iniciar sesión!
                  </p>
                  <p className="text-emerald-800 dark:text-emerald-200">{createdCreds.summary}</p>
                  <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 p-3 font-mono text-xs space-y-1 border border-emerald-200/60 dark:border-emerald-900">
                    <div>
                      <span className="text-slate-400">Acceso:</span> {window.location.origin}/login
                    </div>
                    <div>
                      <span className="text-slate-400">Correo:</span> <strong>{createdCreds.email}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Contraseña:</span> <strong>{createdCreds.password}</strong>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `Acceso SonoTox\nURL: ${window.location.origin}/login\nCorreo: ${createdCreds.email}\nContraseña temporal: ${createdCreds.password}`;
                      navigator.clipboard?.writeText(msg);
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-white font-black cursor-pointer"
                  >
                    Copiar Credenciales
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateUserModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateManualUser} className="space-y-4">
                {createError && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3.5 space-y-2 text-amber-900 dark:text-amber-200">
                    <p className="font-bold">
                      {createError.startsWith('EDGE_FUNCTION_NOT_DEPLOYED:')
                        ? createError.replace('EDGE_FUNCTION_NOT_DEPLOYED: ', '')
                        : createError}
                    </p>
                    {createError.startsWith('EDGE_FUNCTION_NOT_DEPLOYED:') && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(`${window.location.origin}/signup`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
                        >
                          Copiar enlace de registro (/signup)
                        </button>
                        <code className="px-2 py-1 rounded bg-black/15 text-[11px]">
                          supabase functions deploy admin-create-user
                        </code>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Nombre completo *</label>
                    <input
                      required
                      value={createFullName}
                      onChange={(e) => setCreateFullName(e.target.value)}
                      placeholder="Dra. Sofía Martínez"
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Correo electrónico *</label>
                    <input
                      required
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="doctora@clinica.com"
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-500 mb-1">Contraseña temporal *</label>
                    <div className="flex gap-2">
                      <input
                        required
                        minLength={8}
                        type={createShowPass ? 'text' : 'password'}
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => setCreateShowPass((v) => !v)}
                        className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
                      >
                        {createShowPass ? 'Ocultar' : 'Ver'}
                      </button>
                      <button
                        type="button"
                        onClick={generateTempPassword}
                        className="px-3 py-2 rounded-xl bg-primary/15 text-primary font-bold cursor-pointer"
                      >
                        Generar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Especialidad</label>
                    <input
                      value={createSpecialty}
                      onChange={(e) => setCreateSpecialty(e.target.value)}
                      placeholder="Rehabilitación / Neurología / Estética"
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Teléfono / Cédula</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={createPhone}
                        onChange={(e) => setCreatePhone(e.target.value)}
                        placeholder="Teléfono"
                        className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2"
                      />
                      <input
                        value={createLicense}
                        onChange={(e) => setCreateLicense(e.target.value)}
                        placeholder="Cédula"
                        className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Type Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-black uppercase text-[10px] text-slate-400">
                    Tipo de Cuenta a Crear
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    {[
                      { id: 'specialist', label: 'Especialista' },
                      { id: 'clinic_owner', label: 'Owner Clínica' },
                      { id: 'enterprise', label: 'Enterprise x20' },
                      { id: 'assistant', label: 'Asistente' },
                      { id: 'super_admin', label: 'SuperAdmin' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCreateAccountType(opt.id as any)}
                        className={`px-2.5 py-2 rounded-xl font-bold border cursor-pointer ${
                          createAccountType === opt.id
                            ? 'bg-primary text-white border-primary'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {createAccountType === 'clinic_owner' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 p-3">
                    <input
                      value={createClinicName}
                      onChange={(e) => setCreateClinicName(e.target.value)}
                      placeholder="Nombre de nueva clínica *"
                      className="sm:col-span-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-500">Asientos:</span>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={createClinicSeats}
                        onChange={(e) => setCreateClinicSeats(Math.max(1, Number(e.target.value) || 1))}
                        className="w-16 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2 font-black text-center"
                      />
                    </div>
                  </div>
                ) : createAccountType === 'enterprise' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-3">
                    <input
                      value={createEntOrgName}
                      onChange={(e) => setCreateEntOrgName(e.target.value)}
                      placeholder="Nombre de Empresa / Escuela *"
                      className="sm:col-span-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-500">Lotes x20:</span>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={createEntBatches}
                        onChange={(e) => setCreateEntBatches(Math.max(0, Number(e.target.value) || 0))}
                        className="w-16 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-2 font-black text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">Suscripción Inicial</label>
                      <select
                        value={createPlanSlug}
                        onChange={(e) => setCreatePlanSlug(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                      >
                        <option value="premium_solo">Plan Premium (1 año VIP)</option>
                        <option value="plus_solo">Plan Plus (1 año VIP)</option>
                        <option value="free">Plan Gratuito (Free)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-500 mb-1">
                        Máx. usuarios que puede agregar (opcional)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={createMaxTeamUsers}
                        onChange={(e) => setCreateMaxTeamUsers(e.target.value)}
                        placeholder="Vacío = según plan"
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateUserModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-black shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Creando Cuenta...' : 'Crear Cuenta Ahora'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* GOD-MODE ACCOUNT MANAGEMENT DRAWER */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
            {/* Sticky Header + Tabs */}
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 pt-5 pb-3 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white truncate">
                      {selected.full_name || 'Usuario sin nombre'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-primary/15 text-primary">
                      {ROLE_LABELS[selected.role]}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        selected.subscription_tier === 'premium'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                          : selected.subscription_tier === 'plus'
                          ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      Plan {TIER_LABELS[selected.subscription_tier]}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        selected.is_active && selected.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-red-500/15 text-red-600 dark:text-red-300'
                      }`}
                    >
                      {selected.is_active ? selected.status : 'suspendida'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>{selected.email || 'Sin correo'}</span>
                    <span>· {selected.patients_count} pac. / {selected.treatments_count} ses.</span>
                    <span>· Alta: {new Date(selected.created_at).toLocaleDateString('es-MX')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selected.id);
                        setFeedback({ type: 'ok', text: `UUID copiado: ${selected.id}` });
                      }}
                      className="font-mono text-[11px] text-slate-400 hover:text-primary cursor-pointer"
                      title="Copiar ID de usuario"
                    >
                      #{selected.id.slice(0, 8)} ⧉
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* 5-Tab Navigation */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: 'profile', label: 'Cuenta y Tipo', icon: 'manage_accounts' },
                  { id: 'subscription', label: 'Suscripción', icon: 'workspace_premium' },
                  {
                    id: 'clinic',
                    label: `Clínica${selected.clinics?.length ? ` (${selected.clinics.length})` : ''}`,
                    icon: 'local_hospital',
                  },
                  {
                    id: 'enterprise',
                    label: `Enterprise${selected.enterprise_orgs?.length ? ` (${selected.enterprise_orgs.length})` : ''}`,
                    icon: 'corporate_fare',
                  },
                  { id: 'limits', label: 'Cuotas y Permisos', icon: 'tune' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDrawerTab(t.id as DrawerTab)}
                    className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      drawerTab === t.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-6 space-y-5 text-xs">
              {feedback && (
                <div
                  className={`rounded-xl p-3 font-bold flex items-center justify-between gap-2 ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <span>{feedback.text}</span>
                  <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              )}

              {/* ===================== TAB 1: CUENTA, TIPO DE USUARIO Y PERFIL ===================== */}
              {drawerTab === 'profile' && (
                <div className="space-y-5">
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <h4 className="font-black text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">badge</span>
                      Tipo de Usuario / Rol Global en la Plataforma
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          role: 'specialist' as UserRole,
                          label: 'Especialista (Médico)',
                          desc: 'Consultorio propio o miembro clínico',
                          icon: 'stethoscope',
                        },
                        {
                          role: 'assistant' as UserRole,
                          label: 'Asistente de Clínica',
                          desc: 'Agenda y registro demográfico',
                          icon: 'support_agent',
                        },
                        {
                          role: 'enterprise' as UserRole,
                          label: 'Empresa Enterprise',
                          desc: 'Portal B2B · Lotes x20 · Zero-PHI',
                          icon: 'corporate_fare',
                        },
                        {
                          role: 'support_admin' as UserRole,
                          label: 'Soporte Admin',
                          desc: 'Gestión operativa limitada',
                          icon: 'headset_mic',
                        },
                        {
                          role: 'super_admin' as UserRole,
                          label: 'SuperAdmin',
                          desc: 'Control total de la plataforma',
                          icon: 'admin_panel_settings',
                        },
                      ].map((item) => {
                        const active = roleDraft === item.role;
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => setRoleDraft(item.role)}
                            className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                              active
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                              <span className="material-symbols-outlined text-base text-primary">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDrawerTab('clinic')}
                        className="px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold hover:bg-teal-500/25 cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">local_hospital</span>
                        Configurar como Owner de Clínica →
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawerTab('enterprise')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-500/25 cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">corporate_fare</span>
                        Vincular Empresa Enterprise (x20) →
                      </button>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                    <h4 className="font-black text-sm">Estado de Cuenta y Perfil Médico</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Estado de Cuenta</label>
                        <select
                          value={statusDraft}
                          onChange={(e) => {
                            const next = e.target.value as 'active' | 'pending' | 'suspended';
                            setStatusDraft(next);
                            setIsActiveDraft(next === 'active');
                          }}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        >
                          <option value="active">Activa (Acceso habilitado)</option>
                          <option value="pending">Pendiente de aprobación</option>
                          <option value="suspended">Suspendida (Bloqueada)</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer">
                          <span>Cuenta habilitada (is_active)</span>
                          <input
                            type="checkbox"
                            checked={isActiveDraft}
                            onChange={(e) => {
                              setIsActiveDraft(e.target.checked);
                              setStatusDraft(e.target.checked ? 'active' : 'suspended');
                            }}
                            className="size-4 accent-primary"
                          />
                        </label>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Nombre completo</label>
                        <input
                          value={fullNameDraft}
                          onChange={(e) => setFullNameDraft(e.target.value)}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Especialidad</label>
                        <input
                          value={specialtyDraft}
                          onChange={(e) => setSpecialtyDraft(e.target.value)}
                          placeholder="Ej. Rehabilitación / Neurología / Medicina Estética"
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Teléfono</label>
                        <input
                          value={phoneDraft}
                          onChange={(e) => setPhoneDraft(e.target.value)}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">Cédula General</label>
                          <input
                            value={generalLicenseDraft}
                            onChange={(e) => setGeneralLicenseDraft(e.target.value)}
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">Cédula Esp.</label>
                          <input
                            value={specialistLicenseDraft}
                            onChange={(e) => setSpecialistLicenseDraft(e.target.value)}
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-700 dark:text-slate-200">Cumplimiento Legal LFPDPPP</p>
                        <p className="text-[11px] text-slate-400">
                          Términos:{' '}
                          {selected.terms_accepted_at
                            ? new Date(selected.terms_accepted_at).toLocaleDateString('es-MX')
                            : 'Pendiente'}{' '}
                          · Privacidad sensible:{' '}
                          {selected.privacy_sensitive_accepted_at
                            ? new Date(selected.privacy_sensitive_accepted_at).toLocaleDateString('es-MX')
                            : 'Pendiente'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveProfileAndRole(true)}
                        className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/10 font-bold cursor-pointer"
                      >
                        Pedir re-aceptación legal
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveProfileAndRole(false)}
                      className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? 'Guardando...' : 'Guardar Perfil, Rol y Estado de Cuenta'}
                    </button>
                  </section>
                </div>
              )}

              {/* ===================== TAB 2: SUSCRIPCIÓN (GRATUITA, PLUS, PREMIUM) ===================== */}
              {drawerTab === 'subscription' && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/15 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-black text-sm flex items-center gap-2 text-amber-900 dark:text-amber-200">
                          <span className="material-symbols-outlined text-amber-500">workspace_premium</span>
                          Suscripción Individual (Gratuita / Plus / Premium)
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {selected.active_subscription
                            ? `Suscripción activa #${selected.active_subscription.id.slice(0, 8)} · ${selected.active_subscription.plan_name}`
                            : 'Sin suscripción individual activa (actualmente en Plan Gratuito o heredando plan de clínica).'}
                        </p>
                      </div>
                      {selected.active_subscription && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={handleRevokeSub}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold cursor-pointer transition-colors"
                        >
                          Revocar actual
                        </button>
                      )}
                    </div>

                    {/* Visual Tier Picker */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          slug: 'free',
                          title: 'Gratuita (Free)',
                          desc: 'Solo calculadora e impresión',
                          ring: 'border-slate-400',
                        },
                        {
                          slug: 'plus_solo',
                          title: 'Plan Plus',
                          desc: 'Expedientes, historial, agenda, offline',
                          ring: 'border-sky-500',
                        },
                        {
                          slug: 'premium_solo',
                          title: 'Plan Premium',
                          desc: 'Todo Plus + USG, puntos motores, protocolos',
                          ring: 'border-amber-500',
                        },
                      ].map((tier) => {
                        const active = subPlanSlug === tier.slug;
                        return (
                          <button
                            key={tier.slug}
                            type="button"
                            onClick={() => setSubPlanSlug(tier.slug)}
                            className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                              active
                                ? `${tier.ring} bg-white dark:bg-slate-800 shadow-sm`
                                : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50'
                            }`}
                          >
                            <p className="font-black text-slate-900 dark:text-white">{tier.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{tier.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {subPlanSlug !== 'free' && (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block font-bold text-slate-500 mb-1">Estado</label>
                            <select
                              value={subStatus}
                              onChange={(e) => setSubStatus(e.target.value as SubscriptionStatusValue)}
                              className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-bold"
                            >
                              <option value="active">Activa</option>
                              <option value="trialing">Prueba</option>
                              <option value="past_due">Pago pend.</option>
                              <option value="paused">Pausada</option>
                              <option value="canceled">Cancelada</option>
                              <option value="expired">Expirada</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-500 mb-1">Origen</label>
                            <select
                              value={subOrigin}
                              onChange={(e) => setSubOrigin(e.target.value as SubscriptionOrigin)}
                              className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-bold"
                            >
                              <option value="admin_grant">Cortesía Admin</option>
                              <option value="launch_promo">Lanzamiento $0</option>
                              <option value="manual_payment">Pago Manual</option>
                              <option value="promo_code">Cupón</option>
                              <option value="enterprise_license">Enterprise</option>
                              <option value="stripe">Stripe</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-500 mb-1">Intervalo</label>
                            <select
                              value={subInterval}
                              onChange={(e) => setSubInterval(e.target.value as SubscriptionIntervalValue)}
                              className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-bold"
                            >
                              <option value="monthly">Mensual</option>
                              <option value="annual">Anual</option>
                              <option value="lifetime">Vitalicio</option>
                              <option value="custom">Personalizado</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-500 mb-1">Procesador</label>
                            <select
                              value={subProcessor}
                              onChange={(e) => setSubProcessor(e.target.value as PaymentProcessorValue)}
                              className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-2 font-bold"
                            >
                              <option value="comped">Cortesía ($0)</option>
                              <option value="manual">Manual SPEI</option>
                              <option value="stripe">Stripe</option>
                              <option value="mercadopago">MercadoPago</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-500">Fecha de Vencimiento</label>
                            <span className="font-bold text-primary">
                              {subPeriodEndDate
                                ? `Vence el ${new Date(`${subPeriodEndDate}T12:00:00`).toLocaleDateString('es-MX')}`
                                : 'Sin vencimiento (Vitalicio)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={subPeriodEndDate}
                              onChange={(e) => setSubPeriodEndDate(e.target.value)}
                              className="flex-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                            />
                            {subPeriodEndDate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSubPeriodEndDate('');
                                  setSubInterval('lifetime');
                                }}
                                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
                              >
                                Vitalicio
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {GRANT_PRESETS.map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  if (preset.lifetime || preset.days === null) {
                                    setSubPeriodEndDate('');
                                    setSubInterval('lifetime');
                                  } else {
                                    setSubPeriodEndDate(addDaysFromNow(preset.days));
                                    if (subInterval === 'lifetime') setSubInterval('custom');
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary font-bold cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={subProtected}
                              onChange={(e) => setSubProtected(e.target.checked)}
                              className="size-4 accent-primary"
                            />
                            <span>Protegida VIP</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={subIsFounder}
                              onChange={(e) => setSubIsFounder(e.target.checked)}
                              className="size-4 accent-primary"
                            />
                            <span>Fundador</span>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={subCancelAtEnd}
                              onChange={(e) => setSubCancelAtEnd(e.target.checked)}
                              className="size-4 accent-primary"
                            />
                            <span>Cancelar al vencer</span>
                          </label>
                        </div>

                        <div className="space-y-2">
                          <input
                            value={subReason}
                            onChange={(e) => setSubReason(e.target.value)}
                            placeholder="Motivo / Etiqueta..."
                            className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium"
                          />
                          <div className="flex flex-wrap gap-1">
                            {GRANT_REASONS.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => setSubReason(r)}
                                className="px-2 py-0.5 rounded bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold hover:border-primary cursor-pointer"
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                          <input
                            value={subNotes}
                            onChange={(e) => setSubNotes(e.target.value)}
                            placeholder="Nota interna opcional..."
                            className="w-full rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                          />
                        </div>
                      </>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSaveSubscription(false)}
                        className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {busy
                          ? 'Aplicando...'
                          : subPlanSlug === 'free'
                          ? 'Aplicar Plan Gratuito (Degradar a Free)'
                          : selected.active_subscription
                          ? 'Guardar Cambios en Suscripción Actual'
                          : 'Otorgar Nueva Suscripción'}
                      </button>
                      {selected.active_subscription && subPlanSlug !== 'free' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSaveSubscription(true)}
                          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold cursor-pointer"
                          title="Cancela la suscripción previa y crea un nuevo registro de cortesía"
                        >
                          Crear como Nueva
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* ===================== TAB 3: CLÍNICA, OWNER Y CUPOS DE USUARIOS ===================== */}
              {drawerTab === 'clinic' && (
                <div className="space-y-4">
                  {/* Existing Clinic Memberships */}
                  {selected.clinics && selected.clinics.length > 0 && (
                    <section className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-4 space-y-3">
                      <h4 className="font-black text-sm text-teal-800 dark:text-teal-200 flex items-center gap-2">
                        <span className="material-symbols-outlined">local_hospital</span>
                        Clínicas Actuales del Usuario ({selected.clinics.length})
                      </h4>
                      <div className="space-y-2.5">
                        {selected.clinics.map((c) => (
                          <div
                            key={c.clinic_id}
                            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-black text-sm">{c.name}</p>
                                <p className="text-[11px] text-slate-400">
                                  {c.active_plan_name || 'Sin plan de clínica'} · Miembros activos:{' '}
                                  <strong>{c.members_count ?? 1}</strong> /{' '}
                                  <strong>{c.active_seat_limit ?? '—'}</strong> asientos
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRemoveFromClinic(c.clinic_id, c.name)}
                                className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                              >
                                Desvincular
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                  Puesto en la Clínica
                                </label>
                                <select
                                  value={c.role_in_clinic}
                                  disabled={busy}
                                  onChange={(e) =>
                                    handleUpdateExistingClinicRole(c.clinic_id, e.target.value as any)
                                  }
                                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-bold"
                                >
                                  <option value="owner">Dueño (Owner · Control total)</option>
                                  <option value="director">Director Médico</option>
                                  <option value="clinic_admin">Administrador de Clínica</option>
                                  <option value="specialist">Especialista</option>
                                  <option value="assistant">Asistente</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                  Límite de usuarios que puede agregar (asientos)
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={seatEdits[c.clinic_id] ?? c.active_seat_limit ?? 5}
                                    onChange={(e) =>
                                      setSeatEdits((prev) => ({
                                        ...prev,
                                        [c.clinic_id]: Math.max(1, Number(e.target.value) || 1),
                                      }))
                                    }
                                    className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-black text-center"
                                  />
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleUpdateExistingClinicSeats(c.clinic_id)}
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                                  >
                                    Guardar cupo
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Grant / Create New Clinic Access */}
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5">
                    <h4 className="font-black text-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-teal-500">add_business</span>
                      Otorgar Acceso de Clínica / Nombrar Owner
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setClinicSource('existing')}
                        disabled={clinicsList.length === 0}
                        className={`py-2 rounded-xl font-bold border cursor-pointer disabled:opacity-40 ${
                          clinicSource === 'existing'
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Clínica Existente ({clinicsList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setClinicSource('new')}
                        className={`py-2 rounded-xl font-bold border cursor-pointer ${
                          clinicSource === 'new'
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        + Crear Nueva Clínica
                      </button>
                    </div>

                    {clinicSource === 'existing' ? (
                      <select
                        value={selectedClinicId}
                        onChange={(e) => setSelectedClinicId(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold"
                      >
                        <option value="">Selecciona una clínica...</option>
                        {clinicsList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.members_count} miembros ·{' '}
                            {c.active_subscription
                              ? `${c.active_subscription.plan_name} · ${c.active_subscription.seat_limit} asientos`
                              : 'Sin plan'}
                            )
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-slate-500 mb-1">Nombre de la Clínica</label>
                          <input
                            value={newClinicName}
                            onChange={(e) => setNewClinicName(e.target.value)}
                            placeholder="Ej. Clínica Infiltra / Centro Rehab..."
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">Tipo</label>
                          <select
                            value={newClinicType}
                            onChange={(e) => setNewClinicType(e.target.value as any)}
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                          >
                            <option value="clinic">Clínica Multi-especialista</option>
                            <option value="aesthetic_center">Centro Estético</option>
                            <option value="rehab_center">Centro de Rehabilitación</option>
                            <option value="hospital">Hospital / Servicio</option>
                            <option value="solo_practice">Consultorio Privado</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">Ciudad (opcional)</label>
                          <input
                            value={newClinicCity}
                            onChange={(e) => setNewClinicCity(e.target.value)}
                            placeholder="Ej. CDMX / Monterrey"
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Puesto del usuario</label>
                        <select
                          value={clinicRoleDraft}
                          onChange={(e) => setClinicRoleDraft(e.target.value as any)}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        >
                          <option value="owner">Dueño (Owner · Control total)</option>
                          <option value="director">Director Médico</option>
                          <option value="clinic_admin">Administrador de Clínica</option>
                          <option value="specialist">Especialista</option>
                          <option value="assistant">Asistente Operativo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Plan de la Clínica</label>
                        <select
                          value={clinicPlanSlug}
                          onChange={(e) => setClinicPlanSlug(e.target.value)}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        >
                          <option value="premium_clinic">Premium Clínica</option>
                          <option value="plus_clinic">Plus Clínica</option>
                          {clinicSource === 'existing' && (
                            <option value="keep">Mantener plan actual</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Custom Seat Limit Selector */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-500">
                          ¿Cuántos usuarios agregados puede tener esta clínica? (Asientos)
                        </label>
                        <span className="font-black text-teal-600 dark:text-teal-400">
                          {clinicSeatLimit} usuario(s)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[3, 5, 10, 15, 25, 50].map((seats) => (
                          <button
                            key={seats}
                            type="button"
                            onClick={() => setClinicSeatLimit(seats)}
                            className={`px-2.5 py-1.5 rounded-xl font-bold border cursor-pointer ${
                              clinicSeatLimit === seats
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {seats} asientos
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={clinicSeatLimit}
                          onChange={(e) => setClinicSeatLimit(Math.max(1, Number(e.target.value) || 1))}
                          className="w-20 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-black text-center"
                        />
                      </div>
                    </div>

                    {clinicPlanSlug !== 'keep' && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {GRANT_PRESETS.filter((p) => p.days !== 14).map((preset) => {
                            const active = preset.lifetime
                              ? clinicLifetime
                              : !clinicLifetime && clinicDurationDays === preset.days;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setClinicLifetime(preset.lifetime);
                                  setClinicDurationDays(preset.days);
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                                  active
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                        <label className="flex items-center gap-2 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clinicProtected}
                            onChange={(e) => setClinicProtected(e.target.checked)}
                            className="size-4 accent-teal-600"
                          />
                          <span>Proteger contra cobro automático / expiración de beta</span>
                        </label>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={
                        busy || (clinicSource === 'existing' ? !selectedClinicId : !newClinicName.trim())
                      }
                      onClick={handleGrantClinicAccess}
                      className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {busy
                        ? 'Configurando Clínica...'
                        : `Otorgar Acceso de Clínica (${clinicSeatLimit} usuarios)`}
                    </button>
                  </section>
                </div>
              )}

              {/* ===================== TAB 4: EMPRESA ENTERPRISE (LOTES x20) ===================== */}
              {drawerTab === 'enterprise' && (
                <div className="space-y-4">
                  {selected.enterprise_orgs && selected.enterprise_orgs.length > 0 && (
                    <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-2.5">
                      <h4 className="font-black text-sm text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                        <span className="material-symbols-outlined">corporate_fare</span>
                        Empresas Enterprise Asignadas ({selected.enterprise_orgs.length})
                      </h4>
                      {selected.enterprise_orgs.map((org) => (
                        <div
                          key={org.id}
                          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-black text-sm">{org.brand_display_name}</p>
                            <p className="text-[11px] text-slate-400">
                              Rol: <strong className="uppercase">{org.role_in_org}</strong> · Licencias activas:{' '}
                              <strong>{org.active_licenses ?? 0}</strong> / <strong>{org.total_licenses ?? 0}</strong>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleQuickAddEnterpriseBatch(org.id, org.brand_display_name)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                            >
                              +20 Licencias
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRemoveFromEnterprise(org.id, org.brand_display_name)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold cursor-pointer"
                            >
                              Revocar
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}

                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5">
                    <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/30 p-3 text-indigo-800 dark:text-indigo-200">
                      <strong>Modelo Enterprise (Allergan, Ipsen, Merz, Escuelas):</strong> Otorga consultorios privados Premium por lotes de <strong>20 en 20</strong> vía cupones, sin compartir pacientes (Zero-PHI).
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEntSource('existing')}
                        disabled={enterpriseList.length === 0}
                        className={`py-2 rounded-xl font-bold border cursor-pointer disabled:opacity-40 ${
                          entSource === 'existing'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Empresa Existente ({enterpriseList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntSource('new')}
                        className={`py-2 rounded-xl font-bold border cursor-pointer ${
                          entSource === 'new'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        + Crear Nueva Empresa
                      </button>
                    </div>

                    {entSource === 'existing' ? (
                      <select
                        value={selectedEntId}
                        onChange={(e) => setSelectedEntId(e.target.value)}
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold"
                      >
                        <option value="">Selecciona una empresa...</option>
                        {enterpriseList.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.brand_display_name} ({org.active_licenses}/{org.total_licenses} licencias)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">Empresa / Institución</label>
                          <input
                            value={newEntName}
                            onChange={(e) => {
                              setNewEntName(e.target.value);
                              if (!newEntBrand) setNewEntBrand(e.target.value);
                            }}
                            placeholder="Ej. Allergan / Ipsen / Merz / Escuela..."
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 mb-1">Tipo</label>
                          <select
                            value={newEntType}
                            onChange={(e) => setNewEntType(e.target.value as EnterpriseOrgType)}
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                          >
                            <option value="pharma">Farmacéutica</option>
                            <option value="aesthetic_school">Escuela de Medicina Estética</option>
                            <option value="university">Universidad / Posgrado</option>
                            <option value="medical_society">Sociedad Médica</option>
                            <option value="hospital_group">Grupo Hospitalario</option>
                            <option value="other">Otra</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-slate-500 mb-1">Marca visible en cupones</label>
                          <input
                            value={newEntBrand}
                            onChange={(e) => setNewEntBrand(e.target.value)}
                            placeholder="Ej. Allergan Aesthetics México"
                            className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Rol en la Empresa</label>
                        <select
                          value={entRoleInOrg}
                          onChange={(e) => setEntRoleInOrg(e.target.value as any)}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        >
                          <option value="owner">Propietario (Owner · Portal Completo)</option>
                          <option value="manager">Gestor de Cupones y Licencias</option>
                          <option value="billing">Facturación y Lotes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-slate-500 mb-1">Modalidad Lote Inicial</label>
                        <select
                          value={entBatchMode}
                          onChange={(e) => setEntBatchMode(e.target.value as any)}
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        >
                          <option value="pilot_free">Piloto / Cortesía ($0)</option>
                          <option value="manual">Orden de Compra / Manual</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-500">
                          Lote inicial de licencias (múltiplos de 20)
                        </label>
                        <span className="font-black text-indigo-600 dark:text-indigo-400">
                          {entInitialBatches * 20} usuarios Premium
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[0, 1, 2, 3, 5, 10].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setEntInitialBatches(cnt)}
                            className={`px-2.5 py-1.5 rounded-xl font-bold border cursor-pointer ${
                              entInitialBatches === cnt
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {cnt === 0 ? '0' : `${cnt * 20} lic.`}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={entInitialBatches}
                          onChange={(e) => setEntInitialBatches(Math.max(0, Number(e.target.value) || 0))}
                          className="w-16 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1.5 font-black text-center"
                          title="Número de lotes de 20"
                        />
                        <span className="text-[10px] text-slate-400">lote(s) × 20</span>
                      </div>
                    </div>

                    {entInitialBatches > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500">Vigencia:</span>
                        {[
                          { label: '90d', days: 90 },
                          { label: '6 meses', days: 180 },
                          { label: '1 año', days: 365 },
                          { label: 'Vitalicio', days: null },
                        ].map((d) => (
                          <button
                            key={d.label}
                            type="button"
                            onClick={() => setEntDurationDays(d.days)}
                            className={`px-2.5 py-1 rounded-lg font-bold border cursor-pointer ${
                              entDurationDays === d.days
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <label className="flex items-center gap-2 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={entSetGlobalRole}
                        onChange={(e) => setEntSetGlobalRole(e.target.checked)}
                        className="size-4 accent-indigo-600"
                      />
                      <span>Cambiar rol global a Enterprise (acceso directo a /enterprise)</span>
                    </label>

                    <button
                      type="button"
                      disabled={busy || (entSource === 'existing' ? !selectedEntId : !newEntName.trim())}
                      onClick={handleGrantEnterpriseAccess}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {busy
                        ? 'Configurando Enterprise...'
                        : `Otorgar Acceso Enterprise${entInitialBatches > 0 ? ` (+${entInitialBatches * 20} lic.)` : ''}`}
                    </button>
                  </section>
                </div>
              )}

              {/* ===================== TAB 5: CUOTAS, LÍMITES Y PERMISOS GRANULARES ===================== */}
              {drawerTab === 'limits' && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                    <div>
                      <h4 className="font-black text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">speed</span>
                        Cuotas y Límites Personalizados de la Cuenta
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Deja vacío cualquier campo numérico para usar el límite estándar del plan o ilimitado.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2 p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-black text-slate-800 dark:text-white">
                            Máximo de usuarios agregados que puede crear / invitar
                          </label>
                          <span className="font-black text-primary">
                            {maxTeamUsersStr ? `${maxTeamUsersStr} usuarios` : 'Según plan / Ilimitado'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            value={maxTeamUsersStr}
                            onChange={(e) => setMaxTeamUsersStr(e.target.value)}
                            placeholder="Ej. 10 (vacío = según plan)"
                            className="flex-1 min-w-[140px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-black"
                          />
                          {[
                            { label: 'Auto', val: '' },
                            { label: '0', val: '0' },
                            { label: '5', val: '5' },
                            { label: '10', val: '10' },
                            { label: '20', val: '20' },
                            { label: '50', val: '50' },
                            { label: '100', val: '100' },
                          ].map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setMaxTeamUsersStr(p.val)}
                              className={`px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer ${
                                maxTeamUsersStr === p.val
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-500 mb-1">
                          Máx. clínicas como Owner
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={maxClinicsOwnedStr}
                          onChange={(e) => setMaxClinicsOwnedStr(e.target.value)}
                          placeholder="Vacío = 1 por defecto"
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-500 mb-1">
                          Máx. expedientes de pacientes
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={maxPatientsStr}
                          onChange={(e) => setMaxPatientsStr(e.target.value)}
                          placeholder="Vacío = ilimitado"
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-500 mb-1">
                          Máx. plantillas clínicas personales
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={maxTemplatesStr}
                          onChange={(e) => setMaxTemplatesStr(e.target.value)}
                          placeholder="Vacío = ilimitado"
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-500 mb-1">
                          Máx. lotes Enterprise (x20)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={maxEntBatchesStr}
                          onChange={(e) => setMaxEntBatchesStr(e.target.value)}
                          placeholder="Vacío = ilimitado"
                          className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] font-black uppercase text-slate-400">
                        Capacidades Operativas de la Cuenta
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          {
                            label: 'Puede crear su propia clínica',
                            checked: canCreateClinic,
                            set: setCanCreateClinic,
                          },
                          {
                            label: 'Puede invitar / agregar usuarios',
                            checked: canInviteTeam,
                            set: setCanInviteTeam,
                          },
                          {
                            label: 'Exportación masiva CSV / respaldos',
                            checked: canExportAllData,
                            set: setCanExportAllData,
                          },
                          {
                            label: 'Impresión marca blanca (sin sello)',
                            checked: canRemoveBranding,
                            set: setCanRemoveBranding,
                          },
                          {
                            label: 'Acceso anticipado a funciones Beta',
                            checked: earlyAccessBeta,
                            set: setEarlyAccessBeta,
                          },
                        ].map((cap) => (
                          <label
                            key={cap.label}
                            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={cap.checked}
                              onChange={(e) => cap.set(e.target.checked)}
                              className="size-4 accent-primary"
                            />
                            <span>{cap.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase text-slate-400">
                          Overrides Granulares de Módulos (AUTO → ON → OFF)
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOverridesDraft({})}
                            className="text-[11px] font-bold text-slate-400 hover:text-primary cursor-pointer"
                          >
                            Todo AUTO
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const allOn: Partial<Record<FeatureKey, boolean>> = {};
                              ALL_FEATURE_KEYS.filter((f) => f.group !== 'base').forEach((f) => {
                                allOn[f.key] = true;
                              });
                              setOverridesDraft(allOn);
                            }}
                            className="text-[11px] font-bold text-emerald-500 hover:underline cursor-pointer"
                          >
                            Forzar todo ON
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {ALL_FEATURE_KEYS.filter((f) => f.group !== 'base').map((f) => {
                          const val = overridesDraft[f.key];
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => toggleOverride(f.key)}
                              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                                val === true
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 text-emerald-800 dark:text-emerald-200'
                                  : val === false
                                  ? 'bg-red-50 dark:bg-red-950/30 border-red-300 text-red-700 dark:text-red-300'
                                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span className="truncate">{f.label}</span>
                              <span className="font-black uppercase text-[10px] shrink-0">
                                {val === true ? 'ON' : val === false ? 'OFF' : 'AUTO'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-500 mb-1">
                        Notas privadas de administración
                      </label>
                      <textarea
                        rows={2}
                        value={adminNotesDraft}
                        onChange={(e) => setAdminNotesDraft(e.target.value)}
                        placeholder="Acuerdos especiales, contacto VIP, condiciones comerciales..."
                        className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSaveLimitsAndOverrides}
                      className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-black text-sm shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? 'Guardando...' : 'Guardar Cuotas, Capacidades, Overrides y Notas'}
                    </button>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersRolesPanel;
