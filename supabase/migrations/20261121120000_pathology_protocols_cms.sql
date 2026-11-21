-- ============================================================================
-- Migration: Editable Pathology Protocols by SuperAdmin & Storage Unification
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

-- 1. Unify public.is_admin() with public.is_super_admin() so medical-media
--    storage policies and legacy admin checks work for all SuperAdmins.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'jmyocupicior@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'super_admin'
        AND coalesce(up.is_active, true) = true
    );
$$;

-- 2. Ensure clinical_protocols table exists and allows all authenticated users
--    to read published pathology protocols (including inside the Calculator).
CREATE TABLE IF NOT EXISTS public.clinical_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  specialty_category text NOT NULL DEFAULT 'neurological',
  suggested_brand text,
  max_session_dose_json jsonb,
  muscles_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  clinical_notes text,
  safety_precautions jsonb NOT NULL DEFAULT '[]'::jsonb,
  references_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_tier text NOT NULL DEFAULT 'free' CHECK (required_tier IN ('free', 'plus', 'premium')),
  is_published boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entitled users can read published protocols" ON public.clinical_protocols;
CREATE POLICY "Entitled users can read published protocols"
  ON public.clinical_protocols FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR is_published = true
  );

DROP POLICY IF EXISTS "Super admin manages clinical protocols" ON public.clinical_protocols;
CREATE POLICY "Super admin manages clinical protocols"
  ON public.clinical_protocols FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
