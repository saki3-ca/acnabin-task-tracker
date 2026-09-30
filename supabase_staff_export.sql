-- ============================================================================
-- MANPOWER EXCEL: lets Admin and Assistant Director and above download the full
-- staff details (department, articleship, address, emergency contact, laptop ...).
-- Read only. The role is checked on the server. Run once in the SQL Editor,
-- AFTER supabase_staff_records.sql.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_get_staff_all(p_session TEXT)
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
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  IF NOT (v_user.role = 'ADMIN' OR v_user.designation IN ('Assistant Director','Deputy Director','Director','Partner')) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      (to_jsonb(s) - 'linked_user_id' - 'extra')
      || jsonb_build_object(
           'blood_group', COALESCE(pi.blood_group, s.blood_group),
           'emergency_name', COALESCE(pi.emergency_contact_name, s.emergency_name),
           'emergency_phone', COALESCE(pi.emergency_contact_phone, s.emergency_phone))
    )
    FROM public.staff_records s
    LEFT JOIN public.user_personal_info pi ON pi.user_id = s.linked_user_id
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.app_get_staff_all(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_get_staff_all(TEXT) TO anon, authenticated;
