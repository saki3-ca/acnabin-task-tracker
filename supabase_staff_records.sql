-- ============================================================================
-- STAFF RECORDS: the full information sheet (department, articleship, principal, address,
-- emergency contact, laptop, ...), kept in a locked table.
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_lockdown_users.sql.
--
--  * Admin imports the sheet with the "Staff Sheet Import" screen (Admin panel). No SQL needed later.
--  * A person sees and edits only their OWN record, through checked functions.
--  * A record is "linked" to an account when the IDs match: existing accounts are linked by the
--    import; a new signup is linked only if the email typed matches the email in the sheet
--    (or the sheet has no email). Re-importing links any account the Admin has since checked.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_records (
  emp_id TEXT PRIMARY KEY,
  name TEXT, department TEXT, designation TEXT, academic_year TEXT, client_names TEXT,
  articleship_period TEXT, articleship_start DATE, articleship_end DATE, principal_name TEXT,
  mobile TEXT, email TEXT, joining_date DATE, blood_group TEXT,
  emergency_name TEXT, emergency_relationship TEXT, emergency_phone TEXT, present_address TEXT,
  laptop_available TEXT, laptop_ownership TEXT, laptop_id TEXT, remarks TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.staff_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_records FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.staff_import_log (
  id BIGSERIAL PRIMARY KEY,
  run_by TEXT, run_at TIMESTAMPTZ DEFAULT NOW(), mode TEXT,
  total INT, inserted INT, updated INT, unchanged INT, linked INT
);
ALTER TABLE public.staff_import_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_import_log FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Import (Admin only). p_dry_run = TRUE only reports what would happen.
-- p_mode: 'FILL' keeps what is already saved and fills blanks; 'OVERWRITE' replaces with non-blank sheet values.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_import_staff(p_session TEXT, p_rows JSONB, p_mode TEXT, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.users%ROWTYPE;
  v_row JSONB; v_exist JSONB; v_merged JSONB; v_id TEXT;
  v_keys TEXT[] := ARRAY['name','department','designation','academic_year','client_names','articleship_period',
    'articleship_start','articleship_end','principal_name','mobile','email','joining_date','blood_group',
    'emergency_name','emergency_relationship','emergency_phone','present_address','laptop_available',
    'laptop_ownership','laptop_id','remarks'];
  k TEXT; inc TEXT; cur TEXT; nv TEXT;
  v_changed TEXT[]; v_acct RECORD; v_status TEXT; v_would_link BOOLEAN;
  v_out JSONB := '[]'::jsonb;
  n_new INT := 0; n_upd INT := 0; n_same INT := 0; n_link INT := 0; n_err INT := 0;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'INVALID_SESSION'); END IF;
  IF v_admin.role <> 'ADMIN' THEN RETURN jsonb_build_object('status', 'FORBIDDEN'); END IF;
  IF p_mode NOT IN ('FILL','OVERWRITE') OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array'
     OR jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 500 THEN
    RETURN jsonb_build_object('status', 'INVALID_INPUT');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_id := upper(trim(COALESCE(v_row->>'emp_id', '')));
    CONTINUE WHEN v_id !~ '^(STD|EMP)-[0-9]{6}$';

    BEGIN
      SELECT to_jsonb(s) INTO v_exist FROM public.staff_records s WHERE s.emp_id = v_id;
      v_merged := COALESCE(v_exist, jsonb_build_object('emp_id', v_id));
      v_changed := ARRAY[]::TEXT[];

      FOREACH k IN ARRAY v_keys LOOP
        inc := NULLIF(trim(COALESCE(v_row->>k, '')), '');
        cur := NULLIF(trim(COALESCE(v_exist->>k, '')), '');
        IF p_mode = 'OVERWRITE' THEN nv := COALESCE(inc, cur); ELSE nv := COALESCE(cur, inc); END IF;
        IF nv IS DISTINCT FROM cur THEN v_changed := array_append(v_changed, k); END IF;
        v_merged := jsonb_set(v_merged, ARRAY[k], COALESCE(to_jsonb(nv), 'null'::jsonb));
      END LOOP;

      IF p_mode = 'OVERWRITE' THEN
        v_merged := jsonb_set(v_merged, '{extra}', COALESCE(v_exist->'extra', '{}'::jsonb) || COALESCE(v_row->'extra', '{}'::jsonb));
      ELSE
        v_merged := jsonb_set(v_merged, '{extra}', COALESCE(v_row->'extra', '{}'::jsonb) || COALESCE(v_exist->'extra', '{}'::jsonb));
      END IF;

      SELECT id, name INTO v_acct FROM public.users WHERE upper(emp_id) = v_id LIMIT 1;
      v_would_link := v_acct.id IS NOT NULL AND COALESCE(v_exist->>'linked_user_id', '') <> v_acct.id;

      IF v_exist IS NULL THEN v_status := 'NEW';
      ELSIF array_length(v_changed, 1) IS NULL THEN v_status := 'UNCHANGED';
      ELSE v_status := 'UPDATED'; END IF;

      IF NOT p_dry_run THEN
        INSERT INTO public.staff_records
          (emp_id, name, department, designation, academic_year, client_names, articleship_period, articleship_start,
           articleship_end, principal_name, mobile, email, joining_date, blood_group, emergency_name,
           emergency_relationship, emergency_phone, present_address, laptop_available, laptop_ownership, laptop_id,
           remarks, extra, linked_user_id, created_at, updated_at)
        SELECT r.emp_id, r.name, r.department, r.designation, r.academic_year, r.client_names, r.articleship_period,
               r.articleship_start, r.articleship_end, r.principal_name, r.mobile, r.email, r.joining_date, r.blood_group,
               r.emergency_name, r.emergency_relationship, r.emergency_phone, r.present_address, r.laptop_available,
               r.laptop_ownership, r.laptop_id, r.remarks, COALESCE(r.extra, '{}'::jsonb),
               COALESCE(v_acct.id, r.linked_user_id), COALESCE(r.created_at, NOW()), NOW()
        FROM jsonb_populate_record(NULL::public.staff_records, v_merged) r
        ON CONFLICT (emp_id) DO UPDATE SET
          name = EXCLUDED.name, department = EXCLUDED.department, designation = EXCLUDED.designation,
          academic_year = EXCLUDED.academic_year, client_names = EXCLUDED.client_names,
          articleship_period = EXCLUDED.articleship_period, articleship_start = EXCLUDED.articleship_start,
          articleship_end = EXCLUDED.articleship_end, principal_name = EXCLUDED.principal_name,
          mobile = EXCLUDED.mobile, email = EXCLUDED.email, joining_date = EXCLUDED.joining_date,
          blood_group = EXCLUDED.blood_group, emergency_name = EXCLUDED.emergency_name,
          emergency_relationship = EXCLUDED.emergency_relationship, emergency_phone = EXCLUDED.emergency_phone,
          present_address = EXCLUDED.present_address, laptop_available = EXCLUDED.laptop_available,
          laptop_ownership = EXCLUDED.laptop_ownership, laptop_id = EXCLUDED.laptop_id, remarks = EXCLUDED.remarks,
          extra = EXCLUDED.extra, linked_user_id = COALESCE(EXCLUDED.linked_user_id, public.staff_records.linked_user_id),
          updated_at = NOW();
      END IF;

      IF v_status = 'NEW' THEN n_new := n_new + 1; ELSIF v_status = 'UPDATED' THEN n_upd := n_upd + 1; ELSE n_same := n_same + 1; END IF;
      IF v_would_link THEN n_link := n_link + 1; END IF;

      IF jsonb_array_length(v_out) < 400 THEN
        v_out := v_out || jsonb_build_array(jsonb_build_object(
          'emp_id', v_id, 'name', COALESCE(v_merged->>'name', ''), 'status', v_status,
          'account', v_acct.name, 'linked', v_acct.id IS NOT NULL,
          'nameMismatch', v_acct.id IS NOT NULL AND lower(trim(COALESCE(v_merged->>'name', ''))) <> lower(trim(v_acct.name)),
          'changed', to_jsonb(v_changed)));
      END IF;
    EXCEPTION WHEN others THEN
      n_err := n_err + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('emp_id', v_id, 'status', 'ERROR', 'error', SQLERRM));
    END;
  END LOOP;

  IF NOT p_dry_run THEN
    INSERT INTO public.staff_import_log (run_by, mode, total, inserted, updated, unchanged, linked)
    VALUES (v_admin.id, p_mode, n_new + n_upd + n_same, n_new, n_upd, n_same, n_link);
  END IF;

  RETURN jsonb_build_object('status', 'OK', 'dryRun', p_dry_run, 'mode', p_mode,
    'total', n_new + n_upd + n_same, 'new', n_new, 'updated', n_upd, 'unchanged', n_same,
    'linked', n_link, 'errors', n_err, 'rows', v_out);
END;
$$;

-- ---------------------------------------------------------------------------
-- My own record. Blood group / emergency contact fall back to what the person entered in the info form.
-- Returns NULL when nothing is linked to this account.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_get_my_staff(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_rec JSONB;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT to_jsonb(s) - 'linked_user_id' - 'extra' INTO v_rec
  FROM public.staff_records s
  WHERE s.emp_id = upper(v_user.emp_id) AND s.linked_user_id = v_user.id;
  IF v_rec IS NULL THEN RETURN NULL; END IF;

  SELECT v_rec
         || jsonb_build_object(
              'blood_group', COALESCE(pi.blood_group, v_rec->>'blood_group'),
              'emergency_name', COALESCE(pi.emergency_contact_name, v_rec->>'emergency_name'),
              'emergency_phone', COALESCE(pi.emergency_contact_phone, v_rec->>'emergency_phone'))
  INTO v_rec
  FROM (SELECT 1) one
  LEFT JOIN public.user_personal_info pi ON pi.user_id = v_user.id;

  RETURN v_rec;
END;
$$;

-- ---------------------------------------------------------------------------
-- Save my own record (blank = leave as it is). Returns 'OK' | 'INVALID_SESSION' | 'NOT_LINKED' | 'INVALID_INPUT'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_save_my_staff(p_session TEXT, p_fields JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_owner TEXT;
  v_id TEXT;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN RETURN 'INVALID_INPUT'; END IF;

  v_id := upper(v_user.emp_id);
  SELECT linked_user_id INTO v_owner FROM public.staff_records WHERE emp_id = v_id;
  IF NOT FOUND THEN
    INSERT INTO public.staff_records (emp_id, name, linked_user_id) VALUES (v_id, v_user.name, v_user.id);
  ELSIF v_owner IS DISTINCT FROM v_user.id THEN
    RETURN 'NOT_LINKED';
  END IF;

  UPDATE public.staff_records SET
    department = COALESCE(NULLIF(trim(p_fields->>'department'), ''), department),
    academic_year = COALESCE(NULLIF(trim(p_fields->>'academic_year'), ''), academic_year),
    articleship_period = COALESCE(NULLIF(trim(p_fields->>'articleship_period'), ''), articleship_period),
    articleship_start = COALESCE(NULLIF(trim(p_fields->>'articleship_start'), '')::DATE, articleship_start),
    articleship_end = COALESCE(NULLIF(trim(p_fields->>'articleship_end'), '')::DATE, articleship_end),
    principal_name = COALESCE(NULLIF(trim(p_fields->>'principal_name'), ''), principal_name),
    joining_date = COALESCE(NULLIF(trim(p_fields->>'joining_date'), '')::DATE, joining_date),
    present_address = COALESCE(NULLIF(trim(p_fields->>'present_address'), ''), present_address),
    emergency_relationship = COALESCE(NULLIF(trim(p_fields->>'emergency_relationship'), ''), emergency_relationship),
    laptop_available = COALESCE(NULLIF(trim(p_fields->>'laptop_available'), ''), laptop_available),
    laptop_ownership = COALESCE(NULLIF(trim(p_fields->>'laptop_ownership'), ''), laptop_ownership),
    laptop_id = COALESCE(NULLIF(trim(p_fields->>'laptop_id'), ''), laptop_id),
    remarks = COALESCE(NULLIF(trim(p_fields->>'remarks'), ''), remarks),
    updated_at = NOW()
  WHERE emp_id = v_id;

  RETURN 'OK';
EXCEPTION WHEN others THEN
  RETURN 'INVALID_INPUT';
END;
$$;

-- ---------------------------------------------------------------------------
-- Start / joining dates for the Manpower panel (Admin and Assistant Director and above).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_get_staff_dates(p_session TEXT)
RETURNS TABLE (emp_id TEXT, articleship_start DATE, articleship_end DATE, joining_date DATE, academic_year TEXT)
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
  IF NOT FOUND THEN RETURN; END IF;
  IF v_user.role = 'ADMIN' OR v_user.designation IN ('Assistant Director','Deputy Director','Director','Partner') THEN
    RETURN QUERY SELECT s.emp_id, s.articleship_start, s.articleship_end, s.joining_date, s.academic_year FROM public.staff_records s;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Signup links the sheet record when the email typed matches the sheet (or the sheet has no email).
-- (Replaces app_register_user from supabase_lockdown_users.sql, adding the linking step.)
-- ---------------------------------------------------------------------------
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

  -- Link the sheet record only when the email matches (or the sheet has no email)
  UPDATE public.staff_records
  SET linked_user_id = trim(p_id)
  WHERE emp_id = upper(trim(p_emp_id))
    AND linked_user_id IS NULL
    AND (COALESCE(trim(email), '') = '' OR lower(email) = lower(COALESCE(p_email, '')));

  RETURN 'OK';
EXCEPTION WHEN unique_violation THEN
  RETURN 'DUPLICATE';
END;
$$;

REVOKE ALL ON FUNCTION public.app_import_staff(TEXT, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_get_my_staff(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_save_my_staff(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_get_staff_dates(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_import_staff(TEXT, JSONB, TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_my_staff(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_save_my_staff(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_staff_dates(TEXT) TO anon, authenticated;
