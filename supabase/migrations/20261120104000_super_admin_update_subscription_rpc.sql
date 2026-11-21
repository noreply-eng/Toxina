-- ============================================================================
-- Migration 5: SuperAdmin Deep Account Management, Custom Account Limits,
--              In-Place Subscription Modification, Clinic Seat Limits &
--              Enriched Users / Billing Overviews
-- 100% Idempotent (CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- 1. Add flexible per-account quotas & capabilities JSONB on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_limits jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. In-place subscription editor RPC (plan, status, origin, expiry, seats, flags, notes)
CREATE OR REPLACE FUNCTION public.super_admin_update_subscription(
  p_subscription_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
  v_new record;
  v_plan record;
  v_next_plan_id uuid;
  v_next_status text;
  v_next_origin text;
  v_next_interval text;
  v_next_processor text;
  v_next_seat_limit int;
  v_next_price_cents int;
  v_next_period_end timestamptz;
  v_seat record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  SELECT * INTO v_old
  FROM public.subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suscripción no encontrada.';
  END IF;

  v_next_plan_id := v_old.plan_id;
  IF NULLIF(trim(coalesce(p_payload ->> 'plan_slug', '')), '') IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE slug = trim(p_payload ->> 'plan_slug');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plan "%" no encontrado en el catálogo.', p_payload ->> 'plan_slug';
    END IF;
    v_next_plan_id := v_plan.id;
  ELSIF NULLIF(trim(coalesce(p_payload ->> 'plan_id', '')), '') IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = (p_payload ->> 'plan_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plan especificado no encontrado.';
    END IF;
    v_next_plan_id := v_plan.id;
  END IF;

  v_next_status := COALESCE(NULLIF(trim(coalesce(p_payload ->> 'status', '')), ''), v_old.status);
  IF v_next_status NOT IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired') THEN
    RAISE EXCEPTION 'Estado de suscripción no válido: %.', v_next_status;
  END IF;

  v_next_origin := COALESCE(NULLIF(trim(coalesce(p_payload ->> 'origin', '')), ''), v_old.origin);
  IF v_next_origin NOT IN (
    'free_default', 'launch_promo', 'admin_grant',
    'enterprise_license', 'promo_code', 'manual_payment', 'stripe', 'mercadopago'
  ) THEN
    RAISE EXCEPTION 'Origen de suscripción no válido: %.', v_next_origin;
  END IF;

  v_next_interval := COALESCE(NULLIF(trim(coalesce(p_payload ->> 'billing_interval', '')), ''), v_old.billing_interval);
  IF v_next_interval NOT IN ('monthly', 'annual', 'lifetime', 'custom') THEN
    RAISE EXCEPTION 'Intervalo de facturación no válido: %.', v_next_interval;
  END IF;

  v_next_processor := COALESCE(NULLIF(trim(coalesce(p_payload ->> 'payment_processor', '')), ''), v_old.payment_processor, 'comped');
  IF v_next_processor NOT IN ('comped', 'manual', 'stripe', 'mercadopago') THEN
    RAISE EXCEPTION 'Procesador de pago no válido: %.', v_next_processor;
  END IF;

  v_next_seat_limit := GREATEST(
    COALESCE(NULLIF(p_payload ->> 'seat_limit', '')::int, v_old.seat_limit, 1),
    1
  );

  v_next_price_cents := GREATEST(
    COALESCE(NULLIF(p_payload ->> 'price_cents_at_signup', '')::int, v_old.price_cents_at_signup, 0),
    0
  );

  IF p_payload ? 'current_period_end' THEN
    IF p_payload -> 'current_period_end' IS NULL
       OR jsonb_typeof(p_payload -> 'current_period_end') = 'null'
       OR trim(coalesce(p_payload ->> 'current_period_end', '')) = '' THEN
      v_next_period_end := NULL;
    ELSE
      v_next_period_end := (p_payload ->> 'current_period_end')::timestamptz;
    END IF;
  ELSE
    v_next_period_end := v_old.current_period_end;
  END IF;

  UPDATE public.subscriptions
  SET
    plan_id = v_next_plan_id,
    status = v_next_status,
    origin = v_next_origin,
    billing_interval = v_next_interval,
    payment_processor = v_next_processor,
    seat_limit = v_next_seat_limit,
    price_cents_at_signup = v_next_price_cents,
    is_founder = COALESCE((p_payload ->> 'is_founder')::boolean, is_founder),
    protected_from_auto_downgrade = COALESCE(
      (p_payload ->> 'protected_from_auto_downgrade')::boolean,
      protected_from_auto_downgrade
    ),
    cancel_at_period_end = COALESCE(
      (p_payload ->> 'cancel_at_period_end')::boolean,
      cancel_at_period_end
    ),
    grant_reason = CASE
      WHEN p_payload ? 'grant_reason' THEN NULLIF(trim(coalesce(p_payload ->> 'grant_reason', '')), '')
      ELSE grant_reason
    END,
    notes = CASE
      WHEN p_payload ? 'notes' THEN NULLIF(trim(coalesce(p_payload ->> 'notes', '')), '')
      ELSE notes
    END,
    current_period_end = v_next_period_end,
    canceled_at = CASE
      WHEN v_next_status IN ('active', 'trialing') THEN NULL
      WHEN v_next_status = 'canceled' THEN COALESCE(canceled_at, timezone('utc'::text, now()))
      ELSE canceled_at
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_subscription_id
  RETURNING * INTO v_new;

  IF v_new.enterprise_license_id IS NOT NULL THEN
    UPDATE public.enterprise_licenses
    SET
      expires_at = v_new.current_period_end,
      status = CASE
        WHEN v_new.status IN ('active', 'trialing') THEN 'active'
        WHEN v_new.status = 'expired' THEN 'expired'
        WHEN v_new.status = 'canceled' THEN 'revoked'
        ELSE status
      END,
      revoked_at = CASE
        WHEN v_new.status IN ('active', 'trialing') THEN NULL
        WHEN v_new.status = 'canceled' THEN COALESCE(revoked_at, timezone('utc'::text, now()))
        ELSE revoked_at
      END
    WHERE id = v_new.enterprise_license_id;
  END IF;

  IF v_new.user_id IS NOT NULL THEN
    PERFORM public.refresh_user_subscription_tier(v_new.user_id);
  END IF;

  IF v_new.subscriber_type = 'clinic' THEN
    FOR v_seat IN
      SELECT DISTINCT user_id FROM public.subscription_seats
      WHERE subscription_id = p_subscription_id
    LOOP
      PERFORM public.refresh_user_subscription_tier(v_seat.user_id);
    END LOOP;
  END IF;

  PERFORM public.write_audit_log(
    'super_admin_update_subscription',
    'subscription',
    p_subscription_id,
    to_jsonb(v_old),
    to_jsonb(v_new),
    v_new.clinic_id,
    v_new.enterprise_account_id
  );

  RETURN to_jsonb(v_new);
END;
$$;

-- 3. Deep account editor RPC (profile fields, role, status, account_limits, feature_overrides, admin_notes, legal reset)
CREATE OR REPLACE FUNCTION public.super_admin_update_user_account(
  p_user_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
  v_new record;
  v_next_role text;
  v_next_active boolean;
  v_next_status text;
  v_other_admins int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  SELECT * INTO v_old FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  v_next_role := COALESCE(NULLIF(trim(coalesce(p_payload ->> 'role', '')), ''), v_old.role);
  IF v_next_role NOT IN ('super_admin', 'support_admin', 'enterprise', 'specialist', 'assistant') THEN
    RAISE EXCEPTION 'Rol global no válido: %.', v_next_role;
  END IF;

  v_next_active := COALESCE((p_payload ->> 'is_active')::boolean, v_old.is_active);
  v_next_status := COALESCE(NULLIF(trim(coalesce(p_payload ->> 'status', '')), ''), v_old.status);
  IF v_next_status NOT IN ('active', 'pending', 'suspended') THEN
    RAISE EXCEPTION 'Estado de cuenta no válido: %.', v_next_status;
  END IF;

  IF v_old.role = 'super_admin' AND (v_next_role <> 'super_admin' OR NOT v_next_active OR v_next_status <> 'active') THEN
    SELECT COUNT(*) INTO v_other_admins
    FROM public.user_profiles
    WHERE role = 'super_admin' AND is_active = true AND status = 'active' AND id <> p_user_id;
    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'No puedes degradar ni suspender al último SuperAdmin activo de la plataforma.';
    END IF;
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  UPDATE public.user_profiles
  SET
    full_name = CASE WHEN p_payload ? 'full_name' THEN NULLIF(trim(coalesce(p_payload ->> 'full_name', '')), '') ELSE full_name END,
    specialty = CASE WHEN p_payload ? 'specialty' THEN NULLIF(trim(coalesce(p_payload ->> 'specialty', '')), '') ELSE specialty END,
    phone = CASE WHEN p_payload ? 'phone' THEN NULLIF(trim(coalesce(p_payload ->> 'phone', '')), '') ELSE phone END,
    general_license = CASE WHEN p_payload ? 'general_license' THEN NULLIF(trim(coalesce(p_payload ->> 'general_license', '')), '') ELSE general_license END,
    specialist_license = CASE WHEN p_payload ? 'specialist_license' THEN NULLIF(trim(coalesce(p_payload ->> 'specialist_license', '')), '') ELSE specialist_license END,
    role = v_next_role,
    is_active = v_next_active,
    status = v_next_status,
    feature_overrides = CASE WHEN p_payload ? 'feature_overrides' THEN COALESCE(p_payload -> 'feature_overrides', '{}'::jsonb) ELSE feature_overrides END,
    account_limits = CASE WHEN p_payload ? 'account_limits' THEN COALESCE(p_payload -> 'account_limits', '{}'::jsonb) ELSE account_limits END,
    admin_notes = CASE WHEN p_payload ? 'admin_notes' THEN NULLIF(trim(coalesce(p_payload ->> 'admin_notes', '')), '') ELSE admin_notes END,
    terms_accepted_at = CASE WHEN COALESCE((p_payload ->> 'reset_legal_consent')::boolean, false) THEN NULL ELSE terms_accepted_at END,
    privacy_sensitive_accepted_at = CASE WHEN COALESCE((p_payload ->> 'reset_legal_consent')::boolean, false) THEN NULL ELSE privacy_sensitive_accepted_at END,
    consent_revoked_at = CASE WHEN COALESCE((p_payload ->> 'reset_legal_consent')::boolean, false) THEN NULL ELSE consent_revoked_at END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id
  RETURNING * INTO v_new;

  PERFORM public.refresh_user_subscription_tier(p_user_id);

  PERFORM public.write_audit_log(
    'super_admin_update_user_account',
    'user_profile',
    p_user_id,
    to_jsonb(v_old),
    to_jsonb(v_new)
  );

  RETURN to_jsonb(v_new);
END;
$$;

-- 4. Clinic seat limit & membership removal RPCs
CREATE OR REPLACE FUNCTION public.super_admin_update_clinic_seat_limit(
  p_clinic_id uuid,
  p_seat_limit int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub record;
  v_safe_seats int := GREATEST(COALESCE(p_seat_limit, 1), 1);
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE clinic_id = p_clinic_id AND subscriber_type = 'clinic' AND status IN ('active', 'trialing', 'past_due')
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta clínica aún no tiene una suscripción activa para ajustar asientos.';
  END IF;

  UPDATE public.subscriptions
  SET seat_limit = v_safe_seats, updated_at = timezone('utc'::text, now())
  WHERE id = v_sub.id
  RETURNING * INTO v_sub;

  PERFORM public.write_audit_log(
    'super_admin_update_clinic_seat_limit',
    'subscription',
    v_sub.id,
    NULL,
    jsonb_build_object('clinic_id', p_clinic_id, 'seat_limit', v_safe_seats),
    p_clinic_id,
    NULL
  );

  RETURN to_jsonb(v_sub);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_remove_clinic_member(
  p_clinic_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.clinic_user_relationships
  SET is_active = false, status = 'suspended', updated_at = timezone('utc'::text, now())
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  UPDATE public.subscription_seats ss
  SET is_active = false, revoked_at = timezone('utc'::text, now())
  FROM public.subscriptions s
  WHERE ss.subscription_id = s.id AND s.clinic_id = p_clinic_id AND ss.user_id = p_user_id;

  PERFORM public.refresh_user_subscription_tier(p_user_id);

  PERFORM public.write_audit_log(
    'super_admin_remove_clinic_member',
    'clinic_user_relationship',
    p_user_id,
    NULL,
    jsonb_build_object('clinic_id', p_clinic_id, 'user_id', p_user_id),
    p_clinic_id,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_remove_enterprise_manager(
  p_enterprise_account_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.enterprise_account_managers
  SET is_active = false
  WHERE enterprise_account_id = p_enterprise_account_id AND user_id = p_user_id;

  PERFORM public.write_audit_log(
    'super_admin_remove_enterprise_manager',
    'enterprise_account_manager',
    p_user_id,
    NULL,
    jsonb_build_object('enterprise_account_id', p_enterprise_account_id, 'user_id', p_user_id),
    NULL,
    p_enterprise_account_id
  );
END;
$$;

-- 5. Enhanced super_admin_grant_subscription (auto-seats approved clinic members up to seat_limit)
CREATE OR REPLACE FUNCTION public.super_admin_grant_subscription(
  p_user_id uuid DEFAULT NULL, p_clinic_id uuid DEFAULT NULL, p_plan_slug text DEFAULT 'premium_solo',
  p_billing_interval text DEFAULT 'custom', p_duration_days int DEFAULT NULL, p_custom_period_end timestamptz DEFAULT NULL,
  p_is_lifetime boolean DEFAULT false, p_grant_reason text DEFAULT 'Cortesía administrativa',
  p_protected boolean DEFAULT true, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_sub_type text;
  v_period_end timestamptz := NULL;
  v_sub_id uuid;
  v_member record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_user_id IS NULL AND p_clinic_id IS NULL THEN RAISE EXCEPTION 'Debes especificar usuario o clínica.'; END IF;

  v_sub_type := CASE WHEN p_clinic_id IS NOT NULL THEN 'clinic' ELSE 'individual' END;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE slug = p_plan_slug;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan % no encontrado.', p_plan_slug; END IF;

  IF NOT p_is_lifetime THEN
    IF p_custom_period_end IS NOT NULL THEN v_period_end := p_custom_period_end;
    ELSIF p_duration_days IS NOT NULL AND p_duration_days > 0 THEN v_period_end := timezone('utc'::text, now()) + make_interval(days => p_duration_days);
    END IF;
  END IF;

  IF v_sub_type = 'individual' THEN
    UPDATE public.subscriptions SET status = 'canceled', canceled_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id AND subscriber_type = 'individual' AND status IN ('active', 'trialing', 'past_due');
  ELSE
    UPDATE public.subscriptions SET status = 'canceled', canceled_at = timezone('utc'::text, now()), updated_at = timezone('utc'::text, now())
    WHERE clinic_id = p_clinic_id AND subscriber_type = 'clinic' AND status IN ('active', 'trialing', 'past_due');
  END IF;

  IF v_plan.tier = 'free' THEN
    IF p_user_id IS NOT NULL THEN PERFORM public.refresh_user_subscription_tier(p_user_id); END IF;
    PERFORM public.write_audit_log('super_admin_set_free_tier', 'subscription', COALESCE(p_user_id, p_clinic_id), NULL, jsonb_build_object('plan_slug', p_plan_slug, 'reason', p_grant_reason), p_clinic_id, NULL);
    RETURN jsonb_build_object('status', 'downgraded_to_free');
  END IF;

  INSERT INTO public.subscriptions (
    subscriber_type, user_id, clinic_id, plan_id, status, origin, billing_interval,
    seat_limit, price_cents_at_signup, protected_from_auto_downgrade, grant_reason,
    current_period_start, current_period_end, payment_processor, notes, created_by
  )
  VALUES (
    v_sub_type, CASE WHEN v_sub_type = 'individual' THEN p_user_id ELSE NULL END, p_clinic_id,
    v_plan.id, 'active', 'admin_grant',
    CASE WHEN p_is_lifetime THEN 'lifetime' ELSE COALESCE(p_billing_interval, 'custom') END,
    v_plan.max_seats, 0, p_protected, p_grant_reason,
    timezone('utc'::text, now()), v_period_end, 'comped', p_notes, auth.uid()
  )
  RETURNING id INTO v_sub_id;

  IF v_sub_type = 'clinic' THEN
    FOR v_member IN
      SELECT cur.user_id
      FROM public.clinic_user_relationships cur
      WHERE cur.clinic_id = p_clinic_id AND cur.is_active = true AND cur.status = 'approved'
      ORDER BY CASE cur.role_in_clinic WHEN 'owner' THEN 1 WHEN 'director' THEN 2 WHEN 'clinic_admin' THEN 3 ELSE 4 END, cur.created_at ASC
      LIMIT GREATEST(v_plan.max_seats, 1)
    LOOP
      INSERT INTO public.subscription_seats (subscription_id, user_id, is_active, assigned_by)
      VALUES (v_sub_id, v_member.user_id, true, auth.uid())
      ON CONFLICT (subscription_id, user_id) DO UPDATE SET is_active = true, revoked_at = NULL;
      PERFORM public.refresh_user_subscription_tier(v_member.user_id);
    END LOOP;
  END IF;

  PERFORM public.write_audit_log('super_admin_grant_subscription', 'subscription', v_sub_id, NULL,
    jsonb_build_object('user_id', p_user_id, 'clinic_id', p_clinic_id, 'plan_slug', p_plan_slug, 'is_lifetime', p_is_lifetime, 'period_end', v_period_end, 'grant_reason', p_grant_reason, 'protected', p_protected),
    p_clinic_id, NULL
  );

  RETURN jsonb_build_object('subscription_id', v_sub_id, 'status', 'active', 'period_end', v_period_end);
END;
$$;

-- 6. Enriched super_admin_list_users (adds account_limits, clinics with seat limits, enterprise orgs with license totals)
CREATE OR REPLACE FUNCTION public.super_admin_list_users(
  p_search text DEFAULT NULL, p_role text DEFAULT NULL, p_tier text DEFAULT NULL,
  p_origin text DEFAULT NULL, p_limit int DEFAULT 100, p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', up.id, 'email', up.email, 'full_name', up.full_name, 'specialty', up.specialty, 'phone', up.phone,
      'general_license', up.general_license, 'specialist_license', up.specialist_license,
      'role', up.role, 'is_active', up.is_active, 'status', up.status, 'subscription_tier', up.subscription_tier,
      'feature_overrides', up.feature_overrides, 'account_limits', COALESCE(up.account_limits, '{}'::jsonb), 'admin_notes', up.admin_notes,
      'terms_accepted_at', up.terms_accepted_at, 'privacy_sensitive_accepted_at', up.privacy_sensitive_accepted_at,
      'consent_revoked_at', up.consent_revoked_at, 'last_seen_at', up.last_seen_at, 'created_at', up.created_at,
      'patients_count', (SELECT COUNT(*) FROM public.patients p WHERE p.user_id = up.id),
      'treatments_count', (SELECT COUNT(*) FROM public.treatments t WHERE t.user_id = up.id),
      'clinics', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'clinic_id', c.id,
          'name', c.name,
          'role_in_clinic', cur.role_in_clinic,
          'status', cur.status,
          'members_count', (SELECT COUNT(*) FROM public.clinic_user_relationships m WHERE m.clinic_id = c.id AND m.is_active = true),
          'active_seat_limit', (
            SELECT s.seat_limit FROM public.subscriptions s
            WHERE s.clinic_id = c.id AND s.status IN ('active', 'trialing', 'past_due')
            ORDER BY s.created_at DESC LIMIT 1
          ),
          'active_plan_name', (
            SELECT sp.name FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id
            WHERE s.clinic_id = c.id AND s.status IN ('active', 'trialing', 'past_due')
            ORDER BY s.created_at DESC LIMIT 1
          )
        ))
        FROM public.clinic_user_relationships cur
        JOIN public.clinics c ON c.id = cur.clinic_id
        WHERE cur.user_id = up.id AND cur.is_active = true
      ), '[]'::jsonb),
      'enterprise_orgs', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', ea.id,
          'name', ea.name,
          'brand_display_name', ea.brand_display_name,
          'organization_type', ea.organization_type,
          'role_in_org', eam.role_in_org,
          'status', ea.status,
          'total_licenses', COALESCE((SELECT SUM(b.total_licenses) FROM public.enterprise_license_batches b WHERE b.enterprise_account_id = ea.id AND b.status = 'active'), 0),
          'active_licenses', (SELECT COUNT(*) FROM public.enterprise_licenses l WHERE l.enterprise_account_id = ea.id AND l.status = 'active')
        ))
        FROM public.enterprise_account_managers eam
        JOIN public.enterprise_accounts ea ON ea.id = eam.enterprise_account_id
        WHERE eam.user_id = up.id AND eam.is_active = true
      ), '[]'::jsonb),
      'active_subscription', (
        SELECT jsonb_build_object(
          'id', s.id, 'plan_slug', sp.slug, 'plan_name', sp.name, 'tier', sp.tier, 'status', s.status,
          'origin', s.origin, 'billing_interval', s.billing_interval, 'seat_limit', s.seat_limit,
          'price_cents_at_signup', s.price_cents_at_signup, 'payment_processor', s.payment_processor,
          'cancel_at_period_end', s.cancel_at_period_end, 'notes', s.notes,
          'current_period_end', s.current_period_end, 'is_founder', s.is_founder,
          'protected_from_auto_downgrade', s.protected_from_auto_downgrade,
          'grant_reason', s.grant_reason, 'sponsor_name', ea.brand_display_name
        )
        FROM public.subscriptions s
        JOIN public.subscription_plans sp ON sp.id = s.plan_id
        LEFT JOIN public.enterprise_accounts ea ON ea.id = s.enterprise_account_id
        WHERE s.user_id = up.id AND s.subscriber_type = 'individual' AND s.status IN ('active', 'trialing', 'past_due')
        ORDER BY CASE s.origin WHEN 'admin_grant' THEN 1 WHEN 'enterprise_license' THEN 2 ELSE 3 END, s.created_at DESC
        LIMIT 1
      )
    ) AS row_data
    FROM public.user_profiles up
    WHERE (
      p_search IS NULL OR trim(p_search) = ''
      OR up.full_name ILIKE '%' || trim(p_search) || '%'
      OR up.email ILIKE '%' || trim(p_search) || '%'
      OR up.specialty ILIKE '%' || trim(p_search) || '%'
      OR up.general_license ILIKE '%' || trim(p_search) || '%'
    )
    AND (p_role IS NULL OR p_role = 'all' OR up.role = p_role)
    AND (p_tier IS NULL OR p_tier = 'all' OR up.subscription_tier = p_tier)
    AND (p_origin IS NULL OR p_origin = 'all' OR EXISTS (
      SELECT 1 FROM public.subscriptions s WHERE s.user_id = up.id AND s.status IN ('active', 'trialing') AND s.origin = p_origin
    ))
    ORDER BY up.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 300) OFFSET GREATEST(p_offset, 0)
  ) sub;
  RETURN v_rows;
END;
$$;

-- 7. Enriched super_admin_list_billing_overview
CREATE OR REPLACE FUNCTION public.super_admin_list_billing_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN jsonb_build_object(
    'subscriptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'subscriber_type', s.subscriber_type, 'user_id', s.user_id, 'clinic_id', s.clinic_id,
        'user_name', up.full_name, 'user_email', up.email, 'clinic_name', c.name, 'sponsor_name', ea.brand_display_name,
        'plan_id', s.plan_id, 'plan_slug', sp.slug, 'plan_name', sp.name, 'tier', sp.tier,
        'status', s.status, 'origin', s.origin, 'billing_interval', s.billing_interval, 'seat_limit', s.seat_limit,
        'price_cents_at_signup', s.price_cents_at_signup, 'is_founder', s.is_founder,
        'protected_from_auto_downgrade', s.protected_from_auto_downgrade, 'cancel_at_period_end', s.cancel_at_period_end,
        'grant_reason', s.grant_reason, 'notes', s.notes, 'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end, 'payment_processor', s.payment_processor,
        'created_at', s.created_at, 'updated_at', s.updated_at
      ) ORDER BY s.created_at DESC)
      FROM (SELECT * FROM public.subscriptions ORDER BY created_at DESC LIMIT 300) s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN public.user_profiles up ON up.id = s.user_id
      LEFT JOIN public.clinics c ON c.id = s.clinic_id
      LEFT JOIN public.enterprise_accounts ea ON ea.id = s.enterprise_account_id
    ), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bp.id, 'invoice_number', bi.invoice_number, 'user_email', up.email, 'clinic_name', c.name, 'enterprise_name', ea.name,
        'amount_cents', bp.amount_cents, 'currency', bp.currency, 'payment_method', bp.payment_method, 'processor', bp.processor,
        'reference_code', bp.reference_code, 'status', bp.status, 'paid_at', bp.paid_at
      ) ORDER BY bp.paid_at DESC)
      FROM (SELECT * FROM public.billing_payments ORDER BY paid_at DESC LIMIT 100) bp
      LEFT JOIN public.billing_invoices bi ON bi.id = bp.invoice_id
      LEFT JOIN public.user_profiles up ON up.id = bp.user_id
      LEFT JOIN public.clinics c ON c.id = bp.clinic_id
      LEFT JOIN public.enterprise_accounts ea ON ea.id = bp.enterprise_account_id
    ), '[]'::jsonb),
    'promo_codes', COALESCE((SELECT jsonb_agg(to_jsonb(pc) ORDER BY pc.created_at DESC) FROM public.promo_codes pc), '[]'::jsonb),
    'webhooks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', w.id, 'processor', w.processor, 'external_event_id', w.external_event_id, 'event_type', w.event_type, 'status', w.status, 'error_message', w.error_message, 'processed_at', w.processed_at, 'created_at', w.created_at) ORDER BY w.created_at DESC)
      FROM (SELECT * FROM public.billing_webhook_events ORDER BY created_at DESC LIMIT 50) w
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_update_subscription(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_user_account(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_clinic_seat_limit(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_remove_clinic_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_remove_enterprise_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_grant_subscription(uuid, uuid, text, text, int, timestamptz, boolean, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_users(text, text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_billing_overview() TO authenticated;

-- 8. Clinic Owner / Clinic Admin Self-Service RPCs (guarded by is_clinic_admin)
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
  v_active_sub jsonb := NULL;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN
    RAISE EXCEPTION 'Forbidden: se requiere rol de administrador u owner de esta clínica.';
  END IF;

  SELECT * INTO v_clinic FROM public.clinics WHERE id = p_clinic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Clínica no encontrada.';
  END IF;

  SELECT * INTO v_config FROM public.clinic_configurations WHERE clinic_id = p_clinic_id;

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

  IF FOUND THEN
    v_active_sub := jsonb_build_object(
      'id', v_sub.id,
      'plan_slug', v_sub.plan_slug,
      'plan_name', v_sub.plan_name,
      'tier', v_sub.tier,
      'status', v_sub.status,
      'origin', v_sub.origin,
      'billing_interval', v_sub.billing_interval,
      'seat_limit', v_sub.seat_limit,
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
        'has_seat', COALESCE((
          SELECT ss.is_active
          FROM public.subscription_seats ss
          WHERE ss.subscription_id = v_sub.id AND ss.user_id = cur.user_id
          LIMIT 1
        ), false)
      ) ORDER BY CASE cur.role_in_clinic WHEN 'owner' THEN 1 WHEN 'director' THEN 2 WHEN 'clinic_admin' THEN 3 WHEN 'specialist' THEN 4 ELSE 5 END, cur.created_at ASC)
      FROM public.clinic_user_relationships cur
      LEFT JOIN public.user_profiles up ON up.id = cur.user_id
      WHERE cur.clinic_id = p_clinic_id AND cur.is_active = true
    ), '[]'::jsonb),
    'patients_count', (SELECT COUNT(*) FROM public.patients WHERE clinic_id = p_clinic_id),
    'treatments_count', (SELECT COUNT(*) FROM public.treatments WHERE clinic_id = p_clinic_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clinic_admin_update_clinic(p_clinic_id uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
  v_new record;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN
    RAISE EXCEPTION 'Forbidden: no administras esta clínica.';
  END IF;

  SELECT * INTO v_old FROM public.clinics WHERE id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clínica no encontrada.'; END IF;

  UPDATE public.clinics
  SET
    name = COALESCE(NULLIF(trim(coalesce(p_payload ->> 'name', '')), ''), name),
    type = COALESCE(NULLIF(trim(coalesce(p_payload ->> 'type', '')), ''), type),
    city = CASE WHEN p_payload ? 'city' THEN NULLIF(trim(coalesce(p_payload ->> 'city', '')), '') ELSE city END,
    address = CASE WHEN p_payload ? 'address' THEN NULLIF(trim(coalesce(p_payload ->> 'address', '')), '') ELSE address END,
    phone = CASE WHEN p_payload ? 'phone' THEN NULLIF(trim(coalesce(p_payload ->> 'phone', '')), '') ELSE phone END,
    email = CASE WHEN p_payload ? 'email' THEN NULLIF(trim(coalesce(p_payload ->> 'email', '')), '') ELSE email END,
    tax_id = CASE WHEN p_payload ? 'tax_id' THEN NULLIF(trim(coalesce(p_payload ->> 'tax_id', '')), '') ELSE tax_id END,
    license_number = CASE WHEN p_payload ? 'license_number' THEN NULLIF(trim(coalesce(p_payload ->> 'license_number', '')), '') ELSE license_number END,
    director_name = CASE WHEN p_payload ? 'director_name' THEN NULLIF(trim(coalesce(p_payload ->> 'director_name', '')), '') ELSE director_name END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_clinic_id
  RETURNING * INTO v_new;

  PERFORM public.write_audit_log(
    'clinic_admin_update_clinic',
    'clinic',
    p_clinic_id,
    to_jsonb(v_old),
    to_jsonb(v_new),
    p_clinic_id,
    NULL
  );

  RETURN to_jsonb(v_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.clinic_admin_manage_member(
  p_clinic_id uuid,
  p_user_email text,
  p_role_in_clinic text DEFAULT 'specialist',
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_existing record;
  v_sub record;
  v_active_count int;
  v_other_owners int;
  v_res record;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN
    RAISE EXCEPTION 'Forbidden: no administras esta clínica.';
  END IF;

  IF p_role_in_clinic NOT IN ('owner', 'director', 'clinic_admin', 'specialist', 'assistant') THEN
    RAISE EXCEPTION 'Puesto en clínica no válido.';
  END IF;

  SELECT * INTO v_user FROM public.user_profiles WHERE lower(email) = lower(trim(p_user_email)) LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe ninguna cuenta registrada en SonoTox con el correo %. Pídele que se registre primero.', p_user_email;
  END IF;

  SELECT * INTO v_existing
  FROM public.clinic_user_relationships
  WHERE clinic_id = p_clinic_id AND user_id = v_user.id;

  -- Prevent non-superadmin from removing/demoting the last active owner
  IF FOUND AND v_existing.role_in_clinic = 'owner' AND (p_role_in_clinic <> 'owner' OR NOT p_is_active) AND NOT public.is_super_admin() THEN
    SELECT COUNT(*) INTO v_other_owners
    FROM public.clinic_user_relationships
    WHERE clinic_id = p_clinic_id AND role_in_clinic = 'owner' AND is_active = true AND status = 'approved' AND user_id <> v_user.id;
    IF v_other_owners = 0 THEN
      RAISE EXCEPTION 'No puedes degradar ni desactivar al último Owner activo de la clínica.';
    END IF;
  END IF;

  -- Check seat limit when adding a new active member
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE clinic_id = p_clinic_id AND subscriber_type = 'clinic' AND status IN ('active', 'trialing')
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND AND p_is_active AND (v_existing.id IS NULL OR NOT v_existing.is_active) THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.clinic_user_relationships
    WHERE clinic_id = p_clinic_id AND is_active = true AND status = 'approved';

    IF v_active_count >= GREATEST(COALESCE(v_sub.seat_limit, 1), 1) THEN
      RAISE EXCEPTION 'Has alcanzado el límite de % asientos de tu clínica. Solicita más asientos o actualiza tu plan.', v_sub.seat_limit;
    END IF;
  END IF;

  INSERT INTO public.clinic_user_relationships (clinic_id, user_id, role_in_clinic, status, is_active, approved_by, approved_at)
  VALUES (p_clinic_id, v_user.id, p_role_in_clinic, CASE WHEN p_is_active THEN 'approved' ELSE 'suspended' END, p_is_active, auth.uid(), timezone('utc'::text, now()))
  ON CONFLICT (clinic_id, user_id) DO UPDATE SET
    role_in_clinic = EXCLUDED.role_in_clinic,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_res;

  IF v_sub.id IS NOT NULL THEN
    INSERT INTO public.subscription_seats (subscription_id, user_id, is_active, assigned_by, revoked_at)
    VALUES (v_sub.id, v_user.id, p_is_active, auth.uid(), CASE WHEN p_is_active THEN NULL ELSE timezone('utc'::text, now()) END)
    ON CONFLICT (subscription_id, user_id) DO UPDATE SET
      is_active = EXCLUDED.is_active,
      revoked_at = EXCLUDED.revoked_at;
  END IF;

  PERFORM public.refresh_user_subscription_tier(v_user.id);

  PERFORM public.write_audit_log(
    'clinic_admin_manage_member',
    'clinic_user_relationship',
    v_res.id,
    NULL,
    jsonb_build_object('email', v_user.email, 'role_in_clinic', p_role_in_clinic, 'is_active', p_is_active),
    p_clinic_id,
    NULL
  );

  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.clinic_admin_remove_member(p_clinic_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target record;
  v_other_owners int;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN
    RAISE EXCEPTION 'Forbidden: no administras esta clínica.';
  END IF;

  SELECT * INTO v_target
  FROM public.clinic_user_relationships
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_target.role_in_clinic = 'owner' AND NOT public.is_super_admin() THEN
    SELECT COUNT(*) INTO v_other_owners
    FROM public.clinic_user_relationships
    WHERE clinic_id = p_clinic_id AND role_in_clinic = 'owner' AND is_active = true AND status = 'approved' AND user_id <> p_user_id;
    IF v_other_owners = 0 THEN
      RAISE EXCEPTION 'No puedes desvincular al último Owner activo de la clínica.';
    END IF;
  END IF;

  UPDATE public.clinic_user_relationships
  SET is_active = false, status = 'suspended', updated_at = timezone('utc'::text, now())
  WHERE clinic_id = p_clinic_id AND user_id = p_user_id;

  UPDATE public.subscription_seats ss
  SET is_active = false, revoked_at = timezone('utc'::text, now())
  FROM public.subscriptions s
  WHERE ss.subscription_id = s.id AND s.clinic_id = p_clinic_id AND ss.user_id = p_user_id;

  PERFORM public.refresh_user_subscription_tier(p_user_id);

  PERFORM public.write_audit_log(
    'clinic_admin_remove_member',
    'clinic_user_relationship',
    p_user_id,
    NULL,
    jsonb_build_object('clinic_id', p_clinic_id, 'user_id', p_user_id),
    p_clinic_id,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinic_admin_get_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_admin_update_clinic(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_admin_manage_member(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clinic_admin_remove_member(uuid, uuid) TO authenticated;
