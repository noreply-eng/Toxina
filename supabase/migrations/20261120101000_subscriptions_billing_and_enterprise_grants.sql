-- ============================================================================
-- Migration 2: Platform Settings (Free Launch Mode), Subscription Plans,
--              Subscriptions, Seats, Stripe-Ready Billing, Promos,
--              Announcements, Entitlements Resolver & Full Clinical RLS
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  billing_mode text NOT NULL DEFAULT 'free_launch'
    CHECK (billing_mode IN ('free_launch', 'manual_billing', 'stripe_live')),
  launch_promo_banner_enabled boolean NOT NULL DEFAULT true,
  launch_promo_banner_text text NOT NULL
    DEFAULT 'Acceso de lanzamiento gratuito por tiempo limitado: activa Plus o Premium a $0 MXN antes de que cierre la beta.',
  launch_promo_ends_at timestamptz,
  launch_default_grant_days int CHECK (launch_default_grant_days IS NULL OR launch_default_grant_days > 0),
  founder_discount_percent int NOT NULL DEFAULT 40 CHECK (founder_discount_percent BETWEEN 0 AND 100),
  enterprise_batch_size int NOT NULL DEFAULT 20 CHECK (enterprise_batch_size = 20),
  enforce_entitlements boolean NOT NULL DEFAULT true,
  stripe_ready_checked_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.platform_settings (id, billing_mode, launch_promo_banner_enabled, enforce_entitlements)
VALUES (1, 'free_launch', true, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read platform settings" ON public.platform_settings;
CREATE POLICY "Authenticated users can read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Super admin can update platform settings" ON public.platform_settings;
CREATE POLICY "Super admin can update platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  tier text NOT NULL CHECK (tier IN ('free', 'plus', 'premium')),
  scope text NOT NULL CHECK (scope IN ('individual', 'clinic', 'enterprise')),
  name text NOT NULL,
  description text,
  badge_text text,
  price_monthly_cents int NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),
  price_annual_cents int NOT NULL DEFAULT 0 CHECK (price_annual_cents >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  max_seats int NOT NULL DEFAULT 1 CHECK (max_seats >= 1),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_product_id text,
  stripe_price_monthly_id text,
  stripe_price_annual_id text,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.subscription_plans (
  slug, tier, scope, name, description, badge_text,
  price_monthly_cents, price_annual_cents, currency, max_seats,
  features, is_active, is_featured, sort_order
)
VALUES
  (
    'free', 'free', 'individual',
    'Plan Gratuito',
    'Calculadora clínica por marca (Botox, Dysport, Xeomin) con impresión y exportación de la sesión actual.',
    NULL,
    0, 0, 'MXN', 1,
    '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":false,"patients.manage":false,"agenda.manage":false,"templates.manage":false,"offline.sync":false,"data.export":true,"guides.anatomy":false,"guides.usg":false,"content.protocols":false,"content.videos":false,"content.clinical_pearls":false}'::jsonb,
    true, false, 1
  ),
  (
    'plus_solo', 'plus', 'individual',
    'Plan Plus',
    'Gestión completa de expedientes, historial longitudinal de toxina, metas GAS, agenda inteligente y modo offline PWA.',
    'Práctica Clínica',
    29900, 299000, 'MXN', 1,
    '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":true,"patients.manage":true,"agenda.manage":true,"templates.manage":true,"offline.sync":true,"data.export":true,"guides.anatomy":false,"guides.usg":false,"content.protocols":false,"content.videos":false,"content.clinical_pearls":false}'::jsonb,
    true, false, 2
  ),
  (
    'premium_solo', 'premium', 'individual',
    'Plan Premium',
    'Acceso total: expedientes + agenda + guía anatómica, puntos motores, ecografía USG, planificador facial, protocolos, videos y perlas clínicas.',
    'Más popular',
    59900, 599000, 'MXN', 1,
    '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":true,"patients.manage":true,"agenda.manage":true,"templates.manage":true,"offline.sync":true,"data.export":true,"guides.anatomy":true,"guides.usg":true,"content.protocols":true,"content.videos":true,"content.clinical_pearls":true}'::jsonb,
    true, true, 3
  ),
  (
    'plus_clinic', 'plus', 'clinic',
    'Plus Clínica (5 asientos)',
    'Gestión multi-especialista con pacientes compartidos por sede, horarios operativos y agenda coordinada.',
    'Clínicas',
    99900, 999000, 'MXN', 5,
    '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":true,"patients.manage":true,"agenda.manage":true,"templates.manage":true,"offline.sync":true,"data.export":true,"guides.anatomy":false,"guides.usg":false,"content.protocols":false,"content.videos":false,"content.clinical_pearls":false}'::jsonb,
    true, false, 4
  ),
  (
    'premium_clinic', 'premium', 'clinic',
    'Premium Clínica (5 asientos)',
    'Acceso clínico completo + guías USG/anatómicas + protocolos para todo el equipo de tu sede.',
    'Clínicas Pro',
    199900, 1999000, 'MXN', 5,
    '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":true,"patients.manage":true,"agenda.manage":true,"templates.manage":true,"offline.sync":true,"data.export":true,"guides.anatomy":true,"guides.usg":true,"content.protocols":true,"content.videos":true,"content.clinical_pearls":true}'::jsonb,
    true, false, 5
  ),
  (
    'enterprise_batch_20', 'premium', 'enterprise',
    'Lote Enterprise (20 Licencias Premium)',
    'Para farmacéuticas (Allergan, Ipsen, Merz), escuelas e instituciones. Otorga 20 consultorios privados Premium vía cupón sin compartir pacientes.',
    'B2B · Lotes x20',
    799000, 7990000, 'MXN', 20,
    '{"calculator.use":true,"calculator.print_session":true,"calculator.export_session":true,"treatments.persist":true,"patients.manage":true,"agenda.manage":true,"templates.manage":true,"offline.sync":true,"data.export":true,"guides.anatomy":true,"guides.usg":true,"content.protocols":true,"content.videos":true,"content.clinical_pearls":true}'::jsonb,
    true, false, 6
  )
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view active plans" ON public.subscription_plans;
CREATE POLICY "Authenticated can view active plans"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_super_admin());

DROP POLICY IF EXISTS "Super admin manages plans" ON public.subscription_plans;
CREATE POLICY "Super admin manages plans"
  ON public.subscription_plans FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_type text NOT NULL CHECK (subscriber_type IN ('individual', 'clinic')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  enterprise_account_id uuid REFERENCES public.enterprise_accounts(id) ON DELETE SET NULL,
  enterprise_license_id uuid REFERENCES public.enterprise_licenses(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  origin text NOT NULL DEFAULT 'free_default'
    CHECK (origin IN (
      'free_default', 'launch_promo', 'admin_grant',
      'enterprise_license', 'promo_code', 'manual_payment', 'stripe', 'mercadopago'
    )),
  billing_interval text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'annual', 'lifetime', 'custom')),
  seat_limit int NOT NULL DEFAULT 1 CHECK (seat_limit >= 1),
  price_cents_at_signup int NOT NULL DEFAULT 0,
  is_founder boolean NOT NULL DEFAULT false,
  protected_from_auto_downgrade boolean NOT NULL DEFAULT false,
  grant_reason text,
  current_period_start timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  payment_processor text DEFAULT 'comped'
    CHECK (payment_processor IN ('comped', 'manual', 'stripe', 'mercadopago')),
  external_customer_id text,
  external_subscription_id text,
  external_price_id text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subscriptions_owner_check CHECK (
    (subscriber_type = 'individual' AND user_id IS NOT NULL AND clinic_id IS NULL) OR
    (subscriber_type = 'clinic' AND clinic_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic_status ON public.subscriptions (clinic_id, status) WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_origin ON public.subscriptions (origin, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_external_id ON public.subscriptions (external_subscription_id) WHERE external_subscription_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enterprise_licenses_subscription_id_fkey') THEN
    ALTER TABLE public.enterprise_licenses
      ADD CONSTRAINT enterprise_licenses_subscription_id_fkey
      FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.subscription_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  revoked_at timestamptz,
  UNIQUE (subscription_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_seats_user ON public.subscription_seats (user_id, is_active);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subscriptions or clinic admins view clinic subs" ON public.subscriptions;
CREATE POLICY "Users view own subscriptions or clinic admins view clinic subs"
  ON public.subscriptions FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (clinic_id IS NOT NULL AND public.is_clinic_member(clinic_id))
  );

DROP POLICY IF EXISTS "Super admin manages all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admin manages all subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Users view own seats or clinic admins view clinic seats" ON public.subscription_seats;
CREATE POLICY "Users view own seats or clinic admins view clinic seats"
  ON public.subscription_seats FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_seats.subscription_id
        AND s.clinic_id IS NOT NULL
        AND public.is_clinic_admin(s.clinic_id)
    )
  );

DROP POLICY IF EXISTS "Super admin and clinic admins manage seats" ON public.subscription_seats;
CREATE POLICY "Super admin and clinic admins manage seats"
  ON public.subscription_seats FOR ALL
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_seats.subscription_id
        AND s.clinic_id IS NOT NULL
        AND public.is_clinic_admin(s.clinic_id)
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_seats.subscription_id
        AND s.clinic_id IS NOT NULL
        AND public.is_clinic_admin(s.clinic_id)
    )
  );

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('individual', 'clinic', 'enterprise')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  enterprise_account_id uuid REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  billing_email text,
  tax_name text,
  tax_id text,
  tax_regime text,
  tax_postal_code text,
  cfdi_use text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT billing_customers_owner_check CHECK (
    (owner_type = 'individual' AND user_id IS NOT NULL AND clinic_id IS NULL AND enterprise_account_id IS NULL) OR
    (owner_type = 'clinic' AND clinic_id IS NOT NULL AND enterprise_account_id IS NULL) OR
    (owner_type = 'enterprise' AND enterprise_account_id IS NOT NULL AND clinic_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  enterprise_account_id uuid REFERENCES public.enterprise_accounts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_subtotal_cents int NOT NULL DEFAULT 0,
  discount_cents int NOT NULL DEFAULT 0,
  tax_cents int NOT NULL DEFAULT 0,
  amount_total_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'paid', 'past_due', 'void', 'refunded')),
  due_date timestamptz,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  external_invoice_id text,
  hosted_invoice_url text,
  pdf_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  enterprise_account_id uuid REFERENCES public.enterprise_accounts(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MXN',
  payment_method text NOT NULL DEFAULT 'comped'
    CHECK (payment_method IN ('card', 'spei', 'transfer', 'cash', 'oxxo', 'purchase_order', 'comped', 'other')),
  processor text NOT NULL DEFAULT 'manual'
    CHECK (processor IN ('manual', 'stripe', 'mercadopago')),
  external_payment_id text,
  reference_code text,
  receipt_url text,
  status text NOT NULL DEFAULT 'succeeded'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor text NOT NULL CHECK (processor IN ('stripe', 'mercadopago')),
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (processor, external_event_id)
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed_cents', 'trial_days', 'free_months')),
  discount_value int NOT NULL CHECK (discount_value > 0),
  applicable_tiers text[] NOT NULL DEFAULT ARRAY['plus', 'premium'],
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  max_redemptions int CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  times_redeemed int NOT NULL DEFAULT 0,
  valid_from timestamptz DEFAULT timezone('utc'::text, now()),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  redeemed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (promo_code_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  variant text NOT NULL DEFAULT 'info' CHECK (variant IN ('info', 'promo', 'warning', 'critical')),
  target_tiers text[] NOT NULL DEFAULT ARRAY['free', 'plus', 'premium'],
  target_origins text[],
  cta_label text,
  cta_path text,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and super admin view billing customers" ON public.billing_customers;
CREATE POLICY "Owners and super admin view billing customers"
  ON public.billing_customers FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (clinic_id IS NOT NULL AND public.is_clinic_admin(clinic_id))
    OR (enterprise_account_id IS NOT NULL AND public.is_enterprise_manager(enterprise_account_id))
  );

DROP POLICY IF EXISTS "Owners and super admin upsert billing customers" ON public.billing_customers;
CREATE POLICY "Owners and super admin upsert billing customers"
  ON public.billing_customers FOR ALL
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (clinic_id IS NOT NULL AND public.is_clinic_admin(clinic_id))
    OR (enterprise_account_id IS NOT NULL AND public.is_enterprise_manager(enterprise_account_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (clinic_id IS NOT NULL AND public.is_clinic_admin(clinic_id))
    OR (enterprise_account_id IS NOT NULL AND public.is_enterprise_manager(enterprise_account_id))
  );

DROP POLICY IF EXISTS "Owners view invoices" ON public.billing_invoices;
CREATE POLICY "Owners view invoices"
  ON public.billing_invoices FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (clinic_id IS NOT NULL AND public.is_clinic_admin(clinic_id))
    OR (enterprise_account_id IS NOT NULL AND public.is_enterprise_manager(enterprise_account_id))
  );

DROP POLICY IF EXISTS "Super admin manages invoices" ON public.billing_invoices;
CREATE POLICY "Super admin manages invoices"
  ON public.billing_invoices FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Owners view payments" ON public.billing_payments;
CREATE POLICY "Owners view payments"
  ON public.billing_payments FOR SELECT
  USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR (clinic_id IS NOT NULL AND public.is_clinic_admin(clinic_id))
    OR (enterprise_account_id IS NOT NULL AND public.is_enterprise_manager(enterprise_account_id))
  );

DROP POLICY IF EXISTS "Super admin manages payments" ON public.billing_payments;
CREATE POLICY "Super admin manages payments"
  ON public.billing_payments FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Only super admin reads webhook events" ON public.billing_webhook_events;
CREATE POLICY "Only super admin reads webhook events"
  ON public.billing_webhook_events FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin manages promo codes" ON public.promo_codes;
CREATE POLICY "Super admin manages promo codes"
  ON public.promo_codes FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Users view own redemptions or super admin views all" ON public.promo_code_redemptions;
CREATE POLICY "Users view own redemptions or super admin views all"
  ON public.promo_code_redemptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users read active announcements" ON public.platform_announcements;
CREATE POLICY "Authenticated users read active announcements"
  ON public.platform_announcements FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (
      is_active = true
      AND starts_at <= timezone('utc'::text, now())
      AND (ends_at IS NULL OR ends_at > timezone('utc'::text, now()))
    )
  );

DROP POLICY IF EXISTS "Super admin manages announcements" ON public.platform_announcements;
CREATE POLICY "Super admin manages announcements"
  ON public.platform_announcements FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Sync user_profiles.subscription_tier automatically
CREATE OR REPLACE FUNCTION public.refresh_user_subscription_tier(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_tier text := 'free';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = p_user_id;
  IF v_role = 'super_admin' THEN
    v_tier := 'premium';
  ELSE
    SELECT COALESCE((
      SELECT sp.tier
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN public.subscription_seats ss
        ON ss.subscription_id = s.id AND ss.user_id = p_user_id AND ss.is_active = true
      WHERE s.status IN ('active', 'trialing')
        AND (s.current_period_end IS NULL OR s.current_period_end > timezone('utc'::text, now()))
        AND (
          (s.subscriber_type = 'individual' AND s.user_id = p_user_id)
          OR (s.subscriber_type = 'clinic' AND ss.user_id = p_user_id)
        )
      ORDER BY
        CASE s.origin
          WHEN 'admin_grant' THEN 1
          WHEN 'enterprise_license' THEN 2
          ELSE 3
        END,
        CASE sp.tier
          WHEN 'premium' THEN 3
          WHEN 'plus' THEN 2
          ELSE 1
        END DESC
      LIMIT 1
    ), 'free') INTO v_tier;
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);
  UPDATE public.user_profiles
  SET subscription_tier = v_tier,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_subscription_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL THEN
      PERFORM public.refresh_user_subscription_tier(OLD.user_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.refresh_user_subscription_tier(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_sync_tier ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_sync_tier
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_sync_subscription_tier();

-- Seed existing non-admin users with Launch Promo Premium (is_founder = true)
INSERT INTO public.subscriptions (
  subscriber_type, user_id, plan_id, status, origin, billing_interval,
  seat_limit, price_cents_at_signup, is_founder, payment_processor, notes
)
SELECT
  'individual',
  up.id,
  (SELECT id FROM public.subscription_plans WHERE slug = 'premium_solo' LIMIT 1),
  'active',
  'launch_promo',
  'monthly',
  1,
  0,
  true,
  'comped',
  'Migración inicial: acceso Premium de lanzamiento (cohorte Fundador)'
FROM public.user_profiles up
WHERE up.role NOT IN ('super_admin', 'enterprise')
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = up.id AND s.status IN ('active', 'trialing')
  );

-- Entitlements Resolution Engine
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

CREATE OR REPLACE FUNCTION public.user_has_entitlement(p_feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_entitlements jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;
  v_entitlements := public.resolve_user_entitlements(v_uid);
  IF COALESCE((v_entitlements ->> 'is_active')::boolean, false) = false THEN
    RETURN false;
  END IF;
  RETURN COALESCE((v_entitlements -> 'features' ->> p_feature)::boolean, false);
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_entitlement(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_clinical_record(p_owner_user_id uuid, p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT public.is_enterprise_user()
    AND (
      auth.uid() = p_owner_user_id
      OR (
        p_clinic_id IS NOT NULL
        AND public.is_clinic_member(p_clinic_id)
        AND EXISTS (
          SELECT 1
          FROM public.clinic_configurations cc
          WHERE cc.clinic_id = p_clinic_id
            AND cc.allow_cross_doctor_patient_view = true
        )
      )
    );
$$;

-- Clinical Tables RLS (100% idempotent — drops both legacy and new policy names)
-- PATIENTS
DROP POLICY IF EXISTS "Users can view their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can insert their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON public.patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON public.patients;
DROP POLICY IF EXISTS "Clinical users can view own or clinic patients" ON public.patients;
DROP POLICY IF EXISTS "Entitled clinical users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Entitled clinical users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Clinical users can delete own patients" ON public.patients;

CREATE POLICY "Clinical users can view own or clinic patients"
  ON public.patients FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert patients"
  ON public.patients FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('patients.manage') AND (clinic_id IS NULL OR public.is_clinic_member(clinic_id)));
CREATE POLICY "Entitled clinical users can update patients"
  ON public.patients FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('patients.manage'))
  WITH CHECK (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Clinical users can delete own patients"
  ON public.patients FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);

-- TREATMENTS
DROP POLICY IF EXISTS "Users can view their own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users can insert their own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users can update their own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Users can delete their own treatments" ON public.treatments;
DROP POLICY IF EXISTS "Clinical users can view own or clinic treatments" ON public.treatments;
DROP POLICY IF EXISTS "Entitled clinical users can insert treatments" ON public.treatments;
DROP POLICY IF EXISTS "Entitled clinical users can update treatments" ON public.treatments;
DROP POLICY IF EXISTS "Clinical users can delete own treatments" ON public.treatments;

CREATE POLICY "Clinical users can view own or clinic treatments"
  ON public.treatments FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert treatments"
  ON public.treatments FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('treatments.persist') AND (clinic_id IS NULL OR public.is_clinic_member(clinic_id)));
CREATE POLICY "Entitled clinical users can update treatments"
  ON public.treatments FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('treatments.persist'))
  WITH CHECK (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('treatments.persist'));
CREATE POLICY "Clinical users can delete own treatments"
  ON public.treatments FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);

-- TREATMENT DETAILS
DROP POLICY IF EXISTS "Users can view their own treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Users can insert their own treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Users can update their own treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Users can delete their own treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Clinical users can view own or clinic treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Entitled clinical users can insert treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Entitled clinical users can update treatment details" ON public.treatment_details;
DROP POLICY IF EXISTS "Clinical users can delete own treatment details" ON public.treatment_details;

CREATE POLICY "Clinical users can view own or clinic treatment details"
  ON public.treatment_details FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_details.treatment_id AND public.can_access_clinical_record(t.user_id, t.clinic_id)));
CREATE POLICY "Entitled clinical users can insert treatment details"
  ON public.treatment_details FOR INSERT
  WITH CHECK (public.user_has_entitlement('treatments.persist') AND EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_details.treatment_id AND public.can_access_clinical_record(t.user_id, t.clinic_id)));
CREATE POLICY "Entitled clinical users can update treatment details"
  ON public.treatment_details FOR UPDATE
  USING (public.user_has_entitlement('treatments.persist') AND EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_details.treatment_id AND public.can_access_clinical_record(t.user_id, t.clinic_id)));
CREATE POLICY "Clinical users can delete own treatment details"
  ON public.treatment_details FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_details.treatment_id AND NOT public.is_enterprise_user() AND t.user_id = auth.uid()));

-- CONSULTATIONS
DROP POLICY IF EXISTS "Users can view their own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Users can insert their own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Users can update their own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Users can delete their own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Clinical users can view own or clinic consultations" ON public.consultations;
DROP POLICY IF EXISTS "Entitled clinical users can insert consultations" ON public.consultations;
DROP POLICY IF EXISTS "Entitled clinical users can update consultations" ON public.consultations;
DROP POLICY IF EXISTS "Clinical users can delete own consultations" ON public.consultations;

CREATE POLICY "Clinical users can view own or clinic consultations"
  ON public.consultations FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert consultations"
  ON public.consultations FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('agenda.manage') AND (clinic_id IS NULL OR public.is_clinic_member(clinic_id)));
CREATE POLICY "Entitled clinical users can update consultations"
  ON public.consultations FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('agenda.manage'))
  WITH CHECK (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('agenda.manage'));
CREATE POLICY "Clinical users can delete own consultations"
  ON public.consultations FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);

-- PATIENT CLINICAL NOTES
DROP POLICY IF EXISTS "Users can view their own clinical notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Users can insert their own clinical notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Users can update their own clinical notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Users can delete their own clinical notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Clinical users can view own or clinic notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Entitled clinical users can insert clinical notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Entitled clinical users can update clinical notes" ON public.patient_clinical_notes;
DROP POLICY IF EXISTS "Clinical users can delete own clinical notes" ON public.patient_clinical_notes;

CREATE POLICY "Clinical users can view own or clinic notes"
  ON public.patient_clinical_notes FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert clinical notes"
  ON public.patient_clinical_notes FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Entitled clinical users can update clinical notes"
  ON public.patient_clinical_notes FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Clinical users can delete own clinical notes"
  ON public.patient_clinical_notes FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);

-- PATIENT GOALS (GAS)
DROP POLICY IF EXISTS "Users can view their own patient goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Users can insert their own patient goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Users can update their own patient goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Users can delete their own patient goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Clinical users can view own or clinic goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Entitled clinical users can insert goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Entitled clinical users can update goals" ON public.patient_goals;
DROP POLICY IF EXISTS "Clinical users can delete own goals" ON public.patient_goals;

CREATE POLICY "Clinical users can view own or clinic goals"
  ON public.patient_goals FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert goals"
  ON public.patient_goals FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Entitled clinical users can update goals"
  ON public.patient_goals FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Clinical users can delete own goals"
  ON public.patient_goals FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);

-- PATIENT GOAL SCORES
DROP POLICY IF EXISTS "Users can view their own patient goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Users can insert their own patient goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Users can update their own patient goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Users can delete their own patient goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Clinical users can view own or clinic goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Entitled clinical users can insert goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Entitled clinical users can update goal scores" ON public.patient_goal_scores;
DROP POLICY IF EXISTS "Clinical users can delete own goal scores" ON public.patient_goal_scores;

CREATE POLICY "Clinical users can view own or clinic goal scores"
  ON public.patient_goal_scores FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert goal scores"
  ON public.patient_goal_scores FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Entitled clinical users can update goal scores"
  ON public.patient_goal_scores FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('patients.manage'));
CREATE POLICY "Clinical users can delete own goal scores"
  ON public.patient_goal_scores FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);

-- TEMPLATES
DROP POLICY IF EXISTS "Users can view their own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON public.templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.templates;
DROP POLICY IF EXISTS "Clinical users can view own or clinic templates" ON public.templates;
DROP POLICY IF EXISTS "Entitled clinical users can insert templates" ON public.templates;
DROP POLICY IF EXISTS "Entitled clinical users can update templates" ON public.templates;
DROP POLICY IF EXISTS "Clinical users can delete own templates" ON public.templates;

CREATE POLICY "Clinical users can view own or clinic templates"
  ON public.templates FOR SELECT
  USING (public.can_access_clinical_record(user_id, clinic_id));
CREATE POLICY "Entitled clinical users can insert templates"
  ON public.templates FOR INSERT
  WITH CHECK (NOT public.is_enterprise_user() AND auth.uid() = user_id AND public.user_has_entitlement('templates.manage'));
CREATE POLICY "Entitled clinical users can update templates"
  ON public.templates FOR UPDATE
  USING (public.can_access_clinical_record(user_id, clinic_id) AND public.user_has_entitlement('templates.manage'));
CREATE POLICY "Clinical users can delete own templates"
  ON public.templates FOR DELETE
  USING (NOT public.is_enterprise_user() AND auth.uid() = user_id);
