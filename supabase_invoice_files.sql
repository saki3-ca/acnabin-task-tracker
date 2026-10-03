-- ============================================================================
-- INVOICE ATTACHMENTS (VDS / TDS challan files live in Google Drive; this only keeps the list)
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_invoices.sql.
-- ============================================================================

-- PART 1: tables
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_settings FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.invoice_attachments (
  id TEXT PRIMARY KEY DEFAULT ('a' || replace(gen_random_uuid()::text, '-', '')),
  invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('VDS', 'TDS')),
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  drive_file_id TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_by_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoice_attachments_invoice ON public.invoice_attachments (invoice_id);
ALTER TABLE public.invoice_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_attachments FROM anon, authenticated;

-- PART 2: login check for the Drive bridge + the bridge link
CREATE OR REPLACE FUNCTION public.app_invoice_file_auth(p_session TEXT, p_need_admin BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL THEN RETURN FALSE; END IF;
  IF p_need_admin AND v_user.role <> 'ADMIN' THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_settings_get(p_session TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._invoice_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT value FROM public.invoice_settings WHERE key = 'drive_url'), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_settings_set(p_session TEXT, p_drive_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_url TEXT := btrim(COALESCE(p_drive_url, ''));
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF v_url <> '' AND v_url !~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$' THEN RETURN 'INVALID_INPUT'; END IF;
  INSERT INTO public.invoice_settings (key, value) VALUES ('drive_url', v_url)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  RETURN 'OK';
END;
$$;

-- PART 3: list / add / delete the file records
CREATE OR REPLACE FUNCTION public.app_invoice_attachment_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._invoice_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'invoiceId', invoice_id, 'kind', kind, 'fileName', file_name, 'mimeType', COALESCE(mime_type, ''),
      'size', COALESCE(size_bytes, 0), 'driveFileId', drive_file_id, 'uploadedBy', COALESCE(uploaded_by_name, ''),
      'uploadedAt', uploaded_at) ORDER BY uploaded_at)
    FROM public.invoice_attachments
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_attachment_add(
  p_session TEXT, p_invoice_id TEXT, p_kind TEXT, p_file_name TEXT, p_mime TEXT, p_size BIGINT, p_drive_file_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF p_kind NOT IN ('VDS', 'TDS') OR COALESCE(btrim(p_file_name), '') = '' OR COALESCE(btrim(p_drive_file_id), '') = ''
     OR NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id) THEN
    RETURN 'INVALID_INPUT';
  END IF;
  INSERT INTO public.invoice_attachments (invoice_id, kind, file_name, mime_type, size_bytes, drive_file_id, uploaded_by, uploaded_by_name)
  VALUES (p_invoice_id, p_kind, btrim(p_file_name), p_mime, p_size, btrim(p_drive_file_id), v_user.id, v_user.name);
  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_attachment_delete(p_session TEXT, p_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'INVALID_SESSION'; END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  DELETE FROM public.invoice_attachments WHERE id = p_id;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_invoice_file_auth(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_settings_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_settings_set(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_attachment_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_attachment_add(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_attachment_delete(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_invoice_file_auth(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_settings_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_settings_set(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_attachment_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_attachment_add(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_attachment_delete(TEXT, TEXT) TO anon, authenticated;
