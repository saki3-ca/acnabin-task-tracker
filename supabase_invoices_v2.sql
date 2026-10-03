-- ============================================================================
-- INVOICES v2: adds "Submission Status (Client)" + its date.
-- Run once in Supabase SQL Editor if you already ran supabase_invoices.sql before.
-- (Part A = new columns, Part B = list function, Part C = save function)
-- ============================================================================

-- PART A
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_submitted TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client_submit_date DATE;

-- PART B
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
      'clientSubmitted', COALESCE(client_submitted::text, ''),
      'clientSubmitDate', COALESCE(client_submit_date::text, ''),
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

-- PART C
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
      client_submitted = (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'clientSubmitted', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'clientSubmitted', '')), '') ELSE NULL END),
      client_submit_date = NULLIF(btrim(COALESCE(p_fields->>'clientSubmitDate', '')), '')::DATE,
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
    INSERT INTO public.invoices (id, for_month, year, invoice_date, client, jic_name, job_number, purpose, invoice_no, submission_no, amount, tds, vds, client_submitted, client_submit_date, signed_submitted, mail_date, collected, collection_date, collection_method, payment_ref, vds_collected, vds_date, vds_challan_link, vds_challan_no, tds_collected, tds_date, tds_challan_link, tds_challan_no, remarks, erp_note, created_by)
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
      (CASE WHEN NULLIF(btrim(COALESCE(p_fields->>'clientSubmitted', '')), '') IN ('Yes','No') THEN NULLIF(btrim(COALESCE(p_fields->>'clientSubmitted', '')), '') ELSE NULL END),
      NULLIF(btrim(COALESCE(p_fields->>'clientSubmitDate', '')), '')::DATE,
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

