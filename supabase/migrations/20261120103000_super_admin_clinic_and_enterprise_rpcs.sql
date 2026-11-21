-- ============================================================================
-- Migration 4: SECURITY DEFINER RPCs for Self-Service Launch Claim,
--              Promo & Enterprise Voucher Redemption (x20 Batches),
--              SuperAdmin Operations, Enterprise Portal & Clinic Admin
-- 100% Idempotent (CREATE OR REPLACE)
-- ============================================================================

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
    jsonb_build_object('plan_slug', p_plan_slug, 'interval', p_billing_interval, 'price_cents', 0)
  );

  RETURN public.get_my_entitlements();
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_promo_or_enterprise_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_norm_code text := upper(trim(coalesce(p_code, '')));
  v_voucher record;
  v_account record;
  v_total_pool int;
  v_used_pool int;
  v_prem_plan_id uuid;
  v_license_id uuid;
  v_sub_id uuid;
  v_expires_at timestamptz := NULL;
  v_promo record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(v_norm_code) < 3 THEN RAISE EXCEPTION 'Ingresa un código válido.'; END IF;

  SELECT * INTO v_voucher FROM public.enterprise_vouchers WHERE upper(code) = v_norm_code FOR UPDATE;

  IF FOUND THEN
    IF NOT v_voucher.is_active THEN RAISE EXCEPTION 'Este cupón Enterprise ya no está activo.'; END IF;
    IF v_voucher.valid_from > timezone('utc'::text, now()) THEN RAISE EXCEPTION 'Este cupón aún no inicia vigencia.'; END IF;
    IF v_voucher.valid_until IS NOT NULL AND v_voucher.valid_until < timezone('utc'::text, now()) THEN RAISE EXCEPTION 'Este cupón ha expirado.'; END IF;
    IF v_voucher.times_redeemed >= v_voucher.max_redemptions THEN RAISE EXCEPTION 'Este cupón ya alcanzó el límite máximo de usos.'; END IF;

    SELECT * INTO v_account FROM public.enterprise_accounts WHERE id = v_voucher.enterprise_account_id FOR UPDATE;
    IF NOT FOUND OR v_account.status NOT IN ('active', 'trial') THEN
      RAISE EXCEPTION 'La cuenta corporativa patrocinadora no está activa.';
    END IF;

    IF EXISTS (SELECT 1 FROM public.enterprise_licenses WHERE enterprise_account_id = v_account.id AND user_id = v_uid AND status = 'active') THEN
      RAISE EXCEPTION 'Ya tienes una licencia Premium activa patrocinada por %.', v_account.brand_display_name;
    END IF;

    SELECT COALESCE(SUM(total_licenses), 0) INTO v_total_pool
    FROM public.enterprise_license_batches
    WHERE enterprise_account_id = v_account.id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()));

    SELECT COUNT(*) INTO v_used_pool
    FROM public.enterprise_licenses
    WHERE enterprise_account_id = v_account.id AND status = 'active'
      AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()));

    IF v_used_pool >= v_total_pool THEN
      RAISE EXCEPTION 'Todas las licencias disponibles de % han sido asignadas (% / %).', v_account.brand_display_name, v_used_pool, v_total_pool;
    END IF;

    SELECT id INTO v_prem_plan_id FROM public.subscription_plans WHERE slug = 'premium_solo' LIMIT 1;

    IF v_voucher.license_duration_days IS NOT NULL THEN
      v_expires_at := timezone('utc'::text, now()) + make_interval(days => v_voucher.license_duration_days);
    ELSIF v_account.default_license_duration_days IS NOT NULL THEN
      v_expires_at := timezone('utc'::text, now()) + make_interval(days => v_account.default_license_duration_days);
    END IF;

    INSERT INTO public.subscriptions (
      subscriber_type, user_id, clinic_id, enterprise_account_id, plan_id,
      status, origin, billing_interval, seat_limit, price_cents_at_signup,
      protected_from_auto_downgrade, grant_reason, current_period_start,
      current_period_end, payment_processor, notes, created_by
    )
    VALUES (
      'individual', v_uid, NULL, v_account.id, v_prem_plan_id,
      'active', 'enterprise_license', 'annual', 1, 0,
      true, 'Licencia Enterprise patrocinada por ' || v_account.brand_display_name,
      timezone('utc'::text, now()), v_expires_at, 'comped', 'Cupón: ' || v_voucher.code, v_uid
    )
    RETURNING id INTO v_sub_id;

    INSERT INTO public.enterprise_licenses (enterprise_account_id, voucher_id, user_id, subscription_id, status, expires_at)
    VALUES (v_account.id, v_voucher.id, v_uid, v_sub_id, 'active', v_expires_at)
    RETURNING id INTO v_license_id;

    UPDATE public.subscriptions SET enterprise_license_id = v_license_id WHERE id = v_sub_id;
    UPDATE public.enterprise_vouchers SET times_redeemed = times_redeemed + 1 WHERE id = v_voucher.id;

    PERFORM public.write_audit_log(
      'enterprise_voucher_redeemed', 'enterprise_license', v_license_id, NULL,
      jsonb_build_object('code', v_voucher.code, 'enterprise_account_id', v_account.id, 'brand_display_name', v_account.brand_display_name, 'user_id', v_uid),
      NULL, v_account.id
    );

    RETURN jsonb_build_object(
      'kind', 'enterprise_license',
      'message', format('¡Licencia Premium activada! Patrocinada por %s. Tu consultorio y pacientes son 100%% privados.', v_account.brand_display_name),
      'sponsor', v_account.brand_display_name,
      'entitlements', public.get_my_entitlements()
    );
  END IF;

  SELECT * INTO v_promo FROM public.promo_codes WHERE upper(code) = v_norm_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código no encontrado. Verifica mayúsculas y guiones.'; END IF;
  IF NOT v_promo.is_active THEN RAISE EXCEPTION 'Este código promocional ya no está activo.'; END IF;
  IF v_promo.valid_from IS NOT NULL AND v_promo.valid_from > timezone('utc'::text, now()) THEN RAISE EXCEPTION 'Este código aún no está vigente.'; END IF;
  IF v_promo.valid_until IS NOT NULL AND v_promo.valid_until < timezone('utc'::text, now()) THEN RAISE EXCEPTION 'Este código promocional ha expirado.'; END IF;
  IF v_promo.max_redemptions IS NOT NULL AND v_promo.times_redeemed >= v_promo.max_redemptions THEN RAISE EXCEPTION 'Este código promocional alcanzó su límite de usos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.promo_code_redemptions WHERE promo_code_id = v_promo.id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Ya canjeaste este código anteriormente.';
  END IF;

  IF 'premium' = ANY(v_promo.applicable_tiers) THEN
    SELECT id INTO v_prem_plan_id FROM public.subscription_plans WHERE slug = 'premium_solo' LIMIT 1;
  ELSE
    SELECT id INTO v_prem_plan_id FROM public.subscription_plans WHERE slug = 'plus_solo' LIMIT 1;
  END IF;

  IF v_promo.discount_type = 'trial_days' THEN
    v_expires_at := timezone('utc'::text, now()) + make_interval(days => v_promo.discount_value);
  ELSIF v_promo.discount_type = 'free_months' THEN
    v_expires_at := timezone('utc'::text, now()) + make_interval(months => v_promo.discount_value);
  ELSE
    v_expires_at := timezone('utc'::text, now()) + interval '30 days';
  END IF;

  INSERT INTO public.subscriptions (
    subscriber_type, user_id, plan_id, status, origin, billing_interval,
    seat_limit, price_cents_at_signup, grant_reason, current_period_start,
    current_period_end, payment_processor, notes, metadata, created_by
  )
  VALUES (
    'individual', v_uid, v_prem_plan_id,
    CASE WHEN v_promo.discount_type = 'trial_days' THEN 'trialing' ELSE 'active' END,
    'promo_code', 'custom', 1, 0, 'Código promocional: ' || v_promo.code,
    timezone('utc'::text, now()), v_expires_at, 'comped', v_promo.description,
    jsonb_build_object('promo_code', v_promo.code, 'discount_type', v_promo.discount_type, 'discount_value', v_promo.discount_value),
    v_uid
  )
  RETURNING id INTO v_sub_id;

  INSERT INTO public.promo_code_redemptions (promo_code_id, user_id, subscription_id) VALUES (v_promo.id, v_uid, v_sub_id);
  UPDATE public.promo_codes SET times_redeemed = times_redeemed + 1 WHERE id = v_promo.id;

  PERFORM public.write_audit_log('promo_code_redeemed', 'promo_code', v_promo.id, NULL, jsonb_build_object('code', v_promo.code, 'user_id', v_uid, 'subscription_id', v_sub_id));

  RETURN jsonb_build_object('kind', 'promo_code', 'message', format('¡Código %s aplicado correctamente!', v_promo.code), 'entitlements', public.get_my_entitlements());
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_global_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings record;
  v_users_total int; v_users_active_30d int; v_users_new_7d int; v_users_enterprise int;
  v_tier_free int; v_tier_plus int; v_tier_premium int;
  v_origin_launch int; v_origin_admin int; v_origin_enterprise int; v_origin_paid int;
  v_mrr_collected_cents bigint; v_mrr_projected_cents bigint; v_past_due_count int;
  v_clinics_total int; v_clinics_active int;
  v_ent_accounts int; v_ent_licenses_sold int; v_ent_licenses_active int;
  v_patients_total int; v_treatments_30d int; v_consultations_30d int; v_arco_pending int;
  v_stripe_plans_total int; v_stripe_plans_linked int; v_brand_breakdown jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden: super_admin required'; END IF;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE last_seen_at >= now() - interval '30 days'),
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    COUNT(*) FILTER (WHERE role = 'enterprise'),
    COUNT(*) FILTER (WHERE subscription_tier = 'free' AND role <> 'enterprise'),
    COUNT(*) FILTER (WHERE subscription_tier = 'plus'),
    COUNT(*) FILTER (WHERE subscription_tier = 'premium' AND role <> 'enterprise')
  INTO v_users_total, v_users_active_30d, v_users_new_7d, v_users_enterprise, v_tier_free, v_tier_plus, v_tier_premium
  FROM public.user_profiles;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('active','trialing') AND origin = 'launch_promo'),
    COUNT(*) FILTER (WHERE status IN ('active','trialing') AND origin = 'admin_grant'),
    COUNT(*) FILTER (WHERE status IN ('active','trialing') AND origin = 'enterprise_license'),
    COUNT(*) FILTER (WHERE status IN ('active','trialing') AND origin IN ('stripe','mercadopago','manual_payment')),
    COUNT(*) FILTER (WHERE status = 'past_due'),
    COALESCE(SUM(sp.price_monthly_cents) FILTER (WHERE s.status IN ('active','trialing') AND s.origin = 'launch_promo'), 0)
  INTO v_origin_launch, v_origin_admin, v_origin_enterprise, v_origin_paid, v_past_due_count, v_mrr_projected_cents
  FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_mrr_collected_cents
  FROM public.billing_payments WHERE status = 'succeeded' AND paid_at >= date_trunc('month', timezone('utc'::text, now()));

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active = true) INTO v_clinics_total, v_clinics_active FROM public.clinics;
  SELECT COUNT(*) INTO v_ent_accounts FROM public.enterprise_accounts WHERE status <> 'archived';
  SELECT COALESCE(SUM(total_licenses), 0) INTO v_ent_licenses_sold FROM public.enterprise_license_batches WHERE status = 'active';
  SELECT COUNT(*) INTO v_ent_licenses_active FROM public.enterprise_licenses WHERE status = 'active';

  SELECT COUNT(*) INTO v_patients_total FROM public.patients;
  SELECT COUNT(*) INTO v_treatments_30d FROM public.treatments WHERE created_at >= now() - interval '30 days';
  SELECT COUNT(*) INTO v_consultations_30d FROM public.consultations WHERE consultation_date >= now() - interval '30 days';
  SELECT COUNT(*) INTO v_arco_pending FROM public.arco_requests WHERE status IN ('pending', 'in_progress');

  SELECT
    COUNT(*) FILTER (WHERE price_monthly_cents > 0 AND is_active = true),
    COUNT(*) FILTER (WHERE price_monthly_cents > 0 AND is_active = true AND stripe_price_monthly_id IS NOT NULL AND stripe_price_monthly_id <> '')
  INTO v_stripe_plans_total, v_stripe_plans_linked FROM public.subscription_plans;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('brand', product_name, 'count', cnt)), '[]'::jsonb)
  INTO v_brand_breakdown
  FROM (SELECT product_name, COUNT(*) AS cnt FROM public.treatments WHERE created_at >= now() - interval '30 days' GROUP BY product_name ORDER BY cnt DESC LIMIT 6) b;

  RETURN jsonb_build_object(
    'platform_settings', to_jsonb(v_settings),
    'users', jsonb_build_object(
      'total', v_users_total, 'active_30d', v_users_active_30d, 'new_7d', v_users_new_7d, 'enterprise_users', v_users_enterprise,
      'by_tier', jsonb_build_object('free', v_tier_free, 'plus', v_tier_plus, 'premium', v_tier_premium),
      'by_origin', jsonb_build_object('launch_promo', v_origin_launch, 'admin_grant', v_origin_admin, 'enterprise_license', v_origin_enterprise, 'paid', v_origin_paid)
    ),
    'billing', jsonb_build_object(
      'mrr_collected_cents', v_mrr_collected_cents, 'mrr_projected_launch_cents', v_mrr_projected_cents,
      'past_due_count', v_past_due_count, 'stripe_plans_total', v_stripe_plans_total, 'stripe_plans_linked', v_stripe_plans_linked
    ),
    'clinics', jsonb_build_object('total', v_clinics_total, 'active', v_clinics_active),
    'enterprise', jsonb_build_object('accounts', v_ent_accounts, 'licenses_sold', v_ent_licenses_sold, 'licenses_active', v_ent_licenses_active, 'licenses_available', GREATEST(v_ent_licenses_sold - v_ent_licenses_active, 0)),
    'clinical', jsonb_build_object('patients_total', v_patients_total, 'treatments_30d', v_treatments_30d, 'consultations_30d', v_consultations_30d, 'brand_breakdown', v_brand_breakdown),
    'compliance', jsonb_build_object('arco_pending', v_arco_pending)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_update_platform_settings(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_old record; v_new record; v_new_mode text; v_unlinked int;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_old FROM public.platform_settings WHERE id = 1;
  v_new_mode := COALESCE(p_payload ->> 'billing_mode', v_old.billing_mode);

  IF v_new_mode = 'stripe_live' AND COALESCE((p_payload ->> 'force_stripe_live')::boolean, false) = false THEN
    SELECT COUNT(*) INTO v_unlinked FROM public.subscription_plans
    WHERE price_monthly_cents > 0 AND is_active = true AND (stripe_price_monthly_id IS NULL OR stripe_price_monthly_id = '');
    IF v_unlinked > 0 THEN
      RAISE EXCEPTION 'Pre-Flight Stripe: faltan % planes activos por vincular con stripe_price_monthly_id antes de activar cobros reales.', v_unlinked;
    END IF;
  END IF;

  UPDATE public.platform_settings
  SET
    billing_mode = v_new_mode,
    launch_promo_banner_enabled = COALESCE((p_payload ->> 'launch_promo_banner_enabled')::boolean, launch_promo_banner_enabled),
    launch_promo_banner_text = COALESCE(p_payload ->> 'launch_promo_banner_text', launch_promo_banner_text),
    launch_promo_ends_at = CASE WHEN p_payload ? 'launch_promo_ends_at' THEN NULLIF(p_payload ->> 'launch_promo_ends_at', '')::timestamptz ELSE launch_promo_ends_at END,
    launch_default_grant_days = CASE WHEN p_payload ? 'launch_default_grant_days' THEN NULLIF(p_payload ->> 'launch_default_grant_days', '')::int ELSE launch_default_grant_days END,
    founder_discount_percent = COALESCE((p_payload ->> 'founder_discount_percent')::int, founder_discount_percent),
    enforce_entitlements = COALESCE((p_payload ->> 'enforce_entitlements')::boolean, enforce_entitlements),
    updated_by = auth.uid(),
    updated_at = timezone('utc'::text, now())
  WHERE id = 1 RETURNING * INTO v_new;

  PERFORM public.write_audit_log('super_admin_update_platform_settings', 'platform_settings', NULL, to_jsonb(v_old), to_jsonb(v_new));
  RETURN to_jsonb(v_new);
END;
$$;

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
      'feature_overrides', up.feature_overrides, 'admin_notes', up.admin_notes,
      'terms_accepted_at', up.terms_accepted_at, 'privacy_sensitive_accepted_at', up.privacy_sensitive_accepted_at,
      'consent_revoked_at', up.consent_revoked_at, 'last_seen_at', up.last_seen_at, 'created_at', up.created_at,
      'patients_count', (SELECT COUNT(*) FROM public.patients p WHERE p.user_id = up.id),
      'treatments_count', (SELECT COUNT(*) FROM public.treatments t WHERE t.user_id = up.id),
      'active_subscription', (
        SELECT jsonb_build_object(
          'id', s.id, 'plan_slug', sp.slug, 'plan_name', sp.name, 'tier', sp.tier, 'status', s.status,
          'origin', s.origin, 'billing_interval', s.billing_interval, 'current_period_end', s.current_period_end,
          'is_founder', s.is_founder, 'protected_from_auto_downgrade', s.protected_from_auto_downgrade,
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
DECLARE v_plan record; v_sub_type text; v_period_end timestamptz := NULL; v_sub_id uuid;
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

  PERFORM public.write_audit_log('super_admin_grant_subscription', 'subscription', v_sub_id, NULL,
    jsonb_build_object('user_id', p_user_id, 'clinic_id', p_clinic_id, 'plan_slug', p_plan_slug, 'is_lifetime', p_is_lifetime, 'period_end', v_period_end, 'grant_reason', p_grant_reason, 'protected', p_protected),
    p_clinic_id, NULL
  );

  RETURN jsonb_build_object('subscription_id', v_sub_id, 'status', 'active', 'period_end', v_period_end);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_revoke_subscription(p_subscription_id uuid, p_reason text DEFAULT 'Revocado por SuperAdmin')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_old FROM public.subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suscripción no encontrada.'; END IF;

  UPDATE public.subscriptions SET status = 'canceled', canceled_at = timezone('utc'::text, now()), notes = concat_ws(' | ', notes, p_reason), updated_at = timezone('utc'::text, now()) WHERE id = p_subscription_id;
  IF v_old.enterprise_license_id IS NOT NULL THEN
    UPDATE public.enterprise_licenses SET status = 'revoked', revoked_at = timezone('utc'::text, now()), revoked_by = auth.uid(), revocation_reason = p_reason WHERE id = v_old.enterprise_license_id;
  END IF;
  PERFORM public.write_audit_log('super_admin_revoke_subscription', 'subscription', p_subscription_id, to_jsonb(v_old), jsonb_build_object('reason', p_reason), v_old.clinic_id, v_old.enterprise_account_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_update_user_overrides(p_user_id uuid, p_feature_overrides jsonb, p_admin_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT feature_overrides, admin_notes INTO v_old FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.user_profiles SET feature_overrides = COALESCE(p_feature_overrides, '{}'::jsonb), admin_notes = p_admin_notes, updated_at = timezone('utc'::text, now()) WHERE id = p_user_id;
  PERFORM public.write_audit_log('super_admin_update_user_overrides', 'user_profile', p_user_id, to_jsonb(v_old), jsonb_build_object('feature_overrides', p_feature_overrides, 'admin_notes', p_admin_notes));
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_set_user_role(p_user_id uuid, p_new_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old_role text; v_other_admins int;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_new_role NOT IN ('super_admin', 'support_admin', 'enterprise', 'specialist', 'assistant') THEN RAISE EXCEPTION 'Rol no válido.'; END IF;
  SELECT role INTO v_old_role FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;
  IF v_old_role = 'super_admin' AND p_new_role <> 'super_admin' THEN
    SELECT COUNT(*) INTO v_other_admins FROM public.user_profiles WHERE role = 'super_admin' AND is_active = true AND status = 'active' AND id <> p_user_id;
    IF v_other_admins = 0 THEN RAISE EXCEPTION 'No puedes degradar al último SuperAdmin activo de la plataforma.'; END IF;
  END IF;
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.user_profiles SET role = p_new_role, updated_at = timezone('utc'::text, now()) WHERE id = p_user_id;
  PERFORM public.refresh_user_subscription_tier(p_user_id);
  PERFORM public.write_audit_log('super_admin_set_user_role', 'user_profile', p_user_id, jsonb_build_object('role', v_old_role), jsonb_build_object('role', p_new_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_toggle_user_active(p_user_id uuid, p_is_active boolean, p_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old record; v_other_admins int; v_next_status text;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT role, is_active, status INTO v_old FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;
  v_next_status := COALESCE(p_status, CASE WHEN p_is_active THEN 'active' ELSE 'suspended' END);
  IF v_old.role = 'super_admin' AND (NOT p_is_active OR v_next_status <> 'active') THEN
    SELECT COUNT(*) INTO v_other_admins FROM public.user_profiles WHERE role = 'super_admin' AND is_active = true AND status = 'active' AND id <> p_user_id;
    IF v_other_admins = 0 THEN RAISE EXCEPTION 'No puedes suspender al último SuperAdmin activo.'; END IF;
  END IF;
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.user_profiles SET is_active = p_is_active, status = v_next_status, updated_at = timezone('utc'::text, now()) WHERE id = p_user_id;
  PERFORM public.write_audit_log('super_admin_toggle_user_active', 'user_profile', p_user_id, to_jsonb(v_old), jsonb_build_object('is_active', p_is_active, 'status', v_next_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_upsert_plan(p_plan jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := NULLIF(p_plan ->> 'id', '')::uuid; v_result record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.subscription_plans SET
      name = COALESCE(p_plan ->> 'name', name),
      description = COALESCE(p_plan ->> 'description', description),
      badge_text = CASE WHEN p_plan ? 'badge_text' THEN NULLIF(p_plan ->> 'badge_text', '') ELSE badge_text END,
      price_monthly_cents = COALESCE((p_plan ->> 'price_monthly_cents')::int, price_monthly_cents),
      price_annual_cents = COALESCE((p_plan ->> 'price_annual_cents')::int, price_annual_cents),
      currency = COALESCE(p_plan ->> 'currency', currency),
      max_seats = COALESCE((p_plan ->> 'max_seats')::int, max_seats),
      features = COALESCE(p_plan -> 'features', features),
      stripe_product_id = CASE WHEN p_plan ? 'stripe_product_id' THEN NULLIF(p_plan ->> 'stripe_product_id', '') ELSE stripe_product_id END,
      stripe_price_monthly_id = CASE WHEN p_plan ? 'stripe_price_monthly_id' THEN NULLIF(p_plan ->> 'stripe_price_monthly_id', '') ELSE stripe_price_monthly_id END,
      stripe_price_annual_id = CASE WHEN p_plan ? 'stripe_price_annual_id' THEN NULLIF(p_plan ->> 'stripe_price_annual_id', '') ELSE stripe_price_annual_id END,
      is_active = COALESCE((p_plan ->> 'is_active')::boolean, is_active),
      is_featured = COALESCE((p_plan ->> 'is_featured')::boolean, is_featured),
      sort_order = COALESCE((p_plan ->> 'sort_order')::int, sort_order),
      updated_at = timezone('utc'::text, now())
    WHERE id = v_id RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.subscription_plans (
      slug, tier, scope, name, description, badge_text, price_monthly_cents, price_annual_cents,
      currency, max_seats, features, stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id,
      is_active, is_featured, sort_order
    )
    VALUES (
      lower(trim(p_plan ->> 'slug')), p_plan ->> 'tier', COALESCE(p_plan ->> 'scope', 'individual'),
      p_plan ->> 'name', p_plan ->> 'description', NULLIF(p_plan ->> 'badge_text', ''),
      COALESCE((p_plan ->> 'price_monthly_cents')::int, 0), COALESCE((p_plan ->> 'price_annual_cents')::int, 0),
      COALESCE(p_plan ->> 'currency', 'MXN'), COALESCE((p_plan ->> 'max_seats')::int, 1),
      COALESCE(p_plan -> 'features', '{}'::jsonb), NULLIF(p_plan ->> 'stripe_product_id', ''),
      NULLIF(p_plan ->> 'stripe_price_monthly_id', ''), NULLIF(p_plan ->> 'stripe_price_annual_id', ''),
      COALESCE((p_plan ->> 'is_active')::boolean, true), COALESCE((p_plan ->> 'is_featured')::boolean, false),
      COALESCE((p_plan ->> 'sort_order')::int, 10)
    ) RETURNING * INTO v_result;
  END IF;
  PERFORM public.write_audit_log('super_admin_upsert_plan', 'subscription_plan', v_result.id, NULL, to_jsonb(v_result));
  RETURN to_jsonb(v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_record_manual_payment(
  p_subscription_id uuid DEFAULT NULL, p_user_id uuid DEFAULT NULL, p_clinic_id uuid DEFAULT NULL,
  p_enterprise_account_id uuid DEFAULT NULL, p_amount_cents int DEFAULT 0, p_currency text DEFAULT 'MXN',
  p_method text DEFAULT 'spei', p_reference text DEFAULT NULL, p_extend_days int DEFAULT 30, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub record; v_invoice_id uuid; v_payment_id uuid; v_invoice_num text;
  v_target_user uuid := p_user_id; v_target_clinic uuid := p_clinic_id; v_target_ent uuid := p_enterprise_account_id;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_subscription_id IS NOT NULL THEN
    SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
    IF FOUND THEN
      v_target_user := COALESCE(v_target_user, v_sub.user_id);
      v_target_clinic := COALESCE(v_target_clinic, v_sub.clinic_id);
      v_target_ent := COALESCE(v_target_ent, v_sub.enterprise_account_id);
    END IF;
  END IF;
  v_invoice_num := 'STX-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6));
  INSERT INTO public.billing_invoices (invoice_number, subscription_id, clinic_id, enterprise_account_id, user_id, amount_subtotal_cents, amount_total_cents, currency, status, paid_at, notes)
  VALUES (v_invoice_num, p_subscription_id, v_target_clinic, v_target_ent, v_target_user, p_amount_cents, p_amount_cents, COALESCE(p_currency, 'MXN'), 'paid', timezone('utc'::text, now()), p_notes)
  RETURNING id INTO v_invoice_id;
  INSERT INTO public.billing_payments (invoice_id, subscription_id, clinic_id, enterprise_account_id, user_id, amount_cents, currency, payment_method, processor, reference_code, status, recorded_by, paid_at)
  VALUES (v_invoice_id, p_subscription_id, v_target_clinic, v_target_ent, v_target_user, p_amount_cents, COALESCE(p_currency, 'MXN'), p_method, 'manual', p_reference, 'succeeded', auth.uid(), timezone('utc'::text, now()))
  RETURNING id INTO v_payment_id;
  IF p_subscription_id IS NOT NULL AND p_extend_days > 0 THEN
    UPDATE public.subscriptions SET status = 'active',
      origin = CASE WHEN origin IN ('free_default','launch_promo') THEN 'manual_payment' ELSE origin END,
      payment_processor = 'manual',
      current_period_end = GREATEST(COALESCE(current_period_end, timezone('utc'::text, now())), timezone('utc'::text, now())) + make_interval(days => p_extend_days),
      updated_at = timezone('utc'::text, now())
    WHERE id = p_subscription_id;
  END IF;
  PERFORM public.write_audit_log('super_admin_record_manual_payment', 'billing_payment', v_payment_id, NULL, jsonb_build_object('invoice_number', v_invoice_num, 'amount_cents', p_amount_cents, 'method', p_method, 'reference', p_reference, 'extend_days', p_extend_days), v_target_clinic, v_target_ent);
  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_num, 'payment_id', v_payment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_upsert_promo_code(p_promo jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := NULLIF(p_promo ->> 'id', '')::uuid; v_res record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.promo_codes SET
      description = COALESCE(p_promo ->> 'description', description),
      discount_type = COALESCE(p_promo ->> 'discount_type', discount_type),
      discount_value = COALESCE((p_promo ->> 'discount_value')::int, discount_value),
      max_redemptions = CASE WHEN p_promo ? 'max_redemptions' THEN NULLIF(p_promo ->> 'max_redemptions', '')::int ELSE max_redemptions END,
      valid_until = CASE WHEN p_promo ? 'valid_until' THEN NULLIF(p_promo ->> 'valid_until', '')::timestamptz ELSE valid_until END,
      stripe_coupon_id = CASE WHEN p_promo ? 'stripe_coupon_id' THEN NULLIF(p_promo ->> 'stripe_coupon_id', '') ELSE stripe_coupon_id END,
      is_active = COALESCE((p_promo ->> 'is_active')::boolean, is_active)
    WHERE id = v_id RETURNING * INTO v_res;
  ELSE
    INSERT INTO public.promo_codes (code, description, discount_type, discount_value, applicable_tiers, max_redemptions, valid_until, stripe_coupon_id, is_active, created_by)
    VALUES (
      upper(trim(p_promo ->> 'code')), p_promo ->> 'description', COALESCE(p_promo ->> 'discount_type', 'free_months'),
      COALESCE((p_promo ->> 'discount_value')::int, 1),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(p_promo -> 'applicable_tiers') AS t(x)), ARRAY['plus', 'premium']),
      NULLIF(p_promo ->> 'max_redemptions', '')::int, NULLIF(p_promo ->> 'valid_until', '')::timestamptz,
      NULLIF(p_promo ->> 'stripe_coupon_id', ''), COALESCE((p_promo ->> 'is_active')::boolean, true), auth.uid()
    ) RETURNING * INTO v_res;
  END IF;
  PERFORM public.write_audit_log('super_admin_upsert_promo_code', 'promo_code', v_res.id, NULL, to_jsonb(v_res));
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_upsert_announcement(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := NULLIF(p_payload ->> 'id', '')::uuid; v_res record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.platform_announcements SET
      title = COALESCE(p_payload ->> 'title', title),
      message = COALESCE(p_payload ->> 'message', message),
      variant = COALESCE(p_payload ->> 'variant', variant),
      cta_label = CASE WHEN p_payload ? 'cta_label' THEN NULLIF(p_payload ->> 'cta_label', '') ELSE cta_label END,
      cta_path = CASE WHEN p_payload ? 'cta_path' THEN NULLIF(p_payload ->> 'cta_path', '') ELSE cta_path END,
      is_active = COALESCE((p_payload ->> 'is_active')::boolean, is_active),
      ends_at = CASE WHEN p_payload ? 'ends_at' THEN NULLIF(p_payload ->> 'ends_at', '')::timestamptz ELSE ends_at END
    WHERE id = v_id RETURNING * INTO v_res;
  ELSE
    INSERT INTO public.platform_announcements (title, message, variant, target_tiers, target_origins, cta_label, cta_path, is_active, ends_at, created_by)
    VALUES (
      p_payload ->> 'title', p_payload ->> 'message', COALESCE(p_payload ->> 'variant', 'promo'),
      COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload -> 'target_tiers') AS t(x)), ARRAY['free', 'plus', 'premium']),
      CASE WHEN p_payload ? 'target_origins' AND jsonb_typeof(p_payload -> 'target_origins') = 'array'
        THEN (SELECT array_agg(x) FROM jsonb_array_elements_text(p_payload -> 'target_origins') AS t(x)) ELSE NULL END,
      NULLIF(p_payload ->> 'cta_label', ''), NULLIF(p_payload ->> 'cta_path', ''),
      COALESCE((p_payload ->> 'is_active')::boolean, true), NULLIF(p_payload ->> 'ends_at', '')::timestamptz, auth.uid()
    ) RETURNING * INTO v_res;
  END IF;
  PERFORM public.write_audit_log('super_admin_upsert_announcement', 'platform_announcement', v_res.id, NULL, to_jsonb(v_res));
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_upsert_enterprise_account(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := NULLIF(p_payload ->> 'id', '')::uuid; v_slug text; v_res record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.enterprise_accounts SET
      name = COALESCE(p_payload ->> 'name', name),
      organization_type = COALESCE(p_payload ->> 'organization_type', organization_type),
      brand_display_name = COALESCE(p_payload ->> 'brand_display_name', brand_display_name),
      logo_url = CASE WHEN p_payload ? 'logo_url' THEN NULLIF(p_payload ->> 'logo_url', '') ELSE logo_url END,
      contact_name = COALESCE(p_payload ->> 'contact_name', contact_name),
      contact_email = COALESCE(p_payload ->> 'contact_email', contact_email),
      contact_phone = COALESCE(p_payload ->> 'contact_phone', contact_phone),
      tax_id = COALESCE(p_payload ->> 'tax_id', tax_id),
      status = COALESCE(p_payload ->> 'status', status),
      allow_license_reassignment = COALESCE((p_payload ->> 'allow_license_reassignment')::boolean, allow_license_reassignment),
      default_license_duration_days = COALESCE((p_payload ->> 'default_license_duration_days')::int, default_license_duration_days),
      notes = COALESCE(p_payload ->> 'notes', notes),
      updated_at = timezone('utc'::text, now())
    WHERE id = v_id RETURNING * INTO v_res;
  ELSE
    v_slug := COALESCE(
      NULLIF(lower(regexp_replace(trim(p_payload ->> 'slug'), '[^a-z0-9-]+', '-', 'g')), ''),
      lower(regexp_replace(trim(p_payload ->> 'name'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 4)
    );
    INSERT INTO public.enterprise_accounts (
      name, slug, organization_type, brand_display_name, logo_url, contact_name, contact_email, contact_phone,
      tax_id, status, allow_license_reassignment, default_license_duration_days, notes, created_by
    )
    VALUES (
      trim(p_payload ->> 'name'), v_slug, COALESCE(p_payload ->> 'organization_type', 'pharma'),
      COALESCE(NULLIF(trim(p_payload ->> 'brand_display_name'), ''), trim(p_payload ->> 'name')),
      NULLIF(p_payload ->> 'logo_url', ''), NULLIF(p_payload ->> 'contact_name', ''),
      NULLIF(p_payload ->> 'contact_email', ''), NULLIF(p_payload ->> 'contact_phone', ''),
      NULLIF(p_payload ->> 'tax_id', ''), COALESCE(p_payload ->> 'status', 'active'),
      COALESCE((p_payload ->> 'allow_license_reassignment')::boolean, true),
      COALESCE((p_payload ->> 'default_license_duration_days')::int, 365), NULLIF(p_payload ->> 'notes', ''), auth.uid()
    ) RETURNING * INTO v_res;
  END IF;
  PERFORM public.write_audit_log('super_admin_upsert_enterprise_account', 'enterprise_account', v_res.id, NULL, to_jsonb(v_res), NULL, v_res.id);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_assign_enterprise_manager(
  p_enterprise_account_id uuid, p_user_email text, p_role_in_org text DEFAULT 'owner', p_set_enterprise_role boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user record; v_res record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_user FROM public.user_profiles WHERE lower(email) = lower(trim(p_user_email)) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe ningún usuario registrado con el correo %. Pídele que cree su cuenta primero.', p_user_email; END IF;
  INSERT INTO public.enterprise_account_managers (enterprise_account_id, user_id, role_in_org, is_active)
  VALUES (p_enterprise_account_id, v_user.id, COALESCE(p_role_in_org, 'owner'), true)
  ON CONFLICT (enterprise_account_id, user_id) DO UPDATE SET role_in_org = EXCLUDED.role_in_org, is_active = true
  RETURNING * INTO v_res;
  IF p_set_enterprise_role AND v_user.role <> 'super_admin' THEN
    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.user_profiles SET role = 'enterprise', updated_at = timezone('utc'::text, now()) WHERE id = v_user.id;
  END IF;
  PERFORM public.write_audit_log('super_admin_assign_enterprise_manager', 'enterprise_account_manager', v_res.id, NULL, jsonb_build_object('user_id', v_user.id, 'email', v_user.email, 'role_in_org', p_role_in_org), NULL, p_enterprise_account_id);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_add_enterprise_batch(
  p_enterprise_account_id uuid, p_batch_count int, p_billing_interval text DEFAULT 'annual',
  p_unit_batch_price_cents int DEFAULT 0, p_payment_processor text DEFAULT 'comped',
  p_status text DEFAULT 'active', p_expires_at timestamptz DEFAULT NULL,
  p_purchase_order_ref text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res record; v_total_cents int;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_batch_count IS NULL OR p_batch_count < 1 THEN RAISE EXCEPTION 'Debes agregar al menos 1 lote (20 licencias).'; END IF;
  v_total_cents := GREATEST(COALESCE(p_unit_batch_price_cents, 0), 0) * p_batch_count;
  INSERT INTO public.enterprise_license_batches (
    enterprise_account_id, batch_count, licenses_per_batch, billing_interval, unit_batch_price_cents,
    amount_total_cents, status, payment_processor, expires_at, purchase_order_ref, notes, created_by
  )
  VALUES (
    p_enterprise_account_id, p_batch_count, 20, COALESCE(p_billing_interval, 'annual'),
    GREATEST(COALESCE(p_unit_batch_price_cents, 0), 0), v_total_cents, COALESCE(p_status, 'active'),
    COALESCE(p_payment_processor, 'comped'), p_expires_at,
    NULLIF(trim(coalesce(p_purchase_order_ref, '')), ''), NULLIF(trim(coalesce(p_notes, '')), ''), auth.uid()
  ) RETURNING * INTO v_res;
  PERFORM public.write_audit_log('super_admin_add_enterprise_batch', 'enterprise_license_batch', v_res.id, NULL, jsonb_build_object('batch_count', p_batch_count, 'total_licenses', v_res.total_licenses, 'amount_total_cents', v_total_cents), NULL, p_enterprise_account_id);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.enterprise_generate_vouchers(
  p_enterprise_account_id uuid, p_voucher_type text DEFAULT 'single_use', p_campaign_name text DEFAULT NULL,
  p_prefix text DEFAULT 'STX', p_count int DEFAULT 1, p_max_redemptions int DEFAULT 1,
  p_custom_code text DEFAULT NULL, p_duration_days int DEFAULT NULL, p_valid_until timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clean_prefix text; v_created jsonb := '[]'::jsonb; v_code text; v_row record; i int;
BEGIN
  IF NOT public.is_enterprise_manager(p_enterprise_account_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_voucher_type NOT IN ('single_use', 'multi_use') THEN RAISE EXCEPTION 'Tipo de cupón inválido.'; END IF;
  v_clean_prefix := upper(regexp_replace(coalesce(nullif(trim(p_prefix), ''), 'STX'), '[^A-Z0-9]+', '', 'g'));
  IF length(v_clean_prefix) > 12 THEN v_clean_prefix := substring(v_clean_prefix, 1, 12); END IF;

  IF p_voucher_type = 'multi_use' THEN
    v_code := COALESCE(NULLIF(upper(regexp_replace(trim(coalesce(p_custom_code, '')), '[^A-Z0-9-]+', '', 'g')), ''), v_clean_prefix || '-' || upper(substring(gen_random_uuid()::text, 1, 6)));
    INSERT INTO public.enterprise_vouchers (enterprise_account_id, code, campaign_name, voucher_type, max_redemptions, license_duration_days, valid_until, is_active, created_by)
    VALUES (p_enterprise_account_id, v_code, NULLIF(trim(coalesce(p_campaign_name, '')), ''), 'multi_use', GREATEST(COALESCE(p_max_redemptions, 20), 1), p_duration_days, p_valid_until, true, auth.uid())
    RETURNING * INTO v_row;
    v_created := jsonb_build_array(to_jsonb(v_row));
  ELSE
    IF p_count < 1 OR p_count > 200 THEN RAISE EXCEPTION 'Puedes generar entre 1 y 200 códigos únicos por lote.'; END IF;
    FOR i IN 1..p_count LOOP
      v_code := v_clean_prefix || '-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      INSERT INTO public.enterprise_vouchers (enterprise_account_id, code, campaign_name, voucher_type, max_redemptions, license_duration_days, valid_until, is_active, created_by)
      VALUES (p_enterprise_account_id, v_code, NULLIF(trim(coalesce(p_campaign_name, '')), ''), 'single_use', 1, p_duration_days, p_valid_until, true, auth.uid())
      RETURNING * INTO v_row;
      v_created := v_created || jsonb_build_array(to_jsonb(v_row));
    END LOOP;
  END IF;

  PERFORM public.write_audit_log('enterprise_generate_vouchers', 'enterprise_voucher', NULL, NULL, jsonb_build_object('voucher_type', p_voucher_type, 'campaign_name', p_campaign_name, 'generated_count', jsonb_array_length(v_created)), NULL, p_enterprise_account_id);
  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.enterprise_revoke_license(p_license_id uuid, p_reason text DEFAULT 'Revocada por organización patrocinadora')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lic record; v_account record;
BEGIN
  SELECT * INTO v_lic FROM public.enterprise_licenses WHERE id = p_license_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Licencia no encontrada.'; END IF;
  IF NOT public.is_enterprise_manager(v_lic.enterprise_account_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_account FROM public.enterprise_accounts WHERE id = v_lic.enterprise_account_id;
  IF NOT public.is_super_admin() AND NOT v_account.allow_license_reassignment THEN
    RAISE EXCEPTION 'Este contrato no permite revocar licencias desde el portal. Contacta al administrador.';
  END IF;
  UPDATE public.enterprise_licenses SET status = 'revoked', revoked_at = timezone('utc'::text, now()), revoked_by = auth.uid(), revocation_reason = p_reason WHERE id = p_license_id;
  IF v_lic.subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions SET status = 'canceled', canceled_at = timezone('utc'::text, now()), notes = concat_ws(' | ', notes, p_reason), updated_at = timezone('utc'::text, now()) WHERE id = v_lic.subscription_id;
  END IF;
  PERFORM public.write_audit_log('enterprise_revoke_license', 'enterprise_license', p_license_id, to_jsonb(v_lic), jsonb_build_object('reason', p_reason), NULL, v_lic.enterprise_account_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.enterprise_get_portal_data(p_enterprise_account_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_account_id uuid := p_enterprise_account_id; v_account record; v_batches jsonb; v_vouchers jsonb; v_licenses jsonb; v_managers jsonb; v_batch_plan record; v_settings record; v_total_pool int; v_active_count int;
BEGIN
  IF v_account_id IS NULL THEN
    SELECT enterprise_account_id INTO v_account_id FROM public.enterprise_account_managers WHERE user_id = auth.uid() AND is_active = true ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_account_id IS NULL THEN RETURN jsonb_build_object('has_account', false); END IF;
  IF NOT public.is_enterprise_manager(v_account_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT * INTO v_account FROM public.enterprise_accounts WHERE id = v_account_id;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  SELECT * INTO v_batch_plan FROM public.subscription_plans WHERE slug = 'enterprise_batch_20' LIMIT 1;

  SELECT COALESCE(SUM(total_licenses), 0) INTO v_total_pool FROM public.enterprise_license_batches WHERE enterprise_account_id = v_account_id AND status = 'active' AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()));
  SELECT COUNT(*) INTO v_active_count FROM public.enterprise_licenses WHERE enterprise_account_id = v_account_id AND status = 'active' AND (expires_at IS NULL OR expires_at > timezone('utc'::text, now()));

  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC), '[]'::jsonb) INTO v_batches FROM public.enterprise_license_batches b WHERE b.enterprise_account_id = v_account_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC), '[]'::jsonb) INTO v_vouchers FROM public.enterprise_vouchers v WHERE v.enterprise_account_id = v_account_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', el.id, 'user_id', el.user_id, 'doctor_name', up.full_name, 'doctor_email', up.email, 'doctor_specialty', up.specialty,
    'voucher_code', ev.code, 'campaign_name', ev.campaign_name, 'status', el.status, 'activated_at', el.activated_at,
    'expires_at', el.expires_at, 'revoked_at', el.revoked_at, 'revocation_reason', el.revocation_reason
  ) ORDER BY el.activated_at DESC), '[]'::jsonb) INTO v_licenses
  FROM public.enterprise_licenses el LEFT JOIN public.user_profiles up ON up.id = el.user_id LEFT JOIN public.enterprise_vouchers ev ON ev.id = el.voucher_id
  WHERE el.enterprise_account_id = v_account_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', eam.id, 'user_id', eam.user_id, 'role_in_org', eam.role_in_org, 'full_name', up.full_name, 'email', up.email)), '[]'::jsonb) INTO v_managers
  FROM public.enterprise_account_managers eam LEFT JOIN public.user_profiles up ON up.id = eam.user_id
  WHERE eam.enterprise_account_id = v_account_id AND eam.is_active = true;

  RETURN jsonb_build_object(
    'has_account', true, 'account', to_jsonb(v_account),
    'summary', jsonb_build_object('total_licenses', v_total_pool, 'active_licenses', v_active_count, 'available_licenses', GREATEST(v_total_pool - v_active_count, 0), 'batch_size', 20),
    'batch_pricing', jsonb_build_object('price_monthly_cents', COALESCE(v_batch_plan.price_monthly_cents, 799000), 'price_annual_cents', COALESCE(v_batch_plan.price_annual_cents, 7990000), 'currency', COALESCE(v_batch_plan.currency, 'MXN'), 'billing_mode', COALESCE(v_settings.billing_mode, 'free_launch')),
    'batches', v_batches, 'vouchers', v_vouchers, 'licenses', v_licenses, 'managers', v_managers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enterprise_request_license_batch(
  p_enterprise_account_id uuid, p_batch_count int, p_billing_interval text DEFAULT 'annual',
  p_purchase_order_ref text DEFAULT NULL, p_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings record; v_plan record; v_unit_price int; v_status text; v_processor text; v_res record;
BEGIN
  IF NOT public.is_enterprise_manager(p_enterprise_account_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_batch_count IS NULL OR p_batch_count < 1 THEN RAISE EXCEPTION 'Debes solicitar al menos 1 lote (20 licencias).'; END IF;
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE slug = 'enterprise_batch_20' LIMIT 1;

  IF COALESCE(v_settings.billing_mode, 'free_launch') = 'free_launch' THEN
    v_unit_price := 0; v_status := 'active'; v_processor := 'comped';
  ELSE
    v_unit_price := CASE WHEN p_billing_interval = 'monthly' THEN COALESCE(v_plan.price_monthly_cents, 799000) ELSE COALESCE(v_plan.price_annual_cents, 7990000) END;
    v_status := 'pending_payment'; v_processor := 'manual';
  END IF;

  INSERT INTO public.enterprise_license_batches (
    enterprise_account_id, batch_count, licenses_per_batch, billing_interval, unit_batch_price_cents,
    amount_total_cents, status, payment_processor, expires_at, purchase_order_ref, notes, created_by
  )
  VALUES (
    p_enterprise_account_id, p_batch_count, 20,
    CASE WHEN v_processor = 'comped' THEN 'pilot_free' ELSE p_billing_interval END,
    v_unit_price, v_unit_price * p_batch_count, v_status, v_processor,
    timezone('utc'::text, now()) + interval '1 year',
    NULLIF(trim(coalesce(p_purchase_order_ref, '')), ''),
    COALESCE(NULLIF(trim(coalesce(p_notes, '')), ''), 'Solicitado desde Portal Enterprise'), auth.uid()
  ) RETURNING * INTO v_res;

  PERFORM public.write_audit_log('enterprise_request_license_batch', 'enterprise_license_batch', v_res.id, NULL, jsonb_build_object('batch_count', p_batch_count, 'total_licenses', v_res.total_licenses, 'status', v_status), NULL, p_enterprise_account_id);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_list_enterprise_accounts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ea.id, 'name', ea.name, 'slug', ea.slug, 'organization_type', ea.organization_type,
      'brand_display_name', ea.brand_display_name, 'contact_name', ea.contact_name, 'contact_email', ea.contact_email,
      'contact_phone', ea.contact_phone, 'tax_id', ea.tax_id, 'status', ea.status,
      'allow_license_reassignment', ea.allow_license_reassignment, 'default_license_duration_days', ea.default_license_duration_days,
      'notes', ea.notes, 'created_at', ea.created_at,
      'total_licenses', COALESCE((SELECT SUM(b.total_licenses) FROM public.enterprise_license_batches b WHERE b.enterprise_account_id = ea.id AND b.status = 'active'), 0),
      'pending_licenses', COALESCE((SELECT SUM(b.total_licenses) FROM public.enterprise_license_batches b WHERE b.enterprise_account_id = ea.id AND b.status = 'pending_payment'), 0),
      'active_licenses', (SELECT COUNT(*) FROM public.enterprise_licenses l WHERE l.enterprise_account_id = ea.id AND l.status = 'active'),
      'vouchers_count', (SELECT COUNT(*) FROM public.enterprise_vouchers v WHERE v.enterprise_account_id = ea.id AND v.is_active = true),
      'managers', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', up.email, 'full_name', up.full_name, 'role_in_org', m.role_in_org)) FROM public.enterprise_account_managers m LEFT JOIN public.user_profiles up ON up.id = m.user_id WHERE m.enterprise_account_id = ea.id AND m.is_active = true), '[]'::jsonb)
    ) ORDER BY ea.created_at DESC) FROM public.enterprise_accounts ea
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_list_clinics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'slug', c.slug, 'type', c.type, 'city', c.city, 'phone', c.phone, 'email', c.email,
      'tax_id', c.tax_id, 'director_name', c.director_name, 'is_active', c.is_active, 'created_at', c.created_at,
      'members_count', (SELECT COUNT(*) FROM public.clinic_user_relationships cur WHERE cur.clinic_id = c.id AND cur.is_active = true),
      'patients_count', (SELECT COUNT(*) FROM public.patients p WHERE p.clinic_id = c.id),
      'active_subscription', (SELECT jsonb_build_object('id', s.id, 'plan_slug', sp.slug, 'plan_name', sp.name, 'tier', sp.tier, 'status', s.status, 'seat_limit', s.seat_limit, 'current_period_end', s.current_period_end) FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id WHERE s.clinic_id = c.id AND s.status IN ('active', 'trialing', 'past_due') ORDER BY s.created_at DESC LIMIT 1)
    ) ORDER BY c.created_at DESC) FROM public.clinics c
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_upsert_clinic(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := NULLIF(p_payload ->> 'id', '')::uuid; v_res record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_id IS NOT NULL THEN
    UPDATE public.clinics SET
      name = COALESCE(p_payload ->> 'name', name), type = COALESCE(p_payload ->> 'type', type),
      phone = COALESCE(p_payload ->> 'phone', phone), email = COALESCE(p_payload ->> 'email', email),
      address = COALESCE(p_payload ->> 'address', address), city = COALESCE(p_payload ->> 'city', city),
      tax_id = COALESCE(p_payload ->> 'tax_id', tax_id), license_number = COALESCE(p_payload ->> 'license_number', license_number),
      director_name = COALESCE(p_payload ->> 'director_name', director_name),
      is_active = COALESCE((p_payload ->> 'is_active')::boolean, is_active), updated_at = timezone('utc'::text, now())
    WHERE id = v_id RETURNING * INTO v_res;
  ELSE
    INSERT INTO public.clinics (name, slug, type, phone, email, address, city, tax_id, license_number, director_name, is_active, created_by)
    VALUES (
      trim(p_payload ->> 'name'),
      lower(regexp_replace(trim(p_payload ->> 'name'), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 4),
      COALESCE(p_payload ->> 'type', 'clinic'), NULLIF(p_payload ->> 'phone', ''), NULLIF(p_payload ->> 'email', ''),
      NULLIF(p_payload ->> 'address', ''), NULLIF(p_payload ->> 'city', ''), NULLIF(p_payload ->> 'tax_id', ''),
      NULLIF(p_payload ->> 'license_number', ''), NULLIF(p_payload ->> 'director_name', ''),
      COALESCE((p_payload ->> 'is_active')::boolean, true), auth.uid()
    ) RETURNING * INTO v_res;
    INSERT INTO public.clinic_configurations (clinic_id) VALUES (v_res.id) ON CONFLICT DO NOTHING;
  END IF;
  PERFORM public.write_audit_log('super_admin_upsert_clinic', 'clinic', v_res.id, NULL, to_jsonb(v_res), v_res.id, NULL);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_clinic_detail(p_clinic_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clinic record; v_config record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_clinic FROM public.clinics WHERE id = p_clinic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clínica no encontrada.'; END IF;
  SELECT * INTO v_config FROM public.clinic_configurations WHERE clinic_id = p_clinic_id;
  RETURN jsonb_build_object(
    'clinic', to_jsonb(v_clinic), 'configuration', to_jsonb(v_config),
    'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', cur.id, 'user_id', cur.user_id, 'role_in_clinic', cur.role_in_clinic, 'status', cur.status, 'is_active', cur.is_active, 'full_name', up.full_name, 'email', up.email, 'specialty', up.specialty) ORDER BY cur.created_at ASC) FROM public.clinic_user_relationships cur LEFT JOIN public.user_profiles up ON up.id = cur.user_id WHERE cur.clinic_id = p_clinic_id), '[]'::jsonb),
    'patients_count', (SELECT COUNT(*) FROM public.patients WHERE clinic_id = p_clinic_id),
    'treatments_count', (SELECT COUNT(*) FROM public.treatments WHERE clinic_id = p_clinic_id),
    'subscriptions', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'plan_slug', sp.slug, 'plan_name', sp.name, 'tier', sp.tier, 'status', s.status, 'origin', s.origin, 'seat_limit', s.seat_limit, 'current_period_end', s.current_period_end, 'created_at', s.created_at) ORDER BY s.created_at DESC) FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id WHERE s.clinic_id = p_clinic_id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_upsert_clinic_schedule(
  p_clinic_id uuid, p_working_hours jsonb, p_holidays jsonb DEFAULT '[]'::jsonb,
  p_duration int DEFAULT 30, p_buffer int DEFAULT 10, p_allow_cross_view boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res record;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.clinic_configurations (clinic_id, working_hours, holidays, default_appointment_duration, buffer_minutes, allow_cross_doctor_patient_view)
  VALUES (p_clinic_id, p_working_hours, COALESCE(p_holidays, '[]'::jsonb), p_duration, p_buffer, p_allow_cross_view)
  ON CONFLICT (clinic_id) DO UPDATE SET
    working_hours = EXCLUDED.working_hours, holidays = EXCLUDED.holidays,
    default_appointment_duration = EXCLUDED.default_appointment_duration, buffer_minutes = EXCLUDED.buffer_minutes,
    allow_cross_doctor_patient_view = EXCLUDED.allow_cross_doctor_patient_view, updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_res;
  PERFORM public.write_audit_log('upsert_clinic_schedule', 'clinic_configuration', v_res.id, NULL, to_jsonb(v_res), p_clinic_id, NULL);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_manage_clinic_member(
  p_clinic_id uuid, p_user_email text, p_role_in_clinic text DEFAULT 'specialist',
  p_status text DEFAULT 'approved', p_is_active boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user record; v_res record;
BEGIN
  IF NOT public.is_clinic_admin(p_clinic_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_user FROM public.user_profiles WHERE lower(email) = lower(trim(p_user_email)) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró un usuario registrado con el correo %.', p_user_email; END IF;
  INSERT INTO public.clinic_user_relationships (clinic_id, user_id, role_in_clinic, status, is_active, approved_by, approved_at)
  VALUES (p_clinic_id, v_user.id, p_role_in_clinic, p_status, p_is_active, auth.uid(), timezone('utc'::text, now()))
  ON CONFLICT (clinic_id, user_id) DO UPDATE SET role_in_clinic = EXCLUDED.role_in_clinic, status = EXCLUDED.status, is_active = EXCLUDED.is_active, updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_res;
  PERFORM public.write_audit_log('manage_clinic_member', 'clinic_user_relationship', v_res.id, NULL, to_jsonb(v_res), p_clinic_id, NULL);
  RETURN to_jsonb(v_res);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_list_patients(p_search text DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone, 'user_id', p.user_id,
      'doctor_name', up.full_name, 'doctor_email', up.email, 'clinic_id', p.clinic_id, 'clinic_name', c.name, 'created_at', p.created_at,
      'treatments_count', (SELECT COUNT(*) FROM public.treatments t WHERE t.patient_id = p.id),
      'last_treatment_date', (SELECT MAX(t.date) FROM public.treatments t WHERE t.patient_id = p.id)
    ))
    FROM (SELECT * FROM public.patients WHERE p_search IS NULL OR trim(p_search) = '' OR full_name ILIKE '%' || trim(p_search) || '%' OR email ILIKE '%' || trim(p_search) || '%' ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 250)) p
    LEFT JOIN public.user_profiles up ON up.id = p.user_id LEFT JOIN public.clinics c ON c.id = p.clinic_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_reassign_patient(p_patient_id uuid, p_new_doctor_id uuid, p_new_clinic_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old record;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT user_id, clinic_id INTO v_old FROM public.patients WHERE id = p_patient_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente no encontrado.'; END IF;
  UPDATE public.patients SET user_id = p_new_doctor_id, clinic_id = p_new_clinic_id WHERE id = p_patient_id;
  UPDATE public.treatments SET user_id = p_new_doctor_id, clinic_id = p_new_clinic_id WHERE patient_id = p_patient_id;
  UPDATE public.consultations SET user_id = p_new_doctor_id, clinic_id = p_new_clinic_id WHERE patient_id = p_patient_id;
  UPDATE public.patient_clinical_notes SET user_id = p_new_doctor_id, clinic_id = p_new_clinic_id WHERE patient_id = p_patient_id;
  UPDATE public.patient_goals SET user_id = p_new_doctor_id, clinic_id = p_new_clinic_id WHERE patient_id = p_patient_id;
  UPDATE public.patient_goal_scores SET user_id = p_new_doctor_id, clinic_id = p_new_clinic_id WHERE patient_id = p_patient_id;
  PERFORM public.write_audit_log('super_admin_reassign_patient', 'patient', p_patient_id, to_jsonb(v_old), jsonb_build_object('user_id', p_new_doctor_id, 'clinic_id', p_new_clinic_id), p_new_clinic_id, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_list_billing_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN jsonb_build_object(
    'subscriptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'subscriber_type', s.subscriber_type, 'user_id', s.user_id, 'user_name', up.full_name, 'user_email', up.email,
        'clinic_name', c.name, 'sponsor_name', ea.brand_display_name, 'plan_slug', sp.slug, 'plan_name', sp.name, 'tier', sp.tier,
        'status', s.status, 'origin', s.origin, 'billing_interval', s.billing_interval, 'price_cents_at_signup', s.price_cents_at_signup,
        'is_founder', s.is_founder, 'protected_from_auto_downgrade', s.protected_from_auto_downgrade, 'grant_reason', s.grant_reason,
        'current_period_end', s.current_period_end, 'payment_processor', s.payment_processor, 'created_at', s.created_at
      ) ORDER BY s.created_at DESC)
      FROM (SELECT * FROM public.subscriptions ORDER BY created_at DESC LIMIT 150) s
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

CREATE OR REPLACE FUNCTION public.super_admin_list_arco_requests()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', ar.id, 'user_id', ar.user_id, 'user_name', up.full_name, 'user_email', up.email, 'request_type', ar.request_type, 'description', ar.description, 'status', ar.status, 'created_at', ar.created_at, 'resolved_at', ar.resolved_at) ORDER BY ar.created_at DESC)
    FROM public.arco_requests ar LEFT JOIN public.user_profiles up ON up.id = ar.user_id
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_resolve_arco_request(p_request_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_status NOT IN ('pending', 'in_progress', 'resolved', 'rejected') THEN RAISE EXCEPTION 'Estado ARCO no válido.'; END IF;
  UPDATE public.arco_requests SET status = p_status, resolved_at = CASE WHEN p_status IN ('resolved', 'rejected') THEN timezone('utc'::text, now()) ELSE NULL END WHERE id = p_request_id;
  PERFORM public.write_audit_log('super_admin_resolve_arco_request', 'arco_request', p_request_id, NULL, jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_list_audit_logs(p_limit int DEFAULT 120)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', al.id, 'actor_user_id', al.actor_user_id, 'actor_email', up.email, 'actor_name', up.full_name, 'action', al.action, 'entity_type', al.entity_type, 'entity_id', al.entity_id, 'old_values', al.old_values, 'new_values', al.new_values, 'created_at', al.created_at) ORDER BY al.created_at DESC)
    FROM (SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 300)) al
    LEFT JOIN public.user_profiles up ON up.id = al.actor_user_id
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_free_launch_subscription(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_or_enterprise_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_global_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_platform_settings(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_users(text, text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_grant_subscription(uuid, uuid, text, text, int, timestamptz, boolean, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_revoke_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_user_overrides(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_toggle_user_active(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_plan(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_record_manual_payment(uuid, uuid, uuid, uuid, int, text, text, text, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_promo_code(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_announcement(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_enterprise_account(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_assign_enterprise_manager(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_add_enterprise_batch(uuid, int, text, int, text, text, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enterprise_generate_vouchers(uuid, text, text, text, int, int, text, int, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enterprise_revoke_license(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enterprise_get_portal_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enterprise_request_license_batch(uuid, int, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_enterprise_accounts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_clinics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_clinic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_clinic_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_upsert_clinic_schedule(uuid, jsonb, jsonb, int, int, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_manage_clinic_member(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_patients(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_reassign_patient(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_billing_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_arco_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_resolve_arco_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_audit_logs(int) TO authenticated;
