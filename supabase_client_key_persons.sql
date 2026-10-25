-- Key Person / Secondary Key Person for each client.
-- Stores the user id of the chosen staff member; their phone and email are read
-- from the users table, so they stay up to date automatically.
-- Run once in the Supabase SQL editor.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS key_person_id text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS secondary_key_person_id text;
