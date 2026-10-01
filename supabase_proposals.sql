-- ============================================================================
-- PROPOSAL TRACKER
--  * The Admin chooses who gets the Proposal Tracker tab (Admin Panel).
--  * Everyone with access can see, add and edit proposals. Only the Admin can delete.
--  * Duplicates (same proposal name + same client) are refused, also when importing.
--  * All checks run on the server. Run once in Supabase Dashboard -> SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.proposal_access (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.proposal_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_access FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.proposals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  type TEXT,
  assigned_to TEXT,
  receive_date DATE,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  remarks TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposals FROM anon, authenticated;

-- No duplicates: the same proposal name for the same client (ignoring case and extra spaces)
CREATE UNIQUE INDEX IF NOT EXISTS proposals_no_duplicate
  ON public.proposals (lower(btrim(name)), lower(btrim(client)));

-- ---------------------------------------------------------------------------
-- Who is calling, and may they use the tracker? (Admin always may.)
-- Returns the user row, or nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._proposal_caller(p_session TEXT)
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
  IF v_user.role = 'ADMIN' OR EXISTS (SELECT 1 FROM public.proposal_access a WHERE a.user_id = v_user.id) THEN
    RETURN v_user;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._proposal_caller(TEXT) FROM PUBLIC, anon, authenticated;

-- Does the caller have the tab? (used to show or hide it)
CREATE OR REPLACE FUNCTION public.app_proposal_has_access(p_session TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN (SELECT (c).id IS NOT NULL FROM (SELECT public._proposal_caller(p_session) AS c) x);
END;
$$;

-- All proposals
CREATE OR REPLACE FUNCTION public.app_proposal_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._proposal_caller(p_session) AS c) x) THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'client', client, 'type', COALESCE(type, ''),
      'assignedTo', COALESCE(assigned_to, ''), 'receiveDate', COALESCE(receive_date::text, ''),
      'deadline', COALESCE(deadline::text, ''), 'status', status, 'remarks', COALESCE(remarks, ''),
      'createdAt', created_at) ORDER BY created_at DESC)
    FROM public.proposals
  ), '[]'::jsonb);
END;
$$;

-- Add or edit one proposal. Returns OK | DUPLICATE | NO_ACCESS | INVALID_INPUT
CREATE OR REPLACE FUNCTION public.app_proposal_save(p_session TEXT, p_fields JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_id TEXT;
  v_name TEXT; v_client TEXT;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN RETURN 'INVALID_INPUT'; END IF;

  v_name := btrim(COALESCE(p_fields->>'name', ''));
  v_client := btrim(COALESCE(p_fields->>'client', ''));
  IF v_name = '' OR v_client = '' THEN RETURN 'INVALID_INPUT'; END IF;
  v_id := NULLIF(btrim(COALESCE(p_fields->>'id', '')), '');

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.proposals WHERE id = v_id) THEN
    UPDATE public.proposals SET
      name = v_name, client = v_client,
      type = NULLIF(btrim(COALESCE(p_fields->>'type', '')), ''),
      assigned_to = NULLIF(btrim(COALESCE(p_fields->>'assignedTo', '')), ''),
      receive_date = NULLIF(btrim(COALESCE(p_fields->>'receiveDate', '')), '')::DATE,
      deadline = NULLIF(btrim(COALESCE(p_fields->>'deadline', '')), '')::DATE,
      status = COALESCE(NULLIF(btrim(COALESCE(p_fields->>'status', '')), ''), status),
      remarks = NULLIF(btrim(COALESCE(p_fields->>'remarks', '')), ''),
      updated_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.proposals (id, name, client, type, assigned_to, receive_date, deadline, status, remarks, created_by)
    VALUES (
      COALESCE(v_id, 'p' || (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT::TEXT),
      v_name, v_client,
      NULLIF(btrim(COALESCE(p_fields->>'type', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'assignedTo', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'receiveDate', '')), '')::DATE,
      NULLIF(btrim(COALESCE(p_fields->>'deadline', '')), '')::DATE,
      COALESCE(NULLIF(btrim(COALESCE(p_fields->>'status', '')), ''), 'Draft'),
      NULLIF(btrim(COALESCE(p_fields->>'remarks', '')), ''),
      v_user.id);
  END IF;
  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN RETURN 'DUPLICATE';
  WHEN others THEN RETURN 'INVALID_INPUT';
END;
$$;

-- Delete: Admin only. Returns OK | FORBIDDEN | INVALID_SESSION
CREATE OR REPLACE FUNCTION public.app_proposal_delete(p_session TEXT, p_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  DELETE FROM public.proposals WHERE id = p_id;
  RETURN 'OK';
END;
$$;

-- Import (Admin only). Never creates duplicates: rows that already exist are skipped.
-- p_dry_run = TRUE only reports. Returns {status, total, added, skipped, errors, rows[]}
CREATE OR REPLACE FUNCTION public.app_proposal_import(p_session TEXT, p_rows JSONB, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_row JSONB;
  v_name TEXT; v_client TEXT;
  v_out JSONB := '[]'::jsonb;
  n_add INT := 0; n_skip INT := 0; n_err INT := 0;
  v_seen TEXT[] := ARRAY[]::TEXT[]; v_key TEXT; v_dup BOOLEAN;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN jsonb_build_object('status', 'INVALID_SESSION'); END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN jsonb_build_object('status', 'FORBIDDEN'); END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 1000 THEN
    RETURN jsonb_build_object('status', 'INVALID_INPUT');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_name := btrim(COALESCE(v_row->>'name', ''));
    v_client := btrim(COALESCE(v_row->>'client', ''));
    IF v_name = '' OR v_client = '' THEN
      n_err := n_err + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('name', v_name, 'client', v_client, 'result', 'ERROR', 'error', 'Name and client are required'));
      CONTINUE;
    END IF;

    v_key := lower(v_name) || '|' || lower(v_client);
    v_dup := v_key = ANY (v_seen)
             OR EXISTS (SELECT 1 FROM public.proposals WHERE lower(btrim(name)) = lower(v_name) AND lower(btrim(client)) = lower(v_client));
    v_seen := array_append(v_seen, v_key);

    IF v_dup THEN
      n_skip := n_skip + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('name', v_name, 'client', v_client, 'result', 'DUPLICATE'));
      CONTINUE;
    END IF;

    BEGIN
      IF NOT p_dry_run THEN
        INSERT INTO public.proposals (id, name, client, type, assigned_to, receive_date, deadline, status, remarks, created_by)
        VALUES (
          'p' || (extract(epoch FROM clock_timestamp()) * 1000000)::BIGINT::TEXT,
          v_name, v_client,
          NULLIF(btrim(COALESCE(v_row->>'type', '')), ''),
          NULLIF(btrim(COALESCE(v_row->>'assignedTo', '')), ''),
          NULLIF(btrim(COALESCE(v_row->>'receiveDate', '')), '')::DATE,
          NULLIF(btrim(COALESCE(v_row->>'deadline', '')), '')::DATE,
          COALESCE(NULLIF(btrim(COALESCE(v_row->>'status', '')), ''), 'Draft'),
          NULLIF(btrim(COALESCE(v_row->>'remarks', '')), ''),
          v_user.id);
      END IF;
      n_add := n_add + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('name', v_name, 'client', v_client, 'result', 'NEW'));
    EXCEPTION WHEN others THEN
      n_err := n_err + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('name', v_name, 'client', v_client, 'result', 'ERROR', 'error', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object('status', 'OK', 'dryRun', p_dry_run, 'total', n_add + n_skip + n_err,
    'added', n_add, 'skipped', n_skip, 'errors', n_err, 'rows', v_out);
END;
$$;

-- Admin: who has access
CREATE OR REPLACE FUNCTION public.app_proposal_access_get(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT jsonb_agg(user_id) FROM public.proposal_access), '[]'::jsonb);
END;
$$;

-- Admin: set who has access (replaces the list). Returns OK | FORBIDDEN
CREATE OR REPLACE FUNCTION public.app_proposal_access_set(p_session TEXT, p_user_ids JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_user_ids IS NULL OR jsonb_typeof(p_user_ids) <> 'array' THEN RETURN 'FORBIDDEN'; END IF;

  DELETE FROM public.proposal_access
  WHERE user_id NOT IN (SELECT jsonb_array_elements_text(p_user_ids));
  INSERT INTO public.proposal_access (user_id, granted_by)
  SELECT u.id, v_user.id FROM public.users u
  WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_proposal_has_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_save(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_delete(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_import(TEXT, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_access_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_access_set(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_proposal_has_access(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_save(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_delete(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_import(TEXT, JSONB, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_access_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_access_set(TEXT, JSONB) TO anon, authenticated;
