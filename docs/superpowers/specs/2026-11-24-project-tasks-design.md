# Project tasks and progress: phase 1 design

Status: draft for review · 2026-11-24

## Goal

Measure progress on a project through the hours people log, instead of free-text descriptions.

The PM (admin) keeps each project's task list in Weave. When engineers log hours, they pick the task and can move its progress along a 0 / 20 / 50 / 80 / 100% scale. The PM approves those moves, and Weave rolls the approved progress up to deliverable, discipline and project level.

This replaces the hand-maintained per-discipline sheets in `Internal Project_Follow-up_<project>.xlsx`. Later phases add Microsoft Project dates and budget hours, which give earned hours vs actual hours.

## Decisions made

| Question | Decision |
|---|---|
| Where the task list lives | In Weave. The PM (admin) maintains it there. 2260301 is imported once from its Excel. |
| Who moves progress | The engineer, when logging hours. The PM (admin) approves or rejects. |
| Does a pending move count? | No. Only approved steps count toward progress. |
| Is a task required on project entries? | No, it's optional at first ("Tanpa tugas"). The share of hours with a task is shown, so it can become required later. |
| Scope now | The engineering disciplines: Process, Mechanical, Electrical & Automation. Procurement, Manufacturing and 3D come later, with their own ladders. |
| Budget hours and dates | Columns exist but stay empty until Microsoft Project is connected (phase 3). |
| Division | Read from the attendance system's `employees.department` and used to sort the task list: your own discipline first. Division is not the same as discipline; see §6. |
| Progress input | A horizontal segmented control showing 0 · 20 · 50 · 80 · 100%, each with its label. |

## 1. Data model (Weave database, migration `schema-v7-project-tasks.sql`)

### `project_tasks`: the task tree

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `project_id` | uuid → projects, on delete cascade | |
| `parent_id` | uuid → project_tasks, on delete cascade, nullable | null = a deliverable (top level within a discipline) |
| `discipline` | text, check in (`process`, `mechanical`, `electrical_automation`, `procurement`, `manufacturing`, `3d`) | Phase 1 UI offers only the first three |
| `wbs` | text | "2", "2.3", "7.5.1", shown before the name |
| `name` | text, not empty | |
| `doc_type` | text, nullable | DWG, PDF, Excel, Word, PPT … |
| `weight` | numeric > 0, nullable | null = equal share among its siblings |
| `sort_order` | int | order among siblings |
| `planned_start`, `planned_end` | date, nullable | phase 3 (Microsoft Project) |
| `budget_hours` | numeric(7,1), nullable | phase 3 |
| `progress` | numeric 0–1, not null default 0 | the **approved** progress. Only meaningful on leaf tasks; parents are calculated. |
| `archived_at` | timestamptz, nullable | archived tasks are hidden from pickers but keep their logged hours |
| `created_at`, `updated_at` | timestamptz | |

The tree has at most 4 levels: deliverable → task → sub-task → sub-sub-task (Excel goes to "7.5.1"). Only leaf tasks can be logged against or moved.

### `task_progress_updates`: proposals and their review

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `task_id` | uuid → project_tasks, cascade | |
| `user_id` | uuid → profiles, cascade | who proposed |
| `log_date` | date | the work day it was proposed with |
| `from_progress`, `to_progress` | numeric 0–1 | `from` = the approved progress at proposal time |
| `note` | text, nullable | optional, from the engineer |
| `status` | text: `pending` / `approved` / `rejected` / `superseded` | |
| `reviewed_by`, `reviewed_at`, `review_note` | nullable | |
| `created_at` | timestamptz | |

- **Unique** per (`task_id`, `user_id`, `log_date`) **while pending**. Re-saving the same day updates the pending proposal instead of adding another; saving a day deletes and re-inserts its work_logs, so proposals cannot hang off a work_log id.
- **Approving** sets `project_tasks.progress = to_progress`. Any other pending proposals on that task become `superseded`, because they were made against an older step.
- **History:** every approved row is a point in the progress history. That feeds the progress curve later.

### `work_logs.task_id`

- New nullable column `task_id → project_tasks (on delete set null)`. It's allowed only when `category = 'project'` and `project_id` is set, and the task must belong to that project. A trigger checks this.
- **Uniqueness** changes from `unique(user_id, log_date, project_id)` to two partial unique indexes:
  - (`user_id`, `log_date`, `project_id`) where `task_id is null and project_id is not null`
  - (`user_id`, `log_date`, `task_id`) where `task_id is not null`

  So one person can log IO List 3 h and Wiring Diagram 4 h on 2260301 on the same day. "Tanpa tugas" stays one row per project per day.
- `mergeSameProject` (lib/worklog.ts) merges by project **and** task.

### `profiles.division`

New nullable text column, filled by the attendance sync (§6). Admins can also set it by hand.

### Access (RLS)

| Table | Signed-in user | Admin | anon |
|---|---|---|---|
| `project_tasks` | read | all | none |
| `task_progress_updates` | read; insert/update **own pending** rows | all (review) | none |
| `work_logs.task_id` | as for work_logs today | as today | none |

## 2. Progress maths (database function `project_progress(project_id)`, also used by the app)

- **Leaf task:** `progress`, the approved value.
- **Parent** (sub-task group, then deliverable): the weighted average of its non-archived children. Weight is `weight`, or 1 when null. A task with no children uses its own progress.
- **Discipline:** the weighted average of its deliverables.
- **Project overall:** the weighted average of disciplines. Phase 1 uses equal weights across the disciplines that have tasks. A per-project discipline weight table comes later, when budget hours make it meaningful.
- **No rounding** inside the calculation. Display rounds to whole %.

This deliberately does **not** copy two things from the Excel:
- `ROUNDUP(…, 0)`, which shows any started P&ID as 100%.
- Duration-based discipline weights, which gave Process Engineering a weight of 0 because its start and end dates are the same.

Returned shape (per project), also exposed for the admin view:

```json
{ "overall": 0.64, "disciplines": [ { "discipline": "electrical_automation", "progress": 0.74, "deliverables": [ { "id": "…", "wbs": "2", "name": "Wiring Diagram", "progress": 1.0, "pending": 0 } ] } ],
  "hours": { "total": 736, "with_task": 412, "share_with_task": 0.56 } }
```

## 3. Logging hours with a task (EntryFields)

When the selected project has non-archived tasks:

1. A **task picker** appears under the project picker. It's a searchable list grouped by discipline › deliverable, showing `wbs name` and the doc type.
   - Order: the user's own discipline (from division) first, then the tasks they used most recently on this project, then everything else.
   - The first option is **Tanpa tugas** (no task).
2. Once a task is picked, a **progress row** appears:

   ```
   Progres   [ 0%    ][ 20%   ][ 50%      ][ 80%     ][ 100%    ]
             Belum    Mulai    Setengah    Hampir     Selesai
   ```
   - The approved step is filled in. If someone has a pending proposal, its step is outlined with "menunggu".
   - Tapping another step makes this entry's proposal. Tapping it again, or tapping the approved step, removes the proposal.
   - Going backwards is allowed but labelled "turun" (down), so the PM sees it.
   - It's a radiogroup that works with the keyboard (arrow keys). Labels sit under the numbers and stay readable on a phone.
3. **Description** stays, but is optional for project entries with a task.
4. **On Simpan:** the entries save as today. Then, for each entry with a changed step, the pending proposal for (task, me, date) is upserted. If the user removes the step change, their pending proposal is deleted.

The day timer and the "recent projects" chips keep working. A recent chip picks the project only; the task is chosen after.

**Screenshots:** a task entry gets its own folder key, `p-<project>-<first 8 of task id>`. Entries without a task keep `p-<project>`, so existing screenshots stay where they are.

## 4. PM maintenance: Admin → Proyek → project → **Tugas**

- **Tree view:** discipline sections, each with deliverables and their tasks. Each row shows wbs, name, doc type, progress bar and pending count.
- **Actions:** add a deliverable or task, rename, change wbs, doc type or weight, move up or down, and archive or restore. Deleting is allowed only while no hours are logged on the task; otherwise the task is archived.
- **Progress:** an approved value can be set directly. It's stored as an approved update by the admin, so history stays complete.
- The project row in the list shows the overall %.

## 5. Review queue: Admin → **Persetujuan progres**

- **List of pending proposals:** project, `wbs task`, from → to (with "turun" when it goes down), who, date, hours logged on that task that day, and the note.
- **Actions:** approve or reject per row with an optional note; "Setujui semua" per project; filter by project.
- **Logging:** every review is written to `admin_logs` as `APPROVE_TASK_PROGRESS` or `REJECT_TASK_PROGRESS`.
- **Visibility:** the engineer sees the result on the task's progress row next time: approved shows filled, rejected shows a "ditolak" note for 7 days.
- No email or push notification in phase 1.

## 6. Division (attendance system → Weave)

The attendance `employees.department` values are: Workshop, Process, Automation, Finance, Management, Sales, HR.

- **Attendance database (vendor):** `weave_attendance_day` also returns `department`. It's one more field in the reply, the function stays read-only, and no other columns leave the database. The user re-runs `supabase/attendance/weave-attendance-access.sql`.
- **Weave:** `/api/attendance-sync` writes the department into `profiles.division` (only when it changes).
- **Sorting the task picker:** Automation → electrical_automation, Process → process. Workshop → manufacturing is for later. Everyone else gets no preferred discipline, so all disciplines are equal in the picker.
- Division **only sorts**. Anyone can log against any task, because a Process person sometimes does mechanical work.

## 7. One-time import of 2260301

- **Script:** `scripts/import-followup-xlsx.mjs <xlsx> <project_code>`, run locally by the developer. It reads the "Process Eng", "Elec & Automation Eng" and "Mechanical Eng" sheets:
  - Header rows give the deliverables.
  - "DETAIL PROGRESS" rows give the tasks, numbered `x.y` / `x.y.z`.
  - Each task's current % becomes its initial approved progress, rounded to the nearest ladder step.
  - The fixed weights found in the formulas are kept: P&ID 23.5×4/5, Panel Arrangement 95/5, Automation Configuration 45/45/10.
- **Output:** a SQL file for the user to run in the Weave SQL Editor. Nothing is written by the developer.
- **Not imported:** PIC names, status notes and dates. The PIC isn't needed because hours say who worked; dates come from Microsoft Project later.
- The Excel files stay out of git (`ms-projects/` is ignored).

## 8. Out of scope for phase 1

- Procurement and Manufacturing ladders and sheets.
- Microsoft Project dates.
- Budget hours and earned hours.
- Progress on the TV dashboard (phase 2: add project progress to `weave_dashboard`).
- Notifications.
- Making the task required.

## 9. Testing

- **Vitest (lib):**
  - progress rollup (weights, archived children, empty disciplines, no rounding)
  - task ordering for the picker
  - mergeSameProject with tasks
  - entryKey with task
  - proposal diffing (which proposals to upsert or delete on save)
  - mapping division to discipline
  - the Excel row parser (on a small fixture built in the test, not the real file)
- **Local Postgres** (as for v6): the migration applies to v2…v6 and runs twice. Also check:
  - the uniqueness rules: two tasks on one project and day are allowed; a duplicate task is refused
  - the trigger refuses a task from another project
  - RLS: a user cannot approve, cannot edit someone else's proposal, and anon gets nothing
  - approve → progress and superseded
  - `project_progress` numbers match a hand count
- **Browser:** a preview page with fake data for the picker, the progress row and the admin screens, at phone and desktop width. Nothing is saved to real data.

## As built (2026-11-24)

- **Progress maths runs in TypeScript, not SQL:** `lib/tasks.ts` (`rollupProgress`, `projectProgress`) for the admin views. The SQL `project_progress()` function moves to phase 2, together with the TV dashboard.
- **Deleting tasks:** `work_logs.task_id` has no `on delete set null`. A task with logged hours can't be deleted, only archived, because nulling it could create two "no task" entries for one project and day. Deleting a project still removes everything.
- **Proposal note:** an entry's description becomes the proposal's note.
- **Day timer:** the timer has no task picker yet, so timer entries save without a task.
- **Import:** `scripts/import_followup_xlsx.py` (Python/openpyxl, not Node). It numbers tasks by position, because Excel stores "2.10" as 2.1.
- **Checked against the 2260301 workbook:** Mechanical 96.7% and Electrical & Automation 74.2% match. Process is 72% vs Excel's 76%, because Excel's Item Specification formula leaves out task 5.4 "Data Sheet".
