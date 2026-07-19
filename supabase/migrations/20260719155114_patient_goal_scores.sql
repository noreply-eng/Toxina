-- Longitudinal GAS score history (one evaluation per goal per clinical date)
CREATE TABLE IF NOT EXISTS public.patient_goal_scores (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES public.patient_goals(id) ON DELETE CASCADE NOT NULL,
  score smallint NOT NULL CHECK (score >= -2 AND score <= 2),
  scored_at date NOT NULL DEFAULT (timezone('utc'::text, now())::date),
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT patient_goal_scores_goal_date_unique UNIQUE (goal_id, scored_at)
);

CREATE INDEX IF NOT EXISTS idx_patient_goal_scores_patient_date
  ON public.patient_goal_scores (patient_id, scored_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patient_goal_scores_goal_date
  ON public.patient_goal_scores (goal_id, scored_at DESC);

ALTER TABLE public.patient_goal_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patient goal scores" ON public.patient_goal_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patient goal scores" ON public.patient_goal_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patient goal scores" ON public.patient_goal_scores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patient goal scores" ON public.patient_goal_scores
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_patient_goal_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patient_goal_scores_updated_at ON public.patient_goal_scores;
CREATE TRIGGER patient_goal_scores_updated_at
  BEFORE UPDATE ON public.patient_goal_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_patient_goal_scores_updated_at();

-- Seed history from existing current_score values (one-time backfill)
INSERT INTO public.patient_goal_scores (
  user_id,
  patient_id,
  goal_id,
  score,
  scored_at
)
SELECT
  g.user_id,
  g.patient_id,
  g.id,
  g.current_score,
  COALESCE(g.updated_at::date, g.created_at::date, timezone('utc'::text, now())::date)
FROM public.patient_goals g
WHERE g.current_score IS NOT NULL
ON CONFLICT (goal_id, scored_at) DO NOTHING;
