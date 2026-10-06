-- ============================================================================
-- INVOICES: delete ALL invoice rows (to re-import a CSV from scratch).
-- Run in Supabase SQL Editor. This cannot be undone.
-- It also removes the uploaded-file records (invoice_attachments) for those invoices
-- (the files themselves stay in Google Drive). Tab access and the Drive link are kept.
-- ============================================================================

-- 1. Check what will be deleted first:
SELECT count(*) AS invoices, (SELECT count(*) FROM public.invoice_attachments) AS attachments FROM public.invoices;

-- 2. Delete (attachments go with their invoices):
DELETE FROM public.invoices;

-- Only to delete the rows added by the CSV import and keep invoices typed in by hand, use this instead:
-- DELETE FROM public.invoices WHERE created_at >= '2026-10-04' AND created_by = '<admin user id>';
