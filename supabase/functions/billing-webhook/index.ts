// ============================================================================
// Stripe Webhook Handler (Idempotent via billing_webhook_events)
// Deploy with: supabase functions deploy billing-webhook --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//                   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
  const timestamp = parts['t'];
  const expectedSig = parts['v1'];
  if (!timestamp || !expectedSig) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hex === expectedSig;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!webhookSecret) {
    return new Response('STRIPE_WEBHOOK_SECRET not configured', { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  const valid = await verifyStripeSignature(rawBody, sig, webhookSecret);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Idempotency check
  const { error: insertErr } = await adminClient.from('billing_webhook_events').insert({
    processor: 'stripe',
    external_event_id: event.id,
    event_type: event.type,
    status: 'received',
    payload: event,
  });

  if (insertErr && insertErr.code === '23505') {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};
      const planSlug = meta.plan_slug;

      const { data: plan } = await adminClient
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .single();

      if (plan && meta.enterprise_account_id) {
        // B2B Enterprise batch purchase (multiples of 20)
        const batchCount = Math.max(1, Number(meta.batch_count) || 1);
        await adminClient.from('enterprise_license_batches').insert({
          enterprise_account_id: meta.enterprise_account_id,
          batch_count: batchCount,
          licenses_per_batch: 20,
          billing_interval: meta.billing_interval || 'annual',
          unit_batch_price_cents: Math.round((session.amount_total || 0) / batchCount),
          amount_total_cents: session.amount_total || 0,
          status: 'active',
          payment_processor: 'stripe',
          external_subscription_id: session.subscription || null,
        });
      } else if (plan && (meta.user_id || meta.clinic_id)) {
        // Individual or Clinic subscription
        await adminClient.from('subscriptions').insert({
          subscriber_type: meta.clinic_id ? 'clinic' : 'individual',
          user_id: meta.clinic_id ? null : meta.user_id,
          clinic_id: meta.clinic_id || null,
          plan_id: plan.id,
          status: 'active',
          origin: 'stripe',
          billing_interval: meta.billing_interval || 'monthly',
          seat_limit: plan.max_seats,
          price_cents_at_signup: session.amount_total || 0,
          payment_processor: 'stripe',
          external_customer_id: session.customer || null,
          external_subscription_id: session.subscription || null,
        });
      }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const mappedStatus =
        sub.status === 'active'
          ? 'active'
          : sub.status === 'trialing'
          ? 'trialing'
          : sub.status === 'past_due'
          ? 'past_due'
          : 'canceled';

      await adminClient
        .from('subscriptions')
        .update({
          status: mappedStatus,
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
          updated_at: new Date().toISOString(),
        })
        .eq('external_subscription_id', sub.id);
    }

    await adminClient
      .from('billing_webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('processor', 'stripe')
      .eq('external_event_id', event.id);

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    await adminClient
      .from('billing_webhook_events')
      .update({ status: 'failed', error_message: err?.message || 'Unknown error' })
      .eq('processor', 'stripe')
      .eq('external_event_id', event.id);
    return new Response(JSON.stringify({ error: err?.message }), { status: 500 });
  }
});
