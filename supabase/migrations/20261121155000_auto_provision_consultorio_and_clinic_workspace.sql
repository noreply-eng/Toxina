-- ============================================================================
-- Migration: Auto-Provision Consultorio Privado Premium / Clínica Privada Premium
--            on Subscription Activation & Backfill Existing Premium/Plus Users
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

-- 1. Helper: Ensure a user has an active Consultorio Privado ('solo_practice')
--    or Clínica Privada ('clinic') where they are 'owner'.
CREATE OR REPLACE FUNCTION public.ensure_user_clinic_workspace(
  p_user_id uuid,
  p_preferred_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_sub record;
  v_clinic_id uuid;
  v_workspace_type text;
  v_workspace_name text;
  v_base_name text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check if user already owns or administers an active clinic/consultorio
  SELECT c.id INTO v_clinic_id
  FROM public.clinic_user_relationships cur
  JOIN public.clinics c ON c.id = cur.clinic_id
  WHERE cur.user_id = p_user_id
    AND cur.is_active = true
    AND cur.status = 'approved'
    AND cur.role_in_clinic IN ('owner', 'director', 'clinic_admin')
  ORDER BY
    CASE cur.role_in_clinic WHEN 'owner' THEN 1 WHEN 'director' THEN 2 ELSE 3 END,
    cur.created_at ASC
  LIMIT 1;

  -- Inspect user's active subscription to determine if it is a clinic plan or solo practice
  SELECT
    s.id, s.subscriber_type, s.seat_limit, sp.slug AS plan_slug, sp.scope AS plan_scope, sp.max_seats
  INTO v_sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  LEFT JOIN public.subscription_seats ss
    ON ss.subscription_id = s.id AND ss.user_id = p_user_id AND ss.is_active = true
  WHERE s.status IN ('active', 'trialing', 'past_due')
    AND (
      (s.subscriber_type = 'individual' AND s.user_id = p_user_id)
      OR (s.subscriber_type = 'clinic' AND ss.user_id = p_user_id)
    )
  ORDER BY
    CASE sp.tier WHEN 'premium' THEN 3 WHEN 'plus' THEN 2 ELSE 1 END DESC,
    s.created_at DESC
  LIMIT 1;

  IF p_preferred_type IN ('solo_practice', 'clinic', 'hospital', 'aesthetic_center', 'rehab_center') THEN
    v_workspace_type := p_preferred_type;
  ELSIF FOUND AND (v_sub.plan_scope = 'clinic' OR v_sub.plan_slug LIKE '%clinic%' OR COALESCE(v_sub.seat_limit, 1) > 1) THEN
    v_workspace_type := 'clinic';
  ELSE
    v_workspace_type := 'solo_practice';
  END IF;

  v_base_name := COALESCE(NULLIF(trim(coalesce(v_profile.full_name, '')), ''), 'Especialista');

  IF v_clinic_id IS NOT NULL THEN
    -- If user upgraded from solo_practice to clinic plan, upgrade workspace type & default name if still generic
    IF v_workspace_type = 'clinic' THEN
      UPDATE public.clinics
      SET
        type = CASE WHEN type = 'solo_practice' THEN 'clinic' ELSE type END,
        name = CASE
          WHEN name LIKE 'Consultorio de %' THEN 'Clínica de ' || v_base_name
          ELSE name
        END,
        updated_at = timezone('utc'::text, now())
      WHERE id = v_clinic_id;
    END IF;

    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.user_profiles
    SET active_clinic_id = COALESCE(active_clinic_id, v_clinic_id)
    WHERE id = p_user_id;

    RETURN v_clinic_id;
  END IF;

  IF v_workspace_type = 'clinic' THEN
    v_workspace_name := 'Clínica de ' || v_base_name;
  ELSE
    v_workspace_name := 'Consultorio de ' || v_base_name;
  END IF;

  INSERT INTO public.clinics (
    name,
    type,
    email,
    phone,
    director_name,
    director_license,
    is_active,
    created_by
  )
  VALUES (
    v_workspace_name,
    v_workspace_type,
    v_profile.email,
    v_profile.phone,
    v_profile.full_name,
    COALESCE(v_profile.specialist_license, v_profile.general_license),
    true,
    p_user_id
  )
  RETURNING id INTO v_clinic_id;

  INSERT INTO public.clinic_configurations (
    clinic_id,
    allow_cross_doctor_patient_view
  )
  VALUES (
    v_clinic_id,
    (v_workspace_type <> 'solo_practice')
  )
  ON CONFLICT (clinic_id) DO NOTHING;

  INSERT INTO public.clinic_user_relationships (
    clinic_id,
    user_id,
    role_in_clinic,
    status,
    is_active,
    approved_by,
    approved_at
  )
  VALUES (
    v_clinic_id,
    p_user_id,
    'owner',
    'approved',
    true,
    p_user_id,
    timezone('utc'::text, now())
  )
  ON CONFLICT (clinic_id, user_id) DO UPDATE
    SET role_in_clinic = 'owner',
        status = 'approved',
        is_active = true,
        updated_at = timezone('utc'::text, now());

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.user_profiles
  SET active_clinic_id = v_clinic_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN v_clinic_id;
END;
$$;

-- 2. Self-Service RPC so any authenticated Plus/Premium user can open or initialize
--    their Consultorio Privado or Clínica Privada immediately.
CREATE OR REPLACE FUNCTION public.ensure_my_clinic_workspace(
  p_preferred_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinic_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clinic_id := public.ensure_user_clinic_workspace(v_uid, p_preferred_type);
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo inicializar el consultorio o clínica.';
  END IF;

  RETURN public.clinic_admin_get_detail(v_clinic_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_clinic_workspace(text) TO authenticated;

-- 3. Update claim_free_launch_subscription to auto-provision Consultorio Privado
--    or Clínica Privada according to the selected plan ('individual' vs 'clinic')
CREATE OR REPLACE FUNCTION public.claim_free_launch_subscription(
  p_plan_slug text,
  p_billing_interval text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings record;
  v_plan record;
  v_existing record;
  v_period_end timestamptz := NULL;
  v_sub_id uuid;
  v_clinic_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  IF COALESCE(v_settings.billing_mode, 'free_launch') <> 'free_launch' THEN
    RAISE EXCEPTION 'La promoción de lanzamiento gratuito ya no está activa.';
  END IF;

  IF p_billing_interval NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Intervalo de facturación no válido.';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE slug = p_plan_slug AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan no encontrado o inactivo.'; END IF;
  IF v_plan.scope = 'enterprise' THEN
    RAISE EXCEPTION 'Los planes Enterprise en lotes de 20 se gestionan por cuenta corporativa.';
  END IF;

  SELECT * INTO v_existing
  FROM public.subscriptions
  WHERE user_id = v_uid
    AND subscriber_type = 'individual'
    AND status IN ('active', 'trialing')
    AND (protected_from_auto_downgrade = true OR origin IN ('admin_grant', 'enterprise_license'))
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND AND v_plan.tier <> 'premium' THEN
    RAISE EXCEPTION 'Ya cuentas con un acceso protegido o patrocinado superior. Contacta a soporte para modificarlo.';
  END IF;

  -- Cancel previous non-protected launch subscriptions for this user
  UPDATE public.subscriptions
  SET status = 'canceled', canceled_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
  WHERE user_id = v_uid
    AND subscriber_type = 'individual'
    AND status IN ('active', 'trialing')
    AND protected_from_auto_downgrade = false
    AND origin NOT IN ('admin_grant', 'enterprise_license');

  IF v_plan.tier = 'free' THEN
    PERFORM public.refresh_user_subscription_tier(v_uid);
    RETURN public.get_my_entitlements();
  END IF;

  IF v_settings.launch_default_grant_days IS NOT NULL THEN
    v_period_end := timezone('utc'::text, now()) + make_interval(days => v_settings.launch_default_grant_days);
  ELSIF v_settings.launch_promo_ends_at IS NOT NULL THEN
    v_period_end := v_settings.launch_promo_ends_at;
  END IF;

  -- Provision Consultorio Privado ('solo_practice') or Clínica Privada ('clinic')
  v_clinic_id := public.ensure_user_clinic_workspace(
    v_uid,
    CASE WHEN v_plan.scope = 'clinic' THEN 'clinic' ELSE 'solo_practice' END
  );

  INSERT INTO public.subscriptions (
    subscriber_type, user_id, plan_id, status, origin, billing_interval,
    seat_limit, price_cents_at_signup, is_founder, protected_from_auto_downgrade,
    current_period_start, current_period_end, payment_processor, notes, created_by
  )
  VALUES (
    'individual', v_uid, v_plan.id, 'active', 'launch_promo', p_billing_interval,
    v_plan.max_seats, 0, true, false,
    timezone('utc'::text, now()), v_period_end, 'comped',
    'Auto-activación gratuita en modo lanzamiento (Early Adopter)', v_uid
  )
  RETURNING id INTO v_sub_id;

  PERFORM public.write_audit_log(
    'user_claim_launch_subscription', 'subscription', v_sub_id, NULL,
    jsonb_build_object('plan_slug', p_plan_slug, 'interval', p_billing_interval, 'price_cents', 0, 'clinic_id', v_clinic_id)
  );

  RETURN public.get_my_entitlements();
END;
$$;

-- 4. Update clinic_admin_get_detail so it resolves BOTH clinic-scoped subscriptions
--    AND the owner's active individual/launch/enterprise subscription (Consultorio Privado or Clínica Privada).
CREATE OR REPLACE FUNCTION public.clinic_admin_get_detail(p_clinic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic record;
  v_config record;
  v_sub record;
  v_owner_id uuid;
  v_active_sub jsonb := NULL;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN
    RAISE EXCEPTION 'Forbidden: se requiere rol de administrador u owner de esta clínica o consultorio.';
  END IF;

  SELECT * INTO v_clinic FROM public.clinics WHERE id = p_clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consultorio o clínica no encontrado.';
  END IF;

  SELECT * INTO v_config FROM public.clinic_configurations WHERE clinic_id = p_clinic_id;

  -- First check if there is a clinic-scoped subscription
  SELECT
    s.id, s.status, s.origin, s.billing_interval, s.seat_limit,
    s.current_period_start, s.current_period_end, s.grant_reason,
    sp.slug AS plan_slug, sp.name AS plan_name, sp.tier
  INTO v_sub
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.clinic_id = p_clinic_id
    AND s.subscriber_type = 'clinic'
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Fallback: check the owner's (or current admin user's) active individual subscription
  IF NOT FOUND THEN
    SELECT cur.user_id INTO v_owner_id
    FROM public.clinic_user_relationships cur
    WHERE cur.clinic_id = p_clinic_id
      AND cur.is_active = true
      AND cur.status = 'approved'
      AND cur.role_in_clinic IN ('owner', 'director', 'clinic_admin')
    ORDER BY
      CASE WHEN cur.user_id = auth.uid() THEN 0 ELSE 1 END,
      CASE cur.role_in_clinic WHEN 'owner' THEN 1 WHEN 'director' THEN 2 ELSE 3 END
    LIMIT 1;

    IF v_owner_id IS NOT NULL THEN
      SELECT
        s.id, s.status, s.origin, s.billing_interval, s.seat_limit,
        s.current_period_start, s.current_period_end, s.grant_reason,
        sp.slug AS plan_slug, sp.name AS plan_name, sp.tier
      INTO v_sub
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.user_id = v_owner_id
        AND s.subscriber_type = 'individual'
        AND s.status IN ('active', 'trialing', 'past_due')
      ORDER BY
        CASE s.origin WHEN 'admin_grant' THEN 1 WHEN 'enterprise_license' THEN 2 ELSE 3 END,
        CASE sp.tier WHEN 'premium' THEN 3 WHEN 'plus' THEN 2 ELSE 1 END DESC,
        s.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  IF FOUND AND v_sub.id IS NOT NULL THEN
    v_active_sub := jsonb_build_object(
      'id', v_sub.id,
      'plan_slug', v_sub.plan_slug,
      'plan_name', v_sub.plan_name,
      'tier', v_sub.tier,
      'status', v_sub.status,
      'origin', v_sub.origin,
      'billing_interval', v_sub.billing_interval,
      'seat_limit', COALESCE(v_sub.seat_limit, 1),
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end,
      'grant_reason', v_sub.grant_reason
    );
  END IF;

  RETURN jsonb_build_object(
    'clinic', to_jsonb(v_clinic),
    'configuration', to_jsonb(v_config),
    'active_subscription', v_active_sub,
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cur.id,
        'user_id', cur.user_id,
        'role_in_clinic', cur.role_in_clinic,
        'status', cur.status,
        'is_active', cur.is_active,
        'full_name', up.full_name,
        'email', up.email,
        'specialty', up.specialty,
        'has_seat', true
      ) ORDER BY CASE cur.role_in_clinic WHEN 'owner' THEN 1 WHEN 'director' THEN 2 WHEN 'clinic_admin' THEN 3 WHEN 'specialist' THEN 4 ELSE 5 END, cur.created_at ASC)
      FROM public.clinic_user_relationships cur
      LEFT JOIN public.user_profiles up ON up.id = cur.user_id
      WHERE cur.clinic_id = p_clinic_id AND cur.is_active = true
    ), '[]'::jsonb),
    'patients_count', (
      SELECT COUNT(*)
      FROM public.patients p
      WHERE p.clinic_id = p_clinic_id
         OR (v_owner_id IS NOT NULL AND p.user_id = v_owner_id AND p.clinic_id IS NULL)
    ),
    'treatments_count', (
      SELECT COUNT(*)
      FROM public.treatments t
      WHERE t.clinic_id = p_clinic_id
         OR (v_owner_id IS NOT NULL AND t.user_id = v_owner_id AND t.clinic_id IS NULL)
    )
  );
END;
$$;

-- 5. Update resolve_user_entitlements to include 'type' in each clinic membership
--    and auto-provision workspace for Plus/Premium users who don't have one yet.
CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_tier text;
  v_origin text;
  v_announcements jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.user_profiles
  SET last_seen_at = timezone('utc'::text, now())
  WHERE id = v_uid
    AND (last_seen_at IS NULL OR last_seen_at < timezone('utc'::text, now()) - interval '15 minutes');

  v_result := public.resolve_user_entitlements(v_uid);
  v_tier := v_result ->> 'effective_tier';
  v_origin := v_result ->> 'origin';

  -- Auto-provision Consultorio Privado / Clínica Privada if user has active Plus/Premium and no clinic yet
  IF v_tier IN ('plus', 'premium')
     AND COALESCE((v_result ->> 'role'), 'specialist') <> 'enterprise'
     AND jsonb_array_length(COALESCE(v_result -> 'clinics', '[]'::jsonb)) = 0 THEN
    PERFORM public.ensure_user_clinic_workspace(v_uid, NULL);
    v_result := public.resolve_user_entitlements(v_uid);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pa.id,
    'title', pa.title,
    'message', pa.message,
    'variant', pa.variant,
    'cta_label', pa.cta_label,
    'cta_path', pa.cta_path,
    'ends_at', pa.ends_at
  ) ORDER BY pa.created_at DESC), '[]'::jsonb)
  INTO v_announcements
  FROM public.platform_announcements pa
  WHERE pa.is_active = true
    AND pa.starts_at <= timezone('utc'::text, now())
    AND (pa.ends_at IS NULL OR pa.ends_at > timezone('utc'::text, now()))
    AND (pa.target_tiers IS NULL OR v_tier = ANY(pa.target_tiers))
    AND (pa.target_origins IS NULL OR v_origin = ANY(pa.target_origins));

  RETURN v_result || jsonb_build_object('announcements', v_announcements);
END;
$$;

-- 6. Backfill existing Plus & Premium users who don't have a Consultorio/Clínica row yet
DO $$
DECLARE
  v_user record;
BEGIN
  FOR v_user IN
    SELECT up.id
    FROM public.user_profiles up
    WHERE up.role NOT IN ('enterprise')
      AND (
        up.subscription_tier IN ('plus', 'premium')
        OR EXISTS (
          SELECT 1 FROM public.subscriptions s
          WHERE s.user_id = up.id AND s.status IN ('active', 'trialing')
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.clinic_user_relationships cur
        WHERE cur.user_id = up.id AND cur.is_active = true
      )
  LOOP
    PERFORM public.ensure_user_clinic_workspace(v_user.id, NULL);
  END LOOP;
END $$;
