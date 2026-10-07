-- ============================================================================
-- Let the person who uploaded a file delete it (Admin still can delete any file).
-- For proposal attachments and invoice VDS/TDS challan files.
-- Run once in Supabase Dashboard -> SQL Editor (Part 1 = proposals, Part 2 = invoices).
-- ============================================================================

-- PART 1: proposals
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
      'uploadedById', COALESCE(uploaded_by, ''), 'uploadedAt', uploaded_at) ORDER BY uploaded_at)
    FROM public.proposal_attachments
  ), '[]'::jsonb);
END;
$$;

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
  IF v_user.role <> 'ADMIN'
     AND NOT EXISTS (SELECT 1 FROM public.proposal_attachments WHERE id = p_id AND uploaded_by = v_user.id) THEN
    RETURN 'FORBIDDEN';
  END IF;
  DELETE FROM public.proposal_attachments WHERE id = p_id;
  RETURN 'OK';
END;
$$;

-- Used by the Drive script before it moves a file to the bin
CREATE OR REPLACE FUNCTION public.app_proposal_file_can_delete(p_session TEXT, p_drive_file_id TEXT)
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
  IF v_user.role = 'ADMIN' THEN RETURN TRUE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.proposal_attachments WHERE drive_file_id = p_drive_file_id AND uploaded_by = v_user.id);
END;
$$;

REVOKE ALL ON FUNCTION public.app_proposal_file_can_delete(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_proposal_file_can_delete(TEXT, TEXT) TO anon, authenticated;

-- PART 2: invoices
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
      'uploadedById', COALESCE(uploaded_by, ''), 'uploadedAt', uploaded_at) ORDER BY uploaded_at)
    FROM public.invoice_attachments
  ), '[]'::jsonb);
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
  IF v_user.role <> 'ADMIN'
     AND NOT EXISTS (SELECT 1 FROM public.invoice_attachments WHERE id = p_id AND uploaded_by = v_user.id) THEN
    RETURN 'FORBIDDEN';
  END IF;
  DELETE FROM public.invoice_attachments WHERE id = p_id;
  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_file_can_delete(p_session TEXT, p_drive_file_id TEXT)
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
  IF v_user.role = 'ADMIN' THEN RETURN TRUE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.invoice_attachments WHERE drive_file_id = p_drive_file_id AND uploaded_by = v_user.id);
END;
$$;

REVOKE ALL ON FUNCTION public.app_invoice_file_can_delete(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_invoice_file_can_delete(TEXT, TEXT) TO anon, authenticated;
