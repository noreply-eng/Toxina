import { supabase } from '../../supabaseClient';
import {
  FALLBACK_PLANS,
  type BillingMode,
  type SubscriptionPlanRecord,
} from '../entitlements/planCatalog';

export interface ActivateSubscriptionInput {
  planSlug: string;
  billingInterval: 'monthly' | 'annual';
  billingMode: BillingMode;
  clinicId?: string | null;
  promoCode?: string | null;
}

export interface ActivateSubscriptionResult {
  mode: 'claimed_free' | 'redirect_checkout' | 'manual_required';
  message: string;
  checkoutUrl?: string;
}

export async function fetchSubscriptionPlans(includeAll = false): Promise<SubscriptionPlanRecord[]> {
  try {
    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!includeAll) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return FALLBACK_PLANS;
    }
    return data as SubscriptionPlanRecord[];
  } catch {
    return FALLBACK_PLANS;
  }
}

/**
 * Unified subscription activation entrypoint:
 * - free_launch: activates any individual/clinic plan at $0 via DB RPC
 * - manual_billing: informs user to redeem a promo/enterprise code or contact admin
 * - stripe_live: calls Edge Function create-checkout-session and redirects to Stripe Checkout
 */
export async function activatePlanSubscription(
  input: ActivateSubscriptionInput
): Promise<ActivateSubscriptionResult> {
  if (input.billingMode === 'free_launch' || input.planSlug === 'free') {
    const { error } = await supabase.rpc('claim_free_launch_subscription', {
      p_plan_slug: input.planSlug,
      p_billing_interval: input.billingInterval,
    });
    if (error) {
      throw new Error(error.message || 'No se pudo activar el plan gratuito.');
    }
    return {
      mode: 'claimed_free',
      message:
        input.planSlug === 'free'
          ? 'Has vuelto al Plan Gratuito.'
          : '¡Plan activado sin costo ($0) durante el acceso de lanzamiento! Disfruta todas las funciones.',
    };
  }

  if (input.billingMode === 'manual_billing') {
    return {
      mode: 'manual_required',
      message:
        'La pasarela automática aún no está habilitada. Canjea un cupón promocional/Enterprise o solicita la activación manual con administración.',
    };
  }

  // stripe_live mode: invoke Stripe Checkout Edge Function
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      plan_slug: input.planSlug,
      billing_interval: input.billingInterval,
      clinic_id: input.clinicId ?? null,
      promo_code: input.promoCode ?? null,
      success_url: `${window.location.origin}/subscription?checkout=success`,
      cancel_url: `${window.location.origin}/subscription?checkout=canceled`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Error al iniciar la sesión de pago con Stripe.');
  }

  if (data?.url) {
    return {
      mode: 'redirect_checkout',
      checkoutUrl: data.url,
      message: 'Redirigiendo a Stripe Checkout...',
    };
  }

  throw new Error(data?.error || 'Stripe aún no está configurado en el servidor.');
}

export async function redeemPromoOrEnterpriseCode(code: string): Promise<{
  kind: 'enterprise_license' | 'promo_code';
  message: string;
  sponsor?: string;
}> {
  const { data, error } = await supabase.rpc('redeem_promo_or_enterprise_code', {
    p_code: code.trim(),
  });
  if (error) {
    throw new Error(error.message || 'No se pudo aplicar el código.');
  }
  return data as { kind: 'enterprise_license' | 'promo_code'; message: string; sponsor?: string };
}

export async function openCustomerBillingPortal(billingMode: BillingMode): Promise<string | null> {
  if (billingMode !== 'stripe_live') {
    return null;
  }

  const { data, error } = await supabase.functions.invoke('create-billing-portal', {
    body: { return_url: `${window.location.origin}/subscription` },
  });

  if (error) {
    throw new Error(error.message || 'No se pudo abrir el portal de facturación.');
  }

  return data?.url ?? null;
}
