-- ============================================================================
-- MANPOWER for staff BELOW Assistant Director (In Charge, Supervisor, Senior Assistant
-- Manager, Deputy Manager, Manager): they see only the people on THEIR OWN clients,
-- with the full staff-sheet details and NO salary / conveyance.
-- Run once in Supabase Dashboard -> SQL Editor, after supabase_staff_records.sql,
-- supabase_my_info.sql and supabase_access_v4.sql.
--
-- Returns NULL for Admin, Assistant Director and above, anyone the Admin picked in
-- Tab Access -> Manpower (they keep the full directory), and everyone else.
-- Otherwise returns {clients:[{id,name,jobNumber,remarks}], rows:[...]}.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_manpower_scoped(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_mine TEXT[];
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_user.role = 'ADMIN'
     OR v_user.designation NOT IN ('In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager') THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.manpower_access a WHERE a.user_id = v_user.id) THEN RETURN NULL; END IF;

  -- my clients = signup clients + manager access (the same set the app uses everywhere)
  SELECT COALESCE(array_agg(DISTINCT x.cid), ARRAY[]::TEXT[]) INTO v_mine
  FROM (
    SELECT btrim(c) AS cid FROM unnest(string_to_array(COALESCE(v_user.signup_client_id, ''), ',')) c
    UNION
    SELECT m.client_id FROM public.manager_client_access m WHERE m.manager_user_id = v_user.id AND m.status = 'ACTIVE'
  ) x
  WHERE x.cid <> '' AND EXISTS (SELECT 1 FROM public.clients cl WHERE cl.id = x.cid);

  RETURN jsonb_build_object(
    'clients', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cl.id, 'name', cl.name, 'jobNumber', COALESCE(cl.job_number, ''),
        'remarks', COALESCE(r.remarks, '')) ORDER BY cl.name)
      FROM public.clients cl
      LEFT JOIN public.client_manpower_remarks r ON r.client_id = cl.id
      WHERE cl.id = ANY (v_mine)
    ), '[]'::jsonb),
    'rows', COALESCE((
      WITH uc AS (
        SELECT u2.id AS uid, btrim(c) AS cid
        FROM public.users u2, unnest(string_to_array(COALESCE(u2.signup_client_id, ''), ',')) c
        UNION
        SELECT m.manager_user_id, m.client_id FROM public.manager_client_access m WHERE m.status = 'ACTIVE'
      ), shared AS (
        SELECT uc.uid, array_agg(DISTINCT uc.cid) AS cids
        FROM uc WHERE uc.cid = ANY (v_mine) GROUP BY uc.uid
      )
      SELECT jsonb_agg(jsonb_build_object(
        'emp_id', upper(u.emp_id),
        'name', u.name,
        'designation', u.designation,
        'client_ids', to_jsonb(COALESCE(sh.cids, ARRAY[]::TEXT[])),
        'department', COALESCE(sr.department, ''),
        'academic_year', COALESCE(NULLIF(u.academic_year, ''), sr.academic_year, ''),
        'joining_date', COALESCE(sr.joining_date::text, ''),
        'articleship_period', COALESCE(sr.articleship_period, ''),
        'articleship_start', COALESCE(sr.articleship_start::text, ''),
        'articleship_end', COALESCE(sr.articleship_end::text, ''),
        'principal_name', COALESCE(sr.principal_name, ''),
        'mobile', COALESCE(NULLIF(sr.mobile, ''), u.mobile, ''),
        'email', COALESCE(NULLIF(sr.email, ''), u.email, ''),
        'blood_group', COALESCE(pi.blood_group, sr.blood_group, ''),
        'present_address', COALESCE(sr.present_address, ''),
        'emergency_name', COALESCE(pi.emergency_contact_name, sr.emergency_name, ''),
        'emergency_relationship', COALESCE(sr.emergency_relationship, ''),
        'emergency_phone', COALESCE(pi.emergency_contact_phone, sr.emergency_phone, ''),
        'laptop_available', COALESCE(sr.laptop_available, ''),
        'laptop_ownership', COALESCE(sr.laptop_ownership, ''),
        'laptop_id', COALESCE(sr.laptop_id, ''),
        'remarks', COALESCE(sr.remarks, '')
      ) ORDER BY u.emp_id)
      FROM public.users u
      LEFT JOIN shared sh ON sh.uid = u.id
      LEFT JOIN public.staff_records sr ON sr.emp_id = upper(u.emp_id)
      LEFT JOIN public.user_personal_info pi ON pi.user_id = u.id
      WHERE u.status = 'ACTIVE'
        AND u.role <> 'ADMIN'
        AND u.designation NOT IN ('Partner', 'Admin')
        AND (sh.uid IS NOT NULL OR u.id = v_user.id)
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.app_manpower_scoped(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_manpower_scoped(TEXT) TO anon, authenticated;
