-- ============================================================================
-- FIRM COSTING: add 5 recurring clients for September 2026 from the Invoices tab.
-- Run in Supabase Dashboard -> SQL Editor, AFTER supabase_firm_costing.sql and supabase_firm_costing_v2.sql.
-- Run STEP 1 first (select it and Run), check the numbers, then run STEP 2.
--
-- Invoice value = sum of that client's September 2026 invoice amounts (includes VAT and tax).
-- VAT = sum of VDS, tax = sum of TDS; when an invoice has neither, 15% VAT and 7.5% tax are worked out.
-- Invoices whose "For month" is a range (e.g. July-September) are not included.
-- Existing budgets are kept; re-running only refreshes the invoice figures.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: preview (changes nothing). Every client should have a client_id and at least one invoice.
-- ---------------------------------------------------------------------------
WITH targets(wanted) AS (
  VALUES ('Aswad Composite Mills Limited'),
         ('Volumezero Limited'),
         ('Spacezero Limited'),
         ('Walton Hi-Tech Industries PLC'),
         ('Fakhruddin Textile Mills Limited(FTML)')
),
norm AS (
  SELECT wanted, lower(regexp_replace(regexp_replace(wanted, '\([^)]*\)', '', 'g'), '[^a-zA-Z0-9]', '', 'g')) AS k FROM targets
),
cl AS (
  SELECT c.id, c.name, c.job_number,
         lower(regexp_replace(regexp_replace(c.name, '\([^)]*\)', '', 'g'), '[^a-zA-Z0-9]', '', 'g')) AS k
  FROM public.clients c
),
inv AS (
  SELECT i.*, lower(regexp_replace(regexp_replace(i.client, '\([^)]*\)', '', 'g'), '[^a-zA-Z0-9]', '', 'g')) AS k
  FROM public.invoices i
  WHERE i.year = 2026 AND lower(btrim(i.for_month)) = 'september'
)
SELECT n.wanted,
       cl.id AS client_id,
       cl.name AS client_name,
       count(inv.id) AS invoices,
       COALESCE(sum(inv.amount), 0) AS invoice_value,
       COALESCE(sum(inv.vds), 0) AS vat_vds,
       COALESCE(sum(inv.tds), 0) AS tax_tds
FROM norm n
LEFT JOIN cl ON cl.k = n.k
LEFT JOIN inv ON inv.k = n.k OR (COALESCE(cl.job_number, '') <> '' AND inv.job_number = cl.job_number)
GROUP BY n.wanted, cl.id, cl.name
ORDER BY n.wanted;

-- ---------------------------------------------------------------------------
-- STEP 2: save them as Recurring clients for 2026-09 (returns the saved rows)
-- ---------------------------------------------------------------------------
WITH targets(wanted) AS (
  VALUES ('Aswad Composite Mills Limited'),
         ('Volumezero Limited'),
         ('Spacezero Limited'),
         ('Walton Hi-Tech Industries PLC'),
         ('Fakhruddin Textile Mills Limited(FTML)')
),
norm AS (
  SELECT wanted, lower(regexp_replace(regexp_replace(wanted, '\([^)]*\)', '', 'g'), '[^a-zA-Z0-9]', '', 'g')) AS k FROM targets
),
cl AS (
  SELECT c.id, c.name, c.job_number,
         lower(regexp_replace(regexp_replace(c.name, '\([^)]*\)', '', 'g'), '[^a-zA-Z0-9]', '', 'g')) AS k
  FROM public.clients c
),
inv AS (
  SELECT i.*, lower(regexp_replace(regexp_replace(i.client, '\([^)]*\)', '', 'g'), '[^a-zA-Z0-9]', '', 'g')) AS k
  FROM public.invoices i
  WHERE i.year = 2026 AND lower(btrim(i.for_month)) = 'september'
),
tot AS (
  SELECT cl.id AS client_id, cl.name AS client_name,
         COALESCE(sum(inv.amount), 0) AS value,
         COALESCE(sum(inv.vds), 0) AS vds,
         COALESCE(sum(inv.tds), 0) AS tds
  FROM norm n
  JOIN cl ON cl.k = n.k
  LEFT JOIN inv ON inv.k = n.k OR (COALESCE(cl.job_number, '') <> '' AND inv.job_number = cl.job_number)
  GROUP BY cl.id, cl.name
)
INSERT INTO public.firm_costing (month, client_id, client_name, engagement, invoice_value, vat, tax)
SELECT '2026-09', client_id, client_name, 'RECURRING',
       value,
       CASE WHEN vds > 0 THEN vds ELSE round(value / 1.15 * 0.15) END,
       CASE WHEN tds > 0 THEN tds ELSE round(value / 1.15 * 0.075) END
FROM tot
WHERE value > 0
ON CONFLICT (month, client_id, line) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  engagement = 'RECURRING',
  invoice_value = EXCLUDED.invoice_value,
  vat = EXCLUDED.vat,
  tax = EXCLUDED.tax,
  updated_at = now()
RETURNING month, client_name, engagement, invoice_value, vat, tax;
