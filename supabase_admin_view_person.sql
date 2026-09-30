-- ============================================================================
-- ADMIN "Switch User": lets an Admin READ another person's full profile details
-- (staff record + allowance/salary + blood group/emergency contact).
-- Read only. Admin only: checked on the server, not in the browser.
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_staff_records.sql.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_admin_view_person(p_session TEXT, p_emp_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.users%ROWTYPE;
  v_target public.users%ROWTYPE;
  v_staff JSONB;
  v_info JSONB;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND OR v_admin.role <> 'ADMIN' THEN RETURN NULL; END IF;

  SELECT * INTO v_target FROM public.users WHERE upper(trim(emp_id)) = upper(trim(COALESCE(p_emp_id, ''))) LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT to_jsonb(s) - 'linked_user_id' - 'extra' INTO v_staff
  FROM public.staff_records s WHERE s.emp_id = upper(trim(v_target.emp_id));

  SELECT jsonb_build_object(
           'academic_year', v_target.academic_year,
           'salary', ms.salary, 'conveyance', ms.conveyance,
           'daily_conveyance', pi.daily_conveyance,
           'blood_group', pi.blood_group,
           'emergency_contact_name', pi.emergency_contact_name,
           'emergency_contact_phone', pi.emergency_contact_phone)
  INTO v_info
  FROM (SELECT 1) one
  LEFT JOIN public.manpower_salary ms ON ms.emp_id = upper(trim(v_target.emp_id))
  LEFT JOIN public.user_personal_info pi ON pi.user_id = v_target.id;

  RETURN jsonb_build_object('staff', v_staff, 'info', v_info);
END;
$$;

REVOKE ALL ON FUNCTION public.app_admin_view_person(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_view_person(TEXT, TEXT) TO anon, authenticated;
