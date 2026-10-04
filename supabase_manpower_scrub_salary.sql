-- ============================================================================
-- Keep salary figures OUT of the publicly readable `manpower` table.
-- The real figures live in `manpower_salary` (locked, read only through checked functions).
-- Run in Supabase SQL Editor, in order. Safe to run more than once.
-- ============================================================================

-- 0. LOOK FIRST: how many rows in the public table hold figures?
SELECT count(*) AS rows_with_figures FROM public.manpower WHERE salary > 0 OR conveyance > 0;

-- 1. Make sure none of those figures are lost: copy into the locked table
--    (an existing locked-table value is never overwritten).
INSERT INTO public.manpower_salary (emp_id, salary, conveyance)
SELECT upper(btrim(emp_id)), COALESCE(salary, 0), COALESCE(conveyance, 0)
FROM public.manpower
WHERE COALESCE(salary, 0) > 0 OR COALESCE(conveyance, 0) > 0
ON CONFLICT (emp_id) DO NOTHING;

-- 2. Blank the figures in the public table
UPDATE public.manpower SET salary = 0, conveyance = 0, total = 0
WHERE COALESCE(salary, 0) <> 0 OR COALESCE(conveyance, 0) <> 0 OR COALESCE(total, 0) <> 0;

-- 3. Keep it blank: the app's edit screen still writes salary into this table,
--    so a trigger forces the figures back to 0 on every insert or update.
CREATE OR REPLACE FUNCTION public.manpower_no_public_salary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.salary := 0;
  NEW.conveyance := 0;
  NEW.total := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manpower_no_public_salary ON public.manpower;
CREATE TRIGGER manpower_no_public_salary
  BEFORE INSERT OR UPDATE ON public.manpower
  FOR EACH ROW EXECUTE FUNCTION public.manpower_no_public_salary();

-- 4. CHECK: should now return 0
SELECT count(*) AS rows_with_figures FROM public.manpower WHERE salary > 0 OR conveyance > 0;
