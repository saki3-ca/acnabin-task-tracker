-- ============================================================================
-- ACCESS v4
--  * Admin can no longer be picked as a proposal assignee.
--  * Admin can give anyone the Manpower tab (table + 3 functions), and those
--    people can also see the salary figures in it.
-- Run once in Supabase Dashboard -> SQL Editor (after supabase_proposals_v3.sql).
-- ============================================================================

-- PART 1: proposal assignee list = people with access, never Admin
CREATE OR REPLACE FUNCTION public.app_proposal_people(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._proposal_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'designation', u.designation) ORDER BY u.name)
    FROM public.users u
    WHERE u.status = 'ACTIVE'
      AND u.role <> 'ADMIN'
      AND u.id IN (SELECT user_id FROM public.proposal_access)
  ), '[]'::jsonb);
END;
$$;

-- PART 2: Manpower access table
CREATE TABLE IF NOT EXISTS public.manpower_access (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.manpower_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manpower_access FROM anon, authenticated;

-- PART 3: has-access / get / set
CREATE OR REPLACE FUNCTION public.app_manpower_has_access(p_session TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN FALSE; END IF;
  RETURN v_user.role = 'ADMIN' OR EXISTS (SELECT 1 FROM public.manpower_access a WHERE a.user_id = v_user.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_manpower_access_get(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT jsonb_agg(user_id) FROM public.manpower_access), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_manpower_access_set(p_session TEXT, p_user_ids JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND OR v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_user_ids IS NULL OR jsonb_typeof(p_user_ids) <> 'array' THEN RETURN 'FORBIDDEN'; END IF;

  DELETE FROM public.manpower_access
  WHERE user_id NOT IN (SELECT jsonb_array_elements_text(p_user_ids));
  INSERT INTO public.manpower_access (user_id, granted_by)
  SELECT u.id, v_user.id FROM public.users u
  WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_manpower_has_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_manpower_access_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_manpower_access_set(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_manpower_has_access(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_manpower_access_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_manpower_access_set(TEXT, JSONB) TO anon, authenticated;

-- PART 4: people with the Manpower tab can also read the salary figures
CREATE OR REPLACE FUNCTION public.app_get_manpower_salaries(p_session TEXT)
RETURNS TABLE (emp_id TEXT, salary NUMERIC, conveyance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_user.role = 'ADMIN'
     OR v_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner')
     OR EXISTS (SELECT 1 FROM public.manpower_access a WHERE a.user_id = v_user.id) THEN
    RETURN QUERY SELECT m.emp_id, m.salary, m.conveyance FROM public.manpower_salary m;
  END IF;
END;
$$;
