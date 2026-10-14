# Day Timer + Installable App (PWA) — Design

Date: 2026-10-14
Branch: `feat/day-timer` (builds on `feat/worklog-card-input`)

## Goal

Let a user track their workday live instead of typing hours at the end of it, similar to the
Upwork desktop tracker: register today's items in the morning, add more during the day, switch
between them with one click from a small always-on-top window, and send the day as normal
work-log entries in the evening.

## Agreed decisions

| Topic | Decision |
|---|---|
| Platform | Installed Weave app (PWA) in **Microsoft Edge on Windows** |
| Overlay | **Document Picture-in-Picture** mini window opened from the app ("Pop out") |
| Where the running day lives | **Only on this PC** (browser local storage) until sent; no new database table |
| Rounding | Per item, total time of the day rounded to **nearest 0.5 h**; editable before sending |
| Breaks | **Pause button + away detection** (idle/lock + sleep/closed gaps) with a prompt |
| Labels | "Tambah Proyek" stays as is |

## Out of scope

- Live visibility of running timers for admins (would need a database table).
- Continuing a running day on another device.
- Native desktop app (Electron/Tauri), auto-start with Windows.
- Offline use: the service worker exists only to make the app installable and caches nothing.

## 1. Screens and daily flow

### A. "Timer hari ini" panel (user screen, above "Catat jam kerja")

- **Not started:** button **Mulai hari**.
- **Planning / any time:** add items with the same row picker as the work-log form
  (Kategori → project combobox incl. manual, or Quotation/Training + optional Deskripsi).
- **Running:** one line per item with its time so far; the active item is highlighted; clicking
  an item switches to it. Buttons: **Pause / Lanjut**, **Pop out**, **Selesai & kirim**.
- If a previous day was never sent, the panel says so and opens that day's review first.

### B. Mini window (Document Picture-in-Picture, ~320×420, resizable)

- Current item name and a large running clock; **Pause / Lanjut**.
- Today's item list; click to switch.
- **+ Tambah** to add an item without returning to the main window.
- Today's total.
- Shows the away prompt (section 3) when needed.

### C. Review and send ("Selesai & kirim")

- One row per item: Kategori, project/description, tracked time, **rounded hours (editable)**,
  editable description, remove button.
- Rows whose hours round to 0 (under 15 min) are greyed out and not saved unless edited.
- Entries already logged for that date via the form are shown in the same list and kept.
- **Kirim** saves the combined list for the date (replace-the-day, same as the form) and clears
  the timer state.

### D. Installable app

- Edge offers "Install Weave"; the app gets its own window and taskbar icon.

## 2. Timer state

### Model: timestamps, not counters

Every action appends an event with an exact timestamp; time per item is always derived.

```ts
type TimerItem = {
  id: string;
  category: 'project' | 'quotation' | 'training';
  project_id: string | null;        // project category, existing project
  custom_name: string;              // project category, manual project
  custom_code: string;
  description: string;
};

type TimerSegment = { itemId: string; start: number; end: number | null }; // epoch ms

type DayTimerState = {
  version: 1;
  userId: string;
  date: string;                     // YYYY-MM-DD, the date "Mulai hari" was clicked
  items: TimerItem[];
  segments: TimerSegment[];         // at most one open segment (end === null)
  status: 'running' | 'paused' | 'review';
  lastSeen: number;                 // heartbeat, epoch ms
  pendingAway: { start: number; end: number; itemId: string } | null;
};
```

- Switching closes the open segment and opens a new one; pausing closes it.
- Item time = sum of its closed segments + (now − start) for the open one.

### Storage

- `localStorage` key `weave.dayTimer.<userId>`, JSON, a few KB. Per user, so a shared PC does
  not mix days.
- Every read/write wrapped in try/catch; invalid or unknown-version data is ignored with a notice.

### Edge cases

- **App closed / crash / restart / sleep:** state is reloaded from storage; the gap is handled
  by away detection (section 3).
- **Mini window and main window:** same React tree and state (PiP renders a portal), no sync needed.
- **Second tab:** uses a `BroadcastChannel` + storage event; a tab that is not the owner shows
  "Timer berjalan di jendela lain" instead of starting a competing timer.
- **Past midnight:** time stays on the start date.
- **Clearing Edge site data** erases an unsent day. The panel shows a short reminder to send
  daily; sent data is safe in the database.

## 3. Away detection, review and send

### Away detection

- While running, `lastSeen` is written every 30 s.
- **Idle/lock:** Edge Idle Detection API (`IdleDetector`, permission requested once from a
  click). When the user becomes idle or the screen locks, the idle start time is remembered;
  the timer keeps running.
- **Sleep / app closed:** on load or wake, `now − lastSeen` is the gap.
- If an away period is **≥ 10 minutes** (constant, adjustable later), `pendingAway` is set and
  both windows show:
  > Kamu tidak aktif **25 menit** saat *Gedung Sudirman* berjalan.
  > [Tetap di Gedung Sudirman] [Pindah ke item lain…] [Buang]
  - **Keep:** nothing changes.
  - **Move:** the away span is cut from the current segment and added to the chosen item.
  - **Discard:** the away span is cut out (becomes a pause).
- Shorter gaps count normally. If idle permission is declined, sleep/closed gaps still prompt.

### Rounding and review

- Per item: total ms for the day → hours → `Math.round(hours * 2) / 2`
  (1 h 15 m → 1.5; 1 h 14 m → 1.0; < 15 m → 0).
- Hours are editable in the review (0.5 steps, same input as the form).

### Saving

- Extract the form's save logic into one shared function used by both the form and the timer:
  `saveDay(userId, date, entries, hasV4Schema)` → delete that date's rows, insert the list.
- Before the v4 database update runs, the timer offers only the Project category (same as the form).

## 4. Installable app and mini window

- `public/manifest.webmanifest`: name "Weave", `display: standalone`, `start_url: /`,
  theme colour `#4f46e5`, background `#f8fafc`, icons 192/512 PNG generated from
  `public/logo/weaver-icon.svg` (plus maskable).
- `public/sw.js`: minimal service worker (install/activate, network pass-through, no caching),
  registered from the client.
- `app/layout.tsx`: link the manifest, theme-color meta.
- Mini window: `documentPictureInPicture.requestWindow({ width: 320, height: 420 })` from the
  Pop out click; copy the app's stylesheets into the PiP document; render `TimerMiniWindow`
  into it with a React portal; keep the `data-theme` attribute in sync. Hide Pop out when the
  API is missing.

## 5. Code layout

- `lib/dayTimer.ts` — pure logic: types, actions (start, addItem, switchTo, pause, resume,
  resolveAway), totals, gap detection, rounding, storage load/save. No React.
- `components/DayTimerPanel.tsx` — panel in the user screen; owns state, heartbeat, idle
  detection, PiP window.
- `components/TimerMiniWindow.tsx` — mini window content.
- `components/DayReview.tsx` — review and send.
- `app/page.tsx` — render `DayTimerPanel` in `UserView`; share the entry row picker and
  `saveDay` (moved to `lib/` or exported) instead of duplicating them.
- New i18n keys follow the existing `text.id` / `text.en` pattern.
- Styling reuses existing tokens and classes (`worklog-*`, `entry-row`, badges); new classes
  only for the timer layout and clock.

## 6. Testing

- Add **Vitest** (dev dependency) with unit tests for `lib/dayTimer.ts`:
  switching, pausing/resuming, multiple segments per item, open-segment totals, away gap
  detection (idle, sleep, closed), keep/move/discard, midnight, rounding boundaries
  (14:59 / 15:00 / 44:59 / 45:00), merging with existing entries, storage version handling.
- `pnpm build` (type-check) must pass.
- Browser check on a temporary preview page with sample data: panel states, mini window,
  away prompt, review screen, light/dark, desktop width.
