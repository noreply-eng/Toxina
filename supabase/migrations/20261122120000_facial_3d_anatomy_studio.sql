-- ============================================================================
-- Migration: Facial 3D Anatomy Studio (Z-Anatomy / GLB + Mesh Mappings + Pins)
-- 100% Idempotent — safe to re-run in Supabase SQL Editor or via db push
-- ============================================================================

-- 1. Table to store versioned 3D anatomical models, mesh->muscle mappings,
--    3D injection pin coordinates and CC BY-SA 4.0 / license attribution metadata.
CREATE TABLE IF NOT EXISTS public.facial_3d_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  model_url text,
  storage_path text,
  file_size_bytes bigint,
  draco_compressed boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  license_name text NOT NULL DEFAULT 'CC BY-SA 4.0',
  attribution_text text NOT NULL DEFAULT 'Licencia CC BY-SA 4.0',
  attribution_url text DEFAULT 'https://creativecommons.org/licenses/by-sa/4.0/',
  mesh_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  injection_pins jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_facial_3d_models_active
  ON public.facial_3d_models (is_active);

ALTER TABLE public.facial_3d_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active facial 3D models" ON public.facial_3d_models;
CREATE POLICY "Authenticated users can read active facial 3D models"
  ON public.facial_3d_models FOR SELECT
  TO authenticated
  USING (public.is_admin() OR is_active = true);

DROP POLICY IF EXISTS "Super admin manages facial 3D models" ON public.facial_3d_models;
CREATE POLICY "Super admin manages facial 3D models"
  ON public.facial_3d_models FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_facial_3d_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS facial_3d_models_updated_at ON public.facial_3d_models;
CREATE TRIGGER facial_3d_models_updated_at
  BEFORE UPDATE ON public.facial_3d_models
  FOR EACH ROW
  EXECUTE FUNCTION public.set_facial_3d_models_updated_at();

-- 2. Storage bucket for Draco-compressed GLB / GLTF 3D facial anatomy assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anatomy-3d',
  'anatomy-3d',
  true,
  52428800, -- 50 MB max per GLB upload
  ARRAY['model/gltf-binary', 'model/gltf+json', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anatomy 3D models are publicly readable" ON storage.objects;
CREATE POLICY "Anatomy 3D models are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'anatomy-3d');

DROP POLICY IF EXISTS "Super admin can upload anatomy 3D models" ON storage.objects;
CREATE POLICY "Super admin can upload anatomy 3D models"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'anatomy-3d' AND public.is_admin());

DROP POLICY IF EXISTS "Super admin can update anatomy 3D models" ON storage.objects;
CREATE POLICY "Super admin can update anatomy 3D models"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'anatomy-3d' AND public.is_admin());

DROP POLICY IF EXISTS "Super admin can delete anatomy 3D models" ON storage.objects;
CREATE POLICY "Super admin can delete anatomy 3D models"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'anatomy-3d' AND public.is_admin());
