# Manpower tab: In Charge and above, with protected financial data

Status: **design for review. No code changed yet.**

## 1. What you asked for

| Who | Manpower tab | Which people they see | Financial columns (salary, conveyance, total) |
|---|---|---|---|
| Admin | Yes | Everyone | Yes |
| Assistant Director, Deputy Director, Director, Partner (AD+) | Yes | Everyone | Yes |
| Manager, Deputy Manager, Senior Assistant Manager, Supervisor, In Charge (below AD) | **New: Yes** | **Only staff on their assigned clients** | **No**, unless Admin grants it |
| Anyone below AD that Admin picks in the Admin Panel | (same as above) | (same as above) | **Yes** (a per-user switch) |
| Student, Trainee | No | - | No |

Admin never has to be listed; Admin always sees everything.

## 2. Today (what exists)

- `canViewManpower()` allows only Admin and AD+. `NavigationTabs` also shows the tab to anyone in `manpower_access` (Admin Panel → Tab Access).
- Anyone in `manpower_access` currently gets the **whole** directory **and** the salary figures (`supabase_access_v4.sql`, part 4). The two things are not separate.
- Salary and conveyance sit in `manpower_salary`. It is readable only through `app_get_manpower_salaries()`, which checks the login session on the server. This part is already secure.
- The people list (`getManpower` in `api.ts`) is built **in the browser** from the `manpower`, `users`, `clients` and `manager_client_access` tables, using the public key.

## 3. Rules

### 3.1 Who gets the tab
`In Charge` or higher (`isInChargeOrAbove`), plus Admin, plus anyone already in `manpower_access`. Student and Trainee do not get it.

### 3.2 Which rows a user sees
- Admin and AD+: all rows (as today).
- Below AD: a row is visible if the person has **at least one client in common** with the viewer.
  - The viewer's clients = `users.signup_client_id` ∪ `manager_client_access` (ACTIVE). This is the same set the app uses everywhere (`getUserAssignedClientIds`).
  - Staff with no client ("Unassigned") are not shown to them.
  - The viewer always sees their own row.
- Clients dropdown and the Summary view list **only the viewer's clients**.

### 3.3 Financial data
- Visible to Admin and AD+ always.
- Visible to a below-AD user only if Admin switched it on for them (section 5).
- When not allowed:
  - Salary, Conveyance and Total columns are **not rendered**.
  - The top pills (Total Monthly Salary, Total Conveyance, Total Cost) are hidden. Headcount stays.
  - The Summary view shows client + headcount + remarks only.
  - "Export Excel" omits the money columns.
  - The Edit button is Admin-only for salary, as today. A below-AD user never sees the edit form's money fields.
- This is enforced on the **server**. Hiding columns in the page alone is not enough, because anyone can read network responses.

### 3.4 What a below-AD user can edit
Nothing in the directory (designation, year, clients, salary). Remarks per client stay with the people who can edit them today (Admin and AD+). Open point Q3.

## 4. Security design (server-side)

The current browser-side build of the directory cannot enforce "only your clients". The fix is one database function that does the filtering.

### 4.1 New function `app_manpower_directory(p_session)`
- Validates the session (same pattern as `_invoice_caller`).
- Works out the caller's level: `FULL` (Admin or AD+ or in `manpower_access`) or `CLIENT_SCOPED` (In Charge to Manager) or none.
- Returns the people list (empId, name, designation, academic year, client ids/names, contact, remarks) **already filtered** for the caller. No money fields.
- The app calls this instead of reading the tables directly.

### 4.2 Money stays in `app_get_manpower_salaries(p_session)`
Change its rule to: Admin, or AD+, or user in the new `manpower_finance_access` table. Everyone else gets zero rows. For scoped users who have finance access, return **only the rows of the people they can see** (they can see money only for their clients).

### 4.3 Close the public read
`manpower` has a public "allow all" policy (`supabase_schema_and_seed.sql`). If the `manpower` columns still hold salary values, anyone with the public key can read them, which would defeat all of the above. Before building:
1. Check whether `manpower.salary / conveyance / total` are zeroed or removed (the salary seed went to `manpower_salary`).
2. Move `manpower` to the same pattern as `manpower_salary`: `REVOKE` from `anon, authenticated`, access only through the functions above. The other places that read it (register-time academic-year sync in `api.ts`, the manpower edit sync) get small RPCs.

This is the biggest piece of work, and the part that makes the rule real.

## 5. Admin Panel: "who can see financial data"

Admin Panel → Tab Access gets a second card under the existing Manpower one:

> **Manpower: financial data**
> Admin and Assistant Director and above always see salary and conveyance. Choose anyone below Assistant Director who should see them too.
> [search dropdown + chips] [Save]

- Reuses the existing `TabAccessCard` and `UserMultiPicker`. The picker lists **only users below AD** (AD+ and Admin are hidden because they already have it).
- New table `manpower_finance_access(user_id, granted_by, granted_at)`, with get/set functions identical to `app_manpower_access_get/set`.
- The existing card is renamed **"Manpower tab (all clients)"**: people added there see the whole directory, not only their clients. Their money access is now decided by the new finance card.

### Migration of the current behaviour
Today `manpower_access` members see money. To avoid taking this away silently, the migration **copies all existing `manpower_access` members into `manpower_finance_access`** once. Admin can then remove anyone. (Q1)

## 6. Screen design (Manpower tab)

```
┌ MANPOWER ────────────────────────────── [Details | Summary]  [Export Excel] ┐
│ [Headcount 12]  [Clients 3]   [Total salary ৳..]  [Total conveyance ৳..]   │  ← money pills only with finance access
├───────────────────────────────────────────────────────────────────────────── ┤
│ Search [________]  Client [All my clients ▾]  Designation [All ▾]           │
├────────┬───────────────┬─────────────┬─────────────┬──────────┬──────┬─────┤
│ ID     │ Name          │ Client      │ Designation │ Year     │ Sal. │ Conv│  ← last two + Total only with finance access
└────────┴───────────────┴─────────────┴─────────────┴──────────┴──────┴─────┘
```

- **Scoped viewer** (below AD): a slim banner under the title: *"Showing staff on your clients: A, B, C"*, so it is clear why the list is shorter.
- **Details**: same table as now. Money columns appear or disappear as one group.
- **Summary** (per client): Client | Headcount | Remarks, plus Total Salary / Conveyance / Total Cost when allowed.
- Edit pencil: Admin only (unchanged).
- Mobile: same table scroll behaviour as today.

## 7. Files that will change

| Area | File | Change |
|---|---|---|
| DB | `supabase_manpower_scoped.sql` (new) | `manpower_finance_access` table; `app_manpower_directory`, `app_manpower_finance_get/set`; update `app_get_manpower_salaries`; migration copy; lock `manpower` table |
| Permissions | `src/lib/permissions.ts` | `canViewManpowerTab` (In Charge+); keep `canViewManpower` = full |
| Nav | `NavigationTabs.tsx` | show tab for In Charge+ |
| API | `api.ts`, `manpowerService.ts`, `manpowerAccessService.ts` | use the directory function; finance get/set; handle "no money" response |
| UI | `ManpowerView.tsx` | `canSeeMoney` flag hides pills, columns, summary money, export columns; scope banner |
| Admin | `AdminPanel.tsx` | second access card (below-AD users only) |
| Export | `manpowerExcel` (existing export) | omit money columns when not allowed |

## 8. Steps and testing

1. Run the check in 4.3 (read-only SQL). Decide the lock-down approach.
2. SQL file, run in Supabase.
3. Service + permissions + nav.
4. `ManpowerView` changes.
5. Admin Panel card.
6. Test with four accounts: Admin, AD, an In Charge (no finance), the same In Charge with finance switched on. Check the network responses (not only the screen) contain no money for the second case.

## 9. Questions for you

- **Q1.** Current `manpower_access` members can see money today. Copy them into the new finance list (nothing changes for them), or start with an empty finance list? *Recommended: copy.*
- **Q2.** A person works on 3 clients and the viewer shares only 1. Show the row with **all 3 clients** or **only the shared one**? *Recommended: only the shared one (they do not need to see the others).*
- **Q3.** Should In Charge to Manager be able to edit remarks for their own clients, or view only? *Recommended: view only.*
- **Q4.** Should the viewer see people **above** them on the same client (for example their Manager or AD)? *Recommended: yes, anyone on the client is listed, since the rule is "my client's team".*
- **Q5.** Do Supervisor and In Charge count as "In Charge to above"? I assumed yes: In Charge, Supervisor, SAM, Deputy Manager, Manager.
