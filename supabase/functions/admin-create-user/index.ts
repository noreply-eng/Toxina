// Supabase Edge Function: admin-create-user
// Creates a confirmed SonoTox user account manually on behalf of an authenticated super_admin.
// Deploy: supabase functions deploy admin-create-user
// Requires built-in Supabase env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserBody {
  email: string;
  password: string;
  full_name?: string;
  specialty?: string;
  phone?: string;
  general_license?: string;
  specialist_license?: string;
  role?: 'super_admin' | 'support_admin' | 'enterprise' | 'specialist' | 'assistant';
  plan_slug?: string;
  duration_days?: number | null;
  is_lifetime?: boolean;
  protected_from_auto_downgrade?: boolean;
  grant_reason?: string;
  account_limits?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Variables de entorno de Supabase incompletas en el servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: isAdmin, error: adminCheckErr } = await callerClient.rpc('is_super_admin');
    if (adminCheckErr || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acceso denegado: se requiere rol super_admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      data: { user: callerUser },
    } = await callerClient.auth.getUser();

    const body = (await req.json()) as CreateUserBody;
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Ingresa un correo electrónico válido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'La contraseña temporal debe tener al menos 8 caracteres.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name?.trim() || '',
        specialty: body.specialty?.trim() || '',
      },
    });

    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message || 'No se pudo crear la cuenta en Auth.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = created.user.id;
    const safeRole =
      body.role && ['super_admin', 'support_admin', 'enterprise', 'specialist', 'assistant'].includes(body.role)
        ? body.role
        : 'specialist';

    // Update profile fields using callerClient RPC (keeps audit log & profile guard clean)
    const { error: acctErr } = await callerClient.rpc('super_admin_update_user_account', {
      p_user_id: newUserId,
      p_payload: {
        full_name: body.full_name?.trim() || null,
        specialty: body.specialty?.trim() || null,
        phone: body.phone?.trim() || null,
        general_license: body.general_license?.trim() || null,
        specialist_license: body.specialist_license?.trim() || null,
        role: safeRole,
        is_active: true,
        status: 'active',
        account_limits: body.account_limits || {},
      },
    });

    if (acctErr) {
      // Fallback if Migration 5 RPC is not yet applied
      await adminClient
        .from('user_profiles')
        .update({
          full_name: body.full_name?.trim() || null,
          specialty: body.specialty?.trim() || null,
          phone: body.phone?.trim() || null,
          general_license: body.general_license?.trim() || null,
          specialist_license: body.specialist_license?.trim() || null,
        })
        .eq('id', newUserId);

      if (safeRole !== 'specialist') {
        await callerClient.rpc('super_admin_set_user_role', {
          p_user_id: newUserId,
          p_new_role: safeRole,
        });
      }
    }

    // Grant initial individual subscription if requested
    if (body.plan_slug && body.plan_slug !== 'free' && safeRole !== 'enterprise') {
      await callerClient.rpc('super_admin_grant_subscription', {
        p_user_id: newUserId,
        p_clinic_id: null,
        p_plan_slug: body.plan_slug,
        p_billing_interval: body.is_lifetime ? 'lifetime' : 'custom',
        p_duration_days: body.is_lifetime ? null : body.duration_days ?? 365,
        p_custom_period_end: null,
        p_is_lifetime: Boolean(body.is_lifetime),
        p_grant_reason: body.grant_reason || 'Cuenta creada manualmente por SuperAdmin',
        p_protected: body.protected_from_auto_downgrade ?? true,
        p_notes: `Creada por ${callerUser?.email || 'SuperAdmin'}`,
      });
    }

    return new Response(
      JSON.stringify({
        user_id: newUserId,
        email,
        role: safeRole,
        message: 'Cuenta creada y confirmada correctamente.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno creando cuenta.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
