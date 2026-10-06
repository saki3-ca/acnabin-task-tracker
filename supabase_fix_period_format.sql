-- ============================================================================
-- Make every articleship period look the same: "09 Jun 2023 to 08 Jun 2027".
-- Uses the saved start and end dates, so no information is lost.
-- Run in Supabase SQL Editor. Safe to run more than once.
-- ============================================================================

-- 1. Look first (how it will change)
SELECT emp_id, articleship_period AS now,
       to_char(articleship_start, 'DD Mon YYYY') || ' to ' || to_char(articleship_end, 'DD Mon YYYY') AS will_be
FROM public.staff_records
WHERE articleship_start IS NOT NULL AND articleship_end IS NOT NULL
  AND articleship_period IS DISTINCT FROM (to_char(articleship_start, 'DD Mon YYYY') || ' to ' || to_char(articleship_end, 'DD Mon YYYY'))
ORDER BY emp_id;

-- 2. Change them
UPDATE public.staff_records
SET articleship_period = to_char(articleship_start, 'DD Mon YYYY') || ' to ' || to_char(articleship_end, 'DD Mon YYYY'),
    updated_at = NOW()
WHERE articleship_start IS NOT NULL AND articleship_end IS NOT NULL
  AND articleship_period IS DISTINCT FROM (to_char(articleship_start, 'DD Mon YYYY') || ' to ' || to_char(articleship_end, 'DD Mon YYYY'));

-- 3. Rows that still have a period text but no dates (the text could not be read): fix these by hand
SELECT emp_id, articleship_period FROM public.staff_records
WHERE COALESCE(articleship_period, '') <> '' AND (articleship_start IS NULL OR articleship_end IS NULL);
