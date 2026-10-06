-- ============================================================================
-- Fix: "Your account is not linked to the staff sheet yet" on My Profile (permanent fix).
-- Cause: signup linked the sheet record only if the email typed matched the sheet email, so
-- people whose email differs stayed unlinked. Employee ID is unique per account, so it is a
-- safe key: when the sheet record for MY employee ID has no owner, link it to me on first
-- open/save. A record owned by a different account is still refused (NOT_LINKED).
-- Run once in Supabase SQL Editor (after supabase_staff_records.sql). Safe to re-run.
-- ============================================================================

-- 1. Backfill: link every account to its unowned sheet record.
UPDATE public.staff_records s
SET linked_user_id = u.id
FROM public.users u
WHERE upper(u.emp_id) = s.emp_id
  AND s.linked_user_id IS NULL;

-- 2. My record: auto-link when unowned.
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

  UPDATE public.staff_records SET linked_user_id = v_user.id
  WHERE emp_id = upper(v_user.emp_id) AND linked_user_id IS NULL;

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

-- 3. Save my record: auto-link when unowned.
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
  ELSIF v_owner IS NULL THEN
    UPDATE public.staff_records SET linked_user_id = v_user.id WHERE emp_id = v_id;
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

-- 4. Anyone still refused is linked to a DIFFERENT account. List them for the Admin to review:
-- SELECT s.emp_id, s.name, s.linked_user_id, u.id AS my_user_id, u.name AS account_name
-- FROM public.staff_records s JOIN public.users u ON upper(u.emp_id) = s.emp_id
-- WHERE s.linked_user_id IS DISTINCT FROM u.id;
