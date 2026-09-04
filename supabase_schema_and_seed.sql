-- ============================================================================
-- SUPABASE SCHEMA & INITIAL SEED FROM GOOGLE SHEETS
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
  created_date TIMESTAMPTZ DEFAULT NOW()
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

-- ============================================================================
-- SEED DATA INSERTION (MIGRATED FROM GOOGLE SHEETS)
-- ============================================================================

-- SEED USERS (14 users)
INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('b2906eef-124a-4abc-a60f-c0834da25ee0', 'SAKIB', '1643', 'sakiburrahman.official@gmail.com', 'USER', 'Student', 'CLI-001', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('a010f578-fa76-4682-953f-6efba32ea9c3', 'Director', '2000', 'director@gmail.com', 'USER', 'Director', '', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('e53b4ed5-46d2-4566-a3dc-bb7e4ac39201', 'ADMIN', '9999', 'admin@gmail.com', 'ADMIN', 'Admin', '', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('0a5710d5-01ec-470d-bca3-159c165f58b6', 'Md. Hasanul Haque', '1925', 'hasanulh3@gmail.com', 'USER', 'Student', 'CLI-001', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('9839e9b1-3de8-41c6-bf80-0be6271dfb90', 'Gourab Saha', '1917', 'gourabsaha2907@gmail.com', 'USER', 'Student', 'CLI-001', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('fa19ebf9-3f52-4cf1-9a6f-10cf54bdbfc3', 'Tahfeem Adee', '1919', 'tahfeemadee110@gmail.com', 'USER', 'Student', 'CLI-009', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '2061', 'evanridika@gmail.com', 'USER', 'Supervisor', 'CLI-005', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('5d2a32e5-b2b2-41f4-87f5-7498342057c3', 'Mohiman Al Nur', '2085', 'nurmohiman008@gmail.com', 'USER', 'Student', 'CLI-009', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('9f6b268a-8803-4ed9-957c-e08b4cffd4c9', 'Manager', '8888', 'manager@gmail.com', 'USER', 'Senior Assistant Manager', '', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '2174', 'rabbi.acnabin003@gmail.com', 'USER', 'Student', 'CLI-005', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('a3e23b15-f4d6-478c-a350-e0cacf33165c', 'Asma Ul Husna', '2278', 'asmaa.acnabin@gmail.com', 'USER', 'Student', 'CLI-009', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('efd9651e-db66-4442-9191-2ef8cee00023', 'Mohtadi Al Mahmud Abir', '2274', 'mohtadimahmudabir@gmail.com', 'USER', 'Student', 'CLI-005', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', '2114', 'masudahmedmusa1234@gmail.com', 'USER', 'Student', 'CLI-005', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

INSERT INTO public.users (id, name, emp_id, email, role, designation, signup_client_id, status)
VALUES ('40ca076e-5434-4176-ac38-db95bc1c8abe', 'Abdul Kader', '2366', 'kader.acnabin@gmail.com', 'USER', 'Student', 'CLI-001', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emp_id = EXCLUDED.emp_id, email = EXCLUDED.email, role = EXCLUDED.role, designation = EXCLUDED.designation, signup_client_id = EXCLUDED.signup_client_id, status = EXCLUDED.status;

-- SEED CLIENTS (15 clients)
INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-001', 'Walton Hi-Tech Industries PLC.', 'C-24169', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-002', 'Sirajganj Economic Zone Limited', 'A-25220', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-003', 'Hohenstein Laboratories Bangladesh Limited', 'A-25143', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-004', 'Remark HB LTD.', 'C-26087', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-005', 'Spacezero Limited', 'C-21073', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-006', 'Volumezero Limited', 'C-21074', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-007', 'Fakhruddin Textile Mills Limited (FTML)', 'C-21056', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-008', 'Aswad Composite Mills Limited', 'C-24165', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-009', 'Walton Plaza', 'C-25066', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-010', 'United Mymensingh Power Limited', 'A-25142', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-011', 'United Pharma & Healthcare Limited', 'A-25154', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-012', 'Orange Solutions Limited', 'A-25166', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-013', 'Moulvi Tea Company (Pvt.) Ltd', 'A-25153', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-014', 'BGMEA', 'C-26074', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

INSERT INTO public.clients (id, name, job_number, status)
VALUES ('CLI-015', 'AH Others', 'A-26069', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, job_number = EXCLUDED.job_number, status = EXCLUDED.status;

-- SEED TASKS (27 tasks)
INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-001', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'FMS report', 'High', '2026-08-23T18:00:00.000Z', '', 'In Progress', '', '', '2026-09-03T11:04:21.451Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-002', 'CLI-017', 'General', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', 'FMS Report', 'High', '2026-08-23T18:00:00.000Z', '2026-09-02T18:00:00.000Z', 'Completed', 'Completed from my site. need to compile & review by Team Lead', '', '2026-09-03T11:15:55.220Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-003', 'CLI-017', 'General', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', 'HR Audit _ Initial Requisition', 'Medium', '2026-08-30T18:00:00.000Z', '2026-08-31T18:00:00.000Z', 'Completed', 'Completed. Reviewed by sir & instructed for set a kick-off meeting with HR.', '', '2026-09-03T11:20:38.051Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-004', 'CLI-017', 'General', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', 'HR Audit Plan', 'Medium', '2026-08-30T18:00:00.000Z', '2026-08-31T18:00:00.000Z', 'Completed', 'Completed & reviewed by sir. and sir instructed us to set a kick off meeting and after the meeting rearrange the plan based on the meeting', '', '2026-09-03T11:26:03.887Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-005', 'CLI-017', 'General', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', 'Kick-off meeting Questionnaire', 'Medium', '2026-08-31T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'In Progress', 'Completed from my site. Need to review by Team Lead & Sir', '', '2026-09-03T11:27:18.648Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-006', 'CLI-042', 'General', 'b2906eef-124a-4abc-a60f-c0834da25ee0', 'SAKIB', 'b2906eef-124a-4abc-a60f-c0834da25ee0', 'SAKIB', 'Test', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-09T18:00:00.000Z', 'Pending', '', '', '2026-09-03T11:27:33.558Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-007', 'CLI-017', 'General', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', 'Project Visit', 'High', '2026-08-31T18:00:00.000Z', '2026-09-01T18:00:00.000Z', 'Completed', 'We have visited 2 project. and also completed the reports.', '', '2026-09-03T11:28:30.331Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-008', 'CLI-018', 'General', 'efd9651e-db66-4442-9191-2ef8cee00023', 'Mohtadi Al Mahmud Abir', 'efd9651e-db66-4442-9191-2ef8cee00023', 'Mohtadi Al Mahmud Abir', 'FMS audit Report Finalization and PPT preparation', 'High', '2026-09-02T18:00:00.000Z', '2026-09-06T18:00:00.000Z', 'In Progress', '', '', '2026-09-03T11:33:11.610Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-009', 'CLI-017', 'General', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', '6eb71b9f-7262-4364-af35-0170cbc571bd', 'Rabbi Munsi', 'Vouching_ SZ & VZ _ September 2025', 'Low', '2026-09-02T18:00:00.000Z', '2026-09-09T18:00:00.000Z', 'Pending', 'I will start the task from 06 September 2026', '', '2026-09-03T11:33:36.332Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-010', 'CLI-018', 'General', 'efd9651e-db66-4442-9191-2ef8cee00023', 'Mohtadi Al Mahmud Abir', 'efd9651e-db66-4442-9191-2ef8cee00023', 'Mohtadi Al Mahmud Abir', 'HR Audit Questionnaire Finalization and Meeting with HR Team.', 'High', '2026-09-02T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'Pending', '', '', '2026-09-03T11:34:44.303Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-011', 'CLI-018', 'General', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'Observation Write-up Related Accounts/ Finance, Procurement/PMO/FMS, ERP, Project.', 'High', '2026-08-31T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'In Progress', '', '', '2026-09-03T11:45:22.943Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-012', 'CLI-018', 'General', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'Urgent Visit to the Central Store, Bashundhara', 'High', '2026-09-01T18:00:00.000Z', '2026-09-02T18:00:00.000Z', 'Completed', '', '', '2026-09-03T11:47:47.838Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-013', 'CLI-018', 'General', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'Meeting with PMO department regarding Rod utilization Audit', 'High', '2026-08-22T18:00:00.000Z', '2026-09-01T18:00:00.000Z', 'Pending', 'Decision pending upon Sir decision', '', '2026-09-03T11:49:38.087Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-014', 'CLI-018', 'General', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'Project Visit report preparation', 'High', '2026-09-01T18:00:00.000Z', '2026-09-02T18:00:00.000Z', 'Completed', '', '', '2026-09-03T11:50:51.710Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-015', 'CLI-017', 'General', '9f6b268a-8803-4ed9-957c-e08b4cffd4c9', 'Manager', '9f6b268a-8803-4ed9-957c-e08b4cffd4c9', 'Manager', 'Test', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-22T18:00:00.000Z', 'Pending', 'xyz', '', '2026-09-03T11:52:27.073Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-016', 'CLI-018', 'General', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'Transaction Audit (Month -March26 and August25)', 'High', '2026-07-02T18:00:00.000Z', '2026-08-31T18:00:00.000Z', 'Completed', '', '', '2026-09-03T11:54:34.713Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-017', 'CLI-018', 'General', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'e6b368b4-a01c-4c1b-b940-65a8b505dd09', 'Mohammad Musa', 'Work Order Review(Regular Basis)', 'High', '2026-09-03T11:57:17.263Z', '', 'In Progress', 'Continuous process', '', '2026-09-03T11:57:17.263Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-018', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'Conveyance checking', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'Pending', '', '', '2026-09-03T11:59:37.884Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-019', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'Requisition Analysis as per new office memo', 'High', '2026-09-02T18:00:00.000Z', '2026-09-09T18:00:00.000Z', 'Pending', '', '', '2026-09-03T12:01:50.754Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-020', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'September 2025 voucher review file making', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-10T18:00:00.000Z', 'Pending', '', '', '2026-09-03T12:03:57.884Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-021', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'Meeting with HR', 'High', '2026-09-02T18:00:00.000Z', '2026-09-09T18:00:00.000Z', 'Pending', '', '', '2026-09-03T12:04:47.552Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-022', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'FMS observation preparation', 'High', '2026-09-02T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'Pending', '', '', '2026-09-03T12:05:50.386Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-023', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'Exam question', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'Pending', '', '', '2026-09-03T12:07:28.596Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-024', 'CLI-017', 'General', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', '0a921a25-c7ba-470e-8cf2-fe5bb41ff616', 'Jarin Tasnim Ridika', 'Review my team''s work', 'High', '2026-09-02T18:00:00.000Z', '2026-09-05T18:00:00.000Z', 'Pending', '', '', '2026-09-03T12:08:35.772Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-025', 'CLI-001', 'Walton Hi-Tech Industries PLC.', 'a010f578-fa76-4682-953f-6efba32ea9c3', 'Director', 'a010f578-fa76-4682-953f-6efba32ea9c3', 'Director', 'Test', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-10T18:00:00.000Z', 'Pending', '', '', '2026-09-03T13:40:19.117Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-026', 'CLI-017', 'General', '9f6b268a-8803-4ed9-957c-e08b4cffd4c9', 'Manager', '9f6b268a-8803-4ed9-957c-e08b4cffd4c9', 'Manager', 'Test 2.O', 'Medium', '2026-09-02T18:00:00.000Z', '2026-09-03T18:00:00.000Z', 'Pending', '', '', '2026-09-03T13:54:18.067Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

INSERT INTO public.tasks (id, client_id, client_name, assigned_to_id, assigned_to_name, created_by_id, created_by_name, particular, priority, assigned_date, deadline, status, remarks, manager_comment, created_date)
VALUES ('TSK-027', 'CLI-001', 'Walton Hi-Tech Industries PLC.', 'a010f578-fa76-4682-953f-6efba32ea9c3', 'Director', 'a010f578-fa76-4682-953f-6efba32ea9c3', 'Director', 'Test 2', 'High', '2026-09-02T18:00:00.000Z', '2026-09-02T18:00:00.000Z', 'Pending', '', '', '2026-09-03T16:05:09.756Z')
ON CONFLICT (id) DO UPDATE SET particular = EXCLUDED.particular, status = EXCLUDED.status, priority = EXCLUDED.priority, remarks = EXCLUDED.remarks, manager_comment = EXCLUDED.manager_comment;

