-- ============================================================================
-- PROTECTED SALARY / CONVEYANCE FOR THE MANPOWER DIRECTORY
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_password_change.sql.
--
-- Salary data lives in a table the website's anon key cannot read. The only way
-- in is app_get_manpower_salaries(), which needs a valid login session and only
-- answers for Admin or Assistant Director and above.
-- The actual figures are loaded separately (manpower_salary_seed.sql, kept out of git).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.manpower_salary (
  emp_id TEXT PRIMARY KEY,
  salary NUMERIC NOT NULL DEFAULT 0,
  conveyance NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.manpower_salary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manpower_salary FROM anon, authenticated;

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
     OR v_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner') THEN
    RETURN QUERY SELECT m.emp_id, m.salary, m.conveyance FROM public.manpower_salary m;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.app_get_manpower_salaries(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_get_manpower_salaries(TEXT) TO anon, authenticated;
