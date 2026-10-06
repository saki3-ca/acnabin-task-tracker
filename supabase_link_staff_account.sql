-- ============================================================================
-- Fix: "Your account is not linked to the staff sheet yet" when a new user saves My Profile.
-- Cause: at signup the sheet record is linked only if the email in the sheet matches the email
-- the user signed up with (or the sheet email is blank). If they differ the record stays unlinked.
-- Run in Supabase SQL Editor. Replace 'EMP-ID-HERE' with the user's employee ID.
-- ============================================================================

-- 1. Look first: the sheet record and the account must be the same person.
SELECT s.emp_id, s.name AS sheet_name, s.email AS sheet_email, s.linked_user_id,
       u.id AS user_id, u.name AS account_name, u.email AS account_email
FROM public.staff_records s
LEFT JOIN public.users u ON upper(u.emp_id) = s.emp_id
WHERE s.emp_id = upper('EMP-ID-HERE');

-- 2. If it is the right person, link it:
UPDATE public.staff_records s
SET linked_user_id = u.id
FROM public.users u
WHERE s.emp_id = upper('EMP-ID-HERE')
  AND upper(u.emp_id) = s.emp_id
  AND s.linked_user_id IS NULL;

-- To find every unlinked account at once:
-- SELECT s.emp_id, s.name, s.email AS sheet_email, u.email AS account_email
-- FROM public.staff_records s JOIN public.users u ON upper(u.emp_id) = s.emp_id
-- WHERE s.linked_user_id IS NULL;
