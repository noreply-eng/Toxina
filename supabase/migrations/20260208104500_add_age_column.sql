-- Add 'age' column to patients table to support direct age entry from calculator
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS age INTEGER;

-- Optional: Calculate age from date_of_birth if age is null and dob exists
UPDATE public.patients
SET age = EXTRACT(YEAR FROM age(date_of_birth))
WHERE age IS NULL AND date_of_birth IS NOT NULL;
