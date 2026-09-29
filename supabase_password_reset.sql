-- ============================================================================
-- PASSWORD RESET MIGRATION
-- Run once in Supabase Dashboard -> SQL Editor -> Run, AFTER
-- supabase_password_auth.sql.
--
-- Reset tokens are created only by the `request-password-reset` Edge Function
-- (service role), which emails the raw token to the account's address. Only a
-- SHA-256 hash of each token is stored, in a table the anon key cannot touch.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON public.password_reset_tokens (user_id, created_at);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_tokens FROM anon, authenticated;

-- Use a reset token to set a new password. Returns:
--   'OK'        password changed; the token and all other tokens for the user are spent
--   'INVALID'   token unknown, expired or already used
--   'TOO_SHORT' new password under 4 characters (token is NOT spent)
CREATE OR REPLACE FUNCTION public.app_reset_password(p_token TEXT, p_new TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN 'INVALID';
  END IF;
  IF p_new IS NULL OR length(p_new) < 4 THEN
    RETURN 'TOO_SHORT';
  END IF;

  -- Claim the token atomically so it can only be used once.
  UPDATE public.password_reset_tokens
  SET used_at = NOW()
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND used_at IS NULL
    AND expires_at > NOW()
  RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RETURN 'INVALID';
  END IF;

  INSERT INTO public.user_credentials (user_id, password_hash, updated_at)
  VALUES (v_user_id, crypt(p_new, gen_salt('bf')), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash, updated_at = NOW();

  -- Spend any other outstanding links for this user.
  UPDATE public.password_reset_tokens
  SET used_at = NOW()
  WHERE user_id = v_user_id AND used_at IS NULL;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_reset_password(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_reset_password(TEXT, TEXT) TO anon, authenticated;
