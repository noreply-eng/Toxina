-- Add avatar_url and height columns to patients table
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS height NUMERIC;

-- Create storage bucket for patient avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-avatars',
  'patient-avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for patient-avatars bucket

-- Allow public read access to patient avatars
CREATE POLICY "Patient avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'patient-avatars');

-- Allow authenticated users to upload avatars for their own patients
CREATE POLICY "Users can upload avatars for their patients"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'patient-avatars' AND
  auth.uid() IN (
    SELECT user_id FROM public.patients 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow users to update avatars for their own patients
CREATE POLICY "Users can update avatars for their patients"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'patient-avatars' AND
  auth.uid() IN (
    SELECT user_id FROM public.patients 
    WHERE id::text = (storage.foldername(name))[1]
  )
);

-- Allow users to delete avatars for their own patients
CREATE POLICY "Users can delete avatars for their patients"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'patient-avatars' AND
  auth.uid() IN (
    SELECT user_id FROM public.patients 
    WHERE id::text = (storage.foldername(name))[1]
  )
);
