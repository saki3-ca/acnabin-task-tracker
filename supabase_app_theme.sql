-- ============================================================================
-- APP THEME: Classic vs Glass
-- Run once in Supabase Dashboard -> SQL Editor.
-- Anyone (including logged-out users on Login/Signup) can read the app theme.
-- Only Admin can change it.
-- Uses the existing public.app_flags table (key = 'app_theme').
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_flags (
  key TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_flags FROM anon, authenticated;

-- Reads the active app theme ('classic' or 'glass'). Defaults to 'classic'.
-- Allowed without a login, because the login and signup screens need it.
CREATE OR REPLACE FUNCTION public.app_theme_get(p_session TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN COALESCE((SELECT value FROM public.app_flags WHERE key = 'app_theme'), 'classic');
END;
$$;

-- Admin only; returns OK / FORBIDDEN / INVALID_INPUT / NO_ACCESS.
-- No DELETE without a WHERE.
CREATE OR REPLACE FUNCTION public.app_theme_set(p_session TEXT, p_theme TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  IF COALESCE(p_session, '') = '' THEN
    RETURN 'NO_ACCESS';
  END IF;

  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';

  IF v_user.id IS NULL THEN
    RETURN 'NO_ACCESS';
  END IF;

  IF v_user.role <> 'ADMIN' THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF p_theme NOT IN ('classic', 'glass') THEN
    RETURN 'INVALID_INPUT';
  END IF;

  INSERT INTO public.app_flags (key, value)
  VALUES ('app_theme', p_theme)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_theme_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_theme_set(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_theme_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_theme_set(TEXT, TEXT) TO anon, authenticated;
