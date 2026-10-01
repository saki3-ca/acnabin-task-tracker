-- Proposal Tracker: the "Assigned to" list now also includes Admin (Admin always has access to the tracker).
-- Run once in Supabase Dashboard -> SQL Editor, after supabase_proposals_v2.sql.
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
      AND (u.role = 'ADMIN' OR u.id IN (SELECT user_id FROM public.proposal_access))
  ), '[]'::jsonb);
END;
$$;
