-- Chronological clinical follow-up / evolution notes per patient expediente
CREATE TABLE IF NOT EXISTS public.patient_clinical_notes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  note_date date NOT NULL DEFAULT (timezone('utc'::text, now())::date),
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'evolution'
    CHECK (note_type IN ('evolution', 'follow_up', 'general')),
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_notes_patient_date
  ON public.patient_clinical_notes (patient_id, note_date DESC, created_at DESC);

ALTER TABLE public.patient_clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clinical notes" ON public.patient_clinical_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clinical notes" ON public.patient_clinical_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clinical notes" ON public.patient_clinical_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clinical notes" ON public.patient_clinical_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_patient_clinical_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patient_clinical_notes_updated_at ON public.patient_clinical_notes;
CREATE TRIGGER patient_clinical_notes_updated_at
  BEFORE UPDATE ON public.patient_clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_patient_clinical_notes_updated_at();
