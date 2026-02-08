-- Add font size preference field to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'medium';

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.font_size IS 'User font size preference: small, medium, or large';

-- Add check constraint to ensure valid values
ALTER TABLE public.user_profiles
ADD CONSTRAINT font_size_check CHECK (font_size IN ('small', 'medium', 'large'));
