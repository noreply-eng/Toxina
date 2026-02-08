-- Add brand color customization fields to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#8b5cf6';

-- Add comment for documentation
COMMENT ON COLUMN public.user_profiles.primary_color IS 'User-selected primary brand color (hex code)';
COMMENT ON COLUMN public.user_profiles.secondary_color IS 'User-selected secondary brand color (hex code)';
