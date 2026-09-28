# ACNABIN Task Tracker — Complete Technical Handoff Document

---

## 1. SUMMARY

The **ACNABIN Task Tracker** is a specialized web application built for the chartered accountancy firm **ACNABIN** to manage client engagements, audit deliverables, and task allocations across a defined corporate hierarchy. It is used by articled students, audit in-charges, supervisors, managers, directors, partners, and system administrators. 

The core workflow begins with administrators or directors registering client engagements and assigning staff to them. Team members manage their daily audit deliverables, logging status transitions (`Pending` $\rightarrow$ `In Progress` $\rightarrow$ `Completed`) and progress remarks, while supervisors and managers conduct reviews, insert supervisory feedback comments, or delegate tasks downward. Team members can also request task approvals upward to superiors or sideways to peers, triggering automated notifications and 12:00 AM/12:00 PM deadline alerts.

---

## 2. TECH STACK & SETUP

### Languages, Frameworks & Libraries
* **Language & Core Runtime:** TypeScript `~6.0.2`, JavaScript (ES Module)
* **Frontend Library:** React `^19.2.8`, React DOM `^19.2.8`
* **Build Tool & Dev Server:** Vite `^8.2.2`, `@vitejs/plugin-react` `^6.1.0`
* **Icons:** `lucide-react` `^1.40.0`
* **Database Client:** `@supabase/supabase-js` `^2.115.0`
* **Linter:** `oxlint` `^1.79.0`
* **Types:** `@types/node` `^24.13.3`, `@types/react` `^19.2.18`, `@types/react-dom` `^19.2.4`

### Backend, Database & Storage Architecture
1. **Primary Database (Cloud):** Supabase (PostgreSQL 15+)
   * Tables: `users`, `clients`, `tasks`, `manager_client_access`, `manager_student_access`, `notifications`, `task_requests`.
   * Public Row Level Security (RLS) policies enabled (`FOR ALL USING (true) WITH CHECK (true)`).
2. **Local Fallback Storage:** `LocalStorage` with in-memory fallback store (`LocalFallbackStore`) seeded with `INITIAL_USERS`, `INITIAL_CLIENTS`, `INITIAL_TASKS`, `INITIAL_MANAGER_CLIENTS`, and `INITIAL_MANAGER_STUDENTS` if Supabase connection fails.
3. **Legacy / Reference Backend:** Google Apps Script (`apps-script/Code.js`) designed for Google Sheets as a database (migrated to Supabase).

### How to Run, Build & Deploy
* **Install dependencies:**
  ```bash
  npm install
  ```
* **Run local development server:**
  ```bash
  npm run dev
  ```
* **Typecheck and build production bundle:**
  ```bash
  npm run build
  ```
* **Lint codebase:**
  ```bash
  npm run lint
  ```
* **Deploy:** The output directory `dist/` can be deployed directly to Vercel, Netlify, Cloudflare Pages, or GitHub Pages as a Single Page Application (SPA).

### Environment Variables & Configuration
The client reads environment variables via Vite (`import.meta.env`) with fallback defaults configured in `src/lib/supabase.ts`:
* `VITE_SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`): Supabase project endpoint.
* `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`): Supabase anonymous public API key.

---

## 3. FILE STRUCTURE

```
Project 101/
├── .env                                       # Local environment variable definitions
├── .gitignore                                 # Git ignored folders (node_modules, dist, etc.)
├── .oxlintrc.json                             # Oxlint configuration for React and TypeScript
├── clean_duplicate_notifications.sql          # SQL cleanup script to purge duplicate notifications
├── index.html                                 # Single-page HTML entry point and font loaders
├── package.json                               # NPM project manifest, scripts, and dependencies
├── package-lock.json                          # Exact dependency lockfile
├── README.md                                  # Vite template readme
├── sheets_dump.json                           # Snapshot of original data migrated from Google Sheets
├── supabase_schema_and_seed.sql               # Complete SQL schema, RLS policies, and seed data
├── tsconfig.json                              # TypeScript root config
├── tsconfig.app.json                          # TypeScript app bundle compiler configuration
├── tsconfig.node.json                         # TypeScript Vite node configuration
├── vite.config.ts                             # Vite build and plugin configuration
├── apps-script/
│   └── Code.js                                # Google Apps Script backend code (legacy/reference)
├── public/
│   ├── acnabin-logo.png                       # Official ACNABIN firm logo
│   ├── bakertilly-logo.png                    # Baker Tilly network partner logo
│   ├── favicon.ico / favicon.svg              # Browser favicons
│   ├── apple-touch-icon.png                   # Apple touch icon
│   └── icons.svg                              # SVG sprite definitions
└── src/
    ├── App.tsx                                # Root application component, tab routing, modal containers
    ├── main.tsx                               # React DOM entry point mount to root DOM node
    ├── assets/                                # Static images (hero, react, vite SVGs)
    ├── context/
    │   ├── AuthContext.tsx                    # Authentication state, session sync, client/user lists
    │   ├── NotificationContext.tsx            # Real-time notifications, 30s polling, task request counts
    │   └── TaskContext.tsx                    # Task CRUD, team filtering, statistics calculation, toasts
    ├── lib/
    │   ├── constants.ts                       # Designations list, roles, priorities, statuses, brand tokens
    │   ├── dateUtils.ts                       # Date formatting (UK), overdue calculations, deadline math
    │   ├── permissions.ts                     # Hierarchy rank rules, assignment permissions, HRM formatting
    │   └── supabase.ts                        # Supabase client instantiation with fallback URLs
    ├── services/
    │   ├── adminService.ts                    # User updates, manager access matrix queries and caching
    │   ├── api.ts                             # Central Supabase / LocalStorage dispatcher (1,370 lines)
    │   ├── authService.ts                     # Login, registration, session validation, demo switching
    │   ├── clientService.ts                   # Client listing, addition, updates, in-memory/LS caching
    │   ├── mockData.ts                        # Fallback initial data seed for users, clients, tasks
    │   ├── notificationService.ts             # Notification fetching, read status updates
    │   ├── taskRequestService.ts              # Task request creation, querying, accept/decline resolution
    │   └── taskService.ts                     # Task CRUD and manager commenting service wrappers
    ├── styles/
    │   └── index.css                          # Custom CSS design system, colors, tables, badges, responsive
    ├── types/
    │   └── index.ts                           # TypeScript interface definitions for User, Task, Client, etc.
    └── components/
        ├── admin/
        │   └── AdminPanel.tsx                 # Client & student access matrices, user role & client assignment
        ├── auth/
        │   ├── ForgotPasswordModal.tsx        # Password reset dialog
        │   ├── LoginForm.tsx                  # ID/initial/email login with password validation
        │   └── SignupForm.tsx                 # Registration with auto-formatting and client autocomplete
        ├── clients/
        │   └── ClientGrid.tsx                 # Client engagements directory & admin edit/add modal
        ├── dashboard/
        │   └── StatPills.tsx                  # KPI summary metric pills (Total, Pending, In Progress, Overdue)
        ├── layout/
        │   ├── Header.tsx                     # Top header bar, user status, quick user switch, action buttons
        │   └── NavigationTabs.tsx             # Tab bar (My Tasks, Team, Requests, Notifications, Profile, Admin)
        ├── notifications/
        │   ├── NotificationBell.tsx           # Floating popover bell with unread badge and dropdown list
        │   └── NotificationsView.tsx          # Full notification view (Unread & 7-day previous read history)
        ├── profile/
        │   └── ProfileView.tsx                # Official employee profile, image compression upload, password edit
        ├── tasks/
        │   ├── CommentModal.tsx               # Manager review note input dialog
        │   ├── CompletedTasksModal.tsx        # Searchable and filterable archive for completed deliverables
        │   ├── RequestTaskModal.tsx           # Upward/lateral task request submission modal
        │   ├── TaskFilterBar.tsx              # Scoped client, team member, and status dropdown filters
        │   ├── TaskModal.tsx                  # Task creation / edit dialog with role-based client & member logic
        │   ├── TaskRequestsView.tsx           # Inbox/outbox for task request approvals (Accept / Decline)
        │   ├── TaskTable.tsx                  # Primary data table for active & urgent task deliverables
        │   └── TaskTableRow.tsx               # Individual table row with status selector, tooltips, actions
        └── ui/
            ├── InstantTooltip.tsx             # Instant hover tooltip with auto screen boundary clamping
            ├── Modal.tsx                      # Base accessible modal dialog wrapper with ESC listener
            └── Toast.tsx                      # Slide-in bottom toast alert for action feedback
```

---

## 4. DATA MODEL

### Entity Relational Schema

```
 +----------------------------------+       1:N       +------------------------------------+
 |              users               | <-------------- |               tasks                |
 +----------------------------------+                 +------------------------------------+
 | id: TEXT (PK)                    |                 | id: TEXT (PK)                      |
 | name: TEXT                       |                 | client_id: TEXT (FK -> clients.id) |
 | emp_id: TEXT (UNIQUE)            |                 | client_name: TEXT                  |
 | email: TEXT                      |                 | assigned_to_id: TEXT (FK -> users) |
 | role: Role ('USER'|'MGR'|'ADMIN')|                 | assigned_to_name: TEXT             |
 | designation: Designation         |                 | created_by_id: TEXT (FK -> users)  |
 | signup_client_id: TEXT           |                 | created_by_name: TEXT              |
 | status: 'ACTIVE' | 'INACTIVE'    |                 | particular: TEXT                   |
 | avatar_url: TEXT                 |                 | priority: 'High'|'Medium'|'Low'    |
 | created_date: TIMESTAMPTZ        |                 | assigned_date: TEXT                |
 +----------------------------------+                 | deadline: TEXT                     |
        |                      |                      | status: 'Pending'|'In Prog'|'Done' |
        | 1:N                  | 1:N                  | remarks: TEXT                      |
        v                      v                      | manager_comment: TEXT              |
 +-----------------------+  +-----------------------+ | created_date: TIMESTAMPTZ          |
 | manager_client_access |  | manager_student_access| | last_updated: TIMESTAMPTZ          |
 +-----------------------+  +-----------------------+ +------------------------------------+
 | id: UUID (PK)         |  | id: UUID (PK)         |
 | manager_user_id: TEXT |  | manager_user_id: TEXT |
 | client_id: TEXT (FK)  |  | student_user_id: TEXT |
 | status: TEXT          |  | status: TEXT          |
 +-----------------------+  +-----------------------+

 +----------------------------------+                 +------------------------------------+
 |             clients              |                 |           task_requests            |
 +----------------------------------+                 +------------------------------------+
 | id: TEXT (PK)                    |                 | id: TEXT (PK)                      |
 | name: TEXT                       |                 | requester_id: TEXT (FK -> users)   |
 | job_number: TEXT                 |                 | requester_name: TEXT               |
 | status: 'ACTIVE' | 'INACTIVE'    |                 | superior_id: TEXT (FK -> users)    |
 | created_date: TIMESTAMPTZ        |                 | superior_name: TEXT                |
 | last_updated: TIMESTAMPTZ        |                 | client_id: TEXT (FK -> clients)    |
 +----------------------------------+                 | client_name: TEXT                  |
                                                      | particular: TEXT                   |
 +----------------------------------+                 | priority: 'High'|'Medium'|'Low'    |
 |          notifications           |                 | deadline: TEXT                     |
 +----------------------------------+                 | notes: TEXT                        |
 | id: UUID / TEXT (PK)             |                 | status: 'PENDING'|'ACCEPTED'|...   |
 | user_id: TEXT (FK -> users.id)   |                 | created_at: TIMESTAMPTZ            |
 | type: NotificationType           |                 | updated_at: TIMESTAMPTZ            |
 | title: TEXT                      |                 +------------------------------------+
 | message: TEXT                    |
 | data: JSONB                      |
 | is_read: BOOLEAN                 |
 | created_at: TIMESTAMPTZ          |
 +----------------------------------+
```

### Entities & Field Specifications

#### 1. `User` (Table: `public.users`)
| Field | DB Column | TypeScript Type | Defaults / Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `string` | Primary Key (e.g. UUID or `u-<timestamp>`) | Unique internal user ID |
| `name` | `name` | `string` | `NOT NULL` | Full Name of the employee/partner |
| `empId` | `emp_id` | `string` | `UNIQUE`, `NOT NULL` | HRM formatted ID (`STD-001643`, `EMP-000230`, `AB`, `ADMIN`) |
| `email` | `email` | `string` | Optional | Registered official email address |
| `role` | `role` | `'USER' \| 'MANAGER' \| 'ADMIN'` | `'USER'` | Application permission role |
| `designation` | `designation` | `Designation` | `'Student'` | One of 11 hierarchy ranks |
| `signupClientId` | `signup_client_id` | `string` | `''` | Comma-separated client IDs assigned to user |
| `assignedClientIds`| N/A | `string[]` | Computed from `signupClientId` | Array of parsed client IDs |
| `status` | `status` | `'ACTIVE' \| 'INACTIVE'` | `'ACTIVE'` | Account activation status |
| `avatarUrl` | `avatar_url` | `string` | Optional Base64 data URL | Compressed avatar profile image |
| `createdDate` | `created_date` | `string` | `NOW()` | Registration timestamp |

#### 2. `Client` (Table: `public.clients`)
| Field | DB Column | TypeScript Type | Defaults / Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `string` | Primary Key (`CLI-001` or `c-<timestamp>`) | Unique client ID |
| `name` | `name` | `string` | `NOT NULL` | Client corporate organization name |
| `jobNumber` | `job_number` | `string` | `''` | Engagement audit job number (e.g. `C-24169`) |
| `status` | `status` | `'ACTIVE' \| 'INACTIVE'` | `'ACTIVE'` | Active engagement status |
| `createdDate` | `created_date` | `string` | `NOW()` | Creation timestamp |
| `lastUpdated` | `last_updated` | `string` | `NOW()` | Last modification timestamp |

#### 3. `Task` (Table: `public.tasks`)
| Field | DB Column | TypeScript Type | Defaults / Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `id` | `string` | Primary Key (`TSK-XXX`) | Unique task code |
| `clientId` | `client_id` | `string` | Optional | Client ID the deliverable belongs to |
| `clientName` | `client_name` | `string` | `'General'` | Client corporate name cache |
| `assignedToId` | `assigned_to_id` | `string` | `NOT NULL` | User ID of the assignee |
| `assignedToName`| `assigned_to_name`| `string` | `'Unknown'` | Name cache of the assignee |
| `createdById` | `created_by_id` | `string` | `NOT NULL` | User ID of the assigner / creator |
| `createdByName` | `created_by_name`| `string` | `'Admin'` | Name cache of the creator |
| `particular` | `particular` | `string` | `NOT NULL` | Description of audit procedure / deliverable |
| `priority` | `priority` | `'High' \| 'Medium' \| 'Low'` | `'Medium'` | Priority level |
| `assignedDate` | `assigned_date` | `string` | Current date (`YYYY-MM-DD`) | Date task was assigned |
| `deadline` | `deadline` | `string` | Optional (`YYYY-MM-DD`) | Due date |
| `status` | `status` | `'Pending' \| 'In Progress' \| 'Completed'` | `'Pending'` | Current state |
| `remarks` | `remarks` | `string` | `''` | Employee progress / issue notes |
| `managerComment`| `manager_comment`| `string` | `''` | Supervisory feedback from managers |
| `createdDate` | `created_date` | `string` | `NOW()` | Timestamp created |
| `lastUpdated` | `last_updated` | `string` | `NOW()` | Timestamp updated |

#### 4. `TaskRequest` (Table: `public.task_requests`)
| Field | DB Column | TypeScript Type | Description |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `string` (UUID) | Unique request ID |
| `requesterId` | `requester_id` | `string` | User ID of person making request |
| `requesterName` | `requester_name` | `string` | Name of requester |
| `superiorId` | `superior_id` | `string` | User ID of target recipient/superior |
| `superiorName` | `superior_name` | `string` | Name of superior |
| `clientId` | `client_id` | `string` | Client engagement ID |
| `clientName` | `client_name` | `string` | Client engagement name |
| `particular` | `particular` | `string` | Procedure description requested |
| `priority` | `priority` | `Priority` | Requested priority |
| `deadline` | `deadline` | `string` | Requested due date |
| `notes` | `notes` | `string` | Explanatory justification |
| `status` | `status` | `'PENDING' \| 'ACCEPTED' \| 'DECLINED'` | Resolution state |
| `createdAt` | `created_at` | `string` | Submission timestamp |
| `updatedAt` | `updated_at` | `string` | Decision timestamp |

#### 5. `AppNotification` (Table: `public.notifications`)
| Field | DB Column | TypeScript Type | Description |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `string` (UUID) | Unique notification ID |
| `userId` | `user_id` | `string` | Recipient user ID |
| `type` | `type` | `NotificationType` | `'TASK_ASSIGNED' \| 'DEADLINE_ALERT' \| 'MANAGER_COMMENT' \| 'TASK_REQUEST'` |
| `title` | `title` | `string` | Notification title |
| `message` | `message` | `string` | Formatted message body |
| `data` | `data` | `Record<string, any>` | Metadata (e.g. `{ taskId, slot, date, requestId }`) |
| `isRead` | `is_read` | `boolean` | Read flag |
| `createdAt` | `created_at` | `string` | Creation timestamp |

---

## 5. FEATURES

### 5.1 Authentication & Session Management
* **Description:** Users log in using their Employee/Student ID (e.g. `STD-001643`, `EMP-000230`), Partner Initials (`AB`), raw numbers (`1643`), or Email. New accounts can be registered with automated HRM standard formatting.
* **Key Files:** [LoginForm.tsx](file:///src/components/auth/LoginForm.tsx), [SignupForm.tsx](file:///src/components/auth/SignupForm.tsx), [AuthContext.tsx](file:///src/context/AuthContext.tsx), [authService.ts](file:///src/services/authService.ts), [api.ts:L270-L363](file:///src/services/api.ts#L270-L363).
* **Step-by-step Flow:**
  1. User enters ID in `LoginForm.tsx` $\rightarrow$ calls `authContext.login(empId, password)`.
  2. `authService.login()` dispatches `api.callBackend('login', { empId, password })`.
  3. `api.ts` normalizes ID, pad-formats digits to 6 numbers, queries Supabase table `users` with case-insensitive `ilike` or partner initials matching.
  4. User object saved to `localStorage` under `acnabin_current_user`.
  5. `AuthContext` updates `currentUser`, pre-warms client permissions via `adminService.prefetchManagerClientIds()`, and sets `activeTab = 'own'`.

### 5.2 Personal Task Management ("My Tasks")
* **Description:** Shows all active deliverables assigned to or created by the logged-in user. Includes a dedicated section for "⚠️ Near Deadline & Overdue Tasks" (tasks due within $\le 3$ days or past due).
* **Key Files:** [App.tsx:L146-L184](file:///src/App.tsx#L146-L184), [TaskTable.tsx](file:///src/components/tasks/TaskTable.tsx), [TaskTableRow.tsx](file:///src/components/tasks/TaskTableRow.tsx), [TaskModal.tsx](file:///src/components/tasks/TaskModal.tsx).
* **Step-by-step Flow:**
  1. User clicks "+ Add Task" $\rightarrow$ opens `TaskModal.tsx` in `'own'` mode.
  2. Form submits `createTask({ clientId, particular, priority, deadline, status, remarks })`.
  3. `api.ts` inserts into `tasks` table with `assigned_to_id = currentUser.id`.
  4. Task list refreshed, toast displayed, and dashboard KPI stat pills recalculated.

### 5.3 Team Engagement Tasks & Scoped Delegation
* **Description:** Supervisors, Managers, and Partners view and assign tasks to subordinate team members. Filterable by client, team member, and status.
* **Key Files:** [TaskFilterBar.tsx](file:///src/components/tasks/TaskFilterBar.tsx), [TaskModal.tsx](file:///src/components/tasks/TaskModal.tsx), [permissions.ts:L199-L235](file:///src/lib/permissions.ts#L199-L235).
* **Hierarchy & Scoping Rules:**
  * **Assistant Director & Above:** Can assign tasks firm-wide to any subordinate across any client, including bulk assignment (`ALL_MEMBERS`).
  * **In-Charge to Manager:** Can ONLY assign tasks to subordinates who are assigned to the selected client.
  * **Students:** Cannot access the Team Tasks tab (`canViewTeamTasks` returns `false`).
* **Step-by-step Flow:**
  1. Manager selects Client and clicks "+ Assign Task".
  2. Selects subordinate or "Assign to ALL Below Members".
  3. On submit, `createTask` or `createTasksBulk` writes to Supabase and inserts a `TASK_ASSIGNED` notification for each recipient.

### 5.4 Two-Way Review & Manager Comments
* **Description:** Team members provide progress notes in `remarks`. Managers/Supervisors review and add feedback via `managerComment`.
* **Key Files:** [CommentModal.tsx](file:///src/components/tasks/CommentModal.tsx), [TaskTableRow.tsx](file:///src/components/tasks/TaskTableRow.tsx), [api.ts:L637-L667](file:///src/services/api.ts#L637-L667).
* **Permissions:** Users cannot add manager comments on their own tasks (they edit directly). Reviewers add comments which triggers a `MANAGER_COMMENT` notification to the assignee.

### 5.5 Task Request & Approval Engine
* **Description:** Articled students and team members can submit formal task requests upward to leadership or sideways to peers.
* **Key Files:** [RequestTaskModal.tsx](file:///src/components/tasks/RequestTaskModal.tsx), [TaskRequestsView.tsx](file:///src/components/tasks/TaskRequestsView.tsx), [taskRequestService.ts](file:///src/services/taskRequestService.ts), [api.ts:L786-L924](file:///src/services/api.ts#L786-L924).
* **Flow:**
  1. Student creates task request selecting eligible peer or superior (ranks 15–50).
  2. Record created in `task_requests` with status `PENDING`. Superior receives `TASK_REQUEST` notification.
  3. Superior opens `TaskRequestsView` $\rightarrow$ clicks **Accept** or **Decline**.
  4. If Accepted: automatically creates a live `Task` assigned to the superior with remarks noting requester, updates request status to `ACCEPTED`, and notifies requester.

### 5.6 Automated Deadline Alerts & Notifications
* **Description:** Automatically checks deadlines upon notification fetch and runs periodic 30-second polling.
* **Notification Triggers:**
  * `TASK_ASSIGNED`: Sent immediately when a task is created for another user.
  * `DEADLINE_ALERT` (Midnight slot `00:00`): Triggered when task deadline equals today.
  * `DEADLINE_ALERT` (Noon reminder `12:00`): Triggered when hour $\ge 12$ and task deadline equals today.
  * `DEADLINE_ALERT` (Overdue): Triggered daily for incomplete tasks past deadline.
  * `MANAGER_COMMENT`: Sent when a manager adds review notes.
  * `TASK_REQUEST`: Sent upon request submission, acceptance, or decline.
* **Deduplication:** `safeInsertNotification` and in-memory key deduplication prevent redundant alerts.

### 5.7 Completed Tasks Archive
* **Description:** Completed deliverables are removed from active tables to prevent clutter and archived in a dedicated modal accessible by clicking the **COMPLETED** stat pill or profile button. Includes full search, client filtering, reopening (`In Progress`), and permanent deletion.
* **Key Files:** [CompletedTasksModal.tsx](file:///src/components/tasks/CompletedTasksModal.tsx), [App.tsx:L263-L272](file:///src/App.tsx#L263-L272).

### 5.8 Profile Management & Client Matrix
* **Description:** Employees view assigned engagements, active task counts, upload compressed avatars (HTML5 Canvas $\le 250\text{px}$, under 30KB), and change passwords.
* **Key Files:** [ProfileView.tsx](file:///src/components/profile/ProfileView.tsx), [adminService.ts](file:///src/services/adminService.ts).

### 5.9 Admin Control Panel
* **Description:** Administrators manage user designations, access roles (`USER`, `MANAGER`, `ADMIN`), activation states, manager-client permissions, and manager-student assignments.
* **Key Files:** [AdminPanel.tsx](file:///src/components/admin/AdminPanel.tsx), [adminService.ts](file:///src/services/adminService.ts).

---

## 6. FUNCTIONS & API REFERENCE

### `src/services/api.ts` Dispatcher
All service calls invoke `api.callBackend(action, payload)` which attempts `dispatchSupabase(action, payload)` with automatic fallback to `dispatchFallback(action, payload)`.

| Action Name | Input Payload | Output | Side Effects / Database Tables Modified | Invoked By |
| :--- | :--- | :--- | :--- | :--- |
| `login` | `{ empId, password }` | `{ user: User, token: string }` | Updates `localStorage('acnabin_current_user')` | `authService.login` |
| `register` | `{ name, empId, email, designation, clientId, ... }` | `{ user: User, token: string }` | Inserts row into `users` table | `authService.register` |
| `getCurrentUser` | None | `User \| null` | Refreshes user from `users` table | `authService.getCurrentUser` |
| `logout` | None | `{ success: true }` | Clears `localStorage` | `authService.logout` |
| `getMyTasks` | `{ userId?: string }` | `Task[]` | Selects from `tasks` where assigned to or created by user | `taskService.getMyTasks` |
| `getTeamTasks` | `{ userId?: string, filters: TaskFilter }` | `Task[]` | Selects team tasks filtered by client access rules | `taskService.getTeamTasks` |
| `createTask` | `Partial<Task>` | `Task` | Inserts into `tasks`; inserts notification if assigned to another user | `taskService.createTask` |
| `updateTask` | `{ taskId: string, updates: Partial<Task> }` | `Task` | Updates `tasks`; notifies assignee if manager comment added | `taskService.updateTask` |
| `deleteTask` | `{ taskId: string }` | `{ success: true }` | Deletes row from `tasks` table | `taskService.deleteTask` |
| `addManagerComment`| `{ taskId: string, comment: string }` | `Task` | Updates `manager_comment` in `tasks`; inserts notification | `taskService.addManagerComment` |
| `getNotifications` | `{ userId: string }` | `AppNotification[]` | Evaluates task deadlines, inserts alerts, returns last 7 days | `notificationService.getNotifications` |
| `markNotificationRead`| `{ notificationId: string }` | `{ success: true }` | Updates `is_read = true` in `notifications` | `notificationService.markAsRead` |
| `markAllNotificationsRead`| `{ userId: string }` | `{ success: true }` | Updates all user notifications to `is_read = true` | `notificationService.markAllAsRead` |
| `createTaskRequest`| `{ requesterId, superiorId, clientId, ... }`| `TaskRequest` | Inserts into `task_requests`; inserts notification to superior | `taskRequestService.createTaskRequest`|
| `getTaskRequests` | `{ userId: string }` | `TaskRequest[]` | Selects where user is requester or superior | `taskRequestService.getTaskRequests` |
| `respondTaskRequest`| `{ requestId: string, status: 'ACCEPTED'\|'DECLINED' }` | `{ success: true }` | Updates `task_requests`; if accepted, inserts new `tasks` row; notifies requester | `taskRequestService.respondTaskRequest`|
| `getAllClients` | None | `Client[]` | Selects all from `clients` ordered by name | `clientService.getAllClients` |
| `addClient` | `{ name: string, jobNumber?: string }` | `Client` | Inserts into `clients` | `clientService.addClient` |
| `updateClient` | `{ clientId: string, name?, jobNumber?, status? }` | `Client` | Updates `clients` | `clientService.updateClient` |
| `getAllUsers` | None | `User[]` | Selects all from `users` ordered by name | `adminService.getAllUsers` |
| `updateUser` | `{ userId: string, updates: Partial<User> }` | `User` | Updates `users` & syncs `manager_client_access` | `adminService.updateUser` |
| `getManagerClients`| `{ managerUserId: string }` | `ManagerAccessItem[]` | Combines `clients` and `manager_client_access` | `adminService.getManagerClients` |
| `saveManagerClients`| `{ managerUserId: string, clientIds: string[] }` | `{ success: true }` | Replaces rows in `manager_client_access` & updates user | `adminService.saveManagerClients` |
| `getManagerStudents`| `{ managerUserId: string }` | `ManagerStudentItem[]` | Combines student users and `manager_student_access` | `adminService.getManagerStudents` |
| `saveManagerStudents`| `{ managerUserId: string, studentIds: string[] }` | `{ success: true }` | Replaces rows in `manager_student_access` | `adminService.saveManagerStudents` |

---

## 7. USER INTERFACE (UI)

### Visual Style System & Tokens
* **Corporate Theme Palette:**
  * Primary Maroon: `--maroon: #8B1420`, `--maroon-dark: #6E0F19`, `--maroon-light: #F9E8EA`
  * Secondary Teal: `--teal: #1D8C8C`, `--teal-dark: #156E6E`, `--teal-light: #E6F5F5`
  * Corporate Navy: `--navy: #1B2A6B`, `--navy-dark: #121D4D`, `--navy-light: #EBEFFE`
  * Warm Backgrounds: `--cream: #EDE7DE`, `--cream-card: #FAF7F2`, `--cream-input: #FFFFFF`
  * Typography Ink: `--ink: #221F1D`, `--ink-soft: #5A544E`, `--ink-muted: #877E75`
* **Typography:** `'Inter', system-ui, -apple-system, sans-serif`.
* **Styling Technology:** Pure Vanilla CSS with modular design tokens, CSS Grid, and Flexbox layouts.

### Screen & View Breakdown

| View / Modal | Component | Description & Key Elements |
| :--- | :--- | :--- |
| **Login Screen** | `LoginForm.tsx` | ACNABIN brand badge, ID/Initial input, password input, "Forgot password" modal link, signup toggle. |
| **Sign Up Screen** | `SignupForm.tsx` | Full name, ID with HRM auto-formatting, designation autocomplete dropdown, client autocomplete tags. |
| **Top Header** | `Header.tsx` | Official ACNABIN logo, masthead title & current formatted date, user profile info, quick user switcher (Admin), action buttons. |
| **Navigation Tabs** | `NavigationTabs.tsx` | Navigation between `My Tasks`, `Team Tasks`, `Task Requests` (with pending badge), `Notifications` (with unread badge), `My Profile`, and `Admin Panel`. |
| **My Tasks Tab** | `App.tsx` $\rightarrow$ `TaskTable.tsx` | Maroon KPI Stat Pills, Primary Active Tasks table, and dynamic Near Deadline & Overdue urgency table. |
| **Team Tasks Tab** | `TaskFilterBar.tsx` + `TaskTable.tsx` | Teal KPI Stat Pills, Scoped Client filter, Team Member filter, Status filter, Team Engagement task table. |
| **Task Requests Tab**| `TaskRequestsView.tsx` | Request KPI Pills, Incoming Requests table with Accept/Decline actions, and Outgoing Submitted Requests table. |
| **Notifications Tab**| `NotificationsView.tsx` | Unread notifications table (Red banner) with "Mark all read" button and Previous 7-Day history table (Teal banner). |
| **Profile View** | `ProfileView.tsx` | Identity summary, compressed image avatar upload, quick KPI metrics, assigned client engagement table, and password change modal. |
| **Admin Panel** | `AdminPanel.tsx` | Manager client access matrix, manager student supervisory matrix, user designation/role editor, multi-client assignment modal. |
| **Task Modal** | `TaskModal.tsx` | Client selector, Assignee dropdown (with bulk assign for AD+), Particulars textarea, Priority, Deadline, Remarks, Manager Comments. |
| **Comment Modal** | `CommentModal.tsx` | Particulars display, employee remarks box, and manager review input textarea. |
| **Completed Tasks** | `CompletedTasksModal.tsx` | Archive modal with search box, client filter, status reopen dropdown, and task deletion. |

---

## 8. STATE MANAGEMENT & BUSINESS LOGIC

### State Architecture
* **`AuthContext`:** Manages `currentUser`, `allUsers`, `allClients`, and pre-warms client caches.
* **`TaskContext`:** Manages `myTasks`, `teamTasks`, `teamFilters`, `myStats`, `teamStats`, and `toast` messages.
* **`NotificationContext`:** Manages `notifications`, `unreadCount`, `taskRequests`, `pendingRequestsCount`, and runs a 30-second interval poll.

### Hierarchy Ranking Matrix
Defined in `src/lib/permissions.ts`:
$$\text{Admin (100)} > \text{Partner (90)} > \text{Director (80)} > \text{Deputy Director (70)} > \text{Assistant Director (60)} > \text{Manager (50)} > \text{Deputy Manager (40)} > \text{Senior Assistant Manager (30)} > \text{Supervisor (20)} > \text{In Charge (15)} > \text{Student (10)}$$

### HRM ID Formatting Logic (`formatHrmId`)
* **Partners:** 2-letter Initials (e.g. `AB`, `MR`).
* **Admin:** `ADMIN`.
* **Senior Assistant Manager & Above:** `EMP-` followed by 6 zero-padded digits (e.g. `EMP-000230`).
* **Below SAM (Students, In-Charge, Supervisors):** `STD-` followed by 6 zero-padded digits (e.g. `STD-001643`).

---

## 9. AUTHENTICATION & ROLES

### User Roles
1. **`ADMIN`:** Full firm-wide control. Can edit all tasks, change user roles/designations, configure access matrices, add clients, and switch active users via the header dropdown.
2. **`MANAGER` / Management Designations (In-Charge through Partner):** Can view Team Tasks, assign tasks to subordinates, conduct supervisory reviews, and manage assigned client deliverables.
3. **`USER` (Students / Trainees):** Access restricted to own tasks, task requests, notifications, and profile. Cannot view the Team Tasks tab or assign tasks directly.

---

## 10. INTEGRATIONS

* **Supabase API:** Cloud PostgreSQL database for real-time CRUD and storage.
* **HTML5 Canvas:** In-browser client-side image compression for avatars.
* **Google Apps Script (Legacy / Optional):** `apps-script/Code.js` contains a complete JSON REST handler (`doPost`) for Google Sheets synchronization.

---

## 11. KNOWN ISSUES, GAPS & TECHNICAL OBSERVATIONS

1. **Supabase Anonymous RLS:** The database schema enables Row Level Security with public read/write access policies (`USING (true)`). In production, Supabase Auth tokens should be wired to native RLS policies (`auth.uid()`).
2. **Password Hashing:** Passwords are verified via client/API lookup without bcrypt hashing on the fallback local store.
3. **Client-Side Notification Generation:** Midnight and Noon deadline alerts are generated during `getNotifications` query dispatch. A scheduled Supabase Edge Function or cron trigger could execute this asynchronously.
4. **Offline Local Storage Limits:** While `LocalFallbackStore` provides resilience if Supabase is unreachable, localStorage has a browser limit of ~5MB.

---

## 12. KEY CODE EXCERPTS

### A. Core Permission & Hierarchy Logic (`src/lib/permissions.ts`)
```typescript
export const DESIGNATION_RANKS: Record<string, number> = {
  'Admin': 100,
  'Partner': 90,
  'Director': 80,
  'Deputy Director': 70,
  'Assistant Director': 60,
  'Manager': 50,
  'Deputy Manager': 40,
  'Senior Assistant Manager': 30,
  'Supervisor': 20,
  'In Charge': 15,
  'Student': 10
};

export function getAssignableUsers(
  currentUser: User | null,
  allUsers: User[],
  selectedClientId: string
): User[] {
  if (!currentUser || !canAssignTasks(currentUser)) return [];
  const currentRank = getUserRank(currentUser);

  const subordinates = allUsers.filter(
    u => u.id !== currentUser.id &&
         u.role !== 'ADMIN' &&
         u.designation !== 'Admin' &&
         getUserRank(u) < currentRank
  );

  if (!selectedClientId || selectedClientId === 'ALL_CLIENTS' || selectedClientId === 'ALL') {
    if (isAssistantDirectorOrAbove(currentUser.designation) || currentUser.role === 'ADMIN') {
      return subordinates;
    }
    return subordinates.filter(u => isAssistantDirectorOrAbove(u.designation));
  }

  return subordinates.filter(u => {
    if (isAssistantDirectorOrAbove(u.designation)) return true;
    const userClients = getUserAssignedClientIds(u);
    return userClients.includes(selectedClientId);
  });
}
```

### B. Supabase Initialization (`src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL ||
  'https://sjqcoxosfuvsrqoglqxn.supabase.co';

const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_YFlLmEIMXg6uVFSXi3mYaw_e_cFxP4a';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### C. Task Model Definition (`src/types/index.ts`)
```typescript
export interface Task {
  id: string;
  clientId: string;
  clientName?: string;
  assignedToId: string;
  assignedToName?: string;
  createdById: string;
  createdByName?: string;
  particular: string;
  priority: Priority;
  assignedDate?: string;
  deadline?: string;
  status: TaskStatus;
  remarks?: string;
  managerComment?: string;
  createdDate?: string;
  lastUpdated?: string;
}
```

### D. Main App Navigation & Tab Router (`src/App.tsx`)
```typescript
{/* Pane 1: My Tasks */}
{activeTab === 'own' && (
  <div className="tab-pane">
    <StatPills stats={myStats} variant="maroon" onPillClick={pill => {
      if (pill === 'COMPLETED') {
        setCompletedModalScope('own');
        setIsCompletedModalOpen(true);
      }
    }} />
    <TaskTable title="MY TASKS" bannerColor="teal" tasks={activeMyTasks} isLoading={tasksLoading} onEditTask={handleEditTask} onOpenComment={handleOpenComment} />
    {urgentTasks.length > 0 && (
      <TaskTable title="⚠️ NEAR DEADLINE & OVERDUE TASKS" bannerColor="maroon" tasks={urgentTasks} isLoading={tasksLoading} onEditTask={handleEditTask} onOpenComment={handleOpenComment} />
    )}
  </div>
)}

{/* Pane 2: Team Tasks */}
{activeTab === 'team' && (
  <div className="tab-pane">
    <StatPills stats={teamStats} variant="teal" onPillClick={pill => {
      if (pill === 'COMPLETED') {
        setCompletedModalScope('team');
        setIsCompletedModalOpen(true);
      }
    }} />
    <TaskFilterBar onOpenAssignModal={() => handleOpenAddTask('team')} />
    <TaskTable title="TEAM ENGAGEMENT TASKS" bannerColor="maroon" tasks={activeTeamTasks} showTeamColumns={true} isLoading={tasksLoading} onEditTask={handleEditTask} onOpenComment={handleOpenComment} />
  </div>
)}
```
