# Manpower tab for staff below Assistant Director

Status: **design for review. No code changed yet.**

**Scope:** only people below Assistant Director. Admin and Assistant Director and above (AD+) keep exactly what they have today.

"Below AD" here means: In Charge, Supervisor, Senior Assistant Manager, Deputy Manager, Manager. Student and Trainee still have no Manpower tab.

## 1. Two kinds of below-AD user

The existing Admin Panel → Tab Access → **Manpower** picker stays exactly as it is. There is no new card and no new table.

| | Below AD (new, automatic) | Below AD **picked by Admin** (as today) |
|---|---|---|
| Manpower tab | Yes | Yes |
| People shown | Only staff on **their assigned clients** (and themselves) | **Everyone** (unchanged) |
| Clients listed | Only their own clients | All |
| Salary, Conveyance, Total, money pills, Excel money | **Not shown** | Shown (unchanged) |
| Edit | No | Unchanged |

So Admin's existing picker is the one switch for "this person sees the whole directory with financial data". Anyone below AD who is not picked gets the new limited view, with no money.

## 2. Screen (below AD, not picked)

```
┌ MANPOWER ─────────────────────────── [Details | Summary]  [Export Excel] ┐
│ Showing staff on your clients: Client A, Client B                        │
│ [Manpower 12] [My clients 2] [Students 9] [Managers & above 3] [Details|Summary] │
├──────────────────────────────────────────────────────────────────────────┤
│ Search [________]  Client [All my clients ▾]  Designation [All ▾]        │
├────────┬──────────────┬────────────┬─────────────┬──────────┬───────────┤
│ ID     │ Name         │ Client     │ Designation │ Year     │ Contact   │
└────────┴──────────────┴────────────┴─────────────┴──────────┴───────────┘
```

- **Top pills (same 5 slots as today).** The three money pills (Total Monthly Salary, Total Conveyance, Grand Total Cost) have nothing to show without financial access, so they are **replaced by headcount pills** that keep the row the same size:

  | Slot | Picked / AD+ / Admin (today) | Below AD, not picked |
  |---|---|---|
  | 1 | Active Manpower (count) | Active Manpower (count of people they can see) |
  | 2 | Total Monthly Salary | **My Clients** (number of their clients) |
  | 3 | Total Conveyance | **Students** (Student, Trainee, In Charge, Supervisor) |
  | 4 | Grand Total Cost | **Managers & above** (Senior Assistant Manager and up) |
  | 5 | Details / Summary switch | same |

  The counts follow the Client filter, as the money pills do today.
- Summary view: Client | Headcount | Remarks (view only). The Total Salary, Total Conveyance and Total Cost columns and the grand-total row are removed (not just empty).
- No money columns, no money pills (replaced as above), no edit pencil.
- Export Excel has no money columns.

## 3. Rules

1. **Client scope** = `users.signup_client_id` plus ACTIVE `manager_client_access` rows (the set the app already uses, `getUserAssignedClientIds`).
2. A person is listed when they share at least one client with the viewer. The viewer's own row is always listed. "Unassigned" staff are not listed.
3. The Client column and the Client filter show **only the shared clients** (Q2).
4. People above the viewer on the same client (their Manager or an AD) are listed too (Q4).
5. A below-AD user who is **not** in the Manpower picker never receives salary figures.

## 4. Server-side enforcement (not just hidden in the page)

- **`app_manpower_scoped(p_session)`** (new). Checks the session. If the caller is below AD and **not** in `manpower_access`, it returns the staff list already filtered to the caller's clients, with **no money fields**. For Admin, AD+ and picked users it returns nothing, and they use today's path.
- **`app_get_manpower_salaries`**: **no change**. It already gives money only to Admin, AD+ and `manpower_access` members.
- **App code:** `ManpowerView` gets a `scopedMode` for below-AD users who are not picked. It loads from `app_manpower_scoped`, banner and my-clients filter on, money and edit off.

### One thing to check first
The `manpower` table has a public "allow all" read policy. A technically skilled below-AD user could read it directly with the public key and skip the filter. Before building I will check whether `manpower.salary / conveyance / total` still hold real figures:
- If empty, the leak is only names, contacts and client assignments. The scoped function is enough for now.
- If they hold figures, the table must be locked (`REVOKE` from the public key, like `manpower_salary`) before this goes live. That also touches the AD+ path, because it reads the table today.

## 5. Files that will change

| File | Change |
|---|---|
| `supabase_manpower_scoped.sql` (new) | `app_manpower_scoped` only |
| `src/lib/permissions.ts` | `canViewManpowerScoped(user)`: In Charge to Manager |
| `NavigationTabs.tsx` | show the tab for those users |
| `manpowerService.ts`, `api.ts` | scoped load |
| `ManpowerView.tsx` | `scopedMode`: banner, my-clients filter, hide money, no edit |

No change to `AdminPanel.tsx`, `manpowerAccessService.ts` or the access tables.

## 6. Testing
Four accounts: Admin, an AD, an In Charge **not** picked, the same In Charge **picked**. For each, confirm the **network response** (not just the screen) has the right people and no money where it should not.

## 7. Questions (recommended answer first)

- **Q2.** Person works on 3 clients, viewer shares 1. Show only the shared one, or all 3? *Only the shared one.*
- **Q4.** List people above the viewer on the same client? *Yes.*
- **Q3.** Remarks view-only for them? *Yes.*
- **Q5.** Supervisor and In Charge both included? *Assumed yes.*
