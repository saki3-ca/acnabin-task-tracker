# App-Wide Theme System — Context & Handover

**Project:** ACNABIN Task Tracker  
**Active Branch:** `app-theme`  
**Current Commit:** `a578741`  
**Date:** October 27, 2026  

---

## 1. Project Overview & Hard Rules

We are implementing an **app-wide theme system** for the entire task tracker with exactly two themes:
1. **Classic**: Today's exact look, colors, and behavior. Must remain 100% pixel-identical and unchanged.
2. **Glass**: Liquid-glass design inspired by `glass-reference.html`:
   - Page background: `linear-gradient(135deg, #4a5b8a 0%, #8b7eaa 50%, #c79db9 100%) fixed`
   - Panels & Cards: `rgba(255, 255, 255, 0.10)`, backdrop blur `16px`, border `1px solid rgba(255, 255, 255, 0.20)`, shadow `0 8px 32px rgba(0,0,0,0.10)`, rounded corners `24px` for large containers.
   - Text: `#FFFFFF` (primary), `rgba(255, 255, 255, 0.85)` (soft), `rgba(255, 255, 255, 0.70)` (muted).
   - Accents: Mint `#77dfc0` (done / primary), Sky blue `#85c7eb` (in-progress / links), Lavender `#c9a4eb` (header accents), Coral `#f68b8b` (overdue / delete / warnings).

### Critical Safety Rules (MUST FOLLOW)
- **Do not run `git push`, `git merge`, `git rebase`, `git reset --hard` or `git checkout .`**.
- Do not deploy to any environment.
- **Production Database Safety**: `.env` connects locally to the **real production Supabase database**.
  - **NEVER** call `app_theme_set` or mutate theme in the production database during automated tests or manual exploration without explicit user direction.
  - **Dev Override Mechanism**: When `import.meta.env.DEV` is true, use URL parameter `?uiTheme=glass` or `?uiTheme=classic` to preview locally in memory.
  - The Admin Panel has a **"Preview (This Browser Only)"** button that switches theme in React state without writing to Supabase.
  - Migration script is isolated in [supabase_app_theme.sql](file:///c:/Users/sakib/OneDrive/Desktop/September%2026/Project%20101/supabase_app_theme.sql) for the user to run manually in Supabase SQL editor.

---

## 2. Git & Branch Status

- **Current Branch:** `app-theme` (branched from `main` at `7bf3306`)
- **Commits on `app-theme`:**
  - `c462f3e`: Phase 1: Add tokens, ThemeProvider, dev override, SQL migration, Admin switch and shell styling
  - `a578741`: fix(theme): enhance glass theme text contrast, readability, and card styling
- **Unstaged Changes:**
  - `apps-script/BackupToDrive.js` was modified by the user in their IDE (do not discard or overwrite).

---

## 3. What Has Been Completed

### Phase 1: Foundation, DB Migration, ThemeProvider, Admin Switch & Shell
1. **SQL Migration (`supabase_app_theme.sql`)**:
   - Idempotent table `app_flags` (`key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at`, `updated_by`).
   - Stored procedures: `app_theme_get(p_session)` and `app_theme_set(p_session, p_theme)`.
   - Seeded default `'classic'`.
2. **Service Layer (`src/services/appThemeService.ts` & `src/services/api.ts`)**:
   - `getTheme()` and `setTheme(theme)` implemented via Supabase RPC.
   - `appThemeSet` registered in `NO_FALLBACK_ACTIONS` to prevent offline mock writes.
3. **Theme Context (`src/context/ThemeContext.tsx`)**:
   - Wrapped around application in `App.tsx`.
   - Sets `data-ui-theme="classic" | "glass"` on `<html>`.
   - Polls every 60s for global changes (`useLivePolling`).
   - Supports local preview override via URL query parameter `?uiTheme=classic|glass` and Admin preview button.
4. **Admin Panel Appearance Section (`src/components/admin/AdminPanel.tsx`)**:
   - Added visual cards for Classic and Glass with sample chips.
   - Added **"Preview (This Browser Only)"** button (safe local state).
   - Added **"Save for Everyone"** button (calls DB only when explicitly clicked).
5. **Header & Shell (`src/components/layout/Header.tsx` & `src/styles/index.css`)**:
   - Glass rounded notification bell with red badge in Glass mode.
   - Masthead, user section, navigation tabs, and logout button styled for both themes.
6. **Text Readability & Contrast Fixes (Commit `a578741`)**:
   - Overrode legacy root variables (`--ink`, `--ink-soft`, `--ink-muted`, `--navy`, `--maroon`, `--teal`, `--cream-card`, `--line`) under `html[data-ui-theme="glass"]`.
   - Overrode `.stat-pill`, `.filter-bar`, table data cells (`.data-table td`), sticky columns, priority pills, status pills, and modals.
   - Text is now 100% crisp, white, high-contrast, and legible across dark glass surfaces.
7. **Border-Radius Calibration (Tightened Crisp Corners)**:
   - Reduced inflated/bubbly radii across Glass theme:
     - `--ui-radius` (containers & modals): reduced from `24px` to **`12px`**.
     - `--ui-radius-card` (cards & table containers): reduced from `24px` to **`10px`**.
     - `--ui-radius-control` (buttons, tabs, stat pills, inputs): reduced from `16px` to **`6px`**.
     - `--ui-radius-pill` (top header & navigation bar): reduced from `50px` to **`10px`**.
     - Firm Costing cards & header bar: reduced from `20px` to **`10px`**.
   - Result: crisp, sharp, modern desktop aesthetic instead of rounded stadium bubbles.
8. **Firm Costing Chart & Text Contrast Calibration (`chartColors.ts`, `firmCosting.css`)**:
   - Fixed odd text colors on charts (removed legacy dark green/teal `--ink: #013e37` on `.fc-t7` and dark brown `#5A544E` axis labels).
   - Card titles now render in pure crisp `#FFFFFF`, card subtitles in soft white `rgba(255, 255, 255, 0.75)`.
   - SVG chart axis labels and tick marks now render in crisp soft white `rgba(255, 255, 255, 0.75)`.
   - Charts now use full liquid glass palette (Mint `#77dfc0`, Lavender `#c9a4eb`, Coral `#f68b8b`) without falling back to classic muddy colors on `light` cards.
9. **Invoices View & Modals Liquid Glass Transformation (`InvoiceTracker.tsx`, `InvoiceFilesModal.tsx`, `InvoiceImport.tsx`, `UploadPanel.tsx`)**:
   - Converted Invoices table data cells from hardcoded `#fff` to theme-aware translucent zebra rows (`rgba(255, 255, 255, 0.05)` / `rgba(255, 255, 255, 0.02)`).
   - Sticky columns (`stickyStyle`) styled with dark glass backdrop (`rgba(24, 28, 52, 0.95)` with blur) to prevent horizontal scrolling content from bleeding through.
   - Introduced `GLASS_GROUPS` tokenized palette for column headers and legend pills with glowing Mint, Lavender, Amber, and Coral accents.
   - `FormCard` sections inside the New/Edit Invoice modal converted to frosted glass panels with glowing left accent borders and `#FFFFFF` headings.
   - Status chips (`Chip`) converted to glowing mint/coral glass pills.
   - Banner strip and its action buttons converted to frosted glass controls.
   - Monthly Report modal and Invoice Files modal summary boxes converted from hardcoded `#F8FAFC`/`#FAF8F5` to frosted glass.
   - Drive background upload slide panel (`UploadPanel.tsx`) styled with dark liquid glass, glowing status indicators, and frosted progress track.
   - Classic mode remains 100% pixel-identical and untouched.
10. **Exam Leave Routine Tab Transformed (`ExamLeaveTracker.tsx`)**:
   - Replaced blinding white `#ffffff` and `#FAF8F5` rows in `PROFESSIONAL & ADVANCED LEVEL` and `CERTIFICATE LEVEL` tables with translucent zebra rows (`rgba(255, 255, 255, 0.06)` / `rgba(255, 255, 255, 0.03)`).
   - Fixed unreadable dark red text: AL rows now use soft coral `#f68b8b` on `rgba(246, 139, 139, 0.14)`.
   - Level and paper badges: AL (`#f68b8b`), PL (`#c9a4eb`), CL paper badges (`#77dfc0`).
   - Off-day rows styled in translucent `rgba(255, 255, 255, 0.02)` with soft white italic text.
11. **Complete Eradication of `#85C7EB` Across the Application**:
   - Eradicated all occurrences of baby blue `#85C7EB` across `src/styles/index.css`, `chartColors.ts`, `firmCosting.css`, `InvoiceTracker.tsx`, `InvoiceFilesModal.tsx`, `KeyPersonCell.tsx`, and `UploadPanel.tsx`.
   - Replaced with elegant Lavender `#c9a4eb`, crisp `#FFFFFF`, or soft Mint `#77dfc0`.
12. **Assigned Client Engagements Table & Key Person Cell (`ProfileView.tsx`, `KeyPersonCell.tsx`)**:
   - Replaced unreadable dark green text (`#0F5E57`, `#03543F`) with crisp `#FFFFFF` for primary person, and `rgba(255, 255, 255, 0.70)` for secondary.
   - Contact popup card styled with liquid glass (`rgba(24, 28, 52, 0.95)` with blur).
   - Table Job IDs styled with `#c9a4eb`, Company name in `#FFFFFF`.
   - Status and task count chips styled with frosted glass pills (`#77dfc0` and `#c9a4eb`).
13. **Edit Profile Modal Liquid Glass Styling (`ProfileView.tsx`)**:
   - Replaced blinding white boxes (`#F8FAFC`, `#FFFDF9`) with translucent frosted glass panels (`rgba(255, 255, 255, 0.06)` with blur).
   - Fixed labels and section titles to crisp `#FFFFFF` and `#c9a4eb`.
   - Read-only inputs (Employment Year, Academic Year, EMP ID, Designation) styled with translucent frosted backgrounds.
   - Client picker chips and search suggestions styled in liquid glass with white text.
14. **Admin Panel White-on-White Elimination (`AdminPanel.tsx`, `TabAccessManager.tsx`, `UserMultiPicker.tsx`, `DriveLinkBox.tsx`, `StaffImport.tsx`)**:
   - Fixed solid white segmented control buttons (`ALL`, `ADMIN`, `Individual`, `EXCEPT`, `NONE`) by replacing `#fff` with dark translucent track and clear white text.
   - Fixed "Default rule" badge and all status indicators to frosted pills with crisp, high-contrast text.
   - UserMultiPicker search dropdown and chips styled in liquid glass (`rgba(201, 164, 235, 0.22)` with white text).
   - Manager Client and Student access cards styled in frosted glass panels.
   - Multi-Client Assignment modal styled with translucent glass rows.

---

## 4. Pending Topics & Next Steps

### A. Firm Costing Tab (Pending User Decision)
- **Current Behavior**: Firm Costing has its own independent theme mechanism (`.fc-stage`, `--fc-*`, `app_firm_costing_theme` table/RPC). It does not change when the app theme is switched.
- **User Options**:
  1. *Sync with App Theme*: Connect Firm Costing to `useTheme()` so it automatically matches Classic / Glass with the rest of the app.
  2. *Keep Independent*: Keep Firm Costing's own switcher, but update its internal "Glass" style to match the new liquid-glass palette instead of the old yellow/butter palette.

### Phase 2: Tokenization of Core Views (Tasks, Requests, Notifications, Profile, Completed Archive)
1. **My Tasks & Team Tasks (`src/components/tasks/TaskTableRow.tsx` & `src/components/dashboard/StatPills.tsx`)**:
   - Overdue & near-deadline text tokens (`.deadline-overdue-text`, `.deadline-overdue-subtext`, `.deadline-near-subtext`) high-contrast coral/amber in Glass mode while maintaining exact colors in Classic.
   - Completed stat pill value now adopts mint (`var(--ui-accent)`) in Glass mode.
   - Comment box styled cleanly with glass translucency.
2. **Task Requests (`src/components/tasks/TaskRequestsView.tsx`)**:
   - Replaced hardcoded row backgrounds with `.request-row-pending` (translucent amber tint in Glass mode).
   - Replaced inline pastel status badges with `.badge-status-accepted`, `.badge-status-declined`, and `.badge-status-pending` (neon glass chips).
3. **Notifications View (`src/components/notifications/NotificationsView.tsx`)**:
   - Unread row styling tokenized with `.notif-row-unread`.
   - Replaced inline notification type badges with `.notif-type-badge` variants (`badge-task`, `badge-deadline`, `badge-comment`, `badge-info`, `badge-query`, `badge-solved`, `badge-request`, `badge-general`).
   - Admin trash button tokenized with `.notif-trash-btn`.
   - Read notification status styled in mint.
4. **My Profile & Staff Details (`src/components/profile/ProfileView.tsx` & `StaffDetailsCard.tsx`)**:
   - Tokenized card body container (`.profile-card-body`, `.staff-details-body`) removing hardcoded `#ffffff`.
   - Tokenized 5 quick stat boxes (`.profile-stat-box.stat-blue`, `.stat-purple`, `.stat-green`, `.stat-yellow`, `.stat-red`) with responsive hover and vivid glow numbers.
   - Tokenized sub-panels (`.staff-panel`) and top stat boxes (`.staff-stat-box`) in Staff Details.
   - Hairline borders tokenized using `--line-soft`.
5. **Completed Tasks Modal Archive (`src/components/tasks/CompletedTasksModal.tsx`)**:
   - Tokenized header summary card (`.completed-modal-header`) with variant-specific themed text.
   - Tokenized zebra rows (`.table-row-even`, `.table-row-odd`) preserving Classic appearance while keeping Glass rows translucent.
   - Removed inline white backgrounds on search and client filter dropdowns.
6. **Client Grid (`src/components/clients/ClientGrid.tsx`)**:
   - Tokenized `.client-status-badge.active` and `.client-status-badge.inactive`.
7. **Global Shell & Components (`src/styles/index.css`)**:
   - Banner buttons across all views now styled with glass translucency in Glass mode.
   - Floating dropdown menus and slide-over drawers styled with dark glass backdrop blur.

---

## 4. Pending Topics & Next Steps

### A. Firm Costing Tab (Pending User Decision)
- **Current Behavior**: Firm Costing has its own independent theme mechanism (`.fc-stage`, `--fc-*`, `app_firm_costing_theme` table/RPC). It does not change when the app theme is switched.
- **User Options**:
  1. *Sync with App Theme*: Connect Firm Costing to `useTheme()` so it automatically matches Classic / Glass with the rest of the app.
  2. *Keep Independent*: Keep Firm Costing's own switcher, but update its internal "Glass" style to match the new liquid-glass palette instead of the old yellow/butter palette.

### Phase 3: Manpower Directory (Full & Scoped) & Central Exam Leave Management
1. **Designation Badges & High-Contrast Readability**:
   - Centralized `getDesignationBadgeClass(designation, empId)` in `src/lib/permissions.ts`.
   - Replaced inline pastel backgrounds in `ManpowerView.tsx` and `ScopedManpowerView.tsx` with semantic `.role-badge.badge-desig-*` classes (`badge-desig-management`, `badge-desig-incharge`, `badge-desig-student`, `badge-desig-default`).
   - Fixed text contrast: in Glass mode, badges use frosted dark glass surfaces with vivid Sky Blue, Mint, and Lavender text, with a safety net preventing any white-on-white text.
   - Added explicit Glass rules for `.role-badge.admin`, `.role-badge.manager`, `.role-badge.user`, and `.role-badge.student`.
2. **Stat Pills & Border Normalization**:
   - Normalized `.stat-pill.teal-border` and `.stat-pill.navy-border` in Glass theme to `var(--ui-border)` so Team Tasks and other tabs display clean, uniform translucent pill borders (removing the bright neon green outline).
3. **Segmented Controls, Action Bars & Legend Pills**:
   - Replaced custom inline segmented buttons across `ManpowerView.tsx`, `ScopedManpowerView.tsx`, and `ExamLeaveTracker.tsx` with standard `.segmented-control` and `.segmented-btn` classes.
   - Tokenized primary and secondary client tags using `.primary-client-tag` and `.secondary-client-tag`.
   - Tokenized Exam Leave legend pills with `.legend-pill.study-leave`, `.holiday`, and `.working-day`.
4. **Modals & Drawers in Exam Leave**:
   - Wrapped `ApplyExamLeaveModal.tsx` in `.modal-backdrop` and `.modal-dialog` for deep glass backdrop blur.
   - Added `.modal-backdrop` and `.modal-dialog` to Exam Leave timetable popup and candidate quick drawer.
5. **Sticky Column & 36-Day Timeline Matrix**:
   - Added `--table-sticky-bg` (`#FFFFFF` in Classic, `rgba(28, 33, 56, 0.95)` in Glass) ensuring sticky columns in `ScopedManpowerView` and `ExamLeaveTracker` blend seamlessly without opaque solid white patches.
   - Fixed unreadable white-on-white text in Exam Leave: Candidate names now use crisp Sky Blue (`#85c7eb`), client details use crisp white (`rgba(255, 255, 255, 0.85)`), and header titles use Lavender (`#c9a4eb`).
   - Replaced hardcoded `#ffffff` row backgrounds with themed zebra striping (`.table-row-even`, `.table-row-odd`).
   - Study leave blocks styled with glowing amber glass (`rgba(245, 158, 11, 0.35)` with `#fef08a` text), holidays with translucent rose (`#fda4af`), and summary footers with dark glass.

### Phase 4A: Firm Costing Liquid Glass Sync
1. **App Theme Integration (`FirmCosting.tsx`)**:
   - Connected `FirmCosting` to `useTheme()` so it automatically adopts Liquid Glass when the app-wide Glass theme is active.
2. **Eliminated Cream/Butter Clashing Styles (`firmCosting.css`)**:
   - Replaced the jarring yellow butter palette (`#fff1b8`) and beige stage (`#FAF7F2`) with transparent liquid-glass stage and frosted containers (`rgba(255, 255, 255, 0.10)`, backdrop blur `16px`, border `1px solid rgba(255, 255, 255, 0.20)`).
   - Fixed top filter bar (`.fc-top`) so headers and filter inputs render with crisp `#FFFFFF` text on frosted glass inputs rather than white text on cream.
   - Updated chart colors (`chartColors.ts`) to use the official app theme palette: Mint `#77dfc0` (revenue), Sky Blue `#85c7eb` (cost), Coral `#f68b8b` (loss), and Amber `#fef08a` (warning).
   - Classic mode remains 100% pixel-identical and unchanged.

---

## 4. Pending Topics & Next Steps

### Remaining Implementation Phases
- **Phase 4B**: Invoice Tracker, Proposal Tracker (tables, background upload, drawer, assignee picker), and Tender Agent.
- **Phase 5**: Auth screens (Login, Signup, Reset Password) and final cross-screen polish.

---

## 5. How to Run, Test, and Verify

### Running the App Locally:
```bash
npm run dev
```
Dev server runs on `http://localhost:5173/`.

### Local Theme Testing (Safe Dev Overrides):
- Glass Preview: `http://localhost:5173/?uiTheme=glass`
- Classic Preview: `http://localhost:5173/?uiTheme=classic`
- Or navigate to **Admin Panel -> System Theme & Visual Appearance** and click **"Preview (This Browser Only)"**.

### Verification Commands:
```bash
npx tsc -b       # TypeScript compilation check (Must pass with 0 errors)
npx vite build   # Production bundle verification
```
