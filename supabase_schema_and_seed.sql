-- ============================================================================
-- SUPABASE SCHEMA (staff, client and task data is not kept in the repo)
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emp_id TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'USER',
  designation TEXT DEFAULT 'Student',
  signup_client_id TEXT DEFAULT '',
  status TEXT DEFAULT 'ACTIVE',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  mobile TEXT
);

-- 2. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  job_number TEXT DEFAULT '',
  status TEXT DEFAULT 'ACTIVE',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  client_name TEXT DEFAULT 'General',
  assigned_to_id TEXT,
  assigned_to_name TEXT,
  created_by_id TEXT,
  created_by_name TEXT DEFAULT 'Admin',
  particular TEXT NOT NULL,
  priority TEXT DEFAULT 'Medium',
  assigned_date TEXT,
  deadline TEXT,
  status TEXT DEFAULT 'Pending',
  remarks TEXT DEFAULT '',
  manager_comment TEXT DEFAULT '',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MANAGER CLIENT ACCESS TABLE
CREATE TABLE IF NOT EXISTS public.manager_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MANAGER STUDENT ACCESS TABLE
CREATE TABLE IF NOT EXISTS public.manager_student_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id TEXT NOT NULL,
  student_user_id TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure mobile column exists on users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile TEXT;
-- Academic year entered by the user at signup (shown in Manpower; falls back to manpower.academic_year)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS academic_year TEXT;
-- Columns the Manpower edit sync writes to
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_client_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. MANPOWER TABLE
-- Note: schema only, no sensitive salary/contact data in this file.
-- TODO: This table must get proper RLS once Supabase Auth is in place.
CREATE TABLE IF NOT EXISTS public.manpower (
  emp_id TEXT PRIMARY KEY,
  name TEXT,
  client_id TEXT NULL,
  client_name TEXT,
  designation TEXT,
  academic_year TEXT,
  salary NUMERIC,
  conveyance NUMERIC,
  total NUMERIC,
  contact_number TEXT,
  email TEXT,
  education TEXT,
  remarks TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on users" ON public.users;
CREATE POLICY "Allow public full access on users" ON public.users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on clients" ON public.clients;
CREATE POLICY "Allow public full access on clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on tasks" ON public.tasks;
CREATE POLICY "Allow public full access on tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.manager_client_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on manager_client_access" ON public.manager_client_access;
CREATE POLICY "Allow public full access on manager_client_access" ON public.manager_client_access FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.manager_student_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on manager_student_access" ON public.manager_student_access;
CREATE POLICY "Allow public full access on manager_student_access" ON public.manager_student_access FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.manpower ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on manpower" ON public.manpower;
CREATE POLICY "Allow public full access on manpower" ON public.manpower FOR ALL USING (true) WITH CHECK (true);

-- 7. CLIENT MANPOWER REMARKS TABLE
CREATE TABLE IF NOT EXISTS public.client_manpower_remarks (
  client_id TEXT PRIMARY KEY,
  remarks TEXT DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_manpower_remarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access on client_manpower_remarks" ON public.client_manpower_remarks;
CREATE POLICY "Allow public full access on client_manpower_remarks" ON public.client_manpower_remarks FOR ALL USING (true) WITH CHECK (true);

