-- Add missing columns to patients table to match NewPatient form
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS height NUMERIC,
ADD COLUMN IF NOT EXISTS medical_history TEXT,
ADD COLUMN IF NOT EXISTS allergies TEXT,
ADD COLUMN IF NOT EXISTS current_medications TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate existing birth_date data to date_of_birth (if any exists)
UPDATE public.patients 
SET date_of_birth = birth_date 
WHERE birth_date IS NOT NULL AND date_of_birth IS NULL;

-- Optional: Drop old birth_date column after migration is confirmed
-- ALTER TABLE public.patients DROP COLUMN IF EXISTS birth_date;
