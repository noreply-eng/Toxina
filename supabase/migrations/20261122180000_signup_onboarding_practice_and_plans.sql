-- ============================================================================
-- Migration: Signup Onboarding — Practice Type (Individual vs Clinic),
--            Clinic Unit Team Size, Public Plan Catalog Read & Registration
--            Plan Activation RPC (Free / Plus / Premium while Stripe is pending)
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

-- 1. Add practice modality & clinic unit metadata columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS practice_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS clinic_team_size int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS clinic_name text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_practice_type_check') THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_practice_type_check;
  END IF;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_practice_type_check
    CHECK (practice_type IN ('individual', 'clinic'));

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_clinic_team_size_check') THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_clinic_team_size_check;
  END IF;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_clinic_team_size_check
    CHECK (clinic_team_size >= 1 AND clinic_team_size <= 500);
END $$;

-- 2. Allow unauthenticated visitors (anon) on the signup payment gateway to view
--    active individual & clinic plans from the catalog
DROP POLICY IF EXISTS "Public can view active individual and clinic plans" ON public.subscription_plans;
CREATE POLICY "Public can view active individual and clinic plans"
  ON public.subscription_plans FOR SELECT
  TO anon
  USING (is_active = true AND scope IN ('individual', 'clinic'));

-- 3. Update handle_new_user() trigger so metadata submitted during signup
--    is immediately saved on user_profiles (even before email confirmation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'specialist';
  v_practice_type text := 'individual';
  v_team_size int := 1;
  v_raw_team_size text;
  v_clinic_name text;
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'jmyocupicior@gmail.com' THEN
    v_role := 'super_admin';
  END IF;

  IF lower(coalesce(NEW.raw_user_meta_data->>'practice_type', '')) = 'clinic' THEN
    v_practice_type := 'clinic';
  END IF;

  v_raw_team_size := NEW.raw_user_meta_data->>'clinic_team_size';
  IF v_practice_type = 'clinic' THEN
    IF v_raw_team_size ~ '^[0-9]+$' THEN
      v_team_size := GREATEST(2, LEAST(500, v_raw_team_size::int));
    ELSE
      v_team_size := 2;
    END IF;
  ELSE
    v_team_size := 1;
  END IF;

  v_clinic_name := NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'clinic_name', '')), '');

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  INSERT INTO public.user_profiles (
    id, email, full_name, specialty, avatar_url,
    role, subscription_tier, practice_type, clinic_team_size, clinic_name
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(trim(coalesce(NEW.raw_user_meta_data->>'specialty', '')), ''),
    NEW.raw_user_meta_data->>'avatar_url',
    v_role,
    CASE WHEN v_role = 'super_admin' THEN 'premium' ELSE 'free' END,
    v_practice_type,
    v_team_size,
    v_clinic_name
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(trim(coalesce(user_profiles.full_name, '')), ''), EXCLUDED.full_name),
        practice_type = COALESCE(EXCLUDED.practice_type, user_profiles.practice_type),
        clinic_team_size = COALESCE(EXCLUDED.clinic_team_size, user_profiles.clinic_team_size),
        clinic_name = COALESCE(EXCLUDED.clinic_name, user_profiles.clinic_name),
        updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

-- 4. Update resolve_user_entitlements() so clinic type & practice modality are returned
CREATE OR REPLACE FUNCTION public.resolve_user_entitlements(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_settings record;
  v_sub record;
  v_free_features jsonb;
  v_full_features jsonb := '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":true,"patients.manage":true,"agenda.manage":true,"templates.manage":true,"offline.sync":true,"data.export":true,"guides.anatomy":true,"guides.usg":true,"content.protocols":true,"content.videos":true,"content.clinical_pearls":true}'::jsonb;
  v_features jsonb;
  v_effective_tier text := 'free';
  v_origin text := 'free_default';
  v_status text := 'active';
  v_plan_slug text := 'free';
  v_plan_name text := 'Plan Gratuito';
  v_period_end timestamptz := NULL;
  v_is_founder boolean := false;
  v_is_protected boolean := false;
  v_grant_reason text := NULL;
  v_sponsor jsonb := NULL;
  v_enterprise_orgs jsonb := '[]'::jsonb;
  v_clinic_memberships jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  SELECT features INTO v_free_features FROM public.subscription_plans WHERE slug = 'free' LIMIT 1;
  IF v_free_features IS NULL THEN
    v_free_features := '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"data.export":true}'::jsonb;
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'role', 'specialist',
      'is_super_admin', false,
      'is_enterprise_manager', false,
      'effective_tier', 'free',
      'plan_slug', 'free',
      'plan_name', 'Plan Gratuito',
      'origin', 'free_default',
      'status', 'active',
      'practice_type', 'individual',
      'clinic_team_size', 1,
      'clinic_name', NULL,
      'features', v_free_features,
      'platform_settings', to_jsonb(v_settings)
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ea.id,
    'name', ea.name,
    'brand_display_name', ea.brand_display_name,
    'organization_type', ea.organization_type,
    'role_in_org', eam.role_in_org,
    'status', ea.status
  )), '[]'::jsonb)
  INTO v_enterprise_orgs
  FROM public.enterprise_account_managers eam
  JOIN public.enterprise_accounts ea ON ea.id = eam.enterprise_account_id
  WHERE eam.user_id = p_user_id AND eam.is_active = true;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'clinic_id', c.id,
    'name', c.name,
    'type', c.type,
    'role_in_clinic', cur.role_in_clinic,
    'status', cur.status
  )), '[]'::jsonb)
  INTO v_clinic_memberships
  FROM public.clinic_user_relationships cur
  JOIN public.clinics c ON c.id = cur.clinic_id
  WHERE cur.user_id = p_user_id AND cur.is_active = true AND cur.status = 'approved';

  IF v_profile.role = 'super_admin' AND v_profile.is_active = true AND v_profile.status = 'active' THEN
    v_effective_tier := 'premium';
    v_plan_slug := 'super_admin';
    v_plan_name := 'Super Administrador';
    v_origin := 'admin_grant';
    v_features := v_full_features;
    v_is_protected := true;
  ELSE
    SELECT
      s.id, s.status, s.origin, s.billing_interval, s.current_period_end,
      s.is_founder, s.protected_from_auto_downgrade, s.grant_reason, s.enterprise_account_id,
      sp.slug AS plan_slug, sp.name AS plan_name, sp.tier AS plan_tier, sp.features AS plan_features,
      ea.name AS sponsor_name, ea.brand_display_name AS sponsor_display_name,
      ea.organization_type AS sponsor_type, ea.logo_url AS sponsor_logo_url
    INTO v_sub
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    LEFT JOIN public.enterprise_accounts ea ON ea.id = s.enterprise_account_id
    LEFT JOIN public.subscription_seats ss
      ON ss.subscription_id = s.id AND ss.user_id = p_user_id AND ss.is_active = true
    WHERE s.status IN ('active', 'trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end > timezone('utc'::text, now()))
      AND (
        (s.subscriber_type = 'individual' AND s.user_id = p_user_id)
        OR (s.subscriber_type = 'clinic' AND ss.user_id = p_user_id)
      )
    ORDER BY
      CASE s.origin WHEN 'admin_grant' THEN 1 WHEN 'enterprise_license' THEN 2 ELSE 3 END,
      CASE sp.tier WHEN 'premium' THEN 3 WHEN 'plus' THEN 2 ELSE 1 END DESC,
      s.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_effective_tier := v_sub.plan_tier;
      v_plan_slug := v_sub.plan_slug;
      v_plan_name := v_sub.plan_name;
      v_origin := v_sub.origin;
      v_status := v_sub.status;
      v_period_end := v_sub.current_period_end;
      v_is_founder := v_sub.is_founder;
      v_is_protected := v_sub.protected_from_auto_downgrade;
      v_grant_reason := v_sub.grant_reason;
      v_features := COALESCE(v_sub.plan_features, v_free_features);

      IF v_sub.enterprise_account_id IS NOT NULL THEN
        v_sponsor := jsonb_build_object(
          'enterprise_account_id', v_sub.enterprise_account_id,
          'name', v_sub.sponsor_name,
          'brand_display_name', v_sub.sponsor_display_name,
          'organization_type', v_sub.sponsor_type,
          'logo_url', v_sub.sponsor_logo_url
        );
      END IF;
    ELSE
      v_effective_tier := 'free';
      v_plan_slug := 'free';
      v_plan_name := 'Plan Gratuito';
      v_origin := 'free_default';
      v_features := v_free_features;
    END IF;

    IF COALESCE(v_settings.enforce_entitlements, true) = false THEN
      v_features := v_full_features;
    END IF;

    IF v_profile.feature_overrides IS NOT NULL AND jsonb_typeof(v_profile.feature_overrides) = 'object' THEN
      v_features := v_features || v_profile.feature_overrides;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'practice_type', COALESCE(v_profile.practice_type, 'individual'),
    'clinic_team_size', COALESCE(v_profile.clinic_team_size, 1),
    'clinic_name', v_profile.clinic_name,
    'role', v_profile.role,
    'is_active', v_profile.is_active,
    'account_status', v_profile.status,
    'is_super_admin', (v_profile.role = 'super_admin' AND v_profile.is_active = true AND v_profile.status = 'active'),
    'is_enterprise_manager', (v_profile.role = 'enterprise' OR jsonb_array_length(v_enterprise_orgs) > 0),
    'effective_tier', v_effective_tier,
    'plan_slug', v_plan_slug,
    'plan_name', v_plan_name,
    'origin', v_origin,
    'status', v_status,
    'period_end', v_period_end,
    'is_founder', v_is_founder,
    'is_protected_grant', v_is_protected,
    'grant_reason', v_grant_reason,
    'sponsor', v_sponsor,
    'features', v_features,
    'feature_overrides', COALESCE(v_profile.feature_overrides, '{}'::jsonb),
    'active_clinic_id', v_profile.active_clinic_id,
    'clinics', v_clinic_memberships,
    'enterprise_accounts', v_enterprise_orgs,
    'platform_settings', jsonb_build_object(
      'billing_mode', COALESCE(v_settings.billing_mode, 'free_launch'),
      'launch_promo_banner_enabled', COALESCE(v_settings.launch_promo_banner_enabled, true),
      'launch_promo_banner_text', COALESCE(v_settings.launch_promo_banner_text, ''),
      'launch_promo_ends_at', v_settings.launch_promo_ends_at,
      'founder_discount_percent', COALESCE(v_settings.founder_discount_percent, 40),
      'enterprise_batch_size', COALESCE(v_settings.enterprise_batch_size, 20),
      'enforce_entitlements', COALESCE(v_settings.enforce_entitlements, true)
    )
  );
END;
$$;

-- 5. Unified Registration Onboarding RPC:
--    Saves practice_type ('individual' | 'clinic'), clinic_team_size, optional clinic_name,
--    and enrolls the user in Free, Plus, or Premium (individual or clinic) while Stripe
--    payment processing is not yet linked.
CREATE OR REPLACE FUNCTION public.complete_registration_onboarding(
  p_full_name text DEFAULT NULL,
  p_practice_type text DEFAULT 'individual',
  p_clinic_team_size int DEFAULT 1,
  p_clinic_name text DEFAULT NULL,
  p_plan_slug text DEFAULT 'free',
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
  v_practice_type text;
  v_team_size int;
  v_clean_name text;
  v_clean_clinic_name text;
  v_interval text;
  v_period_end timestamptz := NULL;
  v_clinic_id uuid := NULL;
  v_sub_id uuid := NULL;
  v_seat_limit int := 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_practice_type := CASE WHEN lower(trim(coalesce(p_practice_type, ''))) = 'clinic' THEN 'clinic' ELSE 'individual' END;
  v_team_size := CASE
    WHEN v_practice_type = 'clinic' THEN GREATEST(2, LEAST(500, COALESCE(p_clinic_team_size, 2)))
    ELSE 1
  END;
  v_clean_name := NULLIF(trim(coalesce(p_full_name, '')), '');
  v_clean_clinic_name := NULLIF(trim(coalesce(p_clinic_name, '')), '');
  v_interval := CASE WHEN p_billing_interval IN ('monthly', 'annual') THEN p_billing_interval ELSE 'monthly' END;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;

  -- Persist onboarding profile fields
  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  INSERT INTO public.user_profiles (
    id, full_name, practice_type, clinic_team_size, clinic_name, onboarding_completed_at, updated_at
  )
  VALUES (
    v_uid,
    v_clean_name,
    v_practice_type,
    v_team_size,
    v_clean_clinic_name,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(v_clean_name, user_profiles.full_name),
        practice_type = v_practice_type,
        clinic_team_size = v_team_size,
        clinic_name = COALESCE(v_clean_clinic_name, user_profiles.clinic_name),
        onboarding_completed_at = COALESCE(user_profiles.onboarding_completed_at, timezone('utc'::text, now())),
        updated_at = timezone('utc'::text, now());

  -- Resolve target plan from catalog
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE slug = COALESCE(NULLIF(trim(coalesce(p_plan_slug, '')), ''), 'free')
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan "%" no encontrado o inactivo.', p_plan_slug;
  END IF;

  IF v_plan.scope = 'enterprise' THEN
    RAISE EXCEPTION 'Los planes Enterprise en lotes de 20 se gestionan por cuenta corporativa.';
  END IF;

  -- Check if user already has a protected grant (do not accidentally downgrade)
  SELECT * INTO v_existing
  FROM public.subscriptions
  WHERE user_id = v_uid
    AND subscriber_type = 'individual'
    AND status IN ('active', 'trialing')
    AND (protected_from_auto_downgrade = true OR origin IN ('admin_grant', 'enterprise_license'))
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- While Stripe is not live (free_launch / manual_billing) or when choosing Free plan:
    IF COALESCE(v_settings.billing_mode, 'free_launch') <> 'stripe_live' OR v_plan.tier = 'free' THEN
      UPDATE public.subscriptions
      SET status = 'canceled',
          canceled_at = timezone('utc'::text, now()),
          updated_at = timezone('utc'::text, now())
      WHERE user_id = v_uid
        AND subscriber_type = 'individual'
        AND status IN ('active', 'trialing')
        AND protected_from_auto_downgrade = false
        AND origin NOT IN ('admin_grant', 'enterprise_license');

      IF v_plan.tier = 'free' THEN
        PERFORM public.refresh_user_subscription_tier(v_uid);
      ELSE
        IF v_settings.launch_default_grant_days IS NOT NULL THEN
          v_period_end := timezone('utc'::text, now()) + make_interval(days => v_settings.launch_default_grant_days);
        ELSIF v_settings.launch_promo_ends_at IS NOT NULL THEN
          v_period_end := v_settings.launch_promo_ends_at;
        END IF;

        v_clinic_id := public.ensure_user_clinic_workspace(
          v_uid,
          CASE WHEN v_practice_type = 'clinic' OR v_plan.scope = 'clinic' THEN 'clinic' ELSE 'solo_practice' END
        );

        IF v_clinic_id IS NOT NULL THEN
          UPDATE public.clinics
          SET
            name = COALESCE(v_clean_clinic_name, name),
            type = CASE WHEN v_practice_type = 'clinic' THEN 'clinic' ELSE type END,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'practice_type', v_practice_type,
              'declared_team_size', v_team_size
            ),
            updated_at = timezone('utc'::text, now())
          WHERE id = v_clinic_id;
        END IF;

        v_seat_limit := CASE
          WHEN v_practice_type = 'clinic' OR v_plan.scope = 'clinic' THEN GREATEST(v_plan.max_seats, v_team_size)
          ELSE 1
        END;

        INSERT INTO public.subscriptions (
          subscriber_type, user_id, plan_id, status, origin, billing_interval,
          seat_limit, price_cents_at_signup, is_founder, protected_from_auto_downgrade,
          current_period_start, current_period_end, payment_processor, notes, metadata, created_by
        )
        VALUES (
          'individual',
          v_uid,
          v_plan.id,
          'active',
          'launch_promo',
          v_interval,
          v_seat_limit,
          0,
          true,
          false,
          timezone('utc'::text, now()),
          v_period_end,
          'comped',
          CASE
            WHEN v_practice_type = 'clinic' THEN format('Inscripción desde pasarela de registro (Clínica · %s integrantes)', v_team_size)
            ELSE 'Inscripción desde pasarela de registro (Médico particular)'
          END,
          jsonb_build_object(
            'practice_type', v_practice_type,
            'clinic_team_size', v_team_size,
            'clinic_name', v_clean_clinic_name,
            'signup_gateway', true
          ),
          v_uid
        )
        RETURNING id INTO v_sub_id;

        PERFORM public.refresh_user_subscription_tier(v_uid);
      END IF;
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    'user_registration_onboarding',
    'user_profile',
    v_uid,
    NULL,
    jsonb_build_object(
      'practice_type', v_practice_type,
      'clinic_team_size', v_team_size,
      'clinic_name', v_clean_clinic_name,
      'plan_slug', v_plan.slug,
      'plan_tier', v_plan.tier,
      'billing_interval', v_interval,
      'subscription_id', v_sub_id,
      'clinic_id', v_clinic_id
    ),
    v_clinic_id,
    NULL
  );

  RETURN public.get_my_entitlements();
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_registration_onboarding(text, text, int, text, text, text) TO authenticated;
