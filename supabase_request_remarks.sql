-- ============================================================================
-- REMARKS WHEN ACCEPTING / DECLINING A TASK REQUEST
-- Run once in Supabase Dashboard -> SQL Editor.
-- (The app keeps working without it; it just can't store the remarks yet.)
-- ============================================================================
ALTER TABLE public.task_requests ADD COLUMN IF NOT EXISTS response_remarks TEXT;
