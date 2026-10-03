-- ============================================================================
-- INVOICES tab
--  * Only Admin + people the Admin picks (Admin Panel -> Tab Access) can use it.
--  * Everyone with access can add and edit; only Admin can delete.
--  * The same invoice number can never be saved twice.
--  * The same submission number is allowed, but the app asks "are you sure?" first.
-- Run once in Supabase Dashboard -> SQL Editor (in 3 parts, in order).
-- ============================================================================

-- PART 1: tables
CREATE TABLE IF NOT EXISTS public.invoice_access (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.invoice_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_access FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  for_month TEXT,
  year INT,
  invoice_date DATE,
  client TEXT NOT NULL,
  jic_name TEXT,
  job_number TEXT,
  purpose TEXT,
  invoice_no TEXT NOT NULL,
  submission_no TEXT,
  amount NUMERIC,
  tds NUMERIC,
  vds NUMERIC,
  signed_submitted TEXT,
  mail_date DATE,
  collected TEXT,
  collection_date DATE,
  collection_method TEXT,
  payment_ref TEXT,
  vds_collected TEXT,
  vds_date DATE,
  vds_challan_link TEXT,
  vds_challan_no TEXT,
  tds_collected TEXT,
  tds_date DATE,
  tds_challan_link TEXT,
  tds_challan_no TEXT,
  remarks TEXT,
  erp_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM anon, authenticated;

-- The invoice number can never repeat (ignoring capitals and extra spaces)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_no_duplicate_number
  ON public.invoices (lower(btrim(invoice_no)));

-- PART 2: who may use it, list, save, delete
CREATE OR REPLACE FUNCTION public._invoice_caller(p_session TEXT)
RETURNS public.users
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
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_user.role = 'ADMIN' OR EXISTS (SELECT 1 FROM public.invoice_access a WHERE a.user_id = v_user.id) THEN
    RETURN v_user;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._invoice_caller(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_invoice_has_access(p_session TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN (SELECT (c).id IS NOT NULL FROM (SELECT public._invoice_caller(p_session) AS c) x);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._invoice_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id,
      'forMonth', COALESCE(for_month::text, ''),
      'year', COALESCE(year::text, ''),
      'invoiceDate', COALESCE(invoice_date::text, ''),
      'client', COALESCE(client::text, ''),
      'jicName', COALESCE(jic_name::text, ''),
      'jobNumber', COALESCE(job_number::text, ''),
      'purpose', COALESCE(purpose::text, ''),
      'invoiceNo', COALESCE(invoice_no::text, ''),
      'submissionNo', COALESCE(submission_no::text, ''),
      'amount', COALESCE(amount::text, ''),
      'tds', COALESCE(tds::text, ''),
      'vds', COALESCE(vds::text, ''),
      'signedSubmitted', COALESCE(signed_submitted::text, ''),
      'mailDate', COALESCE(mail_date::text, ''),
      'collected', COALESCE(collected::text, ''),
      'collectionDate', COALESCE(collection_date::text, ''),
      'collectionMethod', COALESCE(collection_method::text, ''),
      'paymentRef', COALESCE(payment_ref::text, ''),
      'vdsCollected', COALESCE(vds_collected::text, ''),
      'vdsDate', COALESCE(vds_date::text, ''),
      'vdsChallanLink', COALESCE(vds_challan_link::text, ''),
      'vdsChallanNo', COALESCE(vds_challan_no::text, ''),
      'tdsCollected', COALESCE(tds_collected::text, ''),
      'tdsDate', COALESCE(tds_date::text, ''),
      'tdsChallanLink', COALESCE(tds_challan_link::text, ''),
      'tdsChallanNo', COALESCE(tds_challan_no::text, ''),
      'remarks', COALESCE(remarks::text, ''),
      'erpNote', COALESCE(erp_note::text, ''),
      'createdAt', created_at) ORDER BY invoice_date DESC NULLS LAST, created_at DESC)
    FROM public.invoices
  ), '[]'::jsonb);
END;
$$;

-- Add or edit one invoice. Returns OK | DUPLICATE | SUBMISSION_DUP | NO_ACCESS | INVALID_INPUT
-- SUBMISSION_DUP: another invoice has the same submission number; send p_force = TRUE to save anyway.
CREATE OR REPLACE FUNCTION public.app_invoice_save(p_session TEXT, p_fields JSONB, p_force BOOLEAN DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_id TEXT;
  v_no TEXT; v_client TEXT; v_sub TEXT;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object' THEN RETURN 'INVALID_INPUT'; END IF;

  v_no := btrim(COALESCE(p_fields->>'invoiceNo', ''));
  v_client := btrim(COALESCE(p_fields->>'client', ''));
  v_sub := NULLIF(btrim(COALESCE(p_fields->>'submissionNo', '')), '');
  IF v_no = '' OR v_client = '' THEN RETURN 'INVALID_INPUT'; END IF;
  v_id := NULLIF(btrim(COALESCE(p_fields->>'id', '')), '');

  IF EXISTS (SELECT 1 FROM public.invoices WHERE lower(btrim(invoice_no)) = lower(v_no) AND id IS DISTINCT FROM v_id) THEN
    RETURN 'DUPLICATE';
  END IF;
  IF v_sub IS NOT NULL AND NOT COALESCE(p_force, FALSE)
     AND EXISTS (SELECT 1 FROM public.invoices WHERE lower(btrim(submission_no)) = lower(v_sub) AND id IS DISTINCT FROM v_id) THEN
    RETURN 'SUBMISSION_DUP';
  END IF;

  IF v_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.invoices WHERE id = v_id) THEN
    UPDATE public.invoices SET
      for_month = NULLIF(btrim(COALESCE(p_fields->>'forMonth', '')), ''),
      year = NULLIF(btrim(COALESCE(p_fields->>'year', '')), '')::INT,
      invoice_date = NULLIF(btrim(COALESCE(p_fields->>'invoiceDate', '')), '')::DATE,
      client = NULLIF(btrim(COALESCE(p_fields->>'client', '')), ''),
      jic_name = NULLIF(btrim(COALESCE(p_fields->>'jicName', '')), ''),
      job_number = NULLIF(btrim(COALESCE(p_fields->>'jobNumber', '')), ''),
      purpose = NULLIF(btrim(COALESCE(p_fields->>'purpose', '')), ''),
      invoice_no = NULLIF(btrim(COALESCE(p_fields->>'invoiceNo', '')), ''),
      submission_no = NULLIF(btrim(COALESCE(p_fields->>'submissionNo', '')), ''),
      amount = NULLIF(btrim(COALESCE(p_fields->>'amount', '')), '')::NUMERIC,
      tds = NULLIF(btrim(COALESCE(p_fields->>'tds', '')), '')::NUMERIC,
      vds = NULLIF(btrim(COALESCE(p_fields->>'vds', '')), '')::NUMERIC,
      signed_submitted = (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'signedSubmitted', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'signedSubmitted', '')), '') ELSE NULL END),
      mail_date = NULLIF(btrim(COALESCE(p_fields->>'mailDate', '')), '')::DATE,
      collected = (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'collected', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'collected', '')), '') ELSE NULL END),
      collection_date = NULLIF(btrim(COALESCE(p_fields->>'collectionDate', '')), '')::DATE,
      collection_method = NULLIF(btrim(COALESCE(p_fields->>'collectionMethod', '')), ''),
      payment_ref = NULLIF(btrim(COALESCE(p_fields->>'paymentRef', '')), ''),
      vds_collected = (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'vdsCollected', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'vdsCollected', '')), '') ELSE NULL END),
      vds_date = NULLIF(btrim(COALESCE(p_fields->>'vdsDate', '')), '')::DATE,
      vds_challan_link = NULLIF(btrim(COALESCE(p_fields->>'vdsChallanLink', '')), ''),
      vds_challan_no = NULLIF(btrim(COALESCE(p_fields->>'vdsChallanNo', '')), ''),
      tds_collected = (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'tdsCollected', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'tdsCollected', '')), '') ELSE NULL END),
      tds_date = NULLIF(btrim(COALESCE(p_fields->>'tdsDate', '')), '')::DATE,
      tds_challan_link = NULLIF(btrim(COALESCE(p_fields->>'tdsChallanLink', '')), ''),
      tds_challan_no = NULLIF(btrim(COALESCE(p_fields->>'tdsChallanNo', '')), ''),
      remarks = NULLIF(btrim(COALESCE(p_fields->>'remarks', '')), ''),
      erp_note = NULLIF(btrim(COALESCE(p_fields->>'erpNote', '')), ''),
      updated_at = NOW()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.invoices (id, for_month, year, invoice_date, client, jic_name, job_number, purpose, invoice_no, submission_no, amount, tds, vds, signed_submitted, mail_date, collected, collection_date, collection_method, payment_ref, vds_collected, vds_date, vds_challan_link, vds_challan_no, tds_collected, tds_date, tds_challan_link, tds_challan_no, remarks, erp_note, created_by)
    VALUES (
      COALESCE(v_id, 'i' || (extract(epoch FROM clock_timestamp()) * 1000)::BIGINT::TEXT),
      NULLIF(btrim(COALESCE(p_fields->>'forMonth', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'year', '')), '')::INT,
      NULLIF(btrim(COALESCE(p_fields->>'invoiceDate', '')), '')::DATE,
      NULLIF(btrim(COALESCE(p_fields->>'client', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'jicName', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'jobNumber', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'purpose', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'invoiceNo', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'submissionNo', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'amount', '')), '')::NUMERIC,
      NULLIF(btrim(COALESCE(p_fields->>'tds', '')), '')::NUMERIC,
      NULLIF(btrim(COALESCE(p_fields->>'vds', '')), '')::NUMERIC,
      (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'signedSubmitted', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'signedSubmitted', '')), '') ELSE NULL END),
      NULLIF(btrim(COALESCE(p_fields->>'mailDate', '')), '')::DATE,
      (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'collected', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'collected', '')), '') ELSE NULL END),
      NULLIF(btrim(COALESCE(p_fields->>'collectionDate', '')), '')::DATE,
      NULLIF(btrim(COALESCE(p_fields->>'collectionMethod', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'paymentRef', '')), ''),
      (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'vdsCollected', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'vdsCollected', '')), '') ELSE NULL END),
      NULLIF(btrim(COALESCE(p_fields->>'vdsDate', '')), '')::DATE,
      NULLIF(btrim(COALESCE(p_fields->>'vdsChallanLink', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'vdsChallanNo', '')), ''),
      (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'tdsCollected', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'tdsCollected', '')), '') ELSE NULL END),
      NULLIF(btrim(COALESCE(p_fields->>'tdsDate', '')), '')::DATE,
      NULLIF(btrim(COALESCE(p_fields->>'tdsChallanLink', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'tdsChallanNo', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'remarks', '')), ''),
      NULLIF(btrim(COALESCE(p_fields->>'erpNote', '')), ''),
      v_user.id);
  END IF;
  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN RETURN 'DUPLICATE';
  WHEN others THEN RETURN 'INVALID_INPUT';
END;
$$;

-- Delete: Admin only. Returns OK | FORBIDDEN | INVALID_SESSION
CREATE OR REPLACE FUNCTION public.app_invoice_delete(p_session TEXT, p_id TEXT)
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
  DELETE FROM public.invoices WHERE id = p_id;
  RETURN 'OK';
END;
$$;

-- PART 3: Admin chooses who gets the tab
CREATE OR REPLACE FUNCTION public.app_invoice_access_get(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN NULL; END IF;
  RETURN COALESCE((SELECT jsonb_agg(user_id) FROM public.invoice_access), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_invoice_access_set(p_session TEXT, p_user_ids JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL OR v_user.role <> 'ADMIN' THEN RETURN 'FORBIDDEN'; END IF;
  IF p_user_ids IS NULL OR jsonb_typeof(p_user_ids) <> 'array' THEN RETURN 'FORBIDDEN'; END IF;

  DELETE FROM public.invoice_access
  WHERE user_id NOT IN (SELECT jsonb_array_elements_text(p_user_ids));
  INSERT INTO public.invoice_access (user_id, granted_by)
  SELECT u.id, v_user.id FROM public.users u
  WHERE u.id IN (SELECT jsonb_array_elements_text(p_user_ids))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_invoice_has_access(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_save(TEXT, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_delete(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_access_get(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_invoice_access_set(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_invoice_has_access(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_save(TEXT, JSONB, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_delete(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_access_get(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_invoice_access_set(TEXT, JSONB) TO anon, authenticated;
