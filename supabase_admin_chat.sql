-- ============================================================================
-- ADMIN <-> USER QUESTION CHAT
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_profile_info.sql.
--
-- Admin sends a question to one user; it appears in that user's notifications
-- as unread and stays there until they reply. Messages live in a protected
-- table, reachable only through these session-checked functions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('ADMIN', 'USER')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_chat_user_idx ON public.admin_chat_messages (user_id, created_at);

ALTER TABLE public.admin_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_chat_messages FROM anon, authenticated;

-- Admin asks a user a question. Returns 'OK' | 'INVALID_SESSION' | 'FORBIDDEN' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_chat_send_question(p_session TEXT, p_user_id TEXT, p_message TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin public.users%ROWTYPE;
  v_id BIGINT;
BEGIN
  SELECT u.* INTO v_admin
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_admin.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;

  IF COALESCE(trim(p_message), '') = '' OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RETURN 'INVALID_INPUT';
  END IF;

  INSERT INTO public.admin_chat_messages (user_id, sender, message)
  VALUES (p_user_id, 'ADMIN', trim(p_message))
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, type, title, message, data, is_read)
  VALUES (p_user_id, 'ADMIN_QUERY', 'Question from Admin', trim(p_message),
          jsonb_build_object('questionId', v_id), false);

  RETURN 'OK';
END;
$$;

-- A user answers a question. Returns 'OK' | 'INVALID_SESSION' | 'INVALID_INPUT'
CREATE OR REPLACE FUNCTION public.app_chat_reply(p_session TEXT, p_question_id BIGINT, p_message TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN 'INVALID_SESSION'; END IF;

  IF COALESCE(trim(p_message), '') = ''
     OR NOT EXISTS (
       SELECT 1 FROM public.admin_chat_messages
       WHERE id = p_question_id AND user_id = v_user.id AND sender = 'ADMIN'
     ) THEN
    RETURN 'INVALID_INPUT';
  END IF;

  INSERT INTO public.admin_chat_messages (user_id, sender, message)
  VALUES (v_user.id, 'USER', trim(p_message));

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = v_user.id
    AND type = 'ADMIN_QUERY'
    AND (data->>'questionId') = p_question_id::text;

  RETURN 'OK';
END;
$$;

-- The conversation with one user. Admin can read any user's; a user only their own.
CREATE OR REPLACE FUNCTION public.app_chat_get(p_session TEXT, p_user_id TEXT)
RETURNS TABLE (id BIGINT, sender TEXT, message TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_target TEXT;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW()
    AND u.status = 'ACTIVE';
  IF NOT FOUND THEN RETURN; END IF;

  v_target := CASE WHEN v_user.role = 'ADMIN' THEN p_user_id ELSE v_user.id END;

  RETURN QUERY
    SELECT m.id, m.sender, m.message, m.created_at
    FROM public.admin_chat_messages m
    WHERE m.user_id = v_target
    ORDER BY m.created_at, m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.app_chat_send_question(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_chat_reply(TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_chat_get(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_chat_send_question(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_chat_reply(TEXT, BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_chat_get(TEXT, TEXT) TO anon, authenticated;
