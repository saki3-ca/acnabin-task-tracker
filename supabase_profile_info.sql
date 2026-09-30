-- ============================================================================
-- "UPDATE YOUR INFO" REQUEST: storage + submit function
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_manpower_salary.sql.
--
-- * Blood group, emergency contact and daily conveyance are kept in a protected
--   table (the website's anon key cannot read it).
-- * app_submit_profile_info() needs a valid login session. It saves the person's
--   own academic year, salary and monthly conveyance (daily x 22, or x 24 for
--   Walton clients) so the Manpower panel shows them.
-- ============================================================================

-- The new notification type must be allowed (drops an old type CHECK, if one exists).
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE TABLE IF NOT EXISTS public.user_personal_info (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  emp_id TEXT,
  blood_group TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  daily_conveyance NUMERIC,
  conveyance_days INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_personal_info ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_personal_info FROM anon, authenticated;

-- Returns 'OK' | 'INVALID_SESSION' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_submit_profile_info(
  p_session TEXT,
  p_academic_year TEXT,
  p_salary NUMERIC,
  p_daily_conveyance NUMERIC,
  p_blood_group TEXT,
  p_emergency_name TEXT,
  p_emergency_phone TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_days INT := 22;
  v_walton BOOLEAN;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';

  IF NOT FOUND THEN
    RETURN 'INVALID_SESSION';
  END IF;

  IF p_salary IS NULL OR p_salary < 0
     OR p_daily_conveyance IS NULL OR p_daily_conveyance < 0
     OR p_blood_group NOT IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')
     OR COALESCE(trim(p_emergency_name), '') = ''
     OR COALESCE(trim(p_emergency_phone), '') = '' THEN
    RETURN 'INVALID_INPUT';
  END IF;

  -- Walton clients work 24 days a month, everyone else 22.
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE lower(c.name) LIKE '%walton%'
      AND (
        c.id = ANY (string_to_array(regexp_replace(COALESCE(v_user.signup_client_id, ''), '\s', '', 'g'), ','))
        OR c.id IN (
          SELECT a.client_id FROM public.manager_client_access a
          WHERE a.manager_user_id = v_user.id AND a.status = 'ACTIVE'
        )
      )
  ) INTO v_walton;
  IF v_walton THEN v_days := 24; END IF;

  UPDATE public.users
  SET academic_year = NULLIF(trim(p_academic_year), '')
  WHERE id = v_user.id;

  INSERT INTO public.manpower_salary (emp_id, salary, conveyance)
  VALUES (upper(v_user.emp_id), p_salary, p_daily_conveyance * v_days)
  ON CONFLICT (emp_id) DO UPDATE
    SET salary = EXCLUDED.salary, conveyance = EXCLUDED.conveyance;

  INSERT INTO public.user_personal_info
    (user_id, emp_id, blood_group, emergency_contact_name, emergency_contact_phone,
     daily_conveyance, conveyance_days, updated_at)
  VALUES
    (v_user.id, v_user.emp_id, p_blood_group, trim(p_emergency_name), trim(p_emergency_phone),
     p_daily_conveyance, v_days, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET blood_group = EXCLUDED.blood_group,
        emergency_contact_name = EXCLUDED.emergency_contact_name,
        emergency_contact_phone = EXCLUDED.emergency_contact_phone,
        daily_conveyance = EXCLUDED.daily_conveyance,
        conveyance_days = EXCLUDED.conveyance_days,
        updated_at = NOW();

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_submit_profile_info(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_submit_profile_info(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;
