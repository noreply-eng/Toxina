-- ============================================================================
-- Migration 1: RBAC, Anti-Escalation, Multi-Clinic Core, Enterprise (B2B2C)
--              and Immutable Audit Logs for SonoTox (Toxina)
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Evolve user_profiles cleanly (resolving historical dual migrations)
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'specialist',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS active_clinic_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

-- Normalize legacy subscription_tier casing ('Free' -> 'free', 'Pro'/'Enterprise' -> 'premium')
UPDATE public.user_profiles
SET subscription_tier = CASE
  WHEN lower(coalesce(subscription_tier, 'free')) IN ('pro', 'enterprise', 'premium') THEN 'premium'
  WHEN lower(coalesce(subscription_tier, 'free')) = 'plus' THEN 'plus'
  ELSE 'free'
END;

-- Add/replace CHECK constraints safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_check') THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
  END IF;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('super_admin', 'support_admin', 'enterprise', 'specialist', 'assistant'));

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_status_check') THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_status_check;
  END IF;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_status_check
    CHECK (status IN ('active', 'pending', 'suspended'));

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_subscription_tier_check') THEN
    ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_subscription_tier_check;
  END IF;
  ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_subscription_tier_check
    CHECK (subscription_tier IN ('free', 'plus', 'premium'));
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (lower(email));

-- Backfill email from auth.users
UPDATE public.user_profiles up
SET email = u.email
FROM auth.users u
WHERE up.id = u.id
  AND (up.email IS NULL OR up.email <> u.email);

-- Ensure profile exists for any existing auth.users rows
INSERT INTO public.user_profiles (id, email, full_name, specialty, avatar_url)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'specialty',
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Seed initial super_admin account
UPDATE public.user_profiles
SET role = 'super_admin',
    is_active = true,
    status = 'active',
    subscription_tier = 'premium'
WHERE lower(coalesce(email, '')) = 'jmyocupicior@gmail.com';

-- Consolidate handle_new_user() trigger so new signups always populate email + metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := 'specialist';
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'jmyocupicior@gmail.com' THEN
    v_role := 'super_admin';
  END IF;

  PERFORM set_config('app.bypass_profile_guard', 'on', true);

  INSERT INTO public.user_profiles (id, email, full_name, specialty, avatar_url, role, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'specialty',
    NEW.raw_user_meta_data->>'avatar_url',
    v_role,
    CASE WHEN v_role = 'super_admin' THEN 'premium' ELSE 'free' END
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_auth_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    PERFORM set_config('app.bypass_profile_guard', 'on', true);
    UPDATE public.user_profiles
    SET email = NEW.email,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_auth_user_email();

-- ----------------------------------------------------------------------------
-- 2. RBAC Helper Functions (DB-backed, replacing hardcoded email checks)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
      AND status = 'active'
  );
$$;

-- Keep public.is_admin() as compatibility alias for existing policies (muscle_media / storage)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_enterprise_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'enterprise'
      AND is_active = true
      AND status = 'active'
  );
$$;

-- Anti-privilege-escalation trigger on user_profiles (protects both INSERT & UPDATE)
CREATE OR REPLACE FUNCTION public.guard_user_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass text := current_setting('app.bypass_profile_guard', true);
  v_is_service boolean := (current_user IN ('postgres', 'service_role', 'supabase_admin'));
BEGIN
  IF v_bypass = 'on' OR v_is_service OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'specialist';
    NEW.is_active := true;
    NEW.status := 'active';
    NEW.subscription_tier := 'free';
    NEW.feature_overrides := '{}'::jsonb;
    NEW.admin_notes := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.role := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.status := OLD.status;
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.feature_overrides := OLD.feature_overrides;
    NEW.admin_notes := OLD.admin_notes;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_sensitive_columns ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profile_sensitive_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_sensitive_columns();

-- Refresh RLS policies on user_profiles (100% idempotent)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.user_profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile or super admin views all" ON public.user_profiles;
CREATE POLICY "Users can view own profile or super admin views all"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.user_profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile or super admin updates all" ON public.user_profiles;
CREATE POLICY "Users can update own profile or super admin updates all"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_super_admin())
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. Multi-Clinic Tables (Clinics, Operational Schedules, Team Members)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  type text NOT NULL DEFAULT 'clinic'
    CHECK (type IN ('solo_practice', 'clinic', 'hospital', 'aesthetic_center', 'rehab_center')),
  phone text,
  email text,
  address text,
  city text,
  country text NOT NULL DEFAULT 'MX',
  tax_id text,
  license_number text,
  director_name text,
  director_license text,
  logo_url text,
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  currency text NOT NULL DEFAULT 'MXN',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.clinic_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  working_hours jsonb NOT NULL DEFAULT '{
    "monday":    {"enabled": true,  "open": "09:00", "close": "19:00", "break_start": "14:00", "break_end": "15:00"},
    "tuesday":   {"enabled": true,  "open": "09:00", "close": "19:00", "break_start": "14:00", "break_end": "15:00"},
    "wednesday": {"enabled": true,  "open": "09:00", "close": "19:00", "break_start": "14:00", "break_end": "15:00"},
    "thursday":  {"enabled": true,  "open": "09:00", "close": "19:00", "break_start": "14:00", "break_end": "15:00"},
    "friday":    {"enabled": true,  "open": "09:00", "close": "19:00", "break_start": "14:00", "break_end": "15:00"},
    "saturday":  {"enabled": true,  "open": "09:00", "close": "14:00"},
    "sunday":    {"enabled": false, "open": "09:00", "close": "14:00"}
  }'::jsonb,
  holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_appointment_duration int NOT NULL DEFAULT 30 CHECK (default_appointment_duration BETWEEN 5 AND 480),
  buffer_minutes int NOT NULL DEFAULT 10 CHECK (buffer_minutes BETWEEN 0 AND 120),
  max_appointments_per_day int DEFAULT 30,
  default_toxin_brand text DEFAULT 'Botox',
  allow_cross_doctor_patient_view boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.clinic_user_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_clinic text NOT NULL DEFAULT 'specialist'
    CHECK (role_in_clinic IN ('owner', 'director', 'clinic_admin', 'specialist', 'assistant')),
  status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_active boolean NOT NULL DEFAULT true,
  custom_working_hours jsonb,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (clinic_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clinic_rel_user ON public.clinic_user_relationships (user_id, is_active, status);
CREATE INDEX IF NOT EXISTS idx_clinic_rel_clinic ON public.clinic_user_relationships (clinic_id, is_active, status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_active_clinic_id_fkey') THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_active_clinic_id_fkey
      FOREIGN KEY (active_clinic_id) REFERENCES public.clinics(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_clinic_member(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_user_relationships cur
    WHERE cur.clinic_id = p_clinic_id
      AND cur.user_id = auth.uid()
      AND cur.is_active = true
      AND cur.status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_clinic_admin(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.clinic_user_relationships cur
    WHERE cur.clinic_id = p_clinic_id
      AND cur.user_id = auth.uid()
      AND cur.is_active = true
      AND cur.status = 'approved'
      AND cur.role_in_clinic IN ('owner', 'director', 'clinic_admin')
  );
$$;

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_user_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members or super admin can read clinics" ON public.clinics;
CREATE POLICY "Clinic members or super admin can read clinics"
  ON public.clinics FOR SELECT
  USING (public.is_super_admin() OR public.is_clinic_member(id));

DROP POLICY IF EXISTS "Clinic admins or super admin can update clinics" ON public.clinics;
CREATE POLICY "Clinic admins or super admin can update clinics"
  ON public.clinics FOR UPDATE
  USING (public.is_clinic_admin(id))
  WITH CHECK (public.is_clinic_admin(id));

DROP POLICY IF EXISTS "Super admin can manage clinics" ON public.clinics;
CREATE POLICY "Super admin can manage clinics"
  ON public.clinics FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Clinic members can read clinic configurations" ON public.clinic_configurations;
CREATE POLICY "Clinic members can read clinic configurations"
  ON public.clinic_configurations FOR SELECT
  USING (public.is_super_admin() OR public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Clinic admins can update clinic configurations" ON public.clinic_configurations;
CREATE POLICY "Clinic admins can update clinic configurations"
  ON public.clinic_configurations FOR ALL
  USING (public.is_clinic_admin(clinic_id))
  WITH CHECK (public.is_clinic_admin(clinic_id));

DROP POLICY IF EXISTS "Users can view own clinic memberships or clinic admins view team" ON public.clinic_user_relationships;
CREATE POLICY "Users can view own clinic memberships or clinic admins view team"
  ON public.clinic_user_relationships FOR SELECT
  USING (user_id = auth.uid() OR public.is_clinic_admin(clinic_id) OR public.is_super_admin());

DROP POLICY IF EXISTS "Clinic admins or super admin can manage clinic memberships" ON public.clinic_user_relationships;
CREATE POLICY "Clinic admins or super admin can manage clinic memberships"
  ON public.clinic_user_relationships FOR ALL
  USING (public.is_clinic_admin(clinic_id) OR public.is_super_admin())
  WITH CHECK (public.is_clinic_admin(clinic_id) OR public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 4. Enterprise B2B2C Subsystem (Pharma: Allergan, Ipsen, Merz, Schools)
--    Zero-PHI Isolation: Sponsors buy batches of 20 licenses & issue vouchers.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enterprise_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  organization_type text NOT NULL DEFAULT 'pharma'
    CHECK (organization_type IN ('pharma', 'aesthetic_school', 'university', 'medical_society', 'hospital_group', 'other')),
  brand_display_name text NOT NULL,
  logo_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  tax_id text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trial', 'suspended', 'archived')),
  allow_license_reassignment boolean NOT NULL DEFAULT true,
  default_license_duration_days int DEFAULT 365 CHECK (default_license_duration_days IS NULL OR default_license_duration_days > 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.enterprise_account_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_account_id uuid NOT NULL REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_org text NOT NULL DEFAULT 'manager'
    CHECK (role_in_org IN ('owner', 'manager', 'billing')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (enterprise_account_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.enterprise_license_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_account_id uuid NOT NULL REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE,
  batch_count int NOT NULL CHECK (batch_count >= 1),
  licenses_per_batch int NOT NULL DEFAULT 20 CHECK (licenses_per_batch = 20),
  total_licenses int GENERATED ALWAYS AS (batch_count * licenses_per_batch) STORED,
  billing_interval text NOT NULL DEFAULT 'annual'
    CHECK (billing_interval IN ('monthly', 'annual', 'custom', 'pilot_free')),
  unit_batch_price_cents int NOT NULL DEFAULT 0 CHECK (unit_batch_price_cents >= 0),
  amount_total_cents int NOT NULL DEFAULT 0 CHECK (amount_total_cents >= 0),
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending_payment', 'active', 'past_due', 'expired', 'canceled')),
  payment_processor text NOT NULL DEFAULT 'manual'
    CHECK (payment_processor IN ('comped', 'manual', 'stripe', 'mercadopago')),
  external_subscription_id text,
  external_invoice_id text,
  starts_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz,
  purchase_order_ref text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.enterprise_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_account_id uuid NOT NULL REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.enterprise_license_batches(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  campaign_name text,
  voucher_type text NOT NULL DEFAULT 'single_use'
    CHECK (voucher_type IN ('single_use', 'multi_use')),
  max_redemptions int NOT NULL DEFAULT 1 CHECK (max_redemptions >= 1),
  times_redeemed int NOT NULL DEFAULT 0 CHECK (times_redeemed >= 0 AND times_redeemed <= max_redemptions),
  license_duration_days int CHECK (license_duration_days IS NULL OR license_duration_days > 0),
  valid_from timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.enterprise_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_account_id uuid NOT NULL REFERENCES public.enterprise_accounts(id) ON DELETE CASCADE,
  voucher_id uuid REFERENCES public.enterprise_vouchers(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  activated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_licenses_active_unique
  ON public.enterprise_licenses (enterprise_account_id, user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_user ON public.enterprise_licenses (user_id, status);
CREATE INDEX IF NOT EXISTS idx_enterprise_vouchers_code ON public.enterprise_vouchers (upper(code));
CREATE INDEX IF NOT EXISTS idx_enterprise_batches_account ON public.enterprise_license_batches (enterprise_account_id, status);

CREATE OR REPLACE FUNCTION public.is_enterprise_manager(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.enterprise_account_managers eam
    WHERE eam.enterprise_account_id = p_account_id
      AND eam.user_id = auth.uid()
      AND eam.is_active = true
  );
$$;

ALTER TABLE public.enterprise_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_account_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_license_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enterprise managers or licensed users can read enterprise accounts" ON public.enterprise_accounts;
CREATE POLICY "Enterprise managers or licensed users can read enterprise accounts"
  ON public.enterprise_accounts FOR SELECT
  USING (
    public.is_super_admin()
    OR public.is_enterprise_manager(id)
    OR EXISTS (
      SELECT 1 FROM public.enterprise_licenses el
      WHERE el.enterprise_account_id = enterprise_accounts.id
        AND el.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Super admin manages enterprise accounts" ON public.enterprise_accounts;
CREATE POLICY "Super admin manages enterprise accounts"
  ON public.enterprise_accounts FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Managers can view own enterprise memberships" ON public.enterprise_account_managers;
CREATE POLICY "Managers can view own enterprise memberships"
  ON public.enterprise_account_managers FOR SELECT
  USING (user_id = auth.uid() OR public.is_enterprise_manager(enterprise_account_id));

DROP POLICY IF EXISTS "Super admin manages enterprise managers" ON public.enterprise_account_managers;
CREATE POLICY "Super admin manages enterprise managers"
  ON public.enterprise_account_managers FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Managers and super admin can view enterprise batches" ON public.enterprise_license_batches;
CREATE POLICY "Managers and super admin can view enterprise batches"
  ON public.enterprise_license_batches FOR SELECT
  USING (public.is_enterprise_manager(enterprise_account_id));

DROP POLICY IF EXISTS "Super admin manages enterprise batches" ON public.enterprise_license_batches;
CREATE POLICY "Super admin manages enterprise batches"
  ON public.enterprise_license_batches FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Managers and super admin can view enterprise vouchers" ON public.enterprise_vouchers;
CREATE POLICY "Managers and super admin can view enterprise vouchers"
  ON public.enterprise_vouchers FOR SELECT
  USING (public.is_enterprise_manager(enterprise_account_id));

DROP POLICY IF EXISTS "Super admin manages enterprise vouchers" ON public.enterprise_vouchers;
CREATE POLICY "Super admin manages enterprise vouchers"
  ON public.enterprise_vouchers FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Doctors view own license and managers view org licenses" ON public.enterprise_licenses;
CREATE POLICY "Doctors view own license and managers view org licenses"
  ON public.enterprise_licenses FOR SELECT
  USING (user_id = auth.uid() OR public.is_enterprise_manager(enterprise_account_id));

DROP POLICY IF EXISTS "Super admin manages enterprise licenses" ON public.enterprise_licenses;
CREATE POLICY "Super admin manages enterprise licenses"
  ON public.enterprise_licenses FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 5. Add clinic_id (nullable) to ALL clinical tables for backward compatibility
-- ----------------------------------------------------------------------------
ALTER TABLE public.patients               ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.treatments             ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.treatment_details      ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.consultations          ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.patient_clinical_notes ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.patient_goals          ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.patient_goal_scores    ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.templates              ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients (clinic_id) WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON public.treatments (clinic_id) WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultations_clinic_id ON public.consultations (clinic_id) WHERE clinic_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. Immutable Audit Logs Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  enterprise_account_id uuid REFERENCES public.enterprise_accounts(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_clinic ON public.audit_logs (clinic_id) WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_enterprise ON public.audit_logs (enterprise_account_id) WHERE enterprise_account_id IS NOT NULL;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs readable by super admin or scoped admins" ON public.audit_logs;
CREATE POLICY "Audit logs readable by super admin or scoped admins"
  ON public.audit_logs FOR SELECT
  USING (
    public.is_super_admin()
    OR (clinic_id IS NOT NULL AND public.is_clinic_admin(clinic_id))
    OR (enterprise_account_id IS NOT NULL AND public.is_enterprise_manager(enterprise_account_id))
  );

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_clinic_id uuid DEFAULT NULL,
  p_enterprise_account_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    actor_user_id,
    clinic_id,
    enterprise_account_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values
  )
  VALUES (
    auth.uid(),
    p_clinic_id,
    p_enterprise_account_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    p_new_values
  );
END;
$$;

DROP POLICY IF EXISTS "Super admin can manage all arco requests" ON public.arco_requests;
CREATE POLICY "Super admin can manage all arco requests"
  ON public.arco_requests FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin can manage legal documents" ON public.legal_documents;
CREATE POLICY "Super admin can manage legal documents"
  ON public.legal_documents FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
