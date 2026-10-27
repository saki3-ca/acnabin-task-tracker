-- ============================================================================
-- TASK HISTORY: a log of every task being created, changed or deleted.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to run again.
--
-- What is logged: new task, deleted task, and changes to status, assignee, client, deadline, priority,
-- the task text, the employee remark and the manager comment (old value -> new value, when, and by whom).
-- Only Admin can read the log (Admin Panel -> Task Log). Nothing here changes how tasks work.
-- "By whom" comes from the app; if a change was made another way (for example directly in the database)
-- the name is left empty.
-- Tasks changed BEFORE you ran this file are not in the log.
-- ============================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_updated_by_id TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_updated_by_name TEXT;

CREATE TABLE IF NOT EXISTS public.task_history (
  id BIGSERIAL PRIMARY KEY,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED')),
  particular TEXT,
  client_name TEXT,
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_by_id TEXT,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_history_task_idx ON public.task_history (task_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS task_history_user_idx ON public.task_history (assigned_to_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS task_history_time_idx ON public.task_history (changed_at DESC);
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_history FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._task_history_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes JSONB := '{}'::jsonb;
  v_by_id TEXT;
  v_by_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_history (task_id, action, particular, client_name, assigned_to_id, assigned_to_name, changes, changed_by_id, changed_by_name)
    VALUES (NEW.id, 'CREATED', NEW.particular, NEW.client_name, NEW.assigned_to_id, NEW.assigned_to_name,
            jsonb_build_object('status', jsonb_build_object('to', NEW.status)), NEW.created_by_id, NEW.created_by_name);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_history (task_id, action, particular, client_name, assigned_to_id, assigned_to_name, changes)
    VALUES (OLD.id, 'DELETED', OLD.particular, OLD.client_name, OLD.assigned_to_id, OLD.assigned_to_name,
            jsonb_build_object('status', jsonb_build_object('from', OLD.status)));
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status)); END IF;
  IF NEW.assigned_to_name IS DISTINCT FROM OLD.assigned_to_name OR NEW.assigned_to_id IS DISTINCT FROM OLD.assigned_to_id THEN
    v_changes := v_changes || jsonb_build_object('assigned to', jsonb_build_object('from', OLD.assigned_to_name, 'to', NEW.assigned_to_name));
  END IF;
  IF NEW.client_name IS DISTINCT FROM OLD.client_name THEN v_changes := v_changes || jsonb_build_object('client', jsonb_build_object('from', OLD.client_name, 'to', NEW.client_name)); END IF;
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN v_changes := v_changes || jsonb_build_object('deadline', jsonb_build_object('from', OLD.deadline, 'to', NEW.deadline)); END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('from', OLD.priority, 'to', NEW.priority)); END IF;
  IF NEW.particular IS DISTINCT FROM OLD.particular THEN v_changes := v_changes || jsonb_build_object('task', jsonb_build_object('from', OLD.particular, 'to', NEW.particular)); END IF;
  IF NEW.remarks IS DISTINCT FROM OLD.remarks THEN v_changes := v_changes || jsonb_build_object('remark', jsonb_build_object('from', OLD.remarks, 'to', NEW.remarks)); END IF;
  IF NEW.manager_comment IS DISTINCT FROM OLD.manager_comment THEN v_changes := v_changes || jsonb_build_object('manager comment', jsonb_build_object('from', OLD.manager_comment, 'to', NEW.manager_comment)); END IF;

  IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;

  -- the app stamps who made the change together with a new last_updated; without that stamp the person is unknown
  IF NEW.last_updated IS DISTINCT FROM OLD.last_updated THEN
    v_by_id := NEW.last_updated_by_id;
    v_by_name := NEW.last_updated_by_name;
  END IF;

  INSERT INTO public.task_history (task_id, action, particular, client_name, assigned_to_id, assigned_to_name, changes, changed_by_id, changed_by_name)
  VALUES (NEW.id, 'UPDATED', NEW.particular, NEW.client_name, NEW.assigned_to_id, NEW.assigned_to_name, v_changes, v_by_id, v_by_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_history_trg ON public.tasks;
CREATE TRIGGER task_history_trg
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public._task_history_log();

-- Admin only. p_user_id: only tasks of that person (NULL = everyone). p_only_status: only status changes. Newest first.
CREATE OR REPLACE FUNCTION public.app_task_history_get(p_session TEXT, p_user_id TEXT DEFAULT NULL, p_only_status BOOLEAN DEFAULT FALSE, p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT u.* INTO v_user
  FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
  WHERE s.token_hash = encode(digest(COALESCE(p_session, ''), 'sha256'), 'hex')
    AND s.expires_at > NOW() AND u.status = 'ACTIVE';
  IF NOT FOUND OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(t) ORDER BY t.changed_at DESC)
    FROM (
      SELECT h.id, h.task_id AS "taskId", h.action, h.particular, h.client_name AS "clientName",
             h.assigned_to_id AS "assignedToId", h.assigned_to_name AS "assignedToName",
             h.changes, h.changed_by_name AS "changedByName", h.changed_at
      FROM public.task_history h
      WHERE (p_user_id IS NULL OR h.assigned_to_id = p_user_id)
        AND (NOT COALESCE(p_only_status, FALSE) OR h.changes ? 'status')
      ORDER BY h.changed_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000)
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.app_task_history_get(TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_task_history_get(TEXT, TEXT, BOOLEAN, INT) TO anon, authenticated;
