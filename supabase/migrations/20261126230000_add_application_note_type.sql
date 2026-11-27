-- Add 'application' clinical note type ('general' is displayed as 'Primera vez' in UI)
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'patient_clinical_notes'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%note_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.patient_clinical_notes DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.patient_clinical_notes
  ADD CONSTRAINT patient_clinical_notes_note_type_check
  CHECK (note_type IN ('evolution', 'follow_up', 'application', 'general'));
