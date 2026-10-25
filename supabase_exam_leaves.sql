-- ============================================================================
-- EXAM LEAVE records in the database (they used to live only in each person's own browser,
-- so nobody else could see them).
-- Run once in Supabase Dashboard -> SQL Editor, after supabase_exam_leave_switch.sql.
--
-- Who sees what (checked here, in the database):
--   Admin, Assistant Director and above ........ every leave
--   everyone else ............................... their own leave + people who share one of their clients
-- Who may change a leave:
--   Admin ........................................ any leave (can also add one for anyone)
--   the person ................................... their own leave
--   Senior Assistant Manager and above ........... leaves of people on their clients (AD and above: everyone)
-- Only Admin can delete, approve or reject. One leave per person.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.exam_leaves (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name_key TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_leaves_user_idx ON public.exam_leaves (user_id);
CREATE INDEX IF NOT EXISTS exam_leaves_name_idx ON public.exam_leaves (name_key);
ALTER TABLE public.exam_leaves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_leaves FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- helpers (not callable from the browser)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._exam_leave_caller(p_session TEXT)
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
  RETURN v_user;
END;
$$;

-- all client ids of a person: signup clients + manager access
CREATE OR REPLACE FUNCTION public._exam_leave_clients(p_user TEXT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(array_agg(DISTINCT x.cid), ARRAY[]::TEXT[])
  FROM (
    SELECT btrim(c) AS cid FROM public.users u, unnest(string_to_array(COALESCE(u.signup_client_id, ''), ',')) c WHERE u.id = p_user
    UNION
    SELECT m.client_id FROM public.manager_client_access m WHERE m.manager_user_id = p_user AND m.status = 'ACTIVE'
  ) x
  WHERE x.cid <> '';
$$;

-- the account a leave belongs to: its user_id, else the one active account with that name
CREATE OR REPLACE FUNCTION public._exam_leave_target(p_user_id TEXT, p_name_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(
    NULLIF(p_user_id, ''),
    (SELECT CASE WHEN count(*) = 1 THEN min(u.id) END
       FROM public.users u
      WHERE u.status = 'ACTIVE' AND lower(regexp_replace(btrim(u.name), '\s+', ' ', 'g')) = p_name_key)
  );
$$;

REVOKE ALL ON FUNCTION public._exam_leave_caller(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._exam_leave_clients(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._exam_leave_target(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- list: only the leaves the caller is allowed to see
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_exam_leave_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_all BOOLEAN;
  v_mine TEXT[];
  v_key TEXT;
BEGIN
  v_user := public._exam_leave_caller(p_session);
  IF v_user.id IS NULL THEN RETURN NULL; END IF;
  v_all := v_user.role = 'ADMIN' OR v_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner');
  v_mine := public._exam_leave_clients(v_user.id);
  v_key := lower(regexp_replace(btrim(v_user.name), '\s+', ' ', 'g'));

  RETURN COALESCE((
    SELECT jsonb_agg(e.data ORDER BY e.created_at)
    FROM public.exam_leaves e
    WHERE v_all
       OR e.user_id = v_user.id
       OR e.name_key = v_key
       OR public._exam_leave_clients(public._exam_leave_target(e.user_id, e.name_key)) && v_mine
  ), '[]'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- save (add or change). Returns OK, FORBIDDEN, DUPLICATE, INVALID_INPUT or INVALID_SESSION.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_exam_leave_save(p_session TEXT, p_record JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_id TEXT := btrim(COALESCE(p_record->>'id', ''));
  v_name TEXT := btrim(COALESCE(p_record->>'name', ''));
  v_key TEXT;
  v_existing public.exam_leaves%ROWTYPE;
  v_has_existing BOOLEAN;
  v_is_admin BOOLEAN;
  v_sam BOOLEAN;
  v_ad BOOLEAN;
  v_target TEXT;
  v_status TEXT;
  v_data JSONB;
BEGIN
  v_user := public._exam_leave_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_id = '' OR v_name = '' OR jsonb_typeof(p_record->'leaveDates') IS DISTINCT FROM 'array' THEN RETURN 'INVALID_INPUT'; END IF;

  v_key := lower(regexp_replace(v_name, '\s+', ' ', 'g'));
  v_is_admin := v_user.role = 'ADMIN';
  v_ad := v_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner');
  v_sam := v_ad OR v_user.designation IN ('Senior Assistant Manager', 'Deputy Manager', 'Manager');

  SELECT * INTO v_existing FROM public.exam_leaves WHERE id = v_id;
  v_has_existing := FOUND;

  IF v_has_existing THEN
    v_target := public._exam_leave_target(v_existing.user_id, v_existing.name_key);
    v_key := v_existing.name_key;           -- the person of a saved leave cannot be swapped
    IF NOT (
      v_is_admin
      OR v_target = v_user.id
      OR v_existing.name_key = lower(regexp_replace(btrim(v_user.name), '\s+', ' ', 'g'))
      OR (v_sam AND (v_ad OR public._exam_leave_clients(v_target) && public._exam_leave_clients(v_user.id)))
    ) THEN RETURN 'FORBIDDEN'; END IF;
    v_status := COALESCE(v_existing.data->>'status', 'Pending');
  ELSE
    IF v_is_admin THEN
      v_target := public._exam_leave_target(p_record->>'userId', v_key);
      v_status := 'Approved';
    ELSE
      -- a new leave can only be for yourself
      IF v_key <> lower(regexp_replace(btrim(v_user.name), '\s+', ' ', 'g')) THEN RETURN 'FORBIDDEN'; END IF;
      v_target := v_user.id;
      v_status := 'Pending';
    END IF;
  END IF;

  -- one leave per person
  IF EXISTS (
    SELECT 1 FROM public.exam_leaves e
    WHERE e.id <> v_id AND (e.name_key = v_key OR (v_target IS NOT NULL AND e.user_id = v_target))
  ) THEN RETURN 'DUPLICATE'; END IF;

  v_data := p_record || jsonb_build_object('id', v_id, 'status', v_status, 'userId', v_target);

  INSERT INTO public.exam_leaves (id, user_id, name_key, data)
  VALUES (v_id, v_target, v_key, v_data)
  ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data, user_id = EXCLUDED.user_id, updated_at = now();
  RETURN 'OK';
END;
$$;

-- ---------------------------------------------------------------------------
-- delete / approve / reject: Admin only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_exam_leave_delete(p_session TEXT, p_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._exam_leave_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  DELETE FROM public.exam_leaves WHERE id = p_id;
  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION public.app_exam_leave_status(p_session TEXT, p_id TEXT, p_status TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._exam_leave_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('Approved', 'Pending', 'Rejected') THEN RETURN 'INVALID_INPUT'; END IF;
  UPDATE public.exam_leaves SET data = jsonb_set(data, '{status}', to_jsonb(p_status)), updated_at = now() WHERE id = p_id;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_exam_leave_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_exam_leave_save(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_exam_leave_delete(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_exam_leave_status(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_exam_leave_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_exam_leave_save(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_exam_leave_delete(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_exam_leave_status(TEXT, TEXT, TEXT) TO anon, authenticated;
