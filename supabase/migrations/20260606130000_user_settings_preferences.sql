-- Medical and personalization preferences for user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS default_brand TEXT DEFAULT 'Botox',
ADD COLUMN IF NOT EXISTS unit_system TEXT DEFAULT 'allergan',
ADD COLUMN IF NOT EXISTS default_dose_option TEXT DEFAULT 'min',
ADD COLUMN IF NOT EXISTS default_dilution TEXT DEFAULT '2.5',
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'es',
ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT false;

ALTER TABLE public.user_profiles
ADD CONSTRAINT default_brand_check
CHECK (default_brand IN ('Botox', 'Dysport', 'Xeomin'));

ALTER TABLE public.user_profiles
ADD CONSTRAINT unit_system_check
CHECK (unit_system IN ('allergan', 'speywood'));

ALTER TABLE public.user_profiles
ADD CONSTRAINT default_dose_option_check
CHECK (default_dose_option IN ('min', 'max'));

ALTER TABLE public.user_profiles
ADD CONSTRAINT language_check
CHECK (language IN ('es', 'en'));

COMMENT ON COLUMN public.user_profiles.default_brand IS 'Default toxin brand for calculator';
COMMENT ON COLUMN public.user_profiles.unit_system IS 'Unit display system: allergan (Botox/Xeomin) or speywood (Dysport)';
COMMENT ON COLUMN public.user_profiles.default_dose_option IS 'Default dose selection when loading pathology: min or max';
COMMENT ON COLUMN public.user_profiles.default_dilution IS 'Default vial dilution in ml';
COMMENT ON COLUMN public.user_profiles.language IS 'App language preference: es or en';
COMMENT ON COLUMN public.user_profiles.dark_mode IS 'Dark mode preference';
