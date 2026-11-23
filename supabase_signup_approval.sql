-- ============================================================================
-- SIGNUP APPROVAL FOR ASSISTANT DIRECTOR AND ABOVE
-- Run once in Supabase Dashboard -> SQL Editor. Safe to run more than once.
--
-- What it does
--  * Signups as Assistant Director, Deputy Director, Director or Partner are created
--    INACTIVE and marked "pending approval". They cannot log in or use the app until
--    an Admin activates them (Admin Panel -> Users & Roles -> Waiting for approval).
--    Student, Trainee, In Charge, Supervisor, Senior Assistant Manager, Deputy Manager
--    and Manager signups stay active straight away, as before.
--  * Login refuses inactive accounts in the database (not only in the page), so an
--    inactive account never gets a login session.
--  * Deactivating someone ends their open login sessions at once.
--  * A trigger makes sure nobody can change their own status, role, designation, ID
--    or approval flag from the browser, even if an older grant was left behind.
--
-- To undo the trigger:  DROP TRIGGER IF EXISTS users_guard_privileged ON public.users;
-- ============================================================================

-- 1. Approval flag ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN NOT NULL DEFAULT false;

-- 2. Signup: seniors start INACTIVE + pending. Returns 'OK' | 'DUPLICATE' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_register_user(
  p_id TEXT, p_name TEXT, p_emp_id TEXT, p_email TEXT, p_designation TEXT,
  p_signup_client_id TEXT, p_mobile TEXT, p_academic_year TEXT, p_password TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_needs_approval BOOLEAN;
BEGIN
  IF COALESCE(trim(p_id), '') = '' OR COALESCE(trim(p_name), '') = '' OR COALESCE(trim(p_emp_id), '') = ''
     OR p_password IS NULL OR length(p_password) < 4
     OR p_designation NOT IN ('Student','Trainee','In Charge','Supervisor','Senior Assistant Manager',
                              'Deputy Manager','Manager','Assistant Director','Deputy Director','Director','Partner') THEN
    RETURN 'INVALID_INPUT';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE upper(emp_id) = upper(trim(p_emp_id))) THEN
    RETURN 'DUPLICATE';
  END IF;

  v_needs_approval := p_designation IN ('Assistant Director','Deputy Director','Director','Partner');

  INSERT INTO public.users
    (id, name, emp_id, email, role, designation, signup_client_id, status, pending_approval,
     created_date, mobile, academic_year)
  VALUES
    (trim(p_id), trim(p_name), upper(trim(p_emp_id)), p_email, 'USER', p_designation,
     COALESCE(p_signup_client_id, ''),
     CASE WHEN v_needs_approval THEN 'INACTIVE' ELSE 'ACTIVE' END,
     v_needs_approval,
     NOW(), COALESCE(p_mobile, ''),
     NULLIF(trim(COALESCE(p_academic_year, '')), ''));

  INSERT INTO public.user_credentials (user_id, password_hash)
  VALUES (trim(p_id), crypt(p_password, gen_salt('bf')));

  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  RETURN 'DUPLICATE';
END;
$$;

-- 3. Login: inactive accounts get no session. Returns status 'OK' | 'INVALID' | 'NO_PASSWORD' | 'INACTIVE'
CREATE OR REPLACE FUNCTION public.app_login_session(p_user_id TEXT, p_password TEXT)
RETURNS TABLE (status TEXT, session_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_token TEXT;
BEGIN
  IF p_password IS NULL OR p_password = '' THEN
    RETURN QUERY SELECT 'INVALID'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT password_hash INTO v_hash FROM public.user_credentials WHERE user_id = p_user_id;

  IF v_hash IS NULL THEN
    RETURN QUERY SELECT 'NO_PASSWORD'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_hash <> crypt(p_password, v_hash) THEN
    RETURN QUERY SELECT 'INVALID'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Only checked after the password is right, so this can't be used to probe accounts
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.status = 'ACTIVE') THEN
    RETURN QUERY SELECT 'INACTIVE'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.user_sessions (token_hash, user_id, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), p_user_id, NOW() + INTERVAL '30 days');

  IF to_regclass('public.user_login_logs') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.user_login_logs (user_id) VALUES ($1)' USING p_user_id;
  END IF;

  -- Housekeeping: drop this user's expired sessions.
  DELETE FROM public.user_sessions WHERE user_id = p_user_id AND expires_at < NOW();

  RETURN QUERY SELECT 'OK'::TEXT, v_token;
END;
$$;

-- 4. Admin update: activating clears "pending approval"; deactivating ends open sessions.
-- Returns 'OK' | 'INVALID_SESSION' | 'FORBIDDEN' | 'INVALID_INPUT' | 'DUPLICATE' | 'LAST_ADMIN'
CREATE OR REPLACE FUNCTION public.app_admin_update_user(
  p_session TEXT, p_user_id TEXT, p_emp_id TEXT, p_role TEXT, p_designation TEXT, p_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.users%ROWTYPE;
  v_target public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_admin.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 'INVALID_INPUT'; END IF;

  IF (p_role IS NOT NULL AND p_role NOT IN ('USER','MANAGER','ADMIN'))
     OR (p_status IS NOT NULL AND p_status NOT IN ('ACTIVE','INACTIVE'))
     OR (p_designation IS NOT NULL AND trim(p_designation) = '')
     OR (p_emp_id IS NOT NULL AND trim(p_emp_id) = '') THEN
    RETURN 'INVALID_INPUT';
  END IF;

  IF p_emp_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.users WHERE upper(emp_id) = upper(trim(p_emp_id)) AND id <> p_user_id) THEN
    RETURN 'DUPLICATE';
  END IF;

  -- Never leave the system without an active Admin
  IF v_target.role = 'ADMIN' AND v_target.status = 'ACTIVE'
     AND ((p_role IS NOT NULL AND p_role <> 'ADMIN') OR (p_status IS NOT NULL AND p_status <> 'ACTIVE'))
     AND (SELECT count(*) FROM public.users WHERE role = 'ADMIN' AND status = 'ACTIVE') <= 1 THEN
    RETURN 'LAST_ADMIN';
  END IF;

  UPDATE public.users
  SET emp_id = COALESCE(upper(trim(p_emp_id)), emp_id),
      role = COALESCE(p_role, role),
      designation = COALESCE(trim(p_designation), designation),
      status = COALESCE(p_status, status),
      pending_approval = CASE WHEN p_status = 'ACTIVE' THEN false ELSE pending_approval END
  WHERE id = p_user_id;

  IF p_status = 'INACTIVE' THEN
    DELETE FROM public.user_sessions WHERE user_id = p_user_id;
  END IF;

  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  RETURN 'DUPLICATE';
END;
$$;

REVOKE ALL ON FUNCTION public.app_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_login_session(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_admin_update_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_login_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_update_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 5. Browser key: no direct INSERT/DELETE, UPDATE only on harmless profile columns
--    (repeats the lock from supabase_lockdown_users.sql in case it was never run).
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
DO $$
DECLARE cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
    AND column_name IN ('name','email','avatar_url','mobile','signup_client_id','signup_client_name',
                        'academic_year','updated_at');
  IF cols IS NOT NULL THEN
    EXECUTE 'GRANT UPDATE (' || cols || ') ON public.users TO anon, authenticated';
  END IF;
END $$;

-- 6. Belt and braces: the browser roles can never create users directly or touch
--    privilege columns, whatever grants exist. Database functions (run as the owner)
--    and the service key are not affected.
CREATE OR REPLACE FUNCTION public.users_guard_privileged()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Accounts can only be created or removed through the app''s signup / Admin Panel'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.designation IS DISTINCT FROM OLD.designation
     OR NEW.emp_id IS DISTINCT FROM OLD.emp_id
     OR NEW.pending_approval IS DISTINCT FROM OLD.pending_approval THEN
    RAISE EXCEPTION 'Only an Admin can change status, role, designation or ID'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_privileged ON public.users;
CREATE TRIGGER users_guard_privileged
  BEFORE INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_guard_privileged();


-- ============================================================================
-- 7. EXISTING ACCOUNTS: run these one at a time, after the part above.
-- ============================================================================

-- 7a. Review every Assistant Director and above who is not an Admin.
--     Accounts you don't recognise (like the "user 123" test Director) should be deactivated.
-- SELECT id, name, emp_id, email, designation, role, status, created_date
-- FROM public.users
-- WHERE designation IN ('Assistant Director','Deputy Director','Director','Partner')
--   AND role <> 'ADMIN'
-- ORDER BY created_date DESC;

-- 7b. Deactivate the test account(s) and put them in the Admin "Waiting for approval" list.
--     Check the SELECT output first and put the right emp_id values in the list.
-- WITH target AS (
--   UPDATE public.users
--   SET status = 'INACTIVE', pending_approval = true
--   WHERE upper(emp_id) IN ('PUT-EMP-ID-HERE')
--      OR lower(name) = 'user 123'
--   RETURNING id
-- )
-- DELETE FROM public.user_sessions WHERE user_id IN (SELECT id FROM target);

-- 7c. Optional: send EVERY senior signup made from a given date back for approval.
--     Change the date to before you started using the site's signup page.
-- WITH target AS (
--   UPDATE public.users
--   SET status = 'INACTIVE', pending_approval = true
--   WHERE designation IN ('Assistant Director','Deputy Director','Director','Partner')
--     AND role <> 'ADMIN' AND status = 'ACTIVE'
--     AND created_date >= '2026-11-01'
--   RETURNING id
-- )
-- DELETE FROM public.user_sessions WHERE user_id IN (SELECT id FROM target);
