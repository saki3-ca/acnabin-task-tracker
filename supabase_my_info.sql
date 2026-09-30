-- ============================================================================
-- EDIT PROFILE: read and save my own information (academic year, salary,
-- conveyance, blood group, emergency contact).
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_profile_info.sql.
-- ============================================================================

-- Returns the caller's own saved values (empty result if the session is invalid).
CREATE OR REPLACE FUNCTION public.app_get_my_info(p_session TEXT)
RETURNS TABLE (
  academic_year TEXT, salary NUMERIC, conveyance NUMERIC, daily_conveyance NUMERIC,
  conveyance_days INT, blood_group TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT
)
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
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT v_user.academic_year, ms.salary, ms.conveyance, pi.daily_conveyance,
           pi.conveyance_days, pi.blood_group, pi.emergency_contact_name, pi.emergency_contact_phone
    FROM (SELECT 1) one
    LEFT JOIN public.manpower_salary ms ON ms.emp_id = upper(v_user.emp_id)
    LEFT JOIN public.user_personal_info pi ON pi.user_id = v_user.id;
END;
$$;

-- Saves only the fields that are sent (NULL = leave as it is).
-- Returns 'OK' | 'INVALID_SESSION' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_save_my_info(
  p_session TEXT, p_academic_year TEXT, p_salary NUMERIC, p_daily_conveyance NUMERIC,
  p_blood_group TEXT, p_emergency_name TEXT, p_emergency_phone TEXT
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
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;

  IF (p_salary IS NOT NULL AND p_salary < 0)
     OR (p_daily_conveyance IS NOT NULL AND p_daily_conveyance < 0)
     OR (p_blood_group IS NOT NULL AND p_blood_group NOT IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')) THEN
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

  IF p_academic_year IS NOT NULL THEN
    UPDATE public.users SET academic_year = NULLIF(trim(p_academic_year), '') WHERE id = v_user.id;
  END IF;

  IF p_salary IS NOT NULL OR p_daily_conveyance IS NOT NULL THEN
    INSERT INTO public.manpower_salary (emp_id, salary, conveyance)
    VALUES (upper(v_user.emp_id), COALESCE(p_salary, 0), COALESCE(p_daily_conveyance * v_days, 0))
    ON CONFLICT (emp_id) DO UPDATE
      SET salary = COALESCE(p_salary, public.manpower_salary.salary),
          conveyance = COALESCE(p_daily_conveyance * v_days, public.manpower_salary.conveyance);
  END IF;

  IF p_daily_conveyance IS NOT NULL OR p_blood_group IS NOT NULL
     OR NULLIF(trim(COALESCE(p_emergency_name, '')), '') IS NOT NULL
     OR NULLIF(trim(COALESCE(p_emergency_phone, '')), '') IS NOT NULL THEN
    INSERT INTO public.user_personal_info
      (user_id, emp_id, blood_group, emergency_contact_name, emergency_contact_phone, daily_conveyance, conveyance_days, updated_at)
    VALUES
      (v_user.id, v_user.emp_id, p_blood_group, NULLIF(trim(COALESCE(p_emergency_name, '')), ''),
       NULLIF(trim(COALESCE(p_emergency_phone, '')), ''), p_daily_conveyance,
       CASE WHEN p_daily_conveyance IS NULL THEN NULL ELSE v_days END, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET blood_group = COALESCE(EXCLUDED.blood_group, public.user_personal_info.blood_group),
          emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, public.user_personal_info.emergency_contact_name),
          emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, public.user_personal_info.emergency_contact_phone),
          daily_conveyance = COALESCE(EXCLUDED.daily_conveyance, public.user_personal_info.daily_conveyance),
          conveyance_days = COALESCE(EXCLUDED.conveyance_days, public.user_personal_info.conveyance_days),
          updated_at = NOW();
  END IF;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_get_my_info(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_save_my_info(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_get_my_info(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_save_my_info(TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO anon, authenticated;
