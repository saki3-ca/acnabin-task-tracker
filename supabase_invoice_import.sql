-- ============================================================================
-- INVOICES: import old invoices from a CSV (Admin only).
-- Run once in Supabase Dashboard -> SQL Editor (after supabase_invoices.sql and v2).
-- Never creates duplicates: an invoice number that already exists is skipped.
-- p_dry_run = TRUE only reports. Returns {status, total, added, skipped, errors, rows[]}
-- ============================================================================
CREATE OR REPLACE FUNCTION public.app_invoice_import(p_session TEXT, p_rows JSONB, p_dry_run BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_row JSONB;
  v_no TEXT; v_client TEXT;
  v_out JSONB := '[]'::jsonb;
  n_add INT := 0; n_skip INT := 0; n_err INT := 0;
  v_seen TEXT[] := ARRAY[]::TEXT[]; v_key TEXT;
  v_seq INT := 0;
BEGIN
  v_user := public._invoice_caller(p_session);
  IF v_user.id IS NULL THEN RETURN jsonb_build_object('status', 'NO_ACCESS'); END IF;
  IF v_user.role <> 'ADMIN' THEN RETURN jsonb_build_object('status', 'FORBIDDEN'); END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 OR jsonb_array_length(p_rows) > 1000 THEN
    RETURN jsonb_build_object('status', 'INVALID_INPUT');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_seq := v_seq + 1;
    v_no := btrim(COALESCE(v_row->>'invoiceNo', ''));
    v_client := btrim(COALESCE(v_row->>'client', ''));
    IF v_no = '' OR v_client = '' THEN
      n_err := n_err + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('invoiceNo', v_no, 'client', v_client, 'result', 'ERROR', 'error', 'Invoice number and client are required'));
      CONTINUE;
    END IF;

    v_key := lower(v_no);
    IF v_key = ANY (v_seen) OR EXISTS (SELECT 1 FROM public.invoices WHERE lower(btrim(invoice_no)) = v_key) THEN
      v_seen := array_append(v_seen, v_key);
      n_skip := n_skip + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('invoiceNo', v_no, 'client', v_client, 'result', 'DUPLICATE'));
      CONTINUE;
    END IF;
    v_seen := array_append(v_seen, v_key);

    BEGIN
      -- A sub-transaction: a bad row is reported and the others still go in. A dry run rolls the insert back.
      INSERT INTO public.invoices (id, for_month, year, invoice_date, client, jic_name, job_number, purpose, invoice_no, submission_no, amount, tds, vds, client_submitted, client_submit_date, signed_submitted, mail_date, collected, collection_date, collection_method, payment_ref, vds_collected, vds_date, vds_challan_link, vds_challan_no, tds_collected, tds_date, tds_challan_link, tds_challan_no, remarks, erp_note, created_by)
      VALUES (
        'i' || (extract(epoch FROM clock_timestamp()) * 1000000)::BIGINT::TEXT || '-' || v_seq::TEXT,
        NULLIF(btrim(COALESCE(v_row->>'forMonth', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'year', '')), '')::INT,
        NULLIF(btrim(COALESCE(v_row->>'invoiceDate', '')), '')::DATE,
        v_client,
        NULLIF(btrim(COALESCE(v_row->>'jicName', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'jobNumber', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'purpose', '')), ''),
        v_no,
        NULLIF(btrim(COALESCE(v_row->>'submissionNo', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'amount', '')), '')::NUMERIC,
        NULLIF(btrim(COALESCE(v_row->>'tds', '')), '')::NUMERIC,
        NULLIF(btrim(COALESCE(v_row->>'vds', '')), '')::NUMERIC,
        (CASE WHEN btrim(COALESCE(v_row->>'clientSubmitted', '')) IN ('Yes','No') THEN btrim(v_row->>'clientSubmitted') ELSE NULL END),
        NULLIF(btrim(COALESCE(v_row->>'clientSubmitDate', '')), '')::DATE,
        (CASE WHEN btrim(COALESCE(v_row->>'signedSubmitted', '')) IN ('Yes','No') THEN btrim(v_row->>'signedSubmitted') ELSE NULL END),
        NULLIF(btrim(COALESCE(v_row->>'mailDate', '')), '')::DATE,
        (CASE WHEN btrim(COALESCE(v_row->>'collected', '')) IN ('Yes','No') THEN btrim(v_row->>'collected') ELSE NULL END),
        NULLIF(btrim(COALESCE(v_row->>'collectionDate', '')), '')::DATE,
        NULLIF(btrim(COALESCE(v_row->>'collectionMethod', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'paymentRef', '')), ''),
        (CASE WHEN btrim(COALESCE(v_row->>'vdsCollected', '')) IN ('Yes','No') THEN btrim(v_row->>'vdsCollected') ELSE NULL END),
        NULLIF(btrim(COALESCE(v_row->>'vdsDate', '')), '')::DATE,
        NULLIF(btrim(COALESCE(v_row->>'vdsChallanLink', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'vdsChallanNo', '')), ''),
        (CASE WHEN btrim(COALESCE(v_row->>'tdsCollected', '')) IN ('Yes','No') THEN btrim(v_row->>'tdsCollected') ELSE NULL END),
        NULLIF(btrim(COALESCE(v_row->>'tdsDate', '')), '')::DATE,
        NULLIF(btrim(COALESCE(v_row->>'tdsChallanLink', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'tdsChallanNo', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'remarks', '')), ''),
        NULLIF(btrim(COALESCE(v_row->>'erpNote', '')), ''),
        v_user.id);
      IF p_dry_run THEN
        DELETE FROM public.invoices WHERE lower(btrim(invoice_no)) = v_key;
      END IF;
      n_add := n_add + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('invoiceNo', v_no, 'client', v_client, 'result', 'NEW'));
    EXCEPTION WHEN others THEN
      n_err := n_err + 1;
      v_out := v_out || jsonb_build_array(jsonb_build_object('invoiceNo', v_no, 'client', v_client, 'result', 'ERROR', 'error', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object('status', 'OK', 'dryRun', p_dry_run, 'total', n_add + n_skip + n_err,
    'added', n_add, 'skipped', n_skip, 'errors', n_err, 'rows', v_out);
END;
$$;

REVOKE ALL ON FUNCTION public.app_invoice_import(TEXT, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_invoice_import(TEXT, JSONB, BOOLEAN) TO anon, authenticated;
