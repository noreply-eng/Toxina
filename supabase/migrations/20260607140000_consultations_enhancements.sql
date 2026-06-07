-- Enhanced consultation scheduling fields
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 30
    CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'calculator_followup', 'import'));

CREATE INDEX IF NOT EXISTS idx_consultations_user_status_date
  ON public.consultations (user_id, status, consultation_date);

-- Appointment reminder preferences on user profile
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS appointment_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_appointment_duration integer NOT NULL DEFAULT 30
    CHECK (default_appointment_duration > 0 AND default_appointment_duration <= 480);

COMMENT ON COLUMN public.consultations.duration_minutes IS 'Expected appointment length in minutes';
COMMENT ON COLUMN public.consultations.completed_at IS 'When the consultation was marked completed';
COMMENT ON COLUMN public.consultations.cancellation_reason IS 'Optional reason when status is cancelled';
COMMENT ON COLUMN public.consultations.source IS 'How the appointment was created';
COMMENT ON COLUMN public.user_profiles.appointment_reminders IS 'Enable local appointment reminder notifications';
COMMENT ON COLUMN public.user_profiles.default_appointment_duration IS 'Default duration for new appointments in minutes';
