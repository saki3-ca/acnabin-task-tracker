-- ============================================================================
-- USER QUERIES: users send a text query to Admin; Admin resolves it.
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_profile_info.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_queries (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS user_queries_status_idx ON public.user_queries (status, created_at);

ALTER TABLE public.user_queries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_queries FROM anon, authenticated;

-- A user sends a query; every active Admin gets a notification.
-- Returns 'OK' | 'INVALID_SESSION' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_submit_query(p_session TEXT, p_message TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_id BIGINT;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;

  IF COALESCE(trim(p_message), '') = '' THEN RETURN 'INVALID_INPUT'; END IF;

  INSERT INTO public.user_queries (user_id, message)
  VALUES (v_user.id, trim(p_message))
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, type, title, message, data, is_read)
  SELECT a.id, 'USER_QUERY',
         'New query from ' || v_user.name || ' (' || v_user.emp_id || ')',
         trim(p_message),
         jsonb_build_object('queryId', v_id),
         false
  FROM public.users a
  WHERE a.role = 'ADMIN' AND a.status = 'ACTIVE';

  RETURN 'OK';
END;
$$;

-- Admin: the open queries (oldest first).
CREATE OR REPLACE FUNCTION public.app_list_queries(p_session TEXT)
RETURNS TABLE (id BIGINT, user_id TEXT, user_name TEXT, emp_id TEXT, message TEXT, created_at TIMESTAMPTZ)
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
  IF NOT FOUND OR v_user.role <> 'ADMIN' THEN RETURN; END IF;

  RETURN QUERY
    SELECT q.id, q.user_id, u.name, u.emp_id, q.message, q.created_at
    FROM public.user_queries q
    JOIN public.users u ON u.id = q.user_id
    WHERE q.status = 'OPEN'
    ORDER BY q.created_at, q.id;
END;
$$;

-- Admin resolves a query; the user is notified (with the optional note).
-- Returns 'OK' | 'INVALID_SESSION' | 'FORBIDDEN' | 'NOT_FOUND'
CREATE OR REPLACE FUNCTION public.app_resolve_query(p_session TEXT, p_query_id BIGINT, p_note TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_q public.user_queries%ROWTYPE;
  v_note TEXT := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;

  SELECT * INTO v_q FROM public.user_queries WHERE id = p_query_id AND status = 'OPEN';
  IF NOT FOUND THEN RETURN 'NOT_FOUND'; END IF;

  UPDATE public.user_queries
  SET status = 'RESOLVED', admin_note = v_note, resolved_at = NOW()
  WHERE id = p_query_id;

  INSERT INTO public.notifications (user_id, type, title, message, data, is_read)
  VALUES (
    v_q.user_id, 'QUERY_RESOLVED', 'Your query was solved',
    'Your query "' || left(v_q.message, 80) || CASE WHEN length(v_q.message) > 80 THEN '…' ELSE '' END || '" has been solved.'
      || COALESCE(' Admin note: ' || v_note, ''),
    jsonb_build_object('queryId', p_query_id),
    false
  );

  -- Clear the "new query" notification for every Admin
  UPDATE public.notifications
  SET is_read = true
  WHERE type = 'USER_QUERY' AND (data->>'queryId') = p_query_id::text;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_submit_query(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_list_queries(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_resolve_query(TEXT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_submit_query(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_queries(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_resolve_query(TEXT, BIGINT, TEXT) TO anon, authenticated;
