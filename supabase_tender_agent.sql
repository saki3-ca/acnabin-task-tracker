-- ============================================================================
-- TENDER AGENT tab
--  * Only Admin + people the Admin picks (Admin Panel -> Tab Access) can see it.
--  * Access is checked in the database; the tab button is hidden for everyone else.
-- Run once in Supabase Dashboard -> SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tender_agent_access (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.tender_agent_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tender_agent_access FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._tender_agent_caller(p_session TEXT)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_user.role = 'ADMIN' OR EXISTS (SELECT 1 FROM public.tender_agent_access a WHERE a.user_id = v_user.id) THEN
    RETURN v_user;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._tender_agent_caller(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_tender_agent_has_access(p_session TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN (SELECT (c).id IS NOT NULL FROM (SELECT public._tender_agent_caller(p_session) AS c) x);
END;
$$;

-- Admin chooses who gets the tab
CREATE OR REPLACE FUNCTION public.app_tender_agent_access_get(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._tender_agent_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT jsonb_agg(user_id) FROM public.tender_agent_access), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_tender_agent_access_set(p_session TEXT, p_user_ids JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._tender_agent_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_user_ids IS NULL OR jsonb_typeof(p_user_ids) <> 'array' THEN RETURN 'FORBIDDEN'; END IF;

  DELETE FROM public.tender_agent_access
  WHERE user_id NOT IN (SELECT jsonb_array_elements_text(p_user_ids));
  INSERT INTO public.tender_agent_access (user_id, granted_by)
  SELECT u.id, v_user.id FROM public.users u
  WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_tender_agent_has_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_tender_agent_access_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_tender_agent_access_set(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_tender_agent_has_access(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tender_agent_access_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tender_agent_access_set(TEXT, JSONB) TO anon, authenticated;
