-- ============================================================================
-- PROPOSAL TRACKER v2: several people can be assigned to a proposal (they get an email),
-- and the screen can list who has access (for the "Assigned to" dropdown).
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_proposals.sql.
-- ============================================================================

ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS assigned_ids TEXT[] NOT NULL DEFAULT '{}';

-- Everyone who has access to the tracker (for the "Assigned to" dropdown)
CREATE OR REPLACE FUNCTION public.app_proposal_people(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._proposal_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'designation', u.designation) ORDER BY u.name)
    FROM public.users u
    WHERE u.status = 'ACTIVE'
      AND u.id IN (SELECT user_id FROM public.proposal_access)
  ), '[]'::jsonb);
END;
$$;

-- All proposals (now with the ids of the assigned people)
CREATE OR REPLACE FUNCTION public.app_proposal_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._proposal_caller(p_session) AS c) x) THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'client', client, 'type', COALESCE(type, ''),
      'assignedTo', COALESCE(assigned_to, ''), 'assignedIds', to_jsonb(assigned_ids),
      'receiveDate', COALESCE(receive_date::text, ''),
      'deadline', COALESCE(deadline::text, ''), 'status', status, 'remarks', COALESCE(remarks, ''),
      'createdAt', created_at) ORDER BY created_at DESC)
    FROM public.proposals
  ), '[]'::jsonb);
END;
$$;

-- Add or edit one proposal. "assignedIds" (a list of user ids) sets who it is assigned to.
-- Returns OK | DUPLICATE | NO_ACCESS | INVALID_INPUT
CREATE OR REPLACE FUNCTION public.app_proposal_save(p_session TEXT, p_fields JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_id TEXT;
  v_name TEXT; v_client TEXT;
  v_has_ids BOOLEAN := (p_fields ? 'assignedIds') AND jsonb_typeof(p_fields->'assignedIds') = 'array';
  v_ids TEXT[] := '{}';
  v_names TEXT := NULL;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN RETURN 'INVALID_INPUT'; END IF;

  v_name := btrim(COALESCE(p_fields->>'name', ''));
  v_client := btrim(COALESCE(p_fields->>'client', ''));
  IF v_name = '' OR v_client = '' THEN RETURN 'INVALID_INPUT'; END IF;
  v_id := NULLIF(btrim(COALESCE(p_fields->>'id', '')), '');

  IF v_has_ids THEN
    -- only active people who have access to the tracker, in the order they were picked
    SELECT COALESCE(array_agg(u.id ORDER BY w.ord), '{}'), string_agg(u.name, ', ' ORDER BY w.ord)
    INTO v_ids, v_names
    FROM jsonb_array_elements_text(p_fields->'assignedIds') WITH ORDINALITY AS w(uid, ord)
    JOIN public.users u ON u.id = w.uid AND u.status = 'ACTIVE'
    WHERE u.role = 'ADMIN' OR EXISTS (SELECT 1 FROM public.proposal_access a WHERE a.user_id = u.id);
  END IF;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.proposals WHERE id = v_id) THEN
    UPDATE public.proposals SET
      name = v_name, client = v_client,
      type = NULLIF(btrim(COALESCE(p_fields->>'type', '')), ''),
      assigned_to = CASE WHEN v_has_ids THEN v_names ELSE assigned_to END,
      assigned_ids = CASE WHEN v_has_ids THEN v_ids ELSE assigned_ids END,
      receive_date = NULLIF(btrim(COALESCE(p_fields->>'receiveDate', '')), '')::DATE,
      deadline = NULLIF(btrim(COALESCE(p_fields->>'deadline', '')), '')::DATE,
      status = COALESCE(NULLIF(btrim(COALESCE(p_fields->>'status', '')), ''), status),
      remarks = NULLIF(btrim(COALESCE(p_fields->>'remarks', '')), ''),
      updated_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.proposals (id, name, client, type, assigned_to, assigned_ids, receive_date, deadline, status, remarks, created_by)
    VALUES (
      COALESCE(v_id, 'p' || (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT::TEXT),
      v_name, v_client,
      NULLIF(btrim(COALESCE(p_fields->>'type', '')), ''),
      CASE WHEN v_has_ids THEN v_names ELSE NULLIF(btrim(COALESCE(p_fields->>'assignedTo', '')), '') END,
      v_ids,
      NULLIF(btrim(COALESCE(p_fields->>'receiveDate', '')), '')::DATE,
      NULLIF(btrim(COALESCE(p_fields->>'deadline', '')), '')::DATE,
      COALESCE(NULLIF(btrim(COALESCE(p_fields->>'status', '')), ''), 'Draft'),
      NULLIF(btrim(COALESCE(p_fields->>'remarks', '')), ''),
      v_user.id);
  END IF;
  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN RETURN 'DUPLICATE';
  WHEN others THEN RETURN 'INVALID_INPUT';
END;
$$;

REVOKE ALL ON FUNCTION public.app_proposal_people(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_proposal_people(TEXT) TO anon, authenticated;
