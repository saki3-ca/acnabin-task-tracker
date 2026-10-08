-- ============================================================================
-- TENDER AGENT admin bridge (Task Tracker project)
--  Lets a Task Tracker Admin manage Tender Agent sources without a second sign-in.
--  The portal asks for a short-lived "bridge token" (8 hours, Admin only) and hands it to the
--  Tender Agent dashboard. The Tender Agent database checks the token here before any admin change.
--  A leaked token can only edit tender sources; it is not a Task Tracker login.
-- Run once in the TASK TRACKER Supabase project (SQL Editor). Run supabase_tender_agent.sql first.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tender_agent_bridge_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.tender_agent_bridge_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tender_agent_bridge_tokens FROM anon, authenticated;

-- Admin only: returns a new token (NULL for anyone else)
CREATE OR REPLACE FUNCTION public.app_tender_agent_bridge_issue(p_session TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_token TEXT;
BEGIN
  v_user := public._tender_agent_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;

  DELETE FROM public.tender_agent_bridge_tokens WHERE expires_at < NOW();
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.tender_agent_bridge_tokens (token_hash, user_id, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), v_user.id, NOW() + INTERVAL '8 hours');
  RETURN v_token;
END;
$$;

-- Called by the Tender Agent database: TRUE only for an unexpired token of a still-active Admin
CREATE OR REPLACE FUNCTION public.app_tender_agent_bridge_verify(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.tender_agent_bridge_tokens t JOIN public.users u ON u.id = t.user_id
    WHERE t.token_hash = encode(digest(COALESCE(p_token, ''), 'sha256'), 'hex')
      AND t.expires_at > NOW() AND u.status = 'ACTIVE' AND u.role = 'ADMIN'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.app_tender_agent_bridge_issue(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_tender_agent_bridge_verify(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_tender_agent_bridge_issue(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tender_agent_bridge_verify(TEXT) TO anon, authenticated;
