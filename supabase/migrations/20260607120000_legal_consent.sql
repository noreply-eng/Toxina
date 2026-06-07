-- Legal documents catalog (versioned)
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_type text NOT NULL CHECK (document_type IN ('privacy', 'terms')),
  version text NOT NULL,
  title text NOT NULL,
  content_html text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (document_type, version)
);

-- User consent audit trail (append-only)
CREATE TABLE IF NOT EXISTS public.user_consent_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('privacy', 'terms')),
  document_version text NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('terms', 'privacy_sensitive', 'secondary_purposes')),
  granted boolean NOT NULL DEFAULT true,
  accepted_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  user_agent text,
  ip_address text,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_consent_events_user
  ON public.user_consent_events (user_id, accepted_at DESC);

-- Denormalized consent fields on user_profiles for fast guard checks
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_sensitive_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS secondary_purposes_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS secondary_purposes_version text,
  ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz;

-- ARCO request tickets
CREATE TABLE IF NOT EXISTS public.arco_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'rectification', 'cancellation', 'opposition')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_arco_requests_user
  ON public.arco_requests (user_id, created_at DESC);

-- RLS
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arco_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read legal documents"
  ON public.legal_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view their own consent events"
  ON public.user_consent_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consent events"
  ON public.user_consent_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own arco requests"
  ON public.arco_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own arco requests"
  ON public.arco_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RPC: record consents atomically
CREATE OR REPLACE FUNCTION public.record_user_consents(
  p_terms_version text,
  p_privacy_version text,
  p_secondary_purposes boolean,
  p_user_agent text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_consent_events (user_id, document_type, document_version, consent_type, granted, user_agent, ip_address)
  VALUES (v_user_id, 'terms', p_terms_version, 'terms', true, p_user_agent, p_ip_address);

  INSERT INTO public.user_consent_events (user_id, document_type, document_version, consent_type, granted, user_agent, ip_address)
  VALUES (v_user_id, 'privacy', p_privacy_version, 'privacy_sensitive', true, p_user_agent, p_ip_address);

  IF p_secondary_purposes THEN
    INSERT INTO public.user_consent_events (user_id, document_type, document_version, consent_type, granted, user_agent, ip_address)
    VALUES (v_user_id, 'privacy', p_privacy_version, 'secondary_purposes', true, p_user_agent, p_ip_address);
  ELSE
    INSERT INTO public.user_consent_events (user_id, document_type, document_version, consent_type, granted, user_agent, ip_address)
    VALUES (v_user_id, 'privacy', p_privacy_version, 'secondary_purposes', false, p_user_agent, p_ip_address);
  END IF;

  UPDATE public.user_profiles
  SET
    terms_accepted_at = v_now,
    terms_version = p_terms_version,
    privacy_sensitive_accepted_at = v_now,
    privacy_version = p_privacy_version,
    secondary_purposes_accepted_at = CASE WHEN p_secondary_purposes THEN v_now ELSE NULL END,
    secondary_purposes_version = CASE WHEN p_secondary_purposes THEN p_privacy_version ELSE NULL END,
    consent_revoked_at = NULL,
    updated_at = v_now
  WHERE id = v_user_id;
END;
$$;

-- RPC: update secondary purposes consent
CREATE OR REPLACE FUNCTION public.update_secondary_purposes_consent(
  p_granted boolean,
  p_privacy_version text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_consent_events (user_id, document_type, document_version, consent_type, granted, user_agent)
  VALUES (v_user_id, 'privacy', p_privacy_version, 'secondary_purposes', p_granted, p_user_agent);

  UPDATE public.user_profiles
  SET
    secondary_purposes_accepted_at = CASE WHEN p_granted THEN v_now ELSE NULL END,
    secondary_purposes_version = CASE WHEN p_granted THEN p_privacy_version ELSE NULL END,
    updated_at = v_now
  WHERE id = v_user_id;
END;
$$;

-- RPC: revoke all consents
CREATE OR REPLACE FUNCTION public.revoke_user_consents(
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc'::text, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_consent_events
  SET revoked_at = v_now
  WHERE user_id = v_user_id AND revoked_at IS NULL;

  UPDATE public.user_profiles
  SET
    consent_revoked_at = v_now,
    updated_at = v_now
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_user_consents TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_secondary_purposes_consent TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_consents TO authenticated;
