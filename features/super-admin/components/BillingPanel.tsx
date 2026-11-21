import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchSubscriptionPlans } from '../../billing/billingProvider';
import {
  formatMoney,
  ORIGIN_LABELS,
  TIER_LABELS,
  type SubscriptionOrigin,
  type SubscriptionPlanRecord,
} from '../../entitlements/planCatalog';
import {
  exportSubscriptionsToCsv,
  getBillingOverview,
  grantSubscription,
  listClinics,
  listUsers,
  recordManualPayment,
  revokeSubscription,
  updateSubscription,
  upsertPromoCode,
  upsertSubscriptionPlan,
} from '../services/superAdminService';
import type {
  AdminSubscriptionRow,
  AdminUserRow,
  BillingOverviewData,
  ClinicSummaryRow,
  PaymentProcessorValue,
  SubscriptionIntervalValue,
  SubscriptionStatusValue,
} from '../types';

type BillingSubTab = 'plans' | 'subscriptions' | 'payments' | 'promos' | 'webhooks';

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  active: {
    label: 'Activa',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  trialing: {
    label: 'Prueba',
    badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    dot: 'bg-cyan-500',
  },
  past_due: {
    label: 'Pago pendiente',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  paused: {
    label: 'Pausada',
    badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    dot: 'bg-purple-500',
  },
  canceled: {
    label: 'Cancelada',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    dot: 'bg-red-500',
  },
  expired: {
    label: 'Expirada',
    badge: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
  },
};

const INTERVAL_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
  lifetime: 'Vitalicio',
  custom: 'Personalizado',
};

const QUICK_REASONS = [
  'Cortesía VIP / Fundador',
  'Beca Residente',
  'Docente / Ponente / Taller USG',
  'Convenio Institucional',
  'Pago Externo (SPEI / Transferencia)',
  'Ajuste manual SuperAdmin',
];

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function addDaysToIso(baseIso: string | null | undefined, days: number, fromTodayOnly = false): string {
  const now = new Date();
  let base = now;
  if (!fromTodayOnly && baseIso) {
    const parsed = new Date(baseIso);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
      base = parsed;
    }
  }
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

function getDaysRemaining(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function getInitials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

interface SubEditDraft {
  plan_slug: string;
  status: SubscriptionStatusValue;
  origin: SubscriptionOrigin;
  billing_interval: SubscriptionIntervalValue;
  payment_processor: PaymentProcessorValue;
  seat_limit: number;
  price_mxn: number;
  period_end_date: string;
  is_founder: boolean;
  protected_from_auto_downgrade: boolean;
  cancel_at_period_end: boolean;
  grant_reason: string;
  notes: string;
}

const VALID_SUBTABS: BillingSubTab[] = ['plans', 'subscriptions', 'payments', 'promos', 'webhooks'];

const BillingPanel: React.FC<{ onDataChanged?: () => void }> = ({ onDataChanged }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubTab = searchParams.get('subtab') as BillingSubTab | null;
  const [subTab, setSubTabState] = useState<BillingSubTab>(
    initialSubTab && VALID_SUBTABS.includes(initialSubTab) ? initialSubTab : 'subscriptions'
  );

  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>([]);
  const [overview, setOverview] = useState<BillingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filters for Subscriptions tab
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('all');
  const [subTierFilter, setSubTierFilter] = useState<string>('all');
  const [subOriginFilter, setSubOriginFilter] = useState<string>('all');
  const [subOnlyProtected, setSubOnlyProtected] = useState(false);
  const [subOnlyAttention, setSubOnlyAttention] = useState(false);

  // Slide-over subscription editor state
  const [editingSub, setEditingSub] = useState<AdminSubscriptionRow | null>(null);
  const [subDraft, setSubDraft] = useState<SubEditDraft | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Assign new subscription modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetType, setAssignTargetType] = useState<'individual' | 'clinic'>('individual');
  const [assignUsers, setAssignUsers] = useState<AdminUserRow[]>([]);
  const [assignClinics, setAssignClinics] = useState<ClinicSummaryRow[]>([]);
  const [assignLoadingTargets, setAssignLoadingTargets] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignTargetId, setAssignTargetId] = useState('');
  const [assignPlanSlug, setAssignPlanSlug] = useState('premium_solo');
  const [assignDurationDays, setAssignDurationDays] = useState<number | null>(365);
  const [assignLifetime, setAssignLifetime] = useState(false);
  const [assignReason, setAssignReason] = useState(QUICK_REASONS[0]);
  const [assignProtected, setAssignProtected] = useState(true);
  const [assignNotes, setAssignNotes] = useState('');

  // Plans / Payments / Promos state
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanRecord | null>(null);
  const [paySubId, setPaySubId] = useState('');
  const [payAmountMxn, setPayAmountMxn] = useState(599);
  const [payMethod, setPayMethod] = useState<'spei' | 'transfer' | 'cash' | 'purchase_order' | 'comped'>('spei');
  const [payRef, setPayRef] = useState('');
  const [payExtendDays, setPayExtendDays] = useState(30);

  const [promoCode, setPromoCode] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoType, setPromoType] = useState<'free_months' | 'trial_days' | 'percent'>('free_months');
  const [promoValue, setPromoValue] = useState(3);
  const [promoMax, setPromoMax] = useState('');
  const [promoStripeCoupon, setPromoStripeCoupon] = useState('');

  const setSubTab = (next: BillingSubTab) => {
    setSubTabState(next);
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'billing');
    params.set('subtab', next);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    const paramSub = searchParams.get('subtab') as BillingSubTab | null;
    if (paramSub && VALID_SUBTABS.includes(paramSub) && paramSub !== subTab) {
      setSubTabState(paramSub);
    }
  }, [searchParams, subTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, ov] = await Promise.all([fetchSubscriptionPlans(true), getBillingOverview()]);
      setPlans(p);
      setOverview(ov);
    } catch (err: any) {
      setError(err?.message || 'Error cargando datos financieros.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allSubscriptions = overview?.subscriptions || [];

  const subStats = useMemo(() => {
    let activeCount = 0;
    let premiumActive = 0;
    let plusActive = 0;
    let freeActive = 0;
    let protectedCount = 0;
    let founderCount = 0;
    let sponsorCount = 0;
    let attentionCount = 0;

    for (const s of allSubscriptions) {
      const isLive = s.status === 'active' || s.status === 'trialing';
      if (isLive) {
        activeCount++;
        if (s.tier === 'premium') premiumActive++;
        else if (s.tier === 'plus') plusActive++;
        else freeActive++;
      }
      if (s.protected_from_auto_downgrade) protectedCount++;
      if (s.is_founder) founderCount++;
      if (s.sponsor_name) sponsorCount++;

      const daysLeft = getDaysRemaining(s.current_period_end);
      const expiringSoon = isLive && daysLeft !== null && daysLeft <= 15;
      if (expiringSoon || s.status === 'past_due' || s.status === 'paused') {
        attentionCount++;
      }
    }

    return {
      total: allSubscriptions.length,
      activeCount,
      premiumActive,
      plusActive,
      freeActive,
      protectedCount,
      founderCount,
      sponsorCount,
      attentionCount,
    };
  }, [allSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const q = subSearch.trim().toLowerCase();
    return allSubscriptions.filter((s) => {
      if (q) {
        const hay = [
          s.user_name,
          s.user_email,
          s.clinic_name,
          s.sponsor_name,
          s.plan_name,
          s.plan_slug,
          s.grant_reason,
          s.notes,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (subStatusFilter === 'live') {
        if (s.status !== 'active' && s.status !== 'trialing') return false;
      } else if (subStatusFilter !== 'all' && s.status !== subStatusFilter) {
        return false;
      }

      if (subTierFilter !== 'all' && s.tier !== subTierFilter) return false;
      if (subOriginFilter !== 'all' && s.origin !== subOriginFilter) return false;
      if (subOnlyProtected && !s.protected_from_auto_downgrade) return false;

      if (subOnlyAttention) {
        const isLive = s.status === 'active' || s.status === 'trialing';
        const daysLeft = getDaysRemaining(s.current_period_end);
        const expiringSoon = isLive && daysLeft !== null && daysLeft <= 15;
        if (!expiringSoon && s.status !== 'past_due' && s.status !== 'paused') return false;
      }

      return true;
    });
  }, [
    allSubscriptions,
    subSearch,
    subStatusFilter,
    subTierFilter,
    subOriginFilter,
    subOnlyProtected,
    subOnlyAttention,
  ]);

  const hasActiveSubFilters =
    Boolean(subSearch.trim()) ||
    subStatusFilter !== 'all' ||
    subTierFilter !== 'all' ||
    subOriginFilter !== 'all' ||
    subOnlyProtected ||
    subOnlyAttention;

  const clearSubFilters = () => {
    setSubSearch('');
    setSubStatusFilter('all');
    setSubTierFilter('all');
    setSubOriginFilter('all');
    setSubOnlyProtected(false);
    setSubOnlyAttention(false);
  };

  const openEditSubscription = (sub: AdminSubscriptionRow) => {
    setEditingSub(sub);
    setDrawerError(null);
    setSubDraft({
      plan_slug: sub.plan_slug,
      status: (STATUS_META[sub.status] ? sub.status : 'active') as SubscriptionStatusValue,
      origin: sub.origin,
      billing_interval: (['monthly', 'annual', 'lifetime', 'custom'].includes(sub.billing_interval)
        ? sub.billing_interval
        : 'monthly') as SubscriptionIntervalValue,
      payment_processor: (['comped', 'manual', 'stripe', 'mercadopago'].includes(
        sub.payment_processor || ''
      )
        ? sub.payment_processor
        : 'comped') as PaymentProcessorValue,
      seat_limit: sub.seat_limit ?? 1,
      price_mxn: Math.round((sub.price_cents_at_signup || 0) / 100),
      period_end_date: toDateInputValue(sub.current_period_end),
      is_founder: Boolean(sub.is_founder),
      protected_from_auto_downgrade: Boolean(sub.protected_from_auto_downgrade),
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      grant_reason: sub.grant_reason || '',
      notes: sub.notes || '',
    });
  };

  const handleSaveSubscriptionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !subDraft) return;
    setBusy(true);
    setDrawerError(null);
    setFeedback(null);
    try {
      const periodEndIso = subDraft.period_end_date
        ? new Date(`${subDraft.period_end_date}T23:59:59.000Z`).toISOString()
        : null;

      await updateSubscription(editingSub.id, {
        plan_slug: subDraft.plan_slug,
        status: subDraft.status,
        origin: subDraft.origin,
        billing_interval: subDraft.billing_interval,
        payment_processor: subDraft.payment_processor,
        seat_limit: Math.max(1, subDraft.seat_limit || 1),
        price_cents_at_signup: Math.max(0, Math.round((subDraft.price_mxn || 0) * 100)),
        current_period_end: periodEndIso,
        is_founder: subDraft.is_founder,
        protected_from_auto_downgrade: subDraft.protected_from_auto_downgrade,
        cancel_at_period_end: subDraft.cancel_at_period_end,
        grant_reason: subDraft.grant_reason.trim() || null,
        notes: subDraft.notes.trim() || null,
      });

      const titular = editingSub.user_name || editingSub.user_email || editingSub.clinic_name || 'la cuenta';
      setEditingSub(null);
      setSubDraft(null);
      setFeedback(`Suscripción de ${titular} actualizada correctamente.`);
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setDrawerError(err?.message || 'No se pudo actualizar la suscripción.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickExtend30Days = async (sub: AdminSubscriptionRow) => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const nextDate = addDaysToIso(sub.current_period_end, 30, false);
      const nextIso = new Date(`${nextDate}T23:59:59.000Z`).toISOString();
      await updateSubscription(sub.id, {
        status: 'active',
        current_period_end: nextIso,
      });
      setFeedback(
        `Vigencia de ${sub.user_name || sub.user_email || sub.clinic_name || 'la suscripción'} extendida hasta ${new Date(nextIso).toLocaleDateString('es-MX')}.`
      );
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error extendiendo vigencia.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickReactivate = async (sub: AdminSubscriptionRow) => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const daysLeft = getDaysRemaining(sub.current_period_end);
      const payload: Parameters<typeof updateSubscription>[1] = {
        status: 'active',
        cancel_at_period_end: false,
      };
      if (daysLeft !== null && daysLeft <= 0) {
        const nextDate = addDaysToIso(null, 30, true);
        payload.current_period_end = new Date(`${nextDate}T23:59:59.000Z`).toISOString();
      }
      await updateSubscription(sub.id, payload);
      setFeedback(`Suscripción de ${sub.user_name || sub.user_email || sub.clinic_name || 'la cuenta'} reactivada.`);
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error reactivando suscripción.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickRevoke = async (sub: AdminSubscriptionRow) => {
    const label = sub.user_name || sub.user_email || sub.clinic_name || 'este titular';
    if (!window.confirm(`¿Revocar la suscripción activa de ${label}? El usuario conservará sus datos en solo lectura.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await revokeSubscription(sub.id);
      if (editingSub?.id === sub.id) {
        setEditingSub(null);
        setSubDraft(null);
      }
      setFeedback(`Suscripción de ${label} revocada.`);
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error revocando suscripción.');
    } finally {
      setBusy(false);
    }
  };

  const openAssignModal = async () => {
    setShowAssignModal(true);
    setAssignSearch('');
    setAssignTargetId('');
    setAssignNotes('');
    setAssignLoadingTargets(true);
    try {
      const [u, c] = await Promise.all([listUsers({ limit: 200 }), listClinics()]);
      setAssignUsers(u);
      setAssignClinics(c);
    } catch (err: any) {
      setError(err?.message || 'Error cargando usuarios/clínicas.');
    } finally {
      setAssignLoadingTargets(false);
    }
  };

  const handleAssignNewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetId) return;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await grantSubscription({
        userId: assignTargetType === 'individual' ? assignTargetId : null,
        clinicId: assignTargetType === 'clinic' ? assignTargetId : null,
        planSlug: assignPlanSlug,
        billingInterval: assignLifetime ? 'lifetime' : 'custom',
        durationDays: assignLifetime ? null : assignDurationDays,
        isLifetime: assignLifetime,
        grantReason: assignReason,
        protectedFromAutoDowngrade: assignProtected,
        notes: assignNotes.trim() || null,
      });
      setShowAssignModal(false);
      setFeedback('Nueva suscripción asignada y activada correctamente.');
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error asignando suscripción.');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setBusy(true);
    setFeedback(null);
    try {
      await upsertSubscriptionPlan(editingPlan);
      setEditingPlan(null);
      setFeedback('Plan actualizado en catálogo (incluyendo precios y Stripe IDs).');
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error guardando plan.');
    } finally {
      setBusy(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await recordManualPayment({
        subscriptionId: paySubId || null,
        amountCents: Math.round(payAmountMxn * 100),
        method: payMethod,
        reference: payRef.trim() || undefined,
        extendDays: payExtendDays,
      });
      setPayRef('');
      setFeedback('Pago manual registrado y factura generada.');
      await load();
      onDataChanged?.();
    } catch (err: any) {
      setError(err?.message || 'Error registrando pago.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      await upsertPromoCode({
        code: promoCode.trim().toUpperCase(),
        description: promoDesc.trim() || null,
        discount_type: promoType,
        discount_value: promoValue,
        max_redemptions: promoMax ? Number(promoMax) : null,
        stripe_coupon_id: promoStripeCoupon.trim() || null,
        is_active: true,
      });
      setPromoCode('');
      setPromoDesc('');
      setPromoMax('');
      setPromoStripeCoupon('');
      setFeedback('Código promocional creado.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error creando cupón.');
    } finally {
      setBusy(false);
    }
  };

  const assignablePlans = useMemo(
    () =>
      plans.filter((p) =>
        assignTargetType === 'clinic' ? p.scope === 'clinic' : p.scope === 'individual'
      ),
    [plans, assignTargetType]
  );

  const editablePlansForDrawer = useMemo(() => {
    const nonEnterprise = plans.filter((p) => p.scope !== 'enterprise');
    if (!editingSub) return nonEnterprise;
    const sameScope = nonEnterprise.filter((p) => p.scope === editingSub.subscriber_type);
    const otherScope = nonEnterprise.filter((p) => p.scope !== editingSub.subscriber_type);
    return [...sameScope, ...otherScope];
  }, [plans, editingSub]);

  const filteredAssignUsers = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return assignUsers.slice(0, 50);
    return assignUsers
      .filter((u) =>
        `${u.full_name || ''} ${u.email || ''} ${u.specialty || ''}`.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [assignUsers, assignSearch]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'plans', label: 'Planes, Precios y Stripe IDs', icon: 'sell' },
          { id: 'subscriptions', label: `Suscripciones (${allSubscriptions.length})`, icon: 'card_membership' },
          { id: 'payments', label: `Pagos Manuales (${overview?.payments.length ?? 0})`, icon: 'payments' },
          { id: 'promos', label: `Cupones B2C (${overview?.promo_codes.length ?? 0})`, icon: 'local_offer' },
          { id: 'webhooks', label: `Webhooks Stripe (${overview?.webhooks.length ?? 0})`, icon: 'webhook' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as BillingSubTab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subTab === t.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-primary/40'
            }`}
          >
            <span className="material-symbols-outlined text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/70 p-3 text-xs font-bold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
      {feedback && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Cargando módulo financiero...</div>
      ) : (
        <>
          {subTab === 'plans' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {plans.map((p) => {
                const stripeReady = p.price_monthly_cents === 0 || Boolean(p.stripe_price_monthly_id);
                return (
                  <div
                    key={p.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {p.scope} · {TIER_LABELS[p.tier]}
                          </span>
                          {p.is_featured && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Destacado
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-base mt-1">{p.name}</h4>
                        <p className="text-xs text-slate-500">{p.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPlan({ ...p })}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer"
                      >
                        Editar
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Mensual</span>
                        <strong>{formatMoney(p.price_monthly_cents, p.currency)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Anual</span>
                        <strong>{formatMoney(p.price_annual_cents, p.currency)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Cupo / Lote</span>
                        <strong>
                          {p.max_seats} {p.scope === 'enterprise' ? 'lic.' : 'asiento(s)'}
                        </strong>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className={stripeReady ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                        {stripeReady
                          ? `Stripe vinculado (${p.stripe_price_monthly_id || 'Plan $0'})`
                          : 'Pendiente: vincular stripe_price_monthly_id'}
                      </span>
                      <code className="text-slate-400">{p.slug}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {subTab === 'subscriptions' && (
            <div className="space-y-4">
              {/* KPI Summary Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    clearSubFilters();
                    setSubStatusFilter('live');
                  }}
                  className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Activas / Prueba</span>
                    <span className="material-symbols-outlined text-emerald-500 text-lg">verified</span>
                  </div>
                  <p className="text-2xl font-black mt-1.5">
                    {subStats.activeCount}{' '}
                    <span className="text-xs font-semibold text-slate-400">/ {subStats.total}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Clic para ver solo activas</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearSubFilters();
                    setSubTierFilter('premium');
                  }}
                  className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Activas por Nivel</span>
                    <span className="material-symbols-outlined text-amber-500 text-lg">workspace_premium</span>
                  </div>
                  <div className="flex items-baseline gap-2.5 mt-1.5">
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                      {subStats.premiumActive} <small className="text-[10px] font-bold">Prem</small>
                    </span>
                    <span className="text-lg font-black text-sky-600 dark:text-sky-400">
                      {subStats.plusActive} <small className="text-[10px] font-bold">Plus</small>
                    </span>
                    <span className="text-sm font-bold text-slate-400">
                      {subStats.freeActive} <small className="text-[10px]">Free</small>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Clic para filtrar Premium</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearSubFilters();
                    setSubOnlyProtected(true);
                  }}
                  className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Protegidas & VIP</span>
                    <span className="material-symbols-outlined text-sky-500 text-lg">verified_user</span>
                  </div>
                  <p className="text-2xl font-black mt-1.5">{subStats.protectedCount}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {subStats.founderCount} Fundadores · {subStats.sponsorCount} Enterprise
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    clearSubFilters();
                    setSubOnlyAttention(true);
                  }}
                  className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 p-4 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span>Por Vencer / Atención</span>
                    <span className="material-symbols-outlined text-amber-500 text-lg">schedule</span>
                  </div>
                  <p
                    className={`text-2xl font-black mt-1.5 ${
                      subStats.attentionCount > 0 ? 'text-amber-500' : ''
                    }`}
                  >
                    {subStats.attentionCount}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">≤ 15 días, pago pend. o pausadas</p>
                </button>
              </div>

              {/* Search, Filters & Actions Bar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 min-w-[220px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                      search
                    </span>
                    <input
                      value={subSearch}
                      onChange={(e) => setSubSearch(e.target.value)}
                      placeholder="Buscar por titular, correo, clínica, patrocinador o motivo..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <select
                    value={subStatusFilter}
                    onChange={(e) => setSubStatusFilter(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="live">Activas y Prueba</option>
                    <option value="active">Solo Activas</option>
                    <option value="trialing">En Prueba</option>
                    <option value="past_due">Pago pendiente</option>
                    <option value="paused">Pausadas</option>
                    <option value="canceled">Canceladas</option>
                    <option value="expired">Expiradas</option>
                  </select>

                  <select
                    value={subTierFilter}
                    onChange={(e) => setSubTierFilter(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  >
                    <option value="all">Todos los niveles</option>
                    <option value="premium">Premium</option>
                    <option value="plus">Plus</option>
                    <option value="free">Gratuito</option>
                  </select>

                  <select
                    value={subOriginFilter}
                    onChange={(e) => setSubOriginFilter(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  >
                    <option value="all">Todos los orígenes</option>
                    <option value="launch_promo">Lanzamiento ($0)</option>
                    <option value="admin_grant">Otorgado por Admin</option>
                    <option value="enterprise_license">Enterprise Patrocinada</option>
                    <option value="manual_payment">Pago Manual</option>
                    <option value="promo_code">Código Promocional</option>
                    <option value="stripe">Stripe</option>
                  </select>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => exportSubscriptionsToCsv(filteredSubscriptions)}
                      disabled={filteredSubscriptions.length === 0}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">download</span>
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={openAssignModal}
                      className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">add_circle</span>
                      Asignar Suscripción
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSubOnlyProtected((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                        subOnlyProtected
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">verified_user</span>
                      Solo protegidas VIP
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubOnlyAttention((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                        subOnlyAttention
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      Por vencer / Atención
                    </button>
                    {hasActiveSubFilters && (
                      <button
                        type="button"
                        onClick={clearSubFilters}
                        className="px-2.5 py-1 rounded-lg font-bold text-primary hover:underline cursor-pointer"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                  <span className="text-slate-400">
                    Mostrando <strong className="text-slate-600 dark:text-slate-200">{filteredSubscriptions.length}</strong> de{' '}
                    {allSubscriptions.length} suscripciones
                  </span>
                </div>
              </div>

              {/* Subscriptions Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Titular</th>
                        <th className="py-3 px-3">Plan y Ciclo</th>
                        <th className="py-3 px-3">Origen / Etiquetas</th>
                        <th className="py-3 px-3">Estado</th>
                        <th className="py-3 px-3">Vencimiento</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredSubscriptions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            No hay suscripciones que coincidan con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredSubscriptions.map((s) => {
                          const statusMeta = STATUS_META[s.status] || {
                            label: s.status,
                            badge: 'bg-slate-100 text-slate-600 border-slate-200',
                            dot: 'bg-slate-400',
                          };
                          const tierClass =
                            s.tier === 'premium'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : s.tier === 'plus'
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                              : 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30';
                          const daysLeft = getDaysRemaining(s.current_period_end);
                          const isLive = s.status === 'active' || s.status === 'trialing';

                          return (
                            <tr
                              key={s.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-xl bg-primary/10 text-primary font-black text-[11px] flex items-center justify-center shrink-0">
                                    {getInitials(s.user_name || s.clinic_name, s.user_email)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                                        {s.user_name || s.clinic_name || 'Sin nombre'}
                                      </p>
                                      {s.subscriber_type === 'clinic' && (
                                        <span className="px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-300 text-[9px] font-black uppercase">
                                          Clínica
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                                      {s.user_email || s.subscriber_type}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${tierClass}`}>
                                    {TIER_LABELS[s.tier] || s.tier}
                                  </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-100">
                                    {s.plan_name}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                  <span>{INTERVAL_LABELS[s.billing_interval] || s.billing_interval}</span>
                                  {(s.seat_limit ?? 1) > 1 && <span>· {s.seat_limit} asientos</span>}
                                  {s.price_cents_at_signup > 0 && (
                                    <span>· {formatMoney(s.price_cents_at_signup)}</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {ORIGIN_LABELS[s.origin] || s.origin}
                                  </span>
                                  {s.protected_from_auto_downgrade && (
                                    <span
                                      title="Protegida contra auto-downgrade / fin de beta"
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 text-[9px] font-black uppercase"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">verified_user</span>
                                      VIP
                                    </span>
                                  )}
                                  {s.is_founder && (
                                    <span
                                      title="Cohorte Fundador Early Adopter"
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[9px] font-black uppercase"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">stars</span>
                                      Fundador
                                    </span>
                                  )}
                                </div>
                                {s.sponsor_name && (
                                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    Patrocinada: {s.sponsor_name}
                                  </p>
                                )}
                                {s.grant_reason && (
                                  <p className="text-[10px] text-slate-400 truncate max-w-[210px] mt-0.5">
                                    {s.grant_reason}
                                  </p>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${statusMeta.badge}`}
                                >
                                  <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                                  {statusMeta.label}
                                </span>
                                {s.cancel_at_period_end && isLive && (
                                  <span className="block text-[9px] font-bold text-amber-500 mt-1">
                                    Cancela al vencer
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3">
                                {s.current_period_end ? (
                                  <div>
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                      {new Date(s.current_period_end).toLocaleDateString('es-MX', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </p>
                                    {daysLeft !== null && (
                                      <p
                                        className={`text-[10px] font-bold ${
                                          daysLeft <= 0
                                            ? 'text-red-500'
                                            : daysLeft <= 15
                                            ? 'text-amber-500'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        {daysLeft <= 0
                                          ? `Venció hace ${Math.abs(daysLeft)}d`
                                          : `En ${daysLeft} día(s)`}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium">Sin vencimiento</span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditSubscription(s)}
                                    className="px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary text-primary hover:text-white font-bold text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                    Modificar
                                  </button>

                                  {isLive || s.status === 'past_due' ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handleQuickExtend30Days(s)}
                                      title="Extender vigencia +30 días"
                                      className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-300 font-bold text-[11px] transition-colors cursor-pointer"
                                    >
                                      +30d
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handleQuickReactivate(s)}
                                      className="px-2 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                                    >
                                      Reactivar
                                    </button>
                                  )}

                                  {isLive && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => handleQuickRevoke(s)}
                                      title="Revocar suscripción"
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">cancel</span>
                                    </button>
                                  )}
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
            </div>
          )}

          {subTab === 'payments' && (
            <div className="space-y-4">
              <form
                onSubmit={handleRecordPayment}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <h4 className="font-black text-sm">Registrar Pago Manual (SPEI / Transferencia / Orden de Compra)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <select
                    value={paySubId}
                    onChange={(e) => setPaySubId(e.target.value)}
                    className="sm:col-span-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                  >
                    <option value="">(Opcional) Vincular a suscripción...</option>
                    {allSubscriptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.user_name || s.user_email || s.clinic_name} — {s.plan_name} ({s.status})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={payAmountMxn}
                    onChange={(e) => setPayAmountMxn(Number(e.target.value) || 0)}
                    placeholder="Monto MXN"
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  />
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  >
                    <option value="spei">SPEI</option>
                    <option value="transfer">Transferencia</option>
                    <option value="purchase_order">Orden de Compra</option>
                    <option value="cash">Efectivo</option>
                    <option value="comped">Cortesía ($0)</option>
                  </select>
                  <input
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Folio / Referencia"
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs flex items-center gap-2">
                    <span>Extender vigencia (días):</span>
                    <input
                      type="number"
                      min={0}
                      value={payExtendDays}
                      onChange={(e) => setPayExtendDays(Number(e.target.value) || 0)}
                      className="w-20 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-bold"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer"
                  >
                    Registrar Pago + Factura
                  </button>
                </div>
              </form>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                      <th className="py-3 px-4">Folio</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Monto</th>
                      <th className="py-3 px-3">Método</th>
                      <th className="py-3 px-3">Referencia</th>
                      <th className="py-3 px-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(overview?.payments || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Aún no hay pagos registrados (modo lanzamiento gratuito).
                        </td>
                      </tr>
                    ) : (
                      overview!.payments.map((pay) => (
                        <tr key={pay.id}>
                          <td className="py-2.5 px-4 font-mono font-bold">{pay.invoice_number || '—'}</td>
                          <td className="py-2.5 px-3">
                            {pay.user_email || pay.clinic_name || pay.enterprise_name || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-black">{formatMoney(pay.amount_cents, pay.currency)}</td>
                          <td className="py-2.5 px-3 uppercase">
                            {pay.payment_method} ({pay.processor})
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{pay.reference_code || '—'}</td>
                          <td className="py-2.5 px-4 text-slate-400">
                            {new Date(pay.paid_at).toLocaleDateString('es-MX')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {subTab === 'promos' && (
            <div className="space-y-4">
              <form
                onSubmit={handleCreatePromo}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <h4 className="font-black text-sm">Crear Código Promocional B2C (Stripe-Ready)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    required
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Código (FUNDADOR50)"
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono font-bold uppercase"
                  />
                  <select
                    value={promoType}
                    onChange={(e) => setPromoType(e.target.value as any)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  >
                    <option value="free_months">Meses gratis</option>
                    <option value="trial_days">Días de prueba</option>
                    <option value="percent">% Descuento</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={promoValue}
                    onChange={(e) => setPromoValue(Math.max(1, Number(e.target.value) || 1))}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold"
                  />
                  <input
                    value={promoDesc}
                    onChange={(e) => setPromoDesc(e.target.value)}
                    placeholder="Descripción"
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={promoMax}
                    onChange={(e) => setPromoMax(e.target.value)}
                    placeholder="Límite usos (vacío = ∞)"
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                  />
                  <input
                    value={promoStripeCoupon}
                    onChange={(e) => setPromoStripeCoupon(e.target.value)}
                    placeholder="Stripe Coupon ID (futuro)"
                    className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer"
                >
                  Crear Código Promocional
                </button>
              </form>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {(overview?.promo_codes || []).length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">No hay códigos promocionales creados.</p>
                ) : (
                  overview!.promo_codes.map((pc) => (
                    <div key={pc.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <code className="font-black text-primary text-sm">{pc.code}</code>
                        <span className="ml-2 font-bold">
                          {pc.discount_type === 'percent'
                            ? `${pc.discount_value}% OFF`
                            : pc.discount_type === 'free_months'
                            ? `${pc.discount_value} mes(es) gratis`
                            : `${pc.discount_value} días prueba`}
                        </span>
                        {pc.description && <p className="text-slate-400 mt-0.5">{pc.description}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">
                          Usos: <strong>{pc.times_redeemed}</strong> / {pc.max_redemptions ?? '∞'}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await upsertPromoCode({ id: pc.id, is_active: !pc.is_active });
                            await load();
                          }}
                          className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                            pc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {pc.is_active ? 'Activo' : 'Pausado'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {subTab === 'webhooks' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
              <h4 className="font-black text-sm mb-3">Historial de Webhooks Idempotentes (Stripe / MercadoPago)</h4>
              {(overview?.webhooks || []).length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Sin eventos de webhook recibidos aún.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {overview!.webhooks.map((w) => (
                    <div key={w.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <code className="font-bold">{w.event_type}</code>
                        <span className="ml-2 text-slate-400">{w.external_event_id}</span>
                        {w.error_message && <p className="text-red-500">{w.error_message}</p>}
                      </div>
                      <span className="uppercase font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        {w.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Slide-Over Drawer: Modificar Suscripción Actual */}
      {editingSub && subDraft && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary">
                    Modificar Suscripción Actual
                  </span>
                  <code className="text-[10px] text-slate-400">#{editingSub.id.slice(0, 8)}</code>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
                  {editingSub.user_name || editingSub.clinic_name || 'Sin nombre'}
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {editingSub.user_email || editingSub.subscriber_type} · Creada el{' '}
                  {new Date(editingSub.created_at).toLocaleDateString('es-MX')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSub(null);
                  setSubDraft(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSubscriptionEdit} className="flex-1 p-6 space-y-5 text-xs">
              {drawerError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 font-bold text-red-700 dark:text-red-300">
                  {drawerError}
                </div>
              )}

              {/* 1. Plan selector + quick tier cards */}
              <section className="space-y-2.5">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  1. Plan y Nivel
                </label>
                {editingSub.subscriber_type === 'individual' && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { slug: 'free', label: 'Gratuito', sub: 'Solo calculadora', color: 'border-slate-400' },
                      { slug: 'plus_solo', label: 'Plan Plus', sub: 'Expedientes + Agenda', color: 'border-sky-500' },
                      { slug: 'premium_solo', label: 'Plan Premium', sub: 'USG + Protocolos', color: 'border-amber-500' },
                    ].map((opt) => {
                      const active = subDraft.plan_slug === opt.slug;
                      return (
                        <button
                          key={opt.slug}
                          type="button"
                          onClick={() => setSubDraft({ ...subDraft, plan_slug: opt.slug })}
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            active
                              ? `${opt.color} bg-primary/5 dark:bg-primary/10`
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <p className="font-black text-slate-900 dark:text-white">{opt.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{opt.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                )}

                <select
                  value={subDraft.plan_slug}
                  onChange={(e) => {
                    const selectedPlan = plans.find((p) => p.slug === e.target.value);
                    setSubDraft({
                      ...subDraft,
                      plan_slug: e.target.value,
                      seat_limit: selectedPlan ? Math.max(1, selectedPlan.max_seats) : subDraft.seat_limit,
                    });
                  }}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm font-bold"
                >
                  {editablePlansForDrawer.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name} ({p.scope === 'clinic' ? 'Clínica' : 'Individual'} · {TIER_LABELS[p.tier]} ·{' '}
                      {formatMoney(p.price_monthly_cents, p.currency)}/mes)
                    </option>
                  ))}
                </select>
              </section>

              {/* 2. Estado, Origen, Ciclo */}
              <section className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  2. Estado, Origen y Facturación
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Estado</label>
                    <select
                      value={subDraft.status}
                      onChange={(e) =>
                        setSubDraft({ ...subDraft, status: e.target.value as SubscriptionStatusValue })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    >
                      <option value="active">Activa</option>
                      <option value="trialing">En Prueba (Trial)</option>
                      <option value="past_due">Pago pendiente</option>
                      <option value="paused">Pausada</option>
                      <option value="canceled">Cancelada</option>
                      <option value="expired">Expirada</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Origen</label>
                    <select
                      value={subDraft.origin}
                      onChange={(e) =>
                        setSubDraft({ ...subDraft, origin: e.target.value as SubscriptionOrigin })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    >
                      <option value="admin_grant">Otorgado por Administración</option>
                      <option value="launch_promo">Acceso de Lanzamiento (Fundador)</option>
                      <option value="manual_payment">Pago Registrado (Manual)</option>
                      <option value="promo_code">Código Promocional</option>
                      <option value="enterprise_license">Licencia Enterprise Patrocinada</option>
                      <option value="stripe">Suscripción Stripe</option>
                      <option value="mercadopago">Suscripción MercadoPago</option>
                      <option value="free_default">Plan Base Gratuito</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Intervalo</label>
                    <select
                      value={subDraft.billing_interval}
                      onChange={(e) =>
                        setSubDraft({
                          ...subDraft,
                          billing_interval: e.target.value as SubscriptionIntervalValue,
                        })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
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
                      value={subDraft.payment_processor}
                      onChange={(e) =>
                        setSubDraft({
                          ...subDraft,
                          payment_processor: e.target.value as PaymentProcessorValue,
                        })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    >
                      <option value="comped">Cortesía ($0)</option>
                      <option value="manual">Manual (SPEI / Transf.)</option>
                      <option value="stripe">Stripe</option>
                      <option value="mercadopago">MercadoPago</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Precio pactado (MXN)</label>
                    <input
                      type="number"
                      min={0}
                      value={subDraft.price_mxn}
                      onChange={(e) =>
                        setSubDraft({ ...subDraft, price_mxn: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 mb-1">Asientos permitidos</label>
                    <input
                      type="number"
                      min={1}
                      value={subDraft.seat_limit}
                      onChange={(e) =>
                        setSubDraft({ ...subDraft, seat_limit: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                    />
                  </div>
                </div>
              </section>

              {/* 3. Vigencia / Vencimiento */}
              <section className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    3. Vigencia y Fecha de Vencimiento
                  </label>
                  <span className="text-[11px] font-bold text-primary">
                    {subDraft.period_end_date
                      ? `Vence: ${new Date(`${subDraft.period_end_date}T12:00:00`).toLocaleDateString('es-MX')}`
                      : 'Sin vencimiento (Vitalicio)'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={subDraft.period_end_date}
                    onChange={(e) => setSubDraft({ ...subDraft, period_end_date: e.target.value })}
                    className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                  />
                  {subDraft.period_end_date && (
                    <button
                      type="button"
                      onClick={() =>
                        setSubDraft({
                          ...subDraft,
                          period_end_date: '',
                          billing_interval: 'lifetime',
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold cursor-pointer"
                    >
                      Quitar fecha
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Vitalicio', days: null, extend: false },
                    { label: 'Hoy + 14d', days: 14, extend: false },
                    { label: 'Hoy + 30d', days: 30, extend: false },
                    { label: 'Hoy + 90d', days: 90, extend: false },
                    { label: 'Hoy + 6m', days: 180, extend: false },
                    { label: 'Hoy + 1 año', days: 365, extend: false },
                    ...(subDraft.period_end_date ? [{ label: '+30d extra', days: 30, extend: true }] : []),
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        if (preset.days === null) {
                          setSubDraft({
                            ...subDraft,
                            period_end_date: '',
                            billing_interval: 'lifetime',
                          });
                        } else {
                          const baseIso =
                            preset.extend && subDraft.period_end_date
                              ? `${subDraft.period_end_date}T23:59:59.000Z`
                              : null;
                          setSubDraft({
                            ...subDraft,
                            period_end_date: addDaysToIso(baseIso, preset.days, !preset.extend),
                            billing_interval:
                              subDraft.billing_interval === 'lifetime'
                                ? 'custom'
                                : subDraft.billing_interval,
                          });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* 4. Protecciones e insignias */}
              <section className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  4. Protecciones e Insignias
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subDraft.protected_from_auto_downgrade}
                    onChange={(e) =>
                      setSubDraft({ ...subDraft, protected_from_auto_downgrade: e.target.checked })
                    }
                    className="size-4 accent-primary mt-0.5"
                  />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      Proteger contra auto-downgrade / fin de beta
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Cuando se active Stripe, esta cuenta conservará su acceso sin cobro automático.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subDraft.is_founder}
                    onChange={(e) => setSubDraft({ ...subDraft, is_founder: e.target.checked })}
                    className="size-4 accent-primary mt-0.5"
                  />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      Insignia Fundador (Early Adopter)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Muestra la insignia Fundador y otorga el descuento preferencial configurado.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subDraft.cancel_at_period_end}
                    onChange={(e) =>
                      setSubDraft({ ...subDraft, cancel_at_period_end: e.target.checked })
                    }
                    className="size-4 accent-primary mt-0.5"
                  />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      Cancelar automáticamente al vencer el período
                    </p>
                    <p className="text-[11px] text-slate-400">
                      No se renovará automáticamente al llegar a la fecha de vencimiento.
                    </p>
                  </div>
                </label>
              </section>

              {/* 5. Motivo y Notas */}
              <section className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400">
                  5. Motivo y Notas Internas
                </label>
                <input
                  value={subDraft.grant_reason}
                  onChange={(e) => setSubDraft({ ...subDraft, grant_reason: e.target.value })}
                  placeholder="Motivo visible para referencia (ej. Cortesía VIP / Beca Residente)..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-medium"
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSubDraft({ ...subDraft, grant_reason: r })}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/15 hover:text-primary text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={subDraft.notes}
                  onChange={(e) => setSubDraft({ ...subDraft, notes: e.target.value })}
                  placeholder="Notas internas de administración (solo visible para SuperAdmin)..."
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5"
                />
              </section>

              {/* Sticky Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const id = editingSub.id;
                      const matchPlan = plans.find((p) => p.slug === subDraft.plan_slug);
                      setPaySubId(id);
                      if (matchPlan && matchPlan.price_monthly_cents > 0) {
                        setPayAmountMxn(Math.round(matchPlan.price_monthly_cents / 100));
                      }
                      setEditingSub(null);
                      setSubDraft(null);
                      setSubTab('payments');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    Registrar Pago
                  </button>
                  {editingSub.status === 'active' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleQuickRevoke(editingSub)}
                      className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 font-bold cursor-pointer"
                    >
                      Revocar
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSub(null);
                      setSubDraft(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-black shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Guardando…' : 'Guardar Cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Asignar Nueva Suscripción */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAssignNewSubscription}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-black text-base flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_card</span>
                Asignar / Reemplazar Suscripción
              </h4>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignTargetType('individual');
                    setAssignTargetId('');
                    setAssignPlanSlug('premium_solo');
                  }}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    assignTargetType === 'individual'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Médico Individual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignTargetType('clinic');
                    setAssignTargetId('');
                    setAssignPlanSlug('premium_clinic');
                  }}
                  className={`py-2 rounded-xl font-bold border cursor-pointer ${
                    assignTargetType === 'clinic'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Clínica
                </button>
              </div>

              {assignLoadingTargets ? (
                <p className="py-4 text-center text-slate-400">Cargando directorio...</p>
              ) : assignTargetType === 'individual' ? (
                <div className="space-y-2">
                  <input
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    placeholder="Filtrar médico por nombre o correo..."
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                  />
                  <select
                    required
                    value={assignTargetId}
                    onChange={(e) => setAssignTargetId(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                  >
                    <option value="">Selecciona un médico...</option>
                    {filteredAssignUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || 'Sin nombre'} ({u.email || u.id.slice(0, 8)}) — actual:{' '}
                        {TIER_LABELS[u.subscription_tier]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <select
                  required
                  value={assignTargetId}
                  onChange={(e) => setAssignTargetId(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                >
                  <option value="">Selecciona una clínica...</option>
                  {assignClinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.members_count} miembros)
                    </option>
                  ))}
                </select>
              )}

              <div>
                <label className="block font-bold text-slate-500 mb-1">Plan a otorgar</label>
                <select
                  value={assignPlanSlug}
                  onChange={(e) => setAssignPlanSlug(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2.5 font-bold"
                >
                  {assignablePlans.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name} ({TIER_LABELS[p.tier]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1.5">Vigencia</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '14 días', days: 14, lifetime: false },
                    { label: '30 días', days: 30, lifetime: false },
                    { label: '90 días', days: 90, lifetime: false },
                    { label: '6 meses', days: 180, lifetime: false },
                    { label: '1 año', days: 365, lifetime: false },
                    { label: 'Vitalicio', days: null, lifetime: true },
                  ].map((p) => {
                    const active = p.lifetime ? assignLifetime : !assignLifetime && assignDurationDays === p.days;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setAssignLifetime(p.lifetime);
                          setAssignDurationDays(p.days);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold border cursor-pointer ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 mb-1">Motivo / Etiqueta</label>
                <input
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignProtected}
                  onChange={(e) => setAssignProtected(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Proteger contra cobro automático / expiración de beta
              </label>

              <input
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Nota interna opcional..."
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy || !assignTargetId}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-black disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Asignando…' : 'Asignar Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Plan del Catálogo */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePlan}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-black text-base">Editar Plan: {editingPlan.slug}</h4>
              <button type="button" onClick={() => setEditingPlan(null)} className="cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Nombre comercial</label>
                <input
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={editingPlan.description || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Mensual MXN</label>
                  <input
                    type="number"
                    min={0}
                    value={Math.round(editingPlan.price_monthly_cents / 100)}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        price_monthly_cents: Math.max(0, Number(e.target.value) || 0) * 100,
                      })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Anual MXN</label>
                  <input
                    type="number"
                    min={0}
                    value={Math.round(editingPlan.price_annual_cents / 100)}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        price_annual_cents: Math.max(0, Number(e.target.value) || 0) * 100,
                      })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">Cupo</label>
                  <input
                    type="number"
                    min={1}
                    value={editingPlan.max_seats}
                    onChange={(e) =>
                      setEditingPlan({
                        ...editingPlan,
                        max_seats: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <p className="font-black text-slate-600 dark:text-slate-300">Integración Stripe</p>
                <input
                  value={editingPlan.stripe_product_id || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, stripe_product_id: e.target.value })}
                  placeholder="stripe_product_id (prod_...)"
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editingPlan.stripe_price_monthly_id || ''}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, stripe_price_monthly_id: e.target.value })
                    }
                    placeholder="price_monthly (price_...)"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-xs"
                  />
                  <input
                    value={editingPlan.stripe_price_annual_id || ''}
                    onChange={(e) =>
                      setEditingPlan({ ...editingPlan, stripe_price_annual_id: e.target.value })
                    }
                    placeholder="price_annual (price_...)"
                    className="w-full rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={editingPlan.is_active}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                    className="accent-primary"
                  />
                  Activo
                </label>
                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={editingPlan.is_featured}
                    onChange={(e) => setEditingPlan({ ...editingPlan, is_featured: e.target.checked })}
                    className="accent-primary"
                  />
                  Destacado
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-black cursor-pointer"
              >
                {busy ? 'Guardando...' : 'Guardar Plan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BillingPanel;
