-- ============================================================================
-- Migration 3: Premium Clinical CMS (Procedure Videos, Clinical Pearls,
--              Pre-designed Protocols) & Protected Muscle Media Access
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.procedure_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muscle_id text,
  protocol_id uuid,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'usg_guided'
    CHECK (category IN ('usg_guided', 'anatomical', 'reconstitution', 'clinical_case')),
  duration_seconds int,
  video_storage_path text,
  video_provider text NOT NULL DEFAULT 'supabase_storage'
    CHECK (video_provider IN ('supabase_storage', 'mux', 'cloudflare_stream', 'vimeo_private')),
  thumbnail_url text,
  required_tier text NOT NULL DEFAULT 'premium' CHECK (required_tier IN ('free', 'plus', 'premium')),
  is_published boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.muscle_clinical_pearls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muscle_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  pearl_type text NOT NULL DEFAULT 'technique'
    CHECK (pearl_type IN ('technique', 'safety_warning', 'usg_tip', 'dosing_tip', 'pitfall')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  evidence_reference text,
  required_tier text NOT NULL DEFAULT 'premium' CHECK (required_tier IN ('free', 'plus', 'premium')),
  is_published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.clinical_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  specialty_category text NOT NULL DEFAULT 'spasticity',
  suggested_brand text,
  max_session_dose_json jsonb,
  muscles_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  clinical_notes text,
  safety_precautions jsonb NOT NULL DEFAULT '[]'::jsonb,
  references_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_tier text NOT NULL DEFAULT 'premium' CHECK (required_tier IN ('free', 'plus', 'premium')),
  is_published boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'procedure_videos_protocol_id_fkey') THEN
    ALTER TABLE public.procedure_videos
      ADD CONSTRAINT procedure_videos_protocol_id_fkey
      FOREIGN KEY (protocol_id) REFERENCES public.clinical_protocols(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_procedure_videos_muscle ON public.procedure_videos (muscle_id) WHERE muscle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_muscle_clinical_pearls_muscle ON public.muscle_clinical_pearls (muscle_id);
CREATE INDEX IF NOT EXISTS idx_clinical_protocols_category ON public.clinical_protocols (specialty_category);

ALTER TABLE public.procedure_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muscle_clinical_pearls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entitled users can read published videos" ON public.procedure_videos;
CREATE POLICY "Entitled users can read published videos"
  ON public.procedure_videos FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (is_published = true AND (required_tier = 'free' OR public.user_has_entitlement('content.videos')))
  );

DROP POLICY IF EXISTS "Super admin manages procedure videos" ON public.procedure_videos;
CREATE POLICY "Super admin manages procedure videos"
  ON public.procedure_videos FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Entitled users can read published clinical pearls" ON public.muscle_clinical_pearls;
CREATE POLICY "Entitled users can read published clinical pearls"
  ON public.muscle_clinical_pearls FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (is_published = true AND (required_tier = 'free' OR public.user_has_entitlement('content.clinical_pearls')))
  );

DROP POLICY IF EXISTS "Super admin manages clinical pearls" ON public.muscle_clinical_pearls;
CREATE POLICY "Super admin manages clinical pearls"
  ON public.muscle_clinical_pearls FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Entitled users can read published protocols" ON public.clinical_protocols;
CREATE POLICY "Entitled users can read published protocols"
  ON public.clinical_protocols FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR (is_published = true AND (required_tier = 'free' OR public.user_has_entitlement('content.protocols')))
  );

DROP POLICY IF EXISTS "Super admin manages clinical protocols" ON public.clinical_protocols;
CREATE POLICY "Super admin manages clinical protocols"
  ON public.clinical_protocols FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Authenticated users can read muscle media" ON public.muscle_media;
DROP POLICY IF EXISTS "Entitled users can read muscle media" ON public.muscle_media;
CREATE POLICY "Entitled users can read muscle media"
  ON public.muscle_media FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
    OR public.user_has_entitlement('guides.usg')
    OR public.user_has_entitlement('guides.anatomy')
  );
