-- ============================================================================
-- EMAIL LOG: stops the same task email being sent twice.
-- Run once in Supabase Dashboard -> SQL Editor (before using the send-task-email function).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_log (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event, ref_id, user_id)
);
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_log FROM anon, authenticated;
