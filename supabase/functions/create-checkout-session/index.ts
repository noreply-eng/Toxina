// ============================================================================
// Stripe Checkout Session Edge Function (Ready for Phase 5 Stripe Activation)
// Deploy with: supabase functions deploy create-checkout-session
// Required secrets when activating billing_mode = 'stripe_live':
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userErr } = await adminClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check platform_settings.billing_mode
    const { data: settings } = await adminClient
      .from('platform_settings')
      .select('billing_mode')
      .eq('id', 1)
      .single();

    if (settings?.billing_mode !== 'stripe_live' || !stripeKey) {
      return new Response(
        JSON.stringify({
          code: 'BILLING_NOT_LIVE',
          error:
            'Stripe aún no está activo en la plataforma. Usa la activación de lanzamiento gratuita o canjea un cupón.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      plan_slug,
      billing_interval = 'monthly',
      clinic_id = null,
      enterprise_account_id = null,
      batch_count = 1,
      success_url,
      cancel_url,
    } = body;

    const { data: plan, error: planErr } = await adminClient
      .from('subscription_plans')
      .select('*')
      .eq('slug', plan_slug)
      .eq('is_active', true)
      .single();

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: 'Plan no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripePriceId =
      billing_interval === 'annual' ? plan.stripe_price_annual_id : plan.stripe_price_monthly_id;

    if (!stripePriceId) {
      return new Response(
        JSON.stringify({ error: `El plan ${plan_slug} aún no tiene stripe_price_id vinculado.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quantity = plan.scope === 'enterprise' ? Math.max(1, Number(batch_count) || 1) : 1;

    // Create Stripe Checkout Session via REST API (zero extra SDK bundle needed)
    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('line_items[0][price]', stripePriceId);
    form.set('line_items[0][quantity]', String(quantity));
    form.set('success_url', success_url || `${req.headers.get('origin')}/subscription?checkout=success`);
    form.set('cancel_url', cancel_url || `${req.headers.get('origin')}/subscription?checkout=canceled`);
    form.set('allow_promotion_codes', 'true');
    if (userData.user.email) form.set('customer_email', userData.user.email);
    form.set('metadata[user_id]', userData.user.id);
    form.set('metadata[plan_slug]', plan_slug);
    form.set('metadata[billing_interval]', billing_interval);
    if (clinic_id) form.set('metadata[clinic_id]', clinic_id);
    if (enterprise_account_id) {
      form.set('metadata[enterprise_account_id]', enterprise_account_id);
      form.set('metadata[batch_count]', String(quantity));
    }

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const stripeJson = await stripeResp.json();
    if (!stripeResp.ok) {
      return new Response(
        JSON.stringify({ error: stripeJson?.error?.message || 'Error en Stripe Checkout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ url: stripeJson.url, id: stripeJson.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
