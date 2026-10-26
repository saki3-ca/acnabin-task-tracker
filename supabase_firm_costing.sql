-- ============================================================================
-- FIRM COSTING: client-wise monthly invoice value, VAT, tax and budget.
-- (Cost comes from the Manpower salary table, so it is not stored here.)
-- Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_manpower_salary.sql.
--
-- Who may read and change it (checked here, in the database):
--   Admin, Assistant Director and above.
-- Saving a month replaces that month's rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.firm_costing (
  month TEXT NOT NULL,                 -- 'YYYY-MM'
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  engagement TEXT NOT NULL DEFAULT 'RECURRING' CHECK (engagement IN ('RECURRING', 'ONE_TIME')),
  invoice_value NUMERIC NOT NULL DEFAULT 0,  -- includes VAT and tax
  vat NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  budget NUMERIC NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month, client_id)
);
ALTER TABLE public.firm_costing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.firm_costing FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public._firm_costing_caller(p_session TEXT)
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
  IF v_user.role = 'ADMIN'
     OR v_user.designation IN ('Assistant Director', 'Deputy Director', 'Director', 'Partner') THEN
    RETURN v_user;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._firm_costing_caller(TEXT) FROM PUBLIC, anon, authenticated;

-- every saved row (NULL when the caller has no access)
CREATE OR REPLACE FUNCTION public.app_firm_costing_list(p_session TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (SELECT (c).id IS NULL FROM (SELECT public._firm_costing_caller(p_session) AS c) x) THEN RETURN NULL; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'month', month,
      'clientId', client_id,
      'clientName', client_name,
      'engagement', engagement,
      'invoiceValue', invoice_value,
      'vat', vat,
      'tax', tax,
      'budget', budget
    ) ORDER BY month, client_name)
    FROM public.firm_costing
  ), '[]'::jsonb);
END;
$$;

-- replaces one month with the given rows; returns OK / NO_ACCESS / INVALID_INPUT
CREATE OR REPLACE FUNCTION public.app_firm_costing_save_month(p_session TEXT, p_month TEXT, p_rows JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  r JSONB;
BEGIN
  v_user := public._firm_costing_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' OR jsonb_typeof(COALESCE(p_rows, 'null'::jsonb)) <> 'array' THEN
    RETURN 'INVALID_INPUT';
  END IF;

  DELETE FROM public.firm_costing WHERE month = p_month;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    IF COALESCE(btrim(r->>'clientId'), '') = '' OR COALESCE(btrim(r->>'clientName'), '') = '' THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
    INSERT INTO public.firm_costing (month, client_id, client_name, engagement, invoice_value, vat, tax, budget, updated_by)
    VALUES (
      p_month,
      btrim(r->>'clientId'),
      btrim(r->>'clientName'),
      CASE WHEN r->>'engagement' = 'ONE_TIME' THEN 'ONE_TIME' ELSE 'RECURRING' END,
      GREATEST(COALESCE((r->>'invoiceValue')::NUMERIC, 0), 0),
      GREATEST(COALESCE((r->>'vat')::NUMERIC, 0), 0),
      GREATEST(COALESCE((r->>'tax')::NUMERIC, 0), 0),
      GREATEST(COALESCE((r->>'budget')::NUMERIC, 0), 0),
      v_user.id
    )
    ON CONFLICT (month, client_id) DO UPDATE SET
      client_name = EXCLUDED.client_name, engagement = EXCLUDED.engagement,
      invoice_value = EXCLUDED.invoice_value, vat = EXCLUDED.vat, tax = EXCLUDED.tax,
      budget = EXCLUDED.budget, updated_by = EXCLUDED.updated_by, updated_at = now();
  END LOOP;
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_firm_costing_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_firm_costing_save_month(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_firm_costing_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_firm_costing_save_month(TEXT, TEXT, JSONB) TO anon, authenticated;
