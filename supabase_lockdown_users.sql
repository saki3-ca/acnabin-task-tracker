-- ============================================================================
-- SECURITY LOCK-DOWN, STAGE 1: the users table
-- Run once in Supabase Dashboard -> SQL Editor, AFTER the new site version is live
-- (the site keeps working either way, but it only becomes secure once this runs).
--
-- What it does
--  * Signup goes through app_register_user(): the account is always role USER,
--    status ACTIVE, and "Admin" can never be chosen. The password is set inside.
--  * Changing role / designation / status / ID goes through app_admin_update_user(),
--    which needs an Admin login session.
--  * The public key can no longer INSERT, DELETE or freely UPDATE users.
--    It may still update the harmless profile columns (name, email, photo, mobile,
--    clients, academic year).
--  * app_set_initial_password() is no longer callable from the browser, so nobody
--    can claim an account that has no password yet.
--
-- To undo:  GRANT INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
--           GRANT EXECUTE ON FUNCTION public.app_set_initial_password(TEXT, TEXT) TO anon, authenticated;
-- ============================================================================

-- Signup. Returns 'OK' | 'DUPLICATE' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_register_user(
  p_id TEXT, p_name TEXT, p_emp_id TEXT, p_email TEXT, p_designation TEXT,
  p_signup_client_id TEXT, p_mobile TEXT, p_academic_year TEXT, p_password TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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

  INSERT INTO public.users
    (id, name, emp_id, email, role, designation, signup_client_id, status, created_date, mobile, academic_year)
  VALUES
    (trim(p_id), trim(p_name), upper(trim(p_emp_id)), p_email, 'USER', p_designation,
     COALESCE(p_signup_client_id, ''), 'ACTIVE', NOW(), COALESCE(p_mobile, ''),
     NULLIF(trim(COALESCE(p_academic_year, '')), ''));

  INSERT INTO public.user_credentials (user_id, password_hash)
  VALUES (trim(p_id), crypt(p_password, gen_salt('bf')));

  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  RETURN 'DUPLICATE';
END;
$$;

-- Admin-only change of role / designation / status / ID. NULL = leave as it is.
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
      status = COALESCE(p_status, status)
  WHERE id = p_user_id;

  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  RETURN 'DUPLICATE';
END;
$$;

REVOKE ALL ON FUNCTION public.app_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_admin_update_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_register_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_update_user(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- The actual lock: no direct INSERT/DELETE, and UPDATE only on harmless columns.
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
DO $$
DECLARE cols TEXT;
BEGIN
  -- only the columns that exist, so a missing optional column can't break the script
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
    AND column_name IN ('name','email','avatar_url','mobile','signup_client_id','signup_client_name','academic_year','updated_at');
  EXECUTE 'GRANT UPDATE (' || cols || ') ON public.users TO anon, authenticated';
END $$;

-- Nobody can claim a password-less account from the browser any more.
REVOKE EXECUTE ON FUNCTION public.app_set_initial_password(TEXT, TEXT) FROM anon, authenticated;
