# Design: Key Person column — "Your Assigned Client Engagements"

Location: Profile page → `YOUR ASSIGNED CLIENT ENGAGEMENTS` table
([ProfileView.tsx:1052](../src/components/profile/ProfileView.tsx#L1052)).

## 1. Layout

New **KEY PERSON** column, placed immediately **left of ACTIVE TASKS**.

```
| SL. | Job ID    | Client / Company Name | KEY PERSON              | ACTIVE TASKS | Engagement Status | Action |
|-----|-----------|-----------------------|-------------------------|--------------|-------------------|--------|
|  1  | JOB-0012  | 🏢 ABC Industries Ltd | 👤 Mr. Rahim Uddin      |  📄 3 tasks  |   ✔ ACTIVE        | ...    |
|     |           |                       |    Mr. Karim Hossain    |              |                   |        |
|     |           |                       |    (secondary, muted)   |              |                   |        |
|  2  | JOB-0015  | 🏢 XYZ Textiles       | 👤 Ms. Nasrin Akter     |  📄 0 tasks  |   ✔ ACTIVE        | ...    |
|     |           |                       |    —                    |              |                   |        |
```

Each cell has two stacked lines:

| Line | Content | Style |
|------|---------|-------|
| 1 (top) | **Key Person** name | Teal/navy link-style text, bold, small user icon, pointer cursor |
| 2 (below) | **Secondary Key Person** name | Smaller (11.5px), muted grey, same click behaviour, prefixed with a tiny "2nd" label |

- If no key person is set: show `—`. If only a primary is set, the second line is simply omitted.
- Column width ~`200px`, left-aligned (names read better left-aligned than centred).

## 2. Click behaviour — contact popover

Clicking a name opens a small popover anchored under that name (click again, click outside, or `Esc` closes it). Only one popover open at a time.

```
┌──────────────────────────────┐
│ 👤 Mr. Rahim Uddin           │
│    Key Person                │
│ ──────────────────────────── │
│ 📞 +880 1711-000000   [copy] │  ← tel: link
│ ✉  rahim@abc.com      [copy] │  ← mailto: link
└──────────────────────────────┘
```

- Phone is a `tel:` link, email is a `mailto:` link; each has a small copy-to-clipboard icon with a brief "Copied" tick.
- Header shows the person's name and role label (**Key Person** / **Secondary Key Person**).
- Missing field shows `Not provided` in muted text.
- Popover uses the existing card look (white background, `--border`, soft shadow, 8px radius) — no new design language.

## 3. Data needed (does not exist yet)

`Client` currently has only `id, name, jobNumber, status`. Required new fields:

```ts
keyPersonName?: string;
keyPersonPhone?: string;
keyPersonEmail?: string;
secondaryKeyPersonName?: string;
secondaryKeyPersonPhone?: string;
secondaryKeyPersonEmail?: string;
```

Changes this implies:
1. Database: 6 nullable columns on the clients table (Supabase migration).
2. `Client` type + the client fetch/mapping code.
3. Add/Edit Client form (the Add Client button on this page): inputs for the 6 fields so data can be entered.
4. Table: the new column + popover component.

## 4. Open questions

1. **Who enters the key person data?** Same people who can add/edit clients (assumed), via the Add/Edit Client form?
2. **Is the key person a client-side contact** (e.g. the client's CFO) **or an internal staff member**? Design above assumes a client-side contact with free-text name/phone/email. If internal, we would pick from the staff list instead and pull phone/email automatically.
3. Should the same column also appear on the main Clients grid ([ClientGrid.tsx](../src/components/clients/ClientGrid.tsx)), or only on this profile table?
4. Mobile: popover becomes a bottom sheet on narrow screens (assumed fine).
