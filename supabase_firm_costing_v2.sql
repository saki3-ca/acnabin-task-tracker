-- ============================================================================
-- FIRM COSTING v2: several invoice lines per client per month, with an optional note
-- (invoice number). Run once in Supabase Dashboard -> SQL Editor, AFTER supabase_firm_costing.sql.
-- Existing rows stay as they are (each becomes line 1).
-- ============================================================================

ALTER TABLE public.firm_costing ADD COLUMN IF NOT EXISTS line INT NOT NULL DEFAULT 1;
ALTER TABLE public.firm_costing ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

ALTER TABLE public.firm_costing DROP CONSTRAINT IF EXISTS firm_costing_pkey;
ALTER TABLE public.firm_costing ADD PRIMARY KEY (month, client_id, line);

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
      'note', note,
      'engagement', engagement,
      'invoiceValue', invoice_value,
      'vat', vat,
      'tax', tax,
      'budget', budget
    ) ORDER BY month, client_name, line)
    FROM public.firm_costing
  ), '[]'::jsonb);
END;
$$;

-- replaces one month with the given lines (a client may appear several times); returns OK / NO_ACCESS / INVALID_INPUT
CREATE OR REPLACE FUNCTION public.app_firm_costing_save_month(p_session TEXT, p_month TEXT, p_rows JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  v_user := public._firm_costing_caller(p_session);
  IF v_user.id IS NULL THEN RETURN 'NO_ACCESS'; END IF;
  IF p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' OR jsonb_typeof(COALESCE(p_rows, 'null'::jsonb)) <> 'array' THEN
    RETURN 'INVALID_INPUT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_rows) e
    WHERE COALESCE(btrim(e->>'clientId'), '') = '' OR COALESCE(btrim(e->>'clientName'), '') = ''
  ) THEN
    RETURN 'INVALID_INPUT';
  END IF;

  DELETE FROM public.firm_costing WHERE month = p_month;
  INSERT INTO public.firm_costing (month, client_id, line, client_name, note, engagement, invoice_value, vat, tax, budget, updated_by)
  SELECT
    p_month,
    btrim(e.r->>'clientId'),
    row_number() OVER (PARTITION BY btrim(e.r->>'clientId') ORDER BY e.ord)::INT,
    btrim(e.r->>'clientName'),
    left(COALESCE(btrim(e.r->>'note'), ''), 200),
    CASE WHEN e.r->>'engagement' = 'ONE_TIME' THEN 'ONE_TIME' ELSE 'RECURRING' END,
    GREATEST(COALESCE((e.r->>'invoiceValue')::NUMERIC, 0), 0),
    GREATEST(COALESCE((e.r->>'vat')::NUMERIC, 0), 0),
    GREATEST(COALESCE((e.r->>'tax')::NUMERIC, 0), 0),
    GREATEST(COALESCE((e.r->>'budget')::NUMERIC, 0), 0),
    v_user.id
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS e(r, ord);
  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION public.app_firm_costing_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_firm_costing_save_month(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_firm_costing_list(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_firm_costing_save_month(TEXT, TEXT, JSONB) TO anon, authenticated;
