-- Patient SMART goals with Goal Attainment Scale (GAS) descriptors
CREATE TABLE IF NOT EXISTS public.patient_goals (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  smart_specific text,
  smart_measurable text,
  smart_achievable text,
  smart_relevant text,
  smart_timebound text,
  gas_minus2 text,
  gas_minus1 text,
  gas_zero text NOT NULL,
  gas_plus1 text,
  gas_plus2 text,
  current_score smallint CHECK (current_score >= -2 AND current_score <= 2),
  target_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'archived')),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_goals_patient_status
  ON public.patient_goals (patient_id, status);

ALTER TABLE public.patient_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patient goals" ON public.patient_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patient goals" ON public.patient_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patient goals" ON public.patient_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patient goals" ON public.patient_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_patient_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patient_goals_updated_at ON public.patient_goals;
CREATE TRIGGER patient_goals_updated_at
  BEFORE UPDATE ON public.patient_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_patient_goals_updated_at();
