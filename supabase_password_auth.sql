-- ============================================================================
-- PASSWORD AUTH MIGRATION
-- Run this entire script once in Supabase Dashboard -> SQL Editor -> Run.
--
-- Password hashes live in their own table with RLS enabled and NO policies,
-- so the public (anon) key can never read or write them. The app only talks
-- to them through the SECURITY DEFINER functions below, which compare bcrypt
-- hashes inside Postgres.
--
-- Existing accounts have no password yet: the first successful login to such
-- an account sets its password.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_credentials FROM anon, authenticated;

-- Verify a login. Returns:
--   'OK'        password matches
--   'SET'       account had no password; this password is now saved
--   'INVALID'   wrong password
--   'TOO_SHORT' account has no password and the given one is under 4 chars
CREATE OR REPLACE FUNCTION public.app_login(p_user_id TEXT, p_password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_password IS NULL OR p_password = '' THEN
    RETURN 'INVALID';
  END IF;

  SELECT password_hash INTO v_hash FROM public.user_credentials WHERE user_id = p_user_id;

  IF v_hash IS NULL THEN
    IF length(p_password) < 4 THEN
      RETURN 'TOO_SHORT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
      RETURN 'INVALID';
    END IF;
    INSERT INTO public.user_credentials (user_id, password_hash)
    VALUES (p_user_id, crypt(p_password, gen_salt('bf')))
    ON CONFLICT (user_id) DO NOTHING;
    -- Lost a race with a concurrent first login: verify against the winner.
    SELECT password_hash INTO v_hash FROM public.user_credentials WHERE user_id = p_user_id;
    RETURN CASE WHEN v_hash = crypt(p_password, v_hash) THEN 'SET' ELSE 'INVALID' END;
  END IF;

  RETURN CASE WHEN v_hash = crypt(p_password, v_hash) THEN 'OK' ELSE 'INVALID' END;
END;
$$;

-- Set the initial password for a newly registered account.
-- Refuses (returns FALSE) if the account already has a password.
CREATE OR REPLACE FUNCTION public.app_set_initial_password(p_user_id TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 4 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_credentials (user_id, password_hash)
  VALUES (p_user_id, crypt(p_password, gen_salt('bf')))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- Change password. Returns FALSE if the current password is wrong.
CREATE OR REPLACE FUNCTION public.app_change_password(p_user_id TEXT, p_current TEXT, p_new TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_new IS NULL OR length(p_new) < 4 THEN
    RETURN FALSE;
  END IF;
  SELECT password_hash INTO v_hash FROM public.user_credentials WHERE user_id = p_user_id;
  IF v_hash IS NULL OR v_hash <> crypt(COALESCE(p_current, ''), v_hash) THEN
    RETURN FALSE;
  END IF;
  UPDATE public.user_credentials
  SET password_hash = crypt(p_new, gen_salt('bf')), updated_at = NOW()
  WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.app_login(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_set_initial_password(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_change_password(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_set_initial_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
