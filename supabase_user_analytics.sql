-- ============================================================================
-- USER ANALYTICS & DASHBOARD: Logins, Weekly Activity, Client Usage, and Theme
-- Run once in Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. Ensure theme and last_login_at columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'classic';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Persistent table for recording every user login
CREATE TABLE IF NOT EXISTS public.user_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_id ON public.user_login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_time ON public.user_login_logs(logged_in_at DESC);

ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_login_logs FROM anon, authenticated;

-- 3. Backfill initial login history from existing sessions if empty
INSERT INTO public.user_login_logs (user_id, logged_in_at)
SELECT s.user_id, s.created_at
FROM public.user_sessions s
WHERE NOT EXISTS (SELECT 1 FROM public.user_login_logs l WHERE l.user_id = s.user_id);

-- Update users.last_login_at from user_sessions
UPDATE public.users u
SET last_login_at = s.max_time
FROM (
  SELECT user_id, MAX(created_at) AS max_time
  FROM public.user_sessions
  GROUP BY user_id
) s
WHERE u.id = s.user_id AND (u.last_login_at IS NULL OR u.last_login_at < s.max_time);

-- 4. Update login session function to log permanently and update last_login_at
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

  -- Record persistent login audit
  INSERT INTO public.user_login_logs (user_id, logged_in_at)
  VALUES (p_user_id, NOW());

  -- Update user last login timestamp
  UPDATE public.users SET last_login_at = NOW() WHERE id = p_user_id;

  -- Housekeeping: drop this user's expired sessions.
  DELETE FROM public.user_sessions WHERE user_id = p_user_id AND expires_at < NOW();

  RETURN QUERY SELECT 'OK'::TEXT, v_token;
END;
$$;

-- 5. User theme update function
CREATE OR REPLACE FUNCTION public.app_user_theme_set(p_session TEXT, p_theme TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  IF COALESCE(p_session, '') = '' THEN RETURN 'NO_ACCESS'; END IF;
  IF p_theme NOT IN ('classic', 'glass') THEN RETURN 'INVALID_THEME'; END IF;

  SELECT u.id INTO v_user_id
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';

  IF v_user_id IS NULL THEN RETURN 'NO_ACCESS'; END IF;

  UPDATE public.users SET theme = p_theme WHERE id = v_user_id;
  RETURN 'OK';
END;
$$;

-- 6. User Analytics Aggregator (Admin Only)
CREATE OR REPLACE FUNCTION public.app_user_analytics_get(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.users%ROWTYPE;
  v_total_logins BIGINT;
  v_weekly_logins BIGINT;
  v_today_logins BIGINT;
  v_active_users_7d BIGINT;
  v_active_users_today BIGINT;
  v_daily_logins JSONB;
  v_user_stats JSONB;
  v_theme_counts JSONB;
BEGIN
  -- Authenticate caller
  IF COALESCE(p_session, '') = '' THEN
    RAISE EXCEPTION 'NO_ACCESS';
  END IF;

  SELECT u.* INTO v_admin
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(p_session, 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';

  IF v_admin.id IS NULL OR v_admin.role <> 'ADMIN' THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  -- 1. Aggregated Login Counts (combines user_login_logs and active user_sessions)
  SELECT COUNT(*) INTO v_total_logins FROM public.user_login_logs;
  SELECT COUNT(*) INTO v_weekly_logins FROM public.user_login_logs WHERE logged_in_at >= NOW() - INTERVAL '7 days';
  SELECT COUNT(*) INTO v_today_logins FROM public.user_login_logs WHERE logged_in_at >= CURRENT_DATE;

  SELECT COUNT(DISTINCT user_id) INTO v_active_users_7d FROM public.user_login_logs WHERE logged_in_at >= NOW() - INTERVAL '7 days';
  SELECT COUNT(DISTINCT user_id) INTO v_active_users_today FROM public.user_login_logs WHERE logged_in_at >= CURRENT_DATE;

  -- 2. Daily Logins (Last 30 Days timeline)
  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'date' ASC), '[]'::jsonb) INTO v_daily_logins
  FROM (
    SELECT
      to_char(day::date, 'YYYY-MM-DD') AS "date",
      COUNT(l.id) AS "count"
    FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS day
    LEFT JOIN public.user_login_logs l ON date_trunc('day', l.logged_in_at) = day::date
    GROUP BY day::date
  ) d;

  -- 3. Per-User Stats (login counts & last login)
  SELECT COALESCE(jsonb_agg(u), '[]'::jsonb) INTO v_user_stats
  FROM (
    SELECT
      user_id,
      COUNT(*) AS login_count,
      MAX(logged_in_at) AS last_login_at
    FROM public.user_login_logs
    GROUP BY user_id
  ) u;

  -- 4. Theme Counts
  SELECT COALESCE(jsonb_object_agg(COALESCE(theme, 'classic'), cnt), '{}'::jsonb) INTO v_theme_counts
  FROM (
    SELECT COALESCE(theme, 'classic') AS theme, COUNT(*) AS cnt
    FROM public.users
    GROUP BY theme
  ) t;

  RETURN jsonb_build_object(
    'total_logins', v_total_logins,
    'weekly_logins', v_weekly_logins,
    'today_logins', v_today_logins,
    'active_users_7d', v_active_users_7d,
    'active_users_today', v_active_users_today,
    'daily_logins', v_daily_logins,
    'user_stats', v_user_stats,
    'theme_counts', v_theme_counts
  );
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.app_user_theme_set(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_analytics_get(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_user_theme_set(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_user_analytics_get(TEXT) TO anon, authenticated;
