-- ============================================================================
-- PROPOSAL ATTACHMENTS (files live in Google Drive; this only keeps the list)
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_proposals.sql.
-- ============================================================================

-- Where the Drive bridge (Google Apps Script) lives. Only Admin can change it.
CREATE TABLE IF NOT EXISTS public.proposal_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE public.proposal_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_settings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.proposal_attachments (
  id TEXT PRIMARY KEY DEFAULT ('a' || replace(gen_random_uuid()::text, '-', '')),
  proposal_id TEXT NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  drive_file_id TEXT NOT NULL,
  client_folder TEXT,
  uploaded_by TEXT,
  uploaded_by_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proposal_attachments_proposal ON public.proposal_attachments (proposal_id);
ALTER TABLE public.proposal_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposal_attachments FROM anon, authenticated;

-- Used by the Drive bridge to check a login: may this person use the tracker (and, if asked, are they Admin)?
CREATE OR REPLACE FUNCTION public.app_proposal_file_auth(p_session TEXT, p_need_admin BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN FALSE; END IF;
  IF p_need_admin AND v_user.role <> 'ADMIN' THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

-- Drive bridge link: anyone with access can read it, only Admin can set it
CREATE OR REPLACE FUNCTION public.app_proposal_settings_get(p_session TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._proposal_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT value FROM public.proposal_settings WHERE key = 'drive_url'), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.app_proposal_settings_set(p_session TEXT, p_drive_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_url TEXT := btrim(COALESCE(p_drive_url, ''));
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF v_url <> '' AND v_url !~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$' THEN RETURN 'INVALID_INPUT'; END IF;
  INSERT INTO public.proposal_settings (key, value) VALUES ('drive_url', v_url)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN 'OK';
END;
$$;

-- All attachments (the screen groups them by proposal)
CREATE OR REPLACE FUNCTION public.app_proposal_attachment_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._proposal_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'proposalId', proposal_id, 'fileName', file_name, 'mimeType', COALESCE(mime_type, ''),
      'size', COALESCE(size_bytes, 0), 'driveFileId', drive_file_id, 'uploadedBy', COALESCE(uploaded_by_name, ''),
      'uploadedAt', uploaded_at) ORDER BY uploaded_at)
    FROM public.proposal_attachments
  ), '[]'::jsonb);
END;
$$;

-- Record a file that was uploaded to Drive. Returns OK | NO_ACCESS | INVALID_INPUT
CREATE OR REPLACE FUNCTION public.app_proposal_attachment_add(
  p_session TEXT, p_proposal_id TEXT, p_file_name TEXT, p_mime TEXT, p_size BIGINT, p_drive_file_id TEXT, p_client_folder TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF COALESCE(btrim(p_file_name), '') = '' OR COALESCE(btrim(p_drive_file_id), '') = ''
     OR NOT EXISTS (SELECT 1 FROM public.proposals WHERE id = p_proposal_id) THEN
    RETURN 'INVALID_INPUT';
  END IF;
  INSERT INTO public.proposal_attachments (proposal_id, file_name, mime_type, size_bytes, drive_file_id, client_folder, uploaded_by, uploaded_by_name)
  VALUES (p_proposal_id, btrim(p_file_name), p_mime, p_size, btrim(p_drive_file_id), p_client_folder, v_user.id, v_user.name);
  RETURN 'OK';
END;
$$;

-- Remove the record (Admin only). The screen removes the file from Drive first.
CREATE OR REPLACE FUNCTION public.app_proposal_attachment_delete(p_session TEXT, p_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._proposal_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  DELETE FROM public.proposal_attachments WHERE id = p_id;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_proposal_file_auth(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_settings_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_settings_set(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_attachment_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_attachment_add(TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_proposal_attachment_delete(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_proposal_file_auth(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_settings_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_settings_set(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_attachment_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_attachment_add(TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_proposal_attachment_delete(TEXT, TEXT) TO anon, authenticated;
