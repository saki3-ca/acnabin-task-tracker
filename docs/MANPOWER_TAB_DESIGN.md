# Manpower tab for staff below Assistant Director

Status: **design for review. No code changed yet.**

**Scope: only people below Assistant Director.** Admin and Assistant Director and above (AD+) keep exactly what they have today. Nothing about their tab, data or Excel export changes.

"Below AD" here means: In Charge, Supervisor, Senior Assistant Manager, Deputy Manager, Manager. Student and Trainee still have no Manpower tab.

## 1. What a below-AD user gets

| | Below AD (default) | Below AD + finance switch (set by Admin) |
|---|---|---|
| Manpower tab | Yes | Yes |
| People shown | Only staff on **their assigned clients** (and themselves) | same |
| Clients listed | Only their own clients | same |
| Salary, Conveyance, Total | **Not shown** | Shown, for those people only |
| Money pills / Summary money / Excel money | **Not shown** | Shown |
| Edit people or salary | No | No (Admin only, as today) |

## 2. Screen (below AD, no finance)

```
┌ MANPOWER ─────────────────────────── [Details | Summary]  [Export Excel] ┐
│ Showing staff on your clients: Client A, Client B                        │
│ [Headcount 12]   [Clients 2]                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ Search [________]  Client [All my clients ▾]  Designation [All ▾]        │
├────────┬──────────────┬────────────┬─────────────┬──────────┬───────────┤
│ ID     │ Name         │ Client     │ Designation │ Year     │ Contact   │
└────────┴──────────────┴────────────┴─────────────┴──────────┴───────────┘
```

- Summary view: Client | Headcount | Remarks (view only).
- With the finance switch on, the same screen as AD+ appears, but still limited to their clients: Salary, Conveyance, Total columns and the two money pills are added.
- No edit pencil.

## 3. Rules

1. **Client scope** = `users.signup_client_id` plus ACTIVE `manager_client_access` rows (the same set the app already uses for `getUserAssignedClientIds`).
2. A person is listed when they share at least one client with the viewer. The viewer's own row is always listed. "Unassigned" staff are not listed.
3. The Client column and the Client filter show **only the shared clients** (Q2).
4. People above the viewer on the same client (their Manager or an AD) are listed too (Q4).
5. Money is returned only to a below-AD user listed in `manpower_finance_access`, and only for the people they can see.

## 4. Admin Panel

Admin Panel → Tab Access gets one new card, using the existing `TabAccessCard` and `UserMultiPicker`:

> **Manpower: financial data**
> Assistant Director and above always see salary and conveyance. Choose anyone below Assistant Director who should see them too.
> [search dropdown, chips] [Save]

- The picker lists **only users below AD** (Admin and AD+ are not offered, they already have it).
- New table `manpower_finance_access(user_id, granted_by, granted_at)`. Its get/set functions copy `app_manpower_access_get/set`.
- The existing "Manpower access" card stays as is (it grants the whole-firm tab and money). Nobody's current access is changed.

## 5. Server-side enforcement (so it is not just hidden in the page)

Only the below-AD path is new. The AD+ path keeps calling what it calls today.

- **`app_manpower_scoped(p_session)`** (new). Checks the session. If the caller is below AD, it returns the staff list already filtered to the caller's clients, with **no money fields**. For AD+ or Admin it returns nothing (they use the existing path).
- **`app_get_manpower_salaries(p_session)`** (changed). It keeps answering as today for Admin, AD+ and `manpower_access` members. It adds one rule: a user in `manpower_finance_access` gets the salary rows **only for staff on their own clients**. Everyone else still gets zero rows.
- **App code:** `ManpowerView` gets a flag, `scopedMode`, for below-AD users: it loads from `app_manpower_scoped`, and shows money columns only if the salary function returned rows.

### One thing to check first
The `manpower` table still has a public "allow all" read policy. A below-AD user with technical skill could read the table with the public key and bypass the filter. Before building I will check whether `manpower.salary / conveyance / total` still hold real figures:
- If they are empty, the leak is only names, contacts and client assignments, and filtering by the scoped function is enough for now.
- If they hold figures, the table must be locked (`REVOKE` from the public key, as `manpower_salary` is) before this goes live. That touches the AD+ path too, because it reads the table today.

## 6. Files that will change

| File | Change |
|---|---|
| `supabase_manpower_scoped.sql` (new) | `manpower_finance_access` table, finance get/set, `app_manpower_scoped`, updated `app_get_manpower_salaries` |
| `src/lib/permissions.ts` | `canViewManpowerScoped(user)`: In Charge to Manager |
| `NavigationTabs.tsx` | show the tab for those users |
| `manpowerService.ts`, `manpowerAccessService.ts`, `api.ts` | scoped load, finance get/set |
| `ManpowerView.tsx` | `scopedMode`: banner, my-clients filter, hide money, no edit |
| `AdminPanel.tsx` | the "financial data" card |

## 7. Testing
Four accounts: Admin, an AD, an In Charge without finance, the same In Charge with finance. For each, confirm the **network response** (not just the screen) has the right people and no money where it should not.

## 8. Questions (recommended answer first)

- **Q2.** Person works on 3 clients, viewer shares 1. Show only the shared one, or all 3? *Only the shared one.*
- **Q4.** List people above the viewer on the same client? *Yes.*
- **Q3.** Remarks view-only for them? *Yes (view only).*
- **Q5.** Supervisor and In Charge both included? *Assumed yes.*
