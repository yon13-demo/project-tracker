# Weave TV Dashboard: build spec

One 1920×1080 screen for a 55" TV in a slideshow. It shows how the team's work hours are spread across projects this week, whether yesterday's work was reported, and how logged hours compare with the attendance clock.

The page makes **one database call**, `weave_dashboard`, with the publishable key. Every total, average, % and ranking is computed inside the database, so the page only displays values. The response contains **no personal data**: no names, emails, badge numbers or per-person figures. Project numbers and names, client names included, are shown on purpose.

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

## 6. Screen layout (1920×1080, no scrolling)

A 12-column grid with 32 px padding and 24 px gaps. Row heights: header 88 px, KPI row 220 px, main row 440 px, bottom row 228 px.

| # | Section | Position | Fields | Chart | Colour / alert rules |
|---|---|---|---|---|---|
| 0 | Header | full width | `periods.week.iso_week`, `date`, `attendance.today.synced_at`, `generated_at` | text: "Weave · Minggu 48 · Rabu, 25 Nov 2026 · diperbarui 09:12" | Muted text. If `attendance.today.is_stale`, show an amber "Absensi belum diperbarui sejak HH:MM" badge with an icon. |
| 1 | Lapor kemarin | KPI 1 (3 cols) | `reporting.reported`, `expected`, `rate_pct`, `target_pct`, `date` | progress ring + "19 / 23" | Ring green when `rate_pct ≥ 90`, amber 70–89.9, red < 70. Subtitle "Senin, 24 Nov". |
| 2 | Jam minggu ini | KPI 2 (3 cols) | `hours.week`, `week_change_pct` | hero number + delta | Delta ▲ green when > 0, ▼ red when < 0, grey "—" when null. Note "sampai hari ini". |
| 3 | Jam bulan ini | KPI 3 (3 cols) | `hours.month`, `month_change_pct` | hero number + delta | Same rule as #2 |
| 4 | Streak tim | KPI 4 (3 cols) | `reporting.streak_days` | hero number + "hari kerja" | Green when ≥ 5, neutral 1–4, grey "0 · mulai lagi hari ini" when 0 |
| 5 | Top proyek bulan ini | main, 7 cols | `top_projects_month[]`, `other_projects_month_hours` | horizontal bars, max 8 + one grey "Proyek lain" bar | Single hue (sequential, not one colour per project). Label: code in bold, name, hours on the right, "· 9 orang" muted. Names longer than one line are truncated with "…". |
| 6 | Kategori minggu ini | main, 5 cols, top | `categories_week[]` | one 100% stacked bar + legend with hours and % | Fixed colours per category (same as the Weave app: Proyek, Quotation, Training, Lainnya). Hidden segments < 1%. |
| 7 | Absensi hari ini | main, 5 cols, bottom | `attendance.today.*` | 4 numbers in a row: Masuk · Masih di kantor · Cuti · Belum absen | "Belum absen" amber when > 0 after 09:00 WIB. Whole block 50% opacity + stale badge when `is_stale`. |
| 8 | Jam per minggu | bottom, 8 cols | `weekly_trend[]` | column chart, 8 weeks | Past weeks solid, current week (`partial`) hatched/outlined with a "berjalan" label. One axis only. |
| 9 | Tercatat vs absensi | bottom, 4 cols | `attendance.comparison.*` | big % + two thin bars (clocked vs logged) | `coverage_pct` green ≥ 90, amber 75–89.9, red < 75. Subtitle "Senin–Selasa · 42 hari-orang · 3 belum lapor". |
| 10 | Entri manual | footer chip inside #5 | `manual_projects_month.share_pct`, `entries` | small text chip | Amber when `share_pct` > 5 |

Status colours (green / amber / red) are always paired with an icon or text (▲ ▼ ✓ !), never colour alone. Minimum text size is 24 px; hero numbers are 96–120 px.

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
