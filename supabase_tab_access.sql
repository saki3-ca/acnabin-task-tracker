-- ============================================================================
-- TAB ACCESS: for each tab Admin picks ALL, ADMIN (only Admin), INDIVIDUAL (Admin + chosen people),
-- EXCEPT (everyone except the chosen people) or NONE (nobody).
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_firm_costing.sql, supabase_firm_costing_v2.sql
-- and the older access files (proposals, invoices, tender agent, access_v4, exam_leave_switch).
--
-- Tabs that can be set: manpower, firm_costing, exam_leave, invoices, proposals, tenders.
-- Basic tabs (My Tasks, Task Requests, Notifications, My Profile, Team Tasks) are not part of this.
--
-- No choice saved for a tab = the old rule keeps working, so nothing changes until Admin picks:
--   invoices, proposals, tenders .... only the people added earlier
--   manpower ........................ Assistant Director and above, In Charge to Manager (own clients, no money), people added earlier
--   firm_costing .................... Assistant Director and above
--   exam_leave ...................... the old on/off switch
-- A saved choice replaces the old rule:  ALL = every active person,  ADMIN = Admin only,
--   INDIVIDUAL = Admin plus the people on that tab's list (the lists people were added to before are reused),
--   EXCEPT = every active person except the people on the 'cannot open' list (kept apart from the Individual list),
--   NONE = nobody, not even Admin (the tab is switched off).
-- Both people lists are kept when a tab is switched to another option, so coming back shows the same people.
-- Note: someone who may open Firm Costing also gets the salary figures it is built from.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tab_access_mode (
  tab_key TEXT PRIMARY KEY CHECK (tab_key IN ('manpower', 'firm_costing', 'exam_leave', 'invoices', 'proposals', 'tenders')),
  mode TEXT NOT NULL CHECK (mode IN ('ALL', 'ADMIN', 'INDIVIDUAL', 'EXCEPT', 'NONE')),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- (also upgrades a table made by an earlier version of this file that had no NONE)
ALTER TABLE public.tab_access_mode DROP CONSTRAINT IF EXISTS tab_access_mode_mode_check;
ALTER TABLE public.tab_access_mode ADD CONSTRAINT tab_access_mode_mode_check CHECK (mode IN ('ALL', 'ADMIN', 'INDIVIDUAL', 'EXCEPT', 'NONE'));
ALTER TABLE public.tab_access_mode ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tab_access_mode FROM anon, authenticated;

-- people lists for tabs that had none before (Firm Costing, Exam Leave)
CREATE TABLE IF NOT EXISTS public.tab_access_users (
  tab_key TEXT NOT NULL CHECK (tab_key IN ('manpower', 'firm_costing', 'exam_leave', 'invoices', 'proposals', 'tenders')),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tab_key, user_id)
);
ALTER TABLE public.tab_access_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tab_access_users FROM anon, authenticated;

-- the people who may NOT open a tab while it is set to EXCEPT
CREATE TABLE IF NOT EXISTS public.tab_access_except (
  tab_key TEXT NOT NULL CHECK (tab_key IN ('manpower', 'firm_costing', 'exam_leave', 'invoices', 'proposals', 'tenders')),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tab_key, user_id)
);
ALTER TABLE public.tab_access_except ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tab_access_except FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- helpers (not callable from the browser)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tab_mode(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT mode FROM public.tab_access_mode WHERE tab_key = p_key $$;

-- is this person on the tab's people list? (the four older tabs keep their own tables)
CREATE OR REPLACE FUNCTION public._tab_listed(p_user_id TEXT, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN CASE p_key
    WHEN 'proposals' THEN EXISTS (SELECT 1 FROM public.proposal_access WHERE user_id = p_user_id)
    WHEN 'invoices' THEN EXISTS (SELECT 1 FROM public.invoice_access WHERE user_id = p_user_id)
    WHEN 'tenders' THEN EXISTS (SELECT 1 FROM public.tender_agent_access WHERE user_id = p_user_id)
    WHEN 'manpower' THEN EXISTS (SELECT 1 FROM public.manpower_access WHERE user_id = p_user_id)
    ELSE EXISTS (SELECT 1 FROM public.tab_access_users WHERE tab_key = p_key AND user_id = p_user_id)
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public._tab_excluded(p_user_id TEXT, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$ SELECT EXISTS (SELECT 1 FROM public.tab_access_except WHERE tab_key = p_key AND user_id = p_user_id) $$;

CREATE OR REPLACE FUNCTION public._tab_list(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN COALESCE(CASE p_key
    WHEN 'proposals' THEN (SELECT jsonb_agg(user_id) FROM public.proposal_access)
    WHEN 'invoices' THEN (SELECT jsonb_agg(user_id) FROM public.invoice_access)
    WHEN 'tenders' THEN (SELECT jsonb_agg(user_id) FROM public.tender_agent_access)
    WHEN 'manpower' THEN (SELECT jsonb_agg(user_id) FROM public.manpower_access)
    ELSE (SELECT jsonb_agg(user_id) FROM public.tab_access_users WHERE tab_key = p_key)
  END, '[]'::jsonb);
END;
$$;

-- the rule the database enforces for a signed-in person (used by the invoice, proposal, tender and Firm Costing functions)
CREATE OR REPLACE FUNCTION public._tab_allowed(p_user public.users, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mode TEXT := public._tab_mode(p_key);
BEGIN
  -- NONE switches the tab off for everyone, Admin included
  IF v_mode = 'NONE' THEN RETURN FALSE; END IF;
  IF p_user.role = 'ADMIN' THEN RETURN TRUE; END IF;
  IF v_mode = 'ALL' THEN RETURN TRUE; END IF;
  IF v_mode = 'ADMIN' THEN RETURN FALSE; END IF;
  IF v_mode = 'EXCEPT' THEN RETURN NOT public._tab_excluded(p_user.id, p_key); END IF;
  IF v_mode = 'INDIVIDUAL' THEN RETURN public._tab_listed(p_user.id, p_key); END IF;
  -- no choice saved: the old rule
  IF p_key = 'firm_costing' AND p_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner') THEN RETURN TRUE; END IF;
  RETURN public._tab_listed(p_user.id, p_key);
END;
$$;

REVOKE ALL ON FUNCTION public._tab_mode(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tab_listed(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tab_list(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tab_excluded(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tab_allowed(public.users, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- the four tabs the database itself guards now follow the saved choice
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
  IF public._tab_allowed(v_user, 'proposals') THEN RETURN v_user; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._invoice_caller(p_session TEXT)
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
  IF public._tab_allowed(v_user, 'invoices') THEN RETURN v_user; END IF;
  RETURN NULL;
END;
$$;

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
  IF public._tab_allowed(v_user, 'tenders') THEN RETURN v_user; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._firm_costing_caller(p_session TEXT)
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
  IF public._tab_allowed(v_user, 'firm_costing') THEN RETURN v_user; END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._proposal_caller(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._invoice_caller(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tender_agent_caller(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._firm_costing_caller(TEXT) FROM PUBLIC, anon, authenticated;

-- salary figures: the people who may open Firm Costing get them too (it is built from them)
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
     OR EXISTS (SELECT 1 FROM public.manpower_access a WHERE a.user_id = v_user.id)
     OR public._tab_allowed(v_user, 'firm_costing') THEN
    RETURN QUERY SELECT m.emp_id, m.salary, m.conveyance FROM public.manpower_salary m;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- what the signed-in person (or, for Admin "Switch User", the person being viewed) is allowed:
-- per tab { mode: 'ALL' | 'ADMIN' | 'INDIVIDUAL' | 'EXCEPT' | 'NONE' | null (no choice saved), listed: on the Individual list, excluded: on the EXCEPT list }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_my_tabs(p_session TEXT, p_as_user_id TEXT DEFAULT NULL)
RETURNS JSONB
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
  IF v_user.role = 'ADMIN' AND NULLIF(btrim(COALESCE(p_as_user_id, '')), '') IS NOT NULL THEN
    SELECT u.* INTO v_user FROM public.users u WHERE u.id = btrim(p_as_user_id) AND u.status = 'ACTIVE';
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;
  RETURN (
    SELECT jsonb_object_agg(k, jsonb_build_object('mode', public._tab_mode(k), 'listed', public._tab_listed(v_user.id, k), 'excluded', public._tab_excluded(v_user.id, k)))
    FROM unnest(ARRAY['manpower', 'firm_costing', 'exam_leave', 'invoices', 'proposals', 'tenders']) AS k
  );
END;
$$;

-- Admin only: every tab's saved choice and people list
CREATE OR REPLACE FUNCTION public.app_tab_access_get(p_session TEXT)
RETURNS JSONB
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
  IF NOT FOUND OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;
  RETURN (
    SELECT jsonb_object_agg(k, jsonb_build_object('mode', public._tab_mode(k), 'userIds', public._tab_list(k), 'exceptIds', COALESCE((SELECT jsonb_agg(e.user_id) FROM public.tab_access_except e WHERE e.tab_key = k), '[]'::jsonb)))
    FROM unnest(ARRAY['manpower', 'firm_costing', 'exam_leave', 'invoices', 'proposals', 'tenders']) AS k
  );
END;
$$;

-- Admin only. p_mode NULL = back to the old rule. p_user_ids / p_except_ids NULL = leave that people list as it is.
-- Returns OK / NO_ACCESS / FORBIDDEN / INVALID_INPUT
DROP FUNCTION IF EXISTS public.app_tab_access_set(TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.app_tab_access_set(p_session TEXT, p_tab_key TEXT, p_mode TEXT, p_user_ids JSONB, p_except_ids JSONB DEFAULT NULL)
RETURNS TEXT
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
  IF NOT FOUND THEN RETURN 'NO_ACCESS'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_tab_key NOT IN ('manpower', 'firm_costing', 'exam_leave', 'invoices', 'proposals', 'tenders') THEN RETURN 'INVALID_INPUT'; END IF;
  IF p_mode IS NOT NULL AND p_mode NOT IN ('ALL', 'ADMIN', 'INDIVIDUAL', 'EXCEPT', 'NONE') THEN RETURN 'INVALID_INPUT'; END IF;
  IF p_user_ids IS NOT NULL AND jsonb_typeof(p_user_ids) <> 'array' THEN RETURN 'INVALID_INPUT'; END IF;
  IF p_except_ids IS NOT NULL AND jsonb_typeof(p_except_ids) <> 'array' THEN RETURN 'INVALID_INPUT'; END IF;

  IF p_mode IS NULL THEN
    DELETE FROM public.tab_access_mode WHERE tab_key = p_tab_key;
  ELSE
    INSERT INTO public.tab_access_mode (tab_key, mode, updated_by) VALUES (p_tab_key, p_mode, v_user.id)
    ON CONFLICT (tab_key) DO UPDATE SET mode = EXCLUDED.mode, updated_by = EXCLUDED.updated_by, updated_at = now();
  END IF;

  IF p_user_ids IS NOT NULL THEN
    -- Admin never needs to be on a list
    IF p_tab_key = 'proposals' THEN
      DELETE FROM public.proposal_access WHERE user_id IS NOT NULL;
      INSERT INTO public.proposal_access (user_id, granted_by)
      SELECT u.id, v_user.id FROM public.users u WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids)) AND u.role <> 'ADMIN' AND u.status = 'ACTIVE';
    ELSIF p_tab_key = 'invoices' THEN
      DELETE FROM public.invoice_access WHERE user_id IS NOT NULL;
      INSERT INTO public.invoice_access (user_id, granted_by)
      SELECT u.id, v_user.id FROM public.users u WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids)) AND u.role <> 'ADMIN' AND u.status = 'ACTIVE';
    ELSIF p_tab_key = 'tenders' THEN
      DELETE FROM public.tender_agent_access WHERE user_id IS NOT NULL;
      INSERT INTO public.tender_agent_access (user_id, granted_by)
      SELECT u.id, v_user.id FROM public.users u WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids)) AND u.role <> 'ADMIN' AND u.status = 'ACTIVE';
    ELSIF p_tab_key = 'manpower' THEN
      DELETE FROM public.manpower_access WHERE user_id IS NOT NULL;
      INSERT INTO public.manpower_access (user_id, granted_by)
      SELECT u.id, v_user.id FROM public.users u WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids)) AND u.role <> 'ADMIN' AND u.status = 'ACTIVE';
    ELSE
      DELETE FROM public.tab_access_users WHERE tab_key = p_tab_key;
      INSERT INTO public.tab_access_users (tab_key, user_id, granted_by)
      SELECT p_tab_key, u.id, v_user.id FROM public.users u WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids)) AND u.role <> 'ADMIN' AND u.status = 'ACTIVE';
    END IF;
  END IF;

  IF p_except_ids IS NOT NULL THEN
    DELETE FROM public.tab_access_except WHERE tab_key = p_tab_key;
    INSERT INTO public.tab_access_except (tab_key, user_id, granted_by)
    SELECT p_tab_key, u.id, v_user.id FROM public.users u WHERE u.id IN (SELECT jsonb_array_elements_text(p_except_ids)) AND u.role <> 'ADMIN' AND u.status = 'ACTIVE';
  END IF;

  -- keep the old Exam Leave on/off switch in step, so anything still reading it agrees
  IF p_tab_key = 'exam_leave' AND to_regclass('public.app_flags') IS NOT NULL THEN
    IF p_mode IN ('ADMIN', 'NONE') THEN
      INSERT INTO public.app_flags (key, value) VALUES ('exam_leave_enabled', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false';
    ELSIF p_mode IN ('ALL', 'INDIVIDUAL') THEN
      INSERT INTO public.app_flags (key, value) VALUES ('exam_leave_enabled', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true';
    END IF;
  END IF;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_my_tabs(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_tab_access_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_tab_access_set(TEXT, TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_my_tabs(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tab_access_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_tab_access_set(TEXT, TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;
