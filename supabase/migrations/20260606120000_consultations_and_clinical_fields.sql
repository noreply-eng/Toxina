-- Consultations table for appointment scheduling
CREATE TABLE IF NOT EXISTS public.consultations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  consultation_date timestamptz NOT NULL,
  visit_type text NOT NULL CHECK (visit_type IN ('new_application', 'post_application_review')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
  treatment_type text,
  pathology_id text,
  notes text,
  linked_treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_consultations_user_date
  ON public.consultations (user_id, consultation_date);

CREATE INDEX IF NOT EXISTS idx_consultations_patient_status
  ON public.consultations (patient_id, status);

-- Patient medical summary (general clinical summary for the record)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS medical_summary text;

-- Structured clinical fields on treatments
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS clinical_summary text,
  ADD COLUMN IF NOT EXISTS pathology_id text,
  ADD COLUMN IF NOT EXISTS pathology_title text,
  ADD COLUMN IF NOT EXISTS adjustment_factor numeric,
  ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL;

-- RLS for consultations
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consultations" ON public.consultations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consultations" ON public.consultations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consultations" ON public.consultations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consultations" ON public.consultations
  FOR DELETE USING (auth.uid() = user_id);

-- Auto-update updated_at on consultations
CREATE OR REPLACE FUNCTION public.set_consultations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consultations_updated_at ON public.consultations;
CREATE TRIGGER consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_consultations_updated_at();
