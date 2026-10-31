-- ============================================================================
-- USER ANALYTICS (Admin Panel -> User Analytics)
-- Run once in Supabase Dashboard -> SQL Editor. Safe to run again.
--
-- What it records: every password login, plus every time the app is opened with a saved session (at most one
-- row per person per 4 hours) in user_login_logs, from now on.
-- Logins before you ran this file are rebuilt from the sessions that still exist (one per login, 30-day life),
-- so older history is partial. "Client activity" comes from the Task Log (task_history): every task created or
-- changed counts as one action by the person who did it, on that task's client.
-- Only Admin can read the dashboard. Nothing here changes how the app behaves for staff.
-- Requires supabase_task_history.sql to have been run.
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'classic';

CREATE TABLE IF NOT EXISTS public.user_login_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_login_logs_user_idx ON public.user_login_logs (user_id, logged_in_at DESC);
CREATE INDEX IF NOT EXISTS user_login_logs_time_idx ON public.user_login_logs (logged_in_at DESC);
ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_login_logs FROM anon, authenticated;

-- One-time backfill from sessions that still exist
INSERT INTO public.user_login_logs (user_id, logged_in_at)
SELECT s.user_id, s.created_at
FROM public.user_sessions s
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.user_login_logs);

-- Login: same as before, plus one row in the login log
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

  INSERT INTO public.user_login_logs (user_id) VALUES (p_user_id);

  -- Housekeeping: drop this user's expired sessions.
  DELETE FROM public.user_sessions WHERE user_id = p_user_id AND expires_at < NOW();

  RETURN QUERY SELECT 'OK'::TEXT, v_token;
END;
$$;

-- The app calls this each time it is opened with a saved session (people stay signed in for 30 days, so many
-- visits never go through the password login). Adds one row to the login log unless this person already has
-- one in the last 4 hours. Returns 'OK' | 'NO_ACCESS'.
CREATE OR REPLACE FUNCTION public.app_session_ping(p_session TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  SELECT u.id INTO v_user_id
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF v_user_id IS NULL THEN RETURN 'NO_ACCESS'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_login_logs
                 WHERE user_id = v_user_id AND logged_in_at > NOW() - INTERVAL '4 hours') THEN
    INSERT INTO public.user_login_logs (user_id) VALUES (v_user_id);
  END IF;
  RETURN 'OK';
END;
$$;

-- Saves the signed-in person's Classic/Glass choice on their account
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

-- Admin only. p_days = how many days back (0 = all time). Days are counted in Bangladesh time.
-- Returns NULL for anyone who is not an active Admin.
DROP FUNCTION IF EXISTS public.app_user_analytics_get(TEXT);
CREATE OR REPLACE FUNCTION public.app_user_analytics_get(p_session TEXT, p_days INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.users%ROWTYPE;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Dhaka')::date;
  v_from TIMESTAMPTZ;
  v_days INT := LEAST(GREATEST(COALESCE(p_days, 30), 0), 365);
  v_out JSONB;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND OR v_admin.role <> 'ADMIN' THEN RETURN NULL; END IF;

  v_from := CASE WHEN v_days = 0 THEN '-infinity'::timestamptz
                 ELSE ((v_today - (v_days - 1))::timestamp AT TIME ZONE 'Asia/Dhaka') END;

  SELECT jsonb_build_object(
    'trackingSince', (SELECT MIN(logged_in_at) FROM public.user_login_logs),
    'totalLogins', (SELECT COUNT(*) FROM public.user_login_logs),
    'logins', (SELECT COUNT(*) FROM public.user_login_logs WHERE logged_in_at >= v_from),
    'loginsToday', (SELECT COUNT(*) FROM public.user_login_logs
                    WHERE (logged_in_at AT TIME ZONE 'Asia/Dhaka')::date = v_today),
    'loginsWeek', (SELECT COUNT(*) FROM public.user_login_logs
                   WHERE (logged_in_at AT TIME ZONE 'Asia/Dhaka')::date > v_today - 7),
    'activeUsersToday', (SELECT COUNT(DISTINCT user_id) FROM public.user_login_logs
                         WHERE (logged_in_at AT TIME ZONE 'Asia/Dhaka')::date = v_today),
    'activeUsers', (SELECT COUNT(DISTINCT user_id) FROM public.user_login_logs WHERE logged_in_at >= v_from),
    'activeUsersWeek', (SELECT COUNT(DISTINCT user_id) FROM public.user_login_logs
                        WHERE (logged_in_at AT TIME ZONE 'Asia/Dhaka')::date > v_today - 7),

    -- logins and distinct people per day (days with nothing are filled with 0)
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', to_char(d.day, 'YYYY-MM-DD'), 'logins', COALESCE(x.n, 0), 'users', COALESCE(x.u, 0)) ORDER BY d.day)
      FROM generate_series(
             (CASE WHEN v_days = 0
                  THEN COALESCE((SELECT MIN((logged_in_at AT TIME ZONE 'Asia/Dhaka')::date) FROM public.user_login_logs), v_today)
                  ELSE v_today - (v_days - 1) END)::timestamp,
             v_today::timestamp, INTERVAL '1 day') AS d(day)
      LEFT JOIN (
        SELECT (logged_in_at AT TIME ZONE 'Asia/Dhaka')::date AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u
        FROM public.user_login_logs WHERE logged_in_at >= v_from GROUP BY 1
      ) x ON x.day = d.day::date
    ), '[]'::jsonb),

    -- logins by weekday (0 = Sunday) and by hour of day
    'byWeekday', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', g.i, 'logins', COALESCE(x.n, 0)) ORDER BY g.i)
      FROM generate_series(0, 6) g(i)
      LEFT JOIN (SELECT EXTRACT(DOW FROM logged_in_at AT TIME ZONE 'Asia/Dhaka')::int AS i, COUNT(*) AS n
                 FROM public.user_login_logs WHERE logged_in_at >= v_from GROUP BY 1) x ON x.i = g.i
    ), '[]'::jsonb),
    'byHour', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('hour', g.i, 'logins', COALESCE(x.n, 0)) ORDER BY g.i)
      FROM generate_series(0, 23) g(i)
      LEFT JOIN (SELECT EXTRACT(HOUR FROM logged_in_at AT TIME ZONE 'Asia/Dhaka')::int AS i, COUNT(*) AS n
                 FROM public.user_login_logs WHERE logged_in_at >= v_from GROUP BY 1) x ON x.i = g.i
    ), '[]'::jsonb),

    -- one row per person
    'users', COALESCE((
      SELECT jsonb_agg(to_jsonb(r))
      FROM (
        SELECT u.id AS "userId", u.name, u.emp_id AS "empId", u.designation, u.role, u.status,
               COALESCE(u.theme, 'classic') AS theme,
               (SELECT COUNT(*) FROM public.user_login_logs l WHERE l.user_id = u.id) AS "totalLogins",
               (SELECT COUNT(*) FROM public.user_login_logs l WHERE l.user_id = u.id AND l.logged_in_at >= v_from) AS logins,
               (SELECT COUNT(*) FROM public.user_login_logs l WHERE l.user_id = u.id
                  AND (l.logged_in_at AT TIME ZONE 'Asia/Dhaka')::date > v_today - 7) AS "loginsWeek",
               (SELECT COUNT(DISTINCT (l.logged_in_at AT TIME ZONE 'Asia/Dhaka')::date) FROM public.user_login_logs l
                  WHERE l.user_id = u.id AND l.logged_in_at >= v_from) AS "activeDays",
               (SELECT MAX(l.logged_in_at) FROM public.user_login_logs l WHERE l.user_id = u.id) AS "lastLogin",
               (SELECT COUNT(*) FROM public.task_history h WHERE h.changed_by_id = u.id AND h.changed_at >= v_from) AS actions
        FROM public.users u
      ) r
    ), '[]'::jsonb),

    -- actions per client (task created/changed, by whom the Task Log knows)
    'clients', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.actions DESC)
      FROM (
        SELECT COALESCE(NULLIF(TRIM(h.client_name), ''), 'General') AS "clientName",
               COUNT(*) AS actions,
               COUNT(DISTINCT h.changed_by_id) AS users,
               COUNT(DISTINCT h.task_id) AS tasks
        FROM public.task_history h
        WHERE h.changed_by_id IS NOT NULL AND h.changed_at >= v_from
        GROUP BY 1
      ) c
    ), '[]'::jsonb),

    -- person x client matrix: who works on which client how much
    'userClients', COALESCE((
      SELECT jsonb_agg(to_jsonb(m))
      FROM (
        SELECT h.changed_by_id AS "userId",
               COALESCE(NULLIF(TRIM(h.client_name), ''), 'General') AS "clientName",
               COUNT(*) AS actions
        FROM public.task_history h
        WHERE h.changed_by_id IS NOT NULL AND h.changed_at >= v_from
        GROUP BY 1, 2
        ORDER BY COUNT(*) DESC
        LIMIT 3000
      ) m
    ), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.app_session_ping(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_session_ping(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.app_user_theme_set(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_analytics_get(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_user_theme_set(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_user_analytics_get(TEXT, INT) TO anon, authenticated;
