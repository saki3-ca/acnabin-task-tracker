-- ============================================================================
-- EXAM LEAVE TAB ON/OFF SWITCH (Admin turns the tab on for exam time, off after)
-- Run once in Supabase Dashboard -> SQL Editor.
-- Anyone logged in can read the switch; only Admin can change it.
-- Until Admin changes it, the tab is ON.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_flags (
  key TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_flags FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_exam_leave_enabled_get(p_session TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
    WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
      AND s.expires_at > NOW() AND u.status = 'ACTIVE'
  ) THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT value FROM public.app_flags WHERE key = 'exam_leave_enabled'), 'true') = 'true';
END;
$$;

CREATE OR REPLACE FUNCTION public.app_exam_leave_enabled_set(p_session TEXT, p_enabled BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
    WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
      AND s.expires_at > NOW() AND u.status = 'ACTIVE' AND u.role = 'ADMIN'
  ) THEN RETURN 'FORBIDDEN'; END IF;
  INSERT INTO public.app_flags (key, value) VALUES ('exam_leave_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_exam_leave_enabled_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_exam_leave_enabled_set(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_exam_leave_enabled_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_exam_leave_enabled_set(TEXT, BOOLEAN) TO anon, authenticated;
