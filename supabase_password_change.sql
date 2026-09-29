-- ============================================================================
-- LOGIN SESSIONS + CHANGE PASSWORD WITHOUT THE CURRENT PASSWORD
-- Run once in Supabase Dashboard -> SQL Editor -> Run, AFTER
-- supabase_password_auth.sql.
--
-- A successful login now also returns a random session key, which the browser
-- keeps. Changing the password only needs that key plus the new password, so a
-- logged-in user doesn't re-enter their current password, but nobody can
-- change another account's password just by knowing its user ID.
-- Only SHA-256 hashes of session keys are stored, in a table the anon key
-- cannot touch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions (user_id);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_sessions FROM anon, authenticated;

-- Verify a login and, on success, open a 30-day session.
-- status: 'OK' | 'INVALID' | 'NO_PASSWORD'; session_token is set only for 'OK'.
CREATE OR REPLACE FUNCTION public.app_login_session(p_user_id TEXT, p_password TEXT)
RETURNS TABLE (status TEXT, session_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_token TEXT;
BEGIN
  IF p_password IS NULL OR p_password = '' THEN
    RETURN QUERY SELECT 'INVALID'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  SELECT password_hash INTO v_hash FROM public.user_credentials WHERE user_id = p_user_id;

  IF v_hash IS NULL THEN
    RETURN QUERY SELECT 'NO_PASSWORD'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF v_hash <> crypt(p_password, v_hash) THEN
    RETURN QUERY SELECT 'INVALID'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.user_sessions (token_hash, user_id, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), p_user_id, NOW() + INTERVAL '30 days');

  -- Housekeeping: drop this user's expired sessions.
  DELETE FROM public.user_sessions WHERE user_id = p_user_id AND expires_at < NOW();

  RETURN QUERY SELECT 'OK'::TEXT, v_token;
END;
$$;

-- Set a new password for the account that owns the session.
-- Returns 'OK' | 'INVALID_SESSION' | 'TOO_SHORT'.
CREATE OR REPLACE FUNCTION public.app_set_password_with_session(p_session TEXT, p_new TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  IF p_new IS NULL OR length(p_new) < 4 THEN
    RETURN 'TOO_SHORT';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.user_sessions
  WHERE token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND expires_at > NOW();

  IF v_user_id IS NULL THEN
    RETURN 'INVALID_SESSION';
  END IF;

  INSERT INTO public.user_credentials (user_id, password_hash, updated_at)
  VALUES (v_user_id, crypt(p_new, gen_salt('bf')), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash, updated_at = NOW();

  RETURN 'OK';
END;
$$;

-- End a session (logout).
CREATE OR REPLACE FUNCTION public.app_logout(p_session TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  DELETE FROM public.user_sessions
  WHERE token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION public.app_login_session(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_set_password_with_session(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_logout(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_login_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_set_password_with_session(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_logout(TEXT) TO anon, authenticated;
