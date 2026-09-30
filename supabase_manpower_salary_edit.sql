-- ============================================================================
-- LET ADMIN / ASSISTANT DIRECTOR AND ABOVE EDIT SALARY + CONVEYANCE
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_manpower_salary.sql.
-- Returns 'OK' | 'INVALID_SESSION' | 'FORBIDDEN' | 'INVALID_INPUT'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_set_manpower_salary(
  p_session TEXT, p_emp_id TEXT, p_salary NUMERIC, p_conveyance NUMERIC
)
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
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;

  IF NOT (v_user.role = 'ADMIN'
          OR v_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner')) THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF COALESCE(trim(p_emp_id), '') = '' OR p_salary IS NULL OR p_salary < 0
     OR p_conveyance IS NULL OR p_conveyance < 0 THEN
    RETURN 'INVALID_INPUT';
  END IF;

  INSERT INTO public.manpower_salary (emp_id, salary, conveyance)
  VALUES (upper(trim(p_emp_id)), p_salary, p_conveyance)
  ON CONFLICT (emp_id) DO UPDATE
    SET salary = EXCLUDED.salary, conveyance = EXCLUDED.conveyance;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_set_manpower_salary(TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_set_manpower_salary(TEXT, TEXT, NUMERIC, NUMERIC) TO anon, authenticated;
