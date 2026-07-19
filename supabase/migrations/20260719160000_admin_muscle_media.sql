-- =====================================================================
-- Admin role + editable muscle media (motor point / USG images)
-- Single admin identified by email. Security enforced at the DB layer
-- via public.is_admin() + RLS. All authenticated users can READ media
-- so admin-curated images appear for everyone; only the admin can WRITE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin detection helper (reads the email claim from the JWT)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'jmyocupicior@gmail.com';
$$;

-- ---------------------------------------------------------------------
-- muscle_media: admin-managed images/coordinates keyed by muscle id
-- (muscle_id matches the static id used in data/muscleData.ts)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.muscle_media (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  muscle_id text NOT NULL UNIQUE,
  motor_point_image_url text,
  motor_point_coord_x numeric CHECK (motor_point_coord_x >= 0 AND motor_point_coord_x <= 100),
  motor_point_coord_y numeric CHECK (motor_point_coord_y >= 0 AND motor_point_coord_y <= 100),
  usg_image_url text,
  usg_view text CHECK (usg_view IN ('Transversal', 'Longitudinal', 'Ambas')),
  notes text,
  updated_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_muscle_media_muscle_id
  ON public.muscle_media (muscle_id);

ALTER TABLE public.muscle_media ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read admin-curated media
DROP POLICY IF EXISTS "Authenticated users can read muscle media" ON public.muscle_media;
CREATE POLICY "Authenticated users can read muscle media" ON public.muscle_media
  FOR SELECT
  TO authenticated
  USING (true);

-- Only the admin can create/update/delete media
DROP POLICY IF EXISTS "Admin can insert muscle media" ON public.muscle_media;
CREATE POLICY "Admin can insert muscle media" ON public.muscle_media
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can update muscle media" ON public.muscle_media;
CREATE POLICY "Admin can update muscle media" ON public.muscle_media
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete muscle media" ON public.muscle_media;
CREATE POLICY "Admin can delete muscle media" ON public.muscle_media
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_muscle_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS muscle_media_updated_at ON public.muscle_media;
CREATE TRIGGER muscle_media_updated_at
  BEFORE UPDATE ON public.muscle_media
  FOR EACH ROW
  EXECUTE FUNCTION public.set_muscle_media_updated_at();

-- ---------------------------------------------------------------------
-- Storage bucket for admin-uploaded medical media
-- Public read (images shown to all users); writes restricted to admin.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-media',
  'medical-media',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Medical media is publicly accessible" ON storage.objects;
CREATE POLICY "Medical media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'medical-media');

DROP POLICY IF EXISTS "Admin can upload medical media" ON storage.objects;
CREATE POLICY "Admin can upload medical media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medical-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admin can update medical media" ON storage.objects;
CREATE POLICY "Admin can update medical media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'medical-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admin can delete medical media" ON storage.objects;
CREATE POLICY "Admin can delete medical media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'medical-media' AND public.is_admin());
