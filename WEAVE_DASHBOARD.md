# Weave TV Dashboard: build spec

Two 1920×1080 slides for a 55" TV in a slideshow, about 30 seconds each:

1. **Ringkasan (overview):** how the team's hours are spread across projects this week, whether yesterday's work was reported, project progress, and logged hours against the attendance clock. Sections 1–11. It's live at `/dashboard`.
2. **Beban kerja (workload swimlane):** which type of work runs on which project and when, and where projects overlap for the same engineers. It's the slide-4 view from the "Swimlane Progress" deck. Section 12. For now it comes with **demo data**; the live data source is in §12.7.

The page makes **one database call**, `weave_dashboard`, with the publishable key. Every total, average, % and ranking is computed inside the database, so the page only displays values. The response contains **no personal data**: no names, emails, badge numbers or per-person figures. Slide 2 describes people by role ("1 Automation Engineer"), never by name. Project numbers and names, client names included, are shown on purpose.

---

## 1. Data flow

```
Weave app (weave.web.id)                 Vendor attendance system
  people log work hours per day            clock-in / clock-out punches
          │                                          │
          ▼                                          │  read-only, access code,
  Weave Supabase ── work_logs, projects              │  one person + one date per call
          │                                          ▼
          │◄──── /api/attendance-sync (Weave server) ─┘
          │        copies each user's day into attendance_days
          │        triggered by pg_cron in Weave Supabase
          ▼
  weave_dashboard()  ── aggregates only ──►  TV page (publishable key)
```

| Data | Who updates it | How often it changes |
|---|---|---|
| Work entries (`work_logs`) | Each employee, in Weave | Mostly in the morning for the previous day, and through the day. Entries can be edited later. |
| Projects (`projects`) | Admins, in Weave | Rarely |
| Attendance copy (`attendance_days`) | `/api/attendance-sync`, run by pg_cron | Every 10 min, 07:00–19:50 WIB, Mon–Sat (today + 3 days back). Nightly at 21:00 WIB (last 10 days). |

"Today" is never complete until the next morning, which is why reporting is measured on **yesterday** (the previous workday).

## 2. Connection

| | |
|---|---|
| Project URL | `https://xfbvrndsolancoscebjy.supabase.co` |
| Publishable key | Supabase Dashboard → Weave project → **Project Settings → API Keys** → the *anon / publishable* key. It is the same key weave.web.id already ships to browsers. |
| Endpoint | `POST https://xfbvrndsolancoscebjy.supabase.co/rest/v1/rpc/weave_dashboard` |

**Never** put the `service_role` / secret key in the page. The publishable key can call this one function and nothing else (see §10).

```js
const SUPABASE_URL = 'https://xfbvrndsolancoscebjy.supabase.co';
const SUPABASE_KEY = '<publishable key>';

async function loadDashboard(date /* 'YYYY-MM-DD' or undefined */) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/weave_dashboard`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(date ? { p_date: date } : {}),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`weave_dashboard ${res.status}: ${await res.text()}`);
  return res.json();
}
```

## 3. Parameters

| Name | Type | Allowed values | Default | Meaning |
|---|---|---|---|---|
| `p_date` | date `YYYY-MM-DD` | `2020-01-01` … tomorrow (WIB). Anything else is refused with error `22023`. | today in Asia/Jakarta | The day the screen is "about". Every period below is derived from it. |

There are no other parameters, because the screen has a single fixed view. Derived periods, all inclusive:

| Period | Rule | Example for `p_date` = Wed 2026-11-25 |
|---|---|---|
| `week` | Monday of `p_date`'s week … `p_date` | 11-23 … 11-25 |
| `last_week` | The same days, one week earlier | 11-16 … 11-18 |
| `month` | 1st of the month … `p_date` | 11-01 … 11-25 |
| `last_month` | Same day count in the previous month (capped at its last day) | 10-01 … 10-25 |
| `reporting.date` | Previous workday (Mon–Fri) before `p_date`. On a Monday it is Friday. | 11-24 |
| `attendance.comparison` | `week` up to yesterday. On a Monday: all of last week (Mon–Sun). | 11-23 … 11-24 |

## 4. Response

A realistic example for Wed 2026-11-25, 23 people:

```json
{
  "generated_at": "2026-11-25T02:12:04.51+00:00",
  "timezone": "Asia/Jakarta",
  "date": "2026-11-25",
  "periods": {
    "week":       { "from": "2026-11-23", "to": "2026-11-25", "iso_week": 48 },
    "last_week":  { "from": "2026-11-16", "to": "2026-11-18" },
    "month":      { "from": "2026-11-01", "to": "2026-11-25" },
    "last_month": { "from": "2026-10-01", "to": "2026-10-25" }
  },
  "reporting": {
    "date": "2026-11-24", "expected": 23, "reported": 19,
    "rate_pct": 82.6, "target_pct": 90, "streak_days": 0
  },
  "hours": {
    "week": 312.5, "last_week": 298.0, "week_change_pct": 4.9,
    "month": 2140.0, "last_month": 2215.5, "month_change_pct": -3.4
  },
  "categories_week": [
    { "key": "project",   "label": "Proyek",    "hours": 251.0, "share_pct": 80.3 },
    { "key": "quotation", "label": "Quotation", "hours": 31.5,  "share_pct": 10.1 },
    { "key": "training",  "label": "Training",  "hours": 12.0,  "share_pct": 3.8 },
    { "key": "other",     "label": "Lainnya",   "hours": 18.0,  "share_pct": 5.8 }
  ],
  "top_projects_month": [
    { "rank": 1, "code": "2260301", "name": "LOreal Canada Montreal 2x20T", "hours": 610.5, "people": 9, "share_pct": 28.5 },
    { "rank": 2, "code": "2260504", "name": "Paragon_Mixing Skid 10T",      "hours": 402.0, "people": 7, "share_pct": 18.8 },
    { "rank": 3, "code": "2260801", "name": "Henkel Filling Line",          "hours": 233.0, "people": 5, "share_pct": 10.9 }
  ],
  "other_projects_month_hours": 318.0,
  "manual_projects_month": { "hours": 41.0, "entries": 9, "share_pct": 2.6 },
  "weekly_trend": [
    { "week_start": "2026-10-05", "iso_week": 41, "hours": 498.0, "partial": false },
    { "week_start": "2026-10-12", "iso_week": 42, "hours": 512.5, "partial": false },
    { "week_start": "2026-10-19", "iso_week": 43, "hours": 530.0, "partial": false },
    { "week_start": "2026-10-26", "iso_week": 44, "hours": 476.0, "partial": false },
    { "week_start": "2026-11-02", "iso_week": 45, "hours": 541.5, "partial": false },
    { "week_start": "2026-11-09", "iso_week": 46, "hours": 525.0, "partial": false },
    { "week_start": "2026-11-16", "iso_week": 47, "hours": 507.0, "partial": false },
    { "week_start": "2026-11-23", "iso_week": 48, "hours": 312.5, "partial": true }
  ],
  "attendance": {
    "comparison": {
      "from": "2026-11-23", "to": "2026-11-24",
      "clocked_hours": 372.0, "logged_hours": 331.5, "coverage_pct": 89.1,
      "person_days": 42, "unreported_days": 3
    },
    "today": {
      "date": "2026-11-25", "expected": 23,
      "clocked_in": 20, "still_in": 20, "clocked_out": 0, "on_leave": 1, "not_clocked_in": 2,
      "synced_at": "2026-11-25T02:10:02.8+00:00", "minutes_since_sync": 2, "is_stale": false
    }
  }
}
```

### Field reference

| Field | Meaning | Unit | `null` means |
|---|---|---|---|
| `generated_at` | When the database built this answer | ISO timestamp in UTC (`+00:00`). Convert to WIB for display. | never null |
| `timezone` | Always `Asia/Jakarta`. All *dates* (`YYYY-MM-DD`) are WIB days; timestamps are UTC. | | never null |
| `date` | The `p_date` used | date | never null |
| `periods.*.from/to` | Inclusive date ranges (see §3) | date | never null |
| `periods.week.iso_week` | ISO week number of `date` | integer | never null |
| `reporting.date` | The workday being checked ("yesterday") | date | never null |
| `reporting.expected` | Accounts with the *user* role. Admins are not counted. | people | never null (0 if none) |
| `reporting.reported` | Of those, people with at least one entry (work or leave) on `reporting.date` | people | never null |
| `reporting.rate_pct` | `reported / expected × 100` | %, 1 dp | `expected` = 0 |
| `reporting.target_pct` | Target rate, fixed at 90 | % | never null |
| `reporting.streak_days` | Workdays in a row, ending at `reporting.date`, with at least 90% reported (capped at 120) | workdays | never null (0 = broken) |
| `hours.week` / `month` | Work hours logged in the period, all people including admins. Leave days excluded. | hours, 1 dp | never null |
| `hours.last_week` / `last_month` | The same, for the comparison period | hours | never null |
| `hours.*_change_pct` | `(current − previous) / previous × 100` | %, 1 dp | previous = 0 (nothing to compare with) |
| `categories_week[]` | Always 4 items, in this order: project, quotation, training, other | | |
| `…hours` | Hours in that category this week | hours | never null |
| `…share_pct` | `hours / hours.week × 100` | % | `hours.week` = 0 |
| `top_projects_month[]` | Up to 8 registered projects this month, most hours first. Empty array if none. | | |
| `…code`, `…name` | Project number and name as registered in Weave | text | never null |
| `…hours` | Hours on the project this month | hours | never null |
| `…people` | Distinct people who logged on it this month | people | never null |
| `…share_pct` | `hours / hours.month × 100` (share of *all* hours) | % | `hours.month` = 0 |
| `other_projects_month_hours` | Project hours outside the top 8: smaller registered projects plus typed project names | hours | never null |
| `manual_projects_month.hours` / `entries` | Hours and entry count on project names typed by hand instead of picked from the list | hours / entries | never null |
| `manual_projects_month.share_pct` | Manual hours / all *project* hours × 100 | % | no project hours |
| `weekly_trend[]` | Always 8 weeks, oldest first, ending with the current week | | |
| `…week_start` | Monday of that week | date | never null |
| `…hours` | Hours logged that week (up to `date` for the current one) | hours | never null |
| `…partial` | `true` for the current, unfinished week | boolean | never null |
| `attendance.comparison.from/to` | Comparison period (see §3) | date | never null |
| `…clocked_hours` | Attendance hours on **finished** days (clocked in and out) of *user*-role people | hours | never null |
| `…logged_hours` | Hours those same people logged on those same days | hours | never null |
| `…coverage_pct` | `logged_hours / clocked_hours × 100` | % | `clocked_hours` = 0 (no attendance data yet) |
| `…person_days` | Number of person-days compared | person-days | never null |
| `…unreported_days` | Person-days with clocked hours but no work logged | person-days | never null |
| `attendance.today.expected` | Same as `reporting.expected` | people | never null |
| `…clocked_in` | Clocked in on `date` (some may have left already) | people | never null |
| `…still_in` | Clocked in, no clock-out yet | people | never null |
| `…clocked_out` | Clocked in and out | people | never null |
| `…on_leave` | Approved leave on `date` and not clocked in | people | never null |
| `…not_clocked_in` | `expected − clocked_in − on_leave`, never below 0 | people | never null |
| `…synced_at` | Last time the attendance sync got an answer | ISO timestamp, UTC | the sync has never run |
| `…minutes_since_sync` | Minutes since `synced_at` | minutes | `synced_at` is null |
| `…is_stale` | `true` when the last sync was more than 30 minutes ago (or never). The today figures may then be out of date. | boolean | never null |

## 5. Key list

| Key | Label (ID) | Group | Aggregation | Formula |
|---|---|---|---|---|
| `reporting.reported` | Lapor kemarin | Reporting | count distinct people | people with ≥ 1 entry on `reporting.date` |
| `reporting.rate_pct` | Tingkat lapor | Reporting | recalculated rate | `reported / expected × 100` |
| `reporting.streak_days` | Streak ≥ 90% | Reporting | count, going back | consecutive workdays with `rate ≥ 90%` |
| `hours.week` | Jam minggu ini | Hours | sum | Σ hours, not leave, Mon…`date` |
| `hours.week_change_pct` | vs minggu lalu | Hours | recalculated rate | `(week − last_week) / last_week × 100` |
| `hours.month` | Jam bulan ini | Hours | sum | Σ hours, 1st…`date` |
| `hours.month_change_pct` | vs bulan lalu | Hours | recalculated rate | `(month − last_month) / last_month × 100` |
| `categories_week[].hours` | Proyek / Quotation / Training / Lainnya | Categories | sum per category | Σ hours this week by category |
| `categories_week[].share_pct` | % | Categories | recalculated rate | `category hours / hours.week × 100` |
| `top_projects_month[].hours` | Top proyek | Projects | sum per project, ranked | Σ hours this month, top 8 by hours |
| `top_projects_month[].people` | orang | Projects | count distinct | people who logged on the project this month |
| `top_projects_month[].share_pct` | % | Projects | recalculated rate | `project hours / hours.month × 100` |
| `other_projects_month_hours` | Proyek lain | Projects | sum | project hours − top 8 hours |
| `manual_projects_month.share_pct` | Entri manual | Data quality | recalculated rate | `manual hours / project hours × 100` |
| `weekly_trend[].hours` | Jam per minggu | Trend | sum per ISO week | Σ hours Mon…Sun (current week up to `date`) |
| `attendance.comparison.clocked_hours` | Jam absensi | Attendance | sum | Σ clocked hours, finished days, Mon…yesterday |
| `attendance.comparison.logged_hours` | Jam tercatat | Attendance | sum | Σ logged hours for the same person-days |
| `attendance.comparison.coverage_pct` | Tercatat vs absensi | Attendance | recalculated rate | `logged_hours / clocked_hours × 100` |
| `attendance.today.clocked_in` | Sudah absen masuk | Attendance | count (latest sync) | people with a clock-in on `date` |
| `attendance.today.still_in` | Masih di kantor | Attendance | count (latest sync) | clock-in, no clock-out |
| `attendance.today.not_clocked_in` | Belum absen | Attendance | recalculated | `expected − clocked_in − on_leave` |

Rates are always recalculated from their sums. Never average percentages from different periods.

## 6. Screen layout: slide 1, Ringkasan (1920×1080, no scrolling)

This is the page as built (`app/dashboard/page.tsx`). It's dark by default; `?theme=light` gives a light screen.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Weave  Minggu 48 · Rabu, 25 November 2026                       Diperbarui 09:12   14:46 │
├────────────────────┬────────────────────┬────────────────────┬───────────────────────────┤
│ Lapor kemarin      │ Jam minggu ini     │ Jam bulan ini      │ Absensi hari ini          │
│ ◔83%  19/23        │ 313 jam            │ 2.140 jam          │ 20     20      1    2     │
│ ! target 90%       │ ▲ 4,9% vs minggu   │ ▼ 3,4% vs bulan    │ Masuk  Kantor  Cuti ! Belum│
├────────────────────┴────────────────────┴──────┬─────────────┴───────────────────────────┤
│ Progres proyek (dari tugas yang disetujui)     │ Top proyek bulan ini (jam)              │
│ ┌ 2260301 Montreal … 81% ┐ ┌ 2260504 Paragon 39% ┐│ 2260301 Montreal ████████████ 611 · 9 org│
│ │ ███████████████░░░     │ │ ███████░░░░░░░░░░    ││ 2260101 Powder   ██████████   544 · 7 org│
│ │ Process     ███░  72%  │ │ Process   ████░  55% ││ …                                        │
│ │ Mechanical  █████ 97%  │ │ Elec & A. ██░░░  22% ││ Proyek lain ▒                     42    │
│ │ Elec & A.   ████░ 74%  │ │ 7/42 tugas · 402 jam ││ (Entri manual: 9 entri · 2,6%)          │
│ │ 60/137 · 611 jam · !2  │ └──────────────────────┘│                                          │
├────────────────────────┴────────┬────────────────┴───────┬────────────────────────────────┤
│ Jam per minggu (8 minggu)       │ Kategori minggu ini    │ Tercatat vs absensi            │
│ ▆ ▆ ▇ ▆ ▇ ▇ ▆ ▨                 │ ████████▌▍▌ + legend   │ ! 89%  Absensi ███ 372 j       │
│ M41 … M48*                      │                        │        Tercatat ██ 332 j       │
└─────────────────────────────────┴────────────────────────┴────────────────────────────────┘
```

**Grid:** a 12-column grid with 1em gaps. Rows are header, KPI, main (1.55 fr) and bottom (1 fr). The base font is `clamp(13px, 0.92vw, 24px)`, which is about 18 px on a 1920-wide TV, and every size is in `em`, so the layout scales with the window. Below 1100 px wide the panels stack and the page scrolls.

| # | Section | Columns | Fields | Chart | Colour / alert rules |
|---|---|---|---|---|---|
| 0 | Header | full | `periods.week.iso_week`, `date`, `generated_at`, `attendance.today.synced_at` | "Weave · Minggu 48 · Rabu, 25 November 2026", "Diperbarui 09:12", and a large clock (updates every 30 s) | Amber badge "! Absensi belum diperbarui sejak HH:MM" when `is_stale`. Red badge "✕ Offline sejak HH:MM" when the last call failed. |
| 1 | Lapor kemarin | 3 | `reporting.*` | ring + "19 / 23" + "Streak ≥90%: n hari kerja" | Ring and text green ✓ ≥ 90, amber ! 70–89.9, red ✕ < 70. |
| 2 | Jam minggu ini | 3 | `hours.week`, `week_change_pct` | hero number + delta, note "sampai hari ini" | ▲ green when > 0, ▼ red when < 0, "—" grey when null. |
| 3 | Jam bulan ini | 3 | `hours.month`, `month_change_pct` | hero number + delta, note "1 Nov – 25 Nov" | Same as #2. |
| 4 | Absensi hari ini | 3 | `attendance.today.*` | 4 numbers: Masuk · Di kantor · Cuti · Belum absen | "Belum absen" amber with ! when > 0 after 09:00 WIB. Whole tile at 55% opacity when `is_stale`. |
| 5 | Progres proyek | 7 | `project_progress[]` (§11) | one card per project, side by side (min 22em wide, so 2 per row): code, name, overall % in large type, a meter, then a thin bar per discipline with % | Single hue (`--chart-bar`). Footer "60 / 137 tugas selesai · 611 jam bulan ini". Amber badge "! n progres menunggu persetujuan" when `pending > 0`. 4 cards fit; more are cut off at the bottom, so show the top 4 on TV. |
| 6 | Top proyek bulan ini | 5 | `top_projects_month[]`, `other_projects_month_hours`, `manual_projects_month` | horizontal bars: **code** name · bar · hours · "9 org"; a grey "Proyek lain" bar | Single hue; "Proyek lain" in `--chart-muted`. Chip "Entri manual: n entri · x% jam proyek", amber with ! when > 5%. |
| 7 | Jam per minggu | 5 | `weekly_trend[]` | 8 columns with values on top, labels M41…M48 | Current week (`partial`) hatched and marked "*", with the footnote "* minggu berjalan, belum lengkap". |
| 8 | Kategori minggu ini | 3 | `categories_week[]` | 100% stacked bar + legend (hours, %) | Fixed colours: Proyek `--series-1`, Quotation `--series-2`, Training `--series-3`, Lainnya `--series-4`. Segments < 1% are hidden from the bar but stay in the legend. |
| 9 | Tercatat vs absensi | 4 | `attendance.comparison.*` | big % + two bars (Absensi grey, Tercatat blue) + "42 hari-orang · 3 belum lapor" | Green ✓ ≥ 90, amber ! 75–89.9, red ✕ < 75. |

**Colours:** status colours (green / amber / red) always come with a mark (✓ ! ✕ ▲ ▼), never colour alone. Theme tokens (dark / light):

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0b1120` | `#f8fafc` |
| `--card` | `#111827` | `#ffffff` |
| `--ink` | `#f8fafc` | `#0f172a` |
| `--muted` | `#94a3b8` | `#64748b` |
| `--line` | `#334155` | `#e2e8f0` |
| `--chart-bar` | `#6366f1` | `#4f46e5` |
| `--chart-muted` | `#64748b` | `#64748b` |
| `--success` | `#059669` | `#059669` |
| `--warn` | `#d97706` | `#d97706` |
| `--danger` | `#dc2626` | `#dc2626` |
| `--series-1` | `#3987e5` | `#2a78d6` |
| `--series-2` | `#d95926` | `#eb6834` |
| `--series-3` | `#199e70` | `#1baf7a` |
| `--series-4` | `#c98500` | `#eda100` |
| `--series-7` | `#9085e9` | `#6250d6` |

## 7. Display rules

| Kind | Format | Example |
|---|---|---|
| Hours | Indonesian thousands separator, 0 dp when ≥ 100, otherwise 1 dp, then " j" | `2.140 j`, `31,5 j` |
| Percent | 1 dp below 10, otherwise 0 dp, comma decimal | `4,9%`, `83%` |
| Change | Sign + arrow | `▲ 4,9%`, `▼ 3,4%` |
| People | Integer | `19 / 23` |
| Dates | Indonesian weekday + day + short month | `Selasa, 24 Nov` |
| Times | 24 h, WIB | `09:12` |

- **Null:** show an em dash `—` in muted grey. Never show `0` or `NaN` for a null.
- **Zero target or zero base:** `expected = 0` shows the ring empty with "Belum ada pengguna". Previous period 0 shows "—" for the change, never "+∞%". `clocked_hours = 0` shows "Belum ada data absensi".
- **Timezone:** every `YYYY-MM-DD` date in the response is already a WIB (Asia/Jakarta, UTC+7) day. Timestamps (`generated_at`, `synced_at`) are UTC: format them with `timeZone: 'Asia/Jakarta'`, never the TV's local zone.
- **Long project names:** one line, ellipsis. The project code is always shown in full.

## 8. Refresh

- Poll `weave_dashboard` **every 5 minutes**. Attendance is synced every 10 minutes, and work entries trickle in during the day.
- If a request fails, keep showing the last good data and add a small red "Offline sejak HH:MM" badge in the header. Retry after 1 minute.
- Reload the whole page once a day (for example at 05:00) to pick up a new build and avoid memory creep.

## 9. Empty state

With no users, projects or entries (a fresh database), the exact response for 2026-11-18 is:

```json
{"date": "2026-11-18", "hours": {"week": 0.0, "month": 0.0, "last_week": 0.0, "last_month": 0.0, "week_change_pct": null, "month_change_pct": null}, "periods": {"week": {"to": "2026-11-18", "from": "2026-11-16", "iso_week": 47}, "month": {"to": "2026-11-18", "from": "2026-11-01"}, "last_week": {"to": "2026-11-11", "from": "2026-11-09"}, "last_month": {"to": "2026-10-18", "from": "2026-10-01"}}, "timezone": "Asia/Jakarta", "reporting": {"date": "2026-11-17", "expected": 0, "rate_pct": null, "reported": 0, "target_pct": 90, "streak_days": 0}, "attendance": {"today": {"date": "2026-11-18", "expected": 0, "is_stale": true, "on_leave": 0, "still_in": 0, "synced_at": null, "clocked_in": 0, "clocked_out": 0, "not_clocked_in": 0, "minutes_since_sync": null}, "comparison": {"to": "2026-11-17", "from": "2026-11-16", "person_days": 0, "coverage_pct": null, "logged_hours": 0.0, "clocked_hours": 0.0, "unreported_days": 0}}, "generated_at": "2026-11-23T15:27:35.935626+07:00", "weekly_trend": [{"hours": 0.0, "partial": false, "iso_week": 40, "week_start": "2026-09-28"}, {"hours": 0.0, "partial": false, "iso_week": 41, "week_start": "2026-10-05"}, {"hours": 0.0, "partial": false, "iso_week": 42, "week_start": "2026-10-12"}, {"hours": 0.0, "partial": false, "iso_week": 43, "week_start": "2026-10-19"}, {"hours": 0.0, "partial": false, "iso_week": 44, "week_start": "2026-10-26"}, {"hours": 0.0, "partial": false, "iso_week": 45, "week_start": "2026-11-02"}, {"hours": 0.0, "partial": false, "iso_week": 46, "week_start": "2026-11-09"}, {"hours": 0.0, "partial": true, "iso_week": 47, "week_start": "2026-11-16"}], "categories_week": [{"key": "project", "hours": 0.0, "label": "Proyek", "share_pct": null}, {"key": "quotation", "hours": 0.0, "label": "Quotation", "share_pct": null}, {"key": "training", "hours": 0.0, "label": "Training", "share_pct": null}, {"key": "other", "hours": 0.0, "label": "Lainnya", "share_pct": null}], "top_projects_month": [], "manual_projects_month": {"hours": 0.0, "entries": 0, "share_pct": null}, "other_projects_month_hours": 0.0}
```

What to show:

- **Whole screen**, when `hours.month = 0` and `top_projects_month` is empty: a centred message, **"Belum ada jam kerja tercatat bulan ini"**, with "Data muncul setelah tim mengisi Weave." beneath it. Keep the header.
- **Top projects empty** (hours exist, but only on non-project categories): "Belum ada jam proyek bulan ini".
- **Attendance never synced** (`synced_at = null`): "Data absensi belum tersedia" in both attendance blocks.
- **Monday morning:** `hours.week` is small because people log Monday tomorrow. Show it as usual; the "sampai hari ini" note covers it.

## 10. Security checklist and curl quick test

- [x] `weave_dashboard` is `security definer` with `set search_path = ''`, and every table is schema-qualified.
- [x] `anon` has `execute` on `weave_dashboard(date)` only. It cannot run `is_admin`, `keep_alive` or `weave_run_attendance_sync`.
- [x] `anon` has no `select / insert / update / delete` on any table in `public`, including future tables (default privileges revoked). RLS stays on for every table as a second layer.
- [x] `attendance_days` (per-person attendance) has RLS on, no policies, and no grants to `anon` or `authenticated`. Only the database itself and Weave's server read it. Rows older than 60 days are deleted.
- [x] The response has no names, emails, badge or ID numbers, phone numbers or per-person figures. The smallest unit is a count of people.
- [x] The cron secret lives in Supabase Vault, not in any file. The vendor access code stays in Vercel.
- [x] This file contains no secret or `service_role` key.
- [ ] Re-run the curl test below after any database change.

```bash
URL=https://xfbvrndsolancoscebjy.supabase.co
KEY='<publishable key>'

# 1. The RPC works: expect HTTP 200 and the JSON object
curl -s -w '\nHTTP %{http_code}\n' -X POST "$URL/rest/v1/rpc/weave_dashboard" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{}'

# 2. Direct table read fails: expect HTTP 401 and "permission denied for table work_logs"
curl -s -w '\nHTTP %{http_code}\n' "$URL/rest/v1/work_logs?select=*&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

### Test results

**Local test.** Postgres 18 with Weave's migrations v2–v6 and fake data, run as the `anon` role:

```
rpc ok: {"date": "2026-11-17", "expected": 10, "rate_pct": 90.0, "reported": 9, "target_pct": 90, "streak_days": 2}
ERROR:  permission denied for table work_logs
ERROR:  permission denied for table profiles
ERROR:  permission denied for table attendance_days
ERROR:  permission denied for table admin_settings
ERROR:  permission denied for table projects          (insert)
ERROR:  permission denied for table work_logs         (update)
ERROR:  permission denied for table projects          (delete)
ERROR:  permission denied for function is_admin
ERROR:  permission denied for function keep_alive
ERROR:  permission denied for function weave_run_attendance_sync
```

Signed-in users are unaffected: they still read their own entries and `is_admin()` still works.

**Live test** against `xfbvrndsolancoscebjy.supabase.co` with the publishable key, 2026-11-23 16:03 WIB:

```
$ curl -X POST "$URL/rest/v1/rpc/weave_dashboard" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -d '{}'
HTTP 200
{"reporting": {"date": "2026-11-20", "expected": 23, "reported": 6, "rate_pct": 26.1, "target_pct": 90, "streak_days": 0},
 "hours": {"week": 8, "month": 2033.5, "last_week": 105, "last_month": 2500, "week_change_pct": -92.4, "month_change_pct": -18.7},
 "attendance": {"today": {"expected": 23, "clocked_in": 19, "still_in": 19, "not_clocked_in": 4, "is_stale": false, ...}, ...},
 "top_projects_month": [{"code": "2260301", "hours": 736, ...}, ...], ...}

$ curl "$URL/rest/v1/work_logs?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
{"code":"42501","details":null,"hint":"Grant the required privileges to the current role with: GRANT SELECT ON public.work_logs TO anon;","message":"permission denied for table work_logs"}
HTTP 401
```

The same key also gets `permission denied` (HTTP 401) on `profiles`, `projects`, `admin_settings`, `app_popups`, `attendance_days`, `admin_logs`, on inserting into `projects`, and on `rpc/is_admin`. The attendance sync's first run: `{"ok":true,"people":23,"dates":4,"rows":50,"failed":0}`.

## 11. Project progress (schema v9)

Since `schema-v9-dashboard-progress.sql`, the response also has `project_progress`: up to 6 active projects that have a task list, busiest this month first. It's an empty array when no project has tasks, and it's missing before v9 is run (the page then shows a hint).

| Field | Meaning | Unit | `null` means |
|---|---|---|---|
| `code`, `name` | Project number and name | text | never null |
| `overall` | Average of the disciplines' progress (approved steps only) | %, 1 dp | the project has no live tasks |
| `disciplines[]` | `key`, `label`, `progress_pct`, `tasks` (leaf tasks), `done` (tasks at 100%), in the order Process, Mechanical, Electrical & Automation, … | %, count | never null |
| `tasks_total`, `tasks_done` | Leaf tasks, and how many are at 100% | count | never null |
| `pending` | Progress proposals waiting for the PM | count | never null |
| `hours_month` | Hours logged on the project this month | hours | never null |

**Formula:** a task group's progress is the weighted average of its non-archived children (no weight = 1). A discipline is the weighted average of its deliverables. The project is the plain average of its disciplines. It's the same maths as the app (`lib/tasks.ts`).

**Built page:** `/dashboard` (`app/dashboard/page.tsx`). Dark by default; add `?theme=light` for a light screen, or `?date=YYYY-MM-DD` to show a past day.

## 12. Slide 2: Beban kerja (workload swimlane)

This is the people view of the "Swimlane Progress Automation IFF, Paragon, Egypt Aminolat" deck (slide 4, the consolidated view).
- **Rows (lanes):** a type of work, labelled with its staffing ("1 Automation Engineer | 3 proyek bersamaan").
- **Sub-rows:** one per project.
- **Bars:** the activity over the year.
- **Bands:** amber where 2 projects run in the same lane at the same time, red where 3 do.
- **Strips at the bottom:** how many projects and tasks are active together each month.

**No names on the TV.** People appear only as role and count. A per-person version with names belongs in the admin page, not on this screen.

### 12.1 Demo data

Use this exactly until the live source exists (§12.7). The dates are the ones in the deck, as of 24 Nov 2026. Keep it in the page as `DEMO_WORKLOAD`, and show a small grey "Data contoh" badge in the header while it's used.

```json
{
  "demo": true,
  "title": "Beban kerja engineering",
  "range": { "from": "2026-01-01", "to": "2026-12-31", "today": "2026-11-24", "unit": "month" },
  "projects": [
    { "key": "paragon",  "code": "2260504", "name": "Paragon",        "color": "series-1" },
    { "key": "iff",      "code": null,      "name": "IFF",            "color": "series-7" },
    { "key": "aminolat", "code": "2250304", "name": "Aminolat Egypt", "color": "series-3" }
  ],
  "lanes": [
    {
      "key": "process", "label": "Process Engineering", "division": "Process",
      "staffing": "1 Process Engineer", "parallel_projects": 4, "parallel_note": "3 ditampilkan", "peak_overlap": 2,
      "overlaps": [
        { "from": "2026-01-08", "to": "2026-01-30", "count": 2 },
        { "from": "2026-05-02", "to": "2026-06-29", "count": 2 }
      ],
      "items": [
        { "project": "paragon",  "label": "PID",                 "from": "2026-05-02", "to": "2026-07-30", "status": "done" },
        { "project": "paragon",  "label": "Process Description", "from": "2026-06-14", "to": "2026-10-31", "status": "done" },
        { "project": "iff",      "label": "PID",                 "from": "2026-01-08", "to": "2026-04-29", "status": "done" },
        { "project": "iff",      "label": "Process Description", "from": "2026-04-30", "to": "2026-06-29", "status": "done" },
        { "project": "aminolat", "label": "PID",                 "from": "2026-01-03", "to": "2026-01-30", "status": "done" },
        { "project": "aminolat", "label": "Process Description", "from": "2026-01-03", "to": "2026-01-30", "status": "done" }
      ]
    },
    {
      "key": "io_list", "label": "IO List", "division": "Automation",
      "staffing": "1 Automation Engineer", "parallel_projects": 3, "parallel_note": null, "peak_overlap": 2,
      "overlaps": [ { "from": "2026-07-24", "to": "2026-11-15", "count": 2 } ],
      "items": [
        { "project": "paragon", "label": "IO List dev / revisi", "note": "Rev.3 17 Nov", "from": "2026-06-01", "to": "2026-11-30", "status": "ongoing" },
        { "project": "iff",     "label": "IO List",              "from": "2026-07-24", "to": "2026-11-15", "status": "done" }
      ]
    },
    {
      "key": "plc", "label": "PLC Programming", "division": "Automation",
      "staffing": "2 Automation Engineer", "parallel_projects": 5, "parallel_note": null, "peak_overlap": 3,
      "overlaps": [
        { "from": "2026-10-29", "to": "2026-11-28", "count": 2 },
        { "from": "2026-11-10", "to": "2026-11-24", "count": 3 }
      ],
      "items": [
        { "project": "paragon",  "label": "HW config + function ladder", "note": "ad-hoc", "from": "2026-10-29", "to": null, "status": "ongoing" },
        { "project": "iff",      "label": "HW config, PLC structure, network & IO map", "from": "2026-07-09", "to": "2026-08-27", "status": "done" },
        { "project": "iff",      "label": "Preliminary ladder / sequence logic",        "from": "2026-08-07", "to": "2026-11-28", "status": "ongoing" },
        { "project": "aminolat", "label": "HW config, PLC structure",                    "from": "2026-11-10", "to": "2026-12-04", "status": "ongoing" },
        { "project": "aminolat", "label": "Prelim. ladder logic",                        "from": "2026-11-13", "to": "2026-12-01", "status": "ongoing" }
      ]
    },
    {
      "key": "hmi", "label": "HMI Programming", "division": "Automation",
      "staffing": "PIC sama dengan PLC", "parallel_projects": 2, "parallel_note": null, "peak_overlap": 3,
      "overlaps": [
        { "from": "2026-11-10", "to": "2026-11-28", "count": 2 },
        { "from": "2026-11-23", "to": "2026-11-24", "count": 3 }
      ],
      "items": [
        { "project": "paragon",  "label": "HMI PID display",                   "from": "2026-11-10", "to": null,         "status": "ongoing" },
        { "project": "iff",      "label": "HMI design overview",               "from": "2026-07-11", "to": "2026-10-13", "status": "done" },
        { "project": "iff",      "label": "Screen templates, faceplates, nav", "from": "2026-09-18", "to": "2026-11-09", "status": "done" },
        { "project": "iff",      "label": "Dynamic values / alarms",           "from": "2026-10-28", "to": "2026-12-05", "status": "ongoing" },
        { "project": "aminolat", "label": "HMI design overview",               "from": "2026-11-23", "to": "2026-12-07", "status": "ongoing" },
        { "project": "aminolat", "label": "Screen templates",                  "from": "2026-11-23", "to": "2026-12-07", "status": "ongoing" }
      ]
    },
    {
      "key": "fa", "label": "Functional Analysis", "division": "Automation",
      "staffing": "Review Process + Automation", "parallel_projects": 1, "parallel_note": null, "peak_overlap": 1,
      "overlaps": [],
      "items": [
        { "project": "paragon", "label": "FA Rev.0 (review Process)", "from": "2026-10-12", "to": "2026-10-22", "status": "done" }
      ]
    },
    {
      "key": "electrical", "label": "Electrical Document", "division": "Automation",
      "staffing": "1 Electrical Engineer + 1 Drafter", "parallel_projects": 3, "parallel_note": "procurement & design", "peak_overlap": 3,
      "overlaps": [
        { "from": "2026-06-05", "to": "2026-11-06", "count": 2 },
        { "from": "2026-06-08", "to": "2026-07-02", "count": 3 },
        { "from": "2026-08-31", "to": "2026-09-30", "count": 3 }
      ],
      "items": [
        { "project": "paragon",  "label": "Item List",                 "from": "2026-06-05", "to": "2026-11-19", "status": "done" },
        { "project": "paragon",  "label": "Schematic Diagram",         "from": "2026-06-07", "to": "2026-09-30", "status": "done" },
        { "project": "paragon",  "label": "Schematic Diagram (rev)",   "from": "2026-07-08", "to": "2026-10-31", "status": "done" },
        { "project": "iff",      "label": "Item list dev / update",    "from": "2026-06-08", "to": "2026-11-06", "status": "done" },
        { "project": "iff",      "label": "Schematic & panel docs",    "from": "2026-07-20", "to": "2026-11-06", "status": "done" },
        { "project": "aminolat", "label": "Item list",                 "from": "2026-06-02", "to": "2026-07-02", "status": "done" },
        { "project": "aminolat", "label": "Schematic & panel docs",    "from": "2026-08-31", "to": "2026-09-30", "status": "done" }
      ]
    }
  ],
  "concurrency": [
    { "month": "2026-01", "projects": 2, "tasks": 3 },
    { "month": "2026-02", "projects": 1, "tasks": 1 },
    { "month": "2026-03", "projects": 1, "tasks": 1 },
    { "month": "2026-04", "projects": 1, "tasks": 1 },
    { "month": "2026-05", "projects": 2, "tasks": 2 },
    { "month": "2026-06", "projects": 3, "tasks": 8 },
    { "month": "2026-07", "projects": 3, "tasks": 11 },
    { "month": "2026-08", "projects": 3, "tasks": 11 },
    { "month": "2026-09", "projects": 3, "tasks": 12 },
    { "month": "2026-10", "projects": 2, "tasks": 11 },
    { "month": "2026-11", "projects": 3, "tasks": 9 },
    { "month": "2026-12", "projects": 1, "tasks": 4 }
  ]
}
```

### 12.2 Fields

| Field | Meaning | `null` means |
|---|---|---|
| `range.from/to` | The time axis, inclusive (WIB days) | never null |
| `range.today` | Where the "today" line goes | never null |
| `range.unit` | Column unit, `month` (a `week` view can come later) | never null |
| `projects[].key/code/name` | Project identity; `color` names the series token for its bars | `code` null = not registered in Weave yet (show only the name) |
| `lanes[].label` | Type of work: the row title | never null |
| `lanes[].division` | Division of the people doing it (Process, Automation, …) | never null |
| `lanes[].staffing` | Who, by role and count only, e.g. "2 Automation Engineer" | never null |
| `lanes[].parallel_projects` | Projects this lane's people carry at the same time, all projects counted | never null |
| `lanes[].parallel_note` | Extra text after the count, e.g. "3 ditampilkan" | nothing to add |
| `lanes[].peak_overlap` | Most projects running in this lane at the same moment, within the range | never null |
| `lanes[].overlaps[]` | Windows where `count` (2 or 3+) projects of this lane overlap | empty array = "Tidak ada overlap" |
| `items[].project` | Key into `projects` | never null |
| `items[].label` | What the work is (activity name) | never null |
| `items[].note` | Short status, e.g. "Rev.3 17 Nov", "ad-hoc" | no note |
| `items[].from` | Start day | never null |
| `items[].to` | End day (planned, or the last day worked) | still going with no planned end: draw the bar up to today and fade it |
| `items[].status` | `done` (ended before today) · `ongoing` (today is inside it) · `planned` (starts after today) | never null |
| `concurrency[]` | Per month: distinct projects (any lane) and distinct tasks active together | never null |

### 12.3 Screen layout (1920×1080, no scrolling)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ Beban kerja engineering   Paragon · IFF · Aminolat Egypt        ■Paragon ■IFF ■Aminolat       │
│ Status 24 Nov 2026 · [Data contoh]                    ▨ 2 proyek overlap  ▨ 3 proyek overlap │
├───────────────────────────┬──────┬──────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬────┬────┤
│ LANE / PIC                │ Jan  │ Feb  │ Mar │ Apr │ Mei │ Jun │ Jul │ Agu │ Sep │ Okt│ Nov│Des
├───────────────────────────┼──────┴──────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴────┴──┊─┴───┤
│ PROCESS ENGINEERING       │ Paragon            ██PID██████ ███Process Description███  ┊      │
│ 1 Process Engineer        │ IFF     ████PID█████████ ██Proc. Desc.██                ┊      │
│ 4 proyek bersamaan  ⚠ 2   │ Aminolat ██PID / Proc.Desc.                              ┊      │
├───────────────────────────┼────────────────────────────────────────────────────────┊──────┤
│ PLC PROGRAMMING           │ Paragon                                    ██HW config ad-hoc▸  │
│ 2 Automation Engineer     │ IFF               ██HW config██ ████Preliminary ladder████┊█    │
│ 5 proyek bersamaan  ⛔ 3   │ Aminolat                                         [▒3▒]████┊██   │
├───────────────────────────┼────────────────────────────────────────────────────────┊──────┤
│ …  IO List · HMI · Functional Analysis · Electrical Document                       ┊      │
├───────────────────────────┼────────────────────────────────────────────────────────┊──────┤
│ Proyek aktif bersamaan    │  2 │ 1 │ 1 │ 1 │ 2 │ 3 │ 3 │ 3 │ 3 │ 2 │ 3 │ 1                 │
│ Tugas aktif bersamaan     │  3 │ 1 │ 1 │ 1 │ 2 │ 8 │ 11│ 11│ 12│ 11│ 9 │ 4                 │
└───────────────────────────┴──────────────────────────────────────────────────────────────────┘
                                                      ┊ = hari ini (24 Nov)
```

| # | Part | Size | Content | Rules |
|---|---|---|---|---|
| 0 | Header | full width, ~70 px | Title, project names, "Status 24 Nov 2026", "Data contoh" badge while `demo`; on the right a legend for the 3 projects and the 2 overlap bands | Legend always shown (3 series). |
| 1 | Lane label column | 300 px | **LABEL** (caps, bold), `staffing`, "`parallel_projects` proyek bersamaan" (+ `parallel_note` in muted text), and an overlap badge: amber "! 2" or red "✕ 3" from `peak_overlap`, or a muted "Tidak ada overlap" | Badge text always has the mark plus the number. |
| 2 | Month header | rest, 1 column per month | Jan … Des (Indonesian short months) | Thin vertical grid line per month in `--line`. |
| 3 | Lanes | 6 lanes; each lane = its project sub-rows (only projects with items in that lane) | One sub-row per project: project name at the left edge (muted), bars on the timeline | Lane background alternates `--card` / `--bg`, 1 px `--line` between lanes. |
| 4 | Bars | 18 px tall, radius 4 px | From `from` to `to` (or to today when `to` is null). Label inside the bar when it fits, otherwise to the right of it, in `--ink` text (never in the bar colour). `note` follows the label after " · ". | Colour = the project's series token. `done`: solid. `ongoing`: solid up to today, then 45° hatch to `to`, with a ▸ marker when `to` is null. `planned`: outline only, hatched. Bars of one project in one sub-row that overlap in time stack in two thin rows (9 px each) instead of covering each other. |
| 5 | Overlap bands | full lane height, behind the bars | Each `overlaps[]` window: `--warn` at 18% opacity for 2, `--danger` at 18% for 3+. Small label at the top of the band: "2 proyek" / "3 proyek" | Bands sit behind the bars; the bar colours stay readable. |
| 6 | Today line | full height of the lanes | 2 px dashed vertical line in `--ink` at `range.today`, with the label "Hari ini · 24 Nov" at the top | Not red, so it can't be confused with a 3-project overlap. |
| 7 | Concurrency strips | 2 rows × 28 px | "Proyek aktif bersamaan" and "Tugas aktif bersamaan", one cell per month with the number in it | Projects cell: neutral at 1, amber with ! at 2, red with ✕ at 3+. Tasks cell: a single-hue ramp (lighter = fewer), with the number always written in the cell. |

**Fitting on one screen:** the demo has 6 lanes and 15 project sub-rows. At 1080 px that's about 44 px per sub-row (18 px bar plus padding), which fits with the header and strips. With more than 18 sub-rows, shrink bars to 14 px; with more than 24, split into two slides (Process + Automation).

### 12.4 Display rules

- **Dates in labels:** "2 Mei – 30 Jul". Month names in Indonesian (Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des).
- **Bar position:** day-accurate, as (date − range.from) / (range.to − range.from) of the timeline width. Month columns are drawn to the real number of days in the month.
- **Labels:** truncate with "…" when there's no room inside or to the right; the full text goes in the bar's `title` (on a laptop, hover shows it).
- **Project colours** are fixed by the order of `projects[]`: series-1, series-7, series-3, then series-2, series-5, series-6. Amber and red are kept for overlaps only, never for a project.
- **Empty lane** (no items for any project in the range): keep the label column and show "— tidak ada tugas —" in muted text across the timeline.

### 12.5 Slideshow

- **Rotation:** slide 1 (Ringkasan) 30 s, then slide 2 (Beban kerja) 30 s, then repeat. A 400 ms cross-fade, no motion beyond that.
- **Rotation is off** when `?slide=1` or `?slide=2` is in the URL, which shows just that slide (for a laptop or for checking).
- **Data:** both slides use the same 5-minute poll; slide 2 reads `workload` from the same response once it exists (§12.7), and `DEMO_WORKLOAD` until then.

### 12.6 Empty state

When `lanes` is empty: centre the text **"Belum ada data beban kerja"**, with "Muncul setelah proyek punya daftar tugas dan jadwal." under it, and keep the header.

### 12.7 Where the live data will come from (not built yet)

`weave_dashboard` will get a `workload` field with the same shape as §12.1, built in the database from:

| Part | Source |
|---|---|
| Lanes | A fixed list of work types (Process Engineering, IO List, PLC, HMI, Functional Analysis, Electrical Document, …) that each project's task deliverables are mapped onto. **Still to be agreed.** |
| Bars (`from`/`to`) | Planned dates from the Microsoft Project XML, and actual first/last day with logged hours on the task in Weave |
| `note` | Short status note per task, kept by the PM in Weave |
| `staffing` | Count of people by role (attendance `position`) who logged hours in the lane; roles and counts only |
| `overlaps`, `parallel_projects`, `concurrency` | Calculated from the bars and the logged hours |

Until then the TV shows the demo data with the "Data contoh" badge, so nobody mistakes it for live numbers.
