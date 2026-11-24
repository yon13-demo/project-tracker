# Project tasks and progress: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Engineers log hours against project tasks and propose 0 / 20 / 50 / 80 / 100% progress. Admins maintain the task tree and approve the proposals. Progress rolls up per deliverable, discipline and project.

**Architecture:**
- Two new tables: `project_tasks` (a tree) and `task_progress_updates` (proposals and history).
- `work_logs.task_id`, with per-task uniqueness.
- Pure TypeScript helpers in `lib/tasks.ts` (steps, rollup, ordering, proposal diff), used by new components.
- Admin approval goes through a security-definer function, so approving and updating progress happen atomically and are logged.

**Tech Stack:** Next 14, Supabase (Postgres 15, RLS), Vitest, a Python openpyxl import script.

**Spec:** `docs/superpowers/specs/2026-11-24-project-tasks-design.md`

## Global Constraints

- Steps are exactly 0, 0.2, 0.5, 0.8, 1, labelled Belum / Mulai / Setengah / Hampir / Selesai (EN: Not started / Started / Mid progress / Near completion / Completed).
- Only approved progress counts. Tasks are optional on entries ("Tanpa tugas").
- Phase 1 disciplines are `process`, `mechanical` and `electrical_automation`. The column also allows `procurement`, `manufacturing` and `3d`.
- anon gets nothing on the new tables or functions (v6 lockdown stays).
- Existing screenshot keys (`p-<project>`) don't change for entries without a task.
- No real data is written by the developer. SQL is handed to the user to run.

## Review Focus

1. **Re-saving a day** (delete and re-insert work_logs) must not duplicate proposals or lose the task link. → tested by `proposalDiff` and loadDate round-trip tests.
2. **An app version without v7** (migration not yet run) must still load and save, so `task_id` must not be selected or sent when the column is missing. → column-detection fallback test in `worklog.test.ts`.
3. **Two entries for the same task on one day** merge (hours summed), while the same project with different tasks stays separate. → `mergeSameProject` tests.
4. **An archived task** stays visible on old entries but can't be picked for new ones. → `taskOptions` test.
5. **A parent whose children are all archived** counts as its own progress, never NaN. → rollup test.

---

### Task 1: Database migration v7 (+ local Postgres test)
**Files:** Create `supabase/schema-v7-project-tasks.sql`.
- `project_tasks`, `task_progress_updates`, `work_logs.task_id` with a same-project trigger and partial unique indexes, `profiles.division`.
- RLS as in spec §1.
- `review_task_progress(p_ids uuid[], p_approve boolean, p_note text)` and `set_task_progress(p_task uuid, p_progress numeric)`: security definer, admin only, writing `admin_logs`.
- Test on a local PG with the stubs from v6: applies twice, uniqueness, trigger, RLS (user can't approve, anon none), approve → progress + superseded.

### Task 2: lib/tasks.ts (TDD)
**Produces:**
- `PROGRESS_STEPS`
- `nearestStep(p: number): number`
- `type ProjectTask`, `type ProgressProposal`
- `rollupProgress(tasks) → Map<id, number>` and `projectProgress(tasks) → {overall, disciplines[]}`
- `taskOptions(tasks, projectId, {preferred?: Discipline, recentIds: string[]}) → TaskOption[]`
- `divisionToDiscipline(div) → Discipline | null`
- `proposalDiff(entries, pending, approved, userId, date) → {upsert[], remove[]}`
- `isLeafTask(tasks, id)`

### Task 3: worklog/screenshots changes (TDD)
- `EntryDraft`/`EntryInput` gain `task_id` and `progress` (a proposed step, or `null`).
- `buildWorkLogInserts` sends `task_id` only when `hasTasks`.
- `mergeSameProject` keys by project + task.
- `entryKey` → `p-<project>-<task8>` when there's a task.
- `LOG_COLUMNS_V7`.

### Task 4: Components
- `ProgressSteps.tsx` (radiogroup)
- `TaskPicker.tsx` (native select with optgroups)
- `EntryFields` wiring
- `ProjectTasksPanel.tsx` (admin tree editor)
- `ProgressReviewList.tsx` (approval queue)
- CSS and i18n

### Task 5: page.tsx data flow
- Detect v7 and load tasks, pending proposals and profile division.
- After `saveDay`, apply `proposalDiff`.
- Admin handlers for task CRUD, review and set progress.
- The project progress % in ProjectList.

### Task 6: Division
- The vendor SQL returns `department`.
- `fromAttendanceReply` keeps it, and the sync writes `profiles.division`.

### Task 7: Import script
- `scripts/import_followup_xlsx.py <xlsx> <project_code>` → SQL file.
- Checked against the 2260301 workbook: counts per discipline, weights, steps.

### Task 8: Verify
- tsc, vitest and the local PG run.
- A browser preview with fake data at 390 px and 1280 px.
- Commit, push, then the user runs the SQL.
