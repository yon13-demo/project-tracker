"""One-time import of a project's engineering task list from its "Internal Project_Follow-up_<project>.xlsx".

    python -I scripts/import_followup_xlsx.py "<path to xlsx>" <project_code> [out.sql]

Reads the "Process Eng", "Elec & Automation Eng" and "Mechanical Eng" sheets and writes a SQL file
(default: next to the xlsx, so it stays out of git) that creates the project's tasks in Weave.
Run that file once in the Weave Supabase SQL Editor; it refuses to run if the project already has tasks.

What is taken over:
  - deliverables (the numbered rows of each sheet's top table) and their tasks from "DETAIL PROGRESS";
    "x.y.z" rows become sub-tasks of the "x.y" row above them
  - each task's current progress, snapped to the 0 / 20 / 50 / 80 / 100% ladder
  - fixed weights written in the deliverable formulas, e.g. =(J14*95%)+(J15*5%)
  - document type (DWG, PDF, Excel …)
Not taken over: PIC names, status notes, dates (dates come from Microsoft Project later).

Task numbers are generated from the order in the sheet ("2.10" is often stored by Excel as the number 2.1).
"""
import re
import sys
import uuid
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings('ignore')

SHEETS = {'Process Eng': 'process', 'Elec & Automation Eng': 'electrical_automation', 'Mechanical Eng': 'mechanical'}
STEPS = [0, 0.2, 0.5, 0.8, 1]


def snap(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0
    return min(STEPS, key=lambda s: (abs(s - x), s))


def text(v):
    return '' if v is None else str(v).strip()


def is_int_label(v):
    return isinstance(v, (int, float)) and float(v).is_integer() or (isinstance(v, str) and v.strip().isdigit())


def parse_sheet(ws_f, ws_v, discipline):
    """Returns deliverables: [{name, weight_by_row: {row: w}, tasks: [{row, name, doc, progress, children: [...]}]}]"""
    rows = list(range(1, ws_f.max_row + 1))
    cell = lambda r, c: ws_f.cell(r, c).value
    val = lambda r, c: ws_v.cell(r, c).value
    detail = next((r for r in rows if text(cell(r, 2)).upper() == 'DETAIL PROGRESS'), None)
    if detail is None:
        raise SystemExit(f'{ws_f.title}: no "DETAIL PROGRESS" row')

    # Top table: number → (name, formula of its overall cell). The overall column is the one headed "OVERALL (%)".
    header_row = next(r for r in rows if text(cell(r, 3)).upper() == 'DELIVERABLE ITEM')
    overall_col = next(c for c in range(1, 12) if text(cell(header_row, c)).upper().startswith('OVERALL'))
    summary = {}
    for r in range(header_row + 1, detail):
        if is_int_label(cell(r, 2)) and text(cell(r, 3)):
            summary[int(float(cell(r, 2)))] = (text(cell(r, 3)), text(cell(r, overall_col)))

    deliverables = []
    current = None
    progress_col = None
    for r in range(detail + 1, ws_f.max_row + 1):
        b, c, d = cell(r, 2), text(cell(r, 3)), text(cell(r, 4))
        if is_int_label(b) and d.upper() == 'DOCUMENT':  # section header: "2 | WIRING DIAGRAM | DOCUMENT | PIC | …"
            n = int(float(b))
            # "PROGRES (%)", not the "PROGRESS STATUS" note column next to it
            progress_col = next(col for col in range(5, 14) if text(cell(r, col)).upper().startswith('PROGRES') and '%' in text(cell(r, col)))
            name, formula = summary.get(n, (c.title(), ''))
            weights = {int(row): float(w) for row, w in re.findall(r'\$?[A-Z]+\$?(\d+)\s*\*\s*([\d.]+)%', formula)}
            current = {'number': n, 'name': name, 'weights': weights, 'tasks': []}
            deliverables.append(current)
            continue
        if current is None or not c or b is None:
            continue
        task = {'row': r, 'name': c, 'doc': d or None, 'progress': snap(val(r, progress_col)), 'children': []}
        label = text(b)
        if isinstance(b, str) and label.count('.') >= 2 and current['tasks']:
            current['tasks'][-1]['children'].append(task)  # "7.5.1" under "7.5"
        else:
            current['tasks'].append(task)
    for dl in deliverables:
        dl['discipline'] = discipline
    return deliverables


def sql_str(v):
    return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"


def build_sql(all_deliverables, project_code, source):
    lines = []
    add = lines.append

    def insert(tid, parent, dl, wbs, name, doc, weight, order, progress):
        add(f"  insert into public.project_tasks (id, project_id, parent_id, discipline, wbs, name, doc_type, weight, sort_order, progress) values "
            f"('{tid}', v_project, {sql_str(parent)}, '{dl['discipline']}', '{wbs}', {sql_str(name)}, {sql_str(doc)}, "
            f"{'null' if weight is None else weight}, {order}, {progress});")

    counts = {}
    for dl in all_deliverables:
        did = str(uuid.uuid4())
        insert(did, None, dl, str(dl['number']), dl['name'], None, None, dl['number'], 0)
        for i, t in enumerate(dl['tasks'], 1):
            tid = str(uuid.uuid4())
            wbs = f"{dl['number']}.{i}"
            insert(tid, did, dl, wbs, t['name'], t['doc'], dl['weights'].get(t['row']), i, t['progress'] if not t['children'] else 0)
            for j, ch in enumerate(t['children'], 1):
                insert(str(uuid.uuid4()), tid, dl, f'{wbs}.{j}', ch['name'], ch['doc'], dl['weights'].get(ch['row']), j, ch['progress'])
        counts[dl['discipline']] = counts.get(dl['discipline'], 0) + 1 + sum(1 + len(t['children']) for t in dl['tasks'])

    head = [
        f'-- Weave: task list for project {project_code}, imported from {Path(source).name}.',
        '-- Run once in the Weave Supabase SQL Editor. Refuses to run if the project already has tasks.',
        f"-- {', '.join(f'{k}: {v}' for k, v in counts.items())} rows (deliverables + tasks).",
        'do $import$',
        'declare v_project uuid;',
        'begin',
        f"  select id into v_project from public.projects where project_code = {sql_str(project_code)};",
        f"  if v_project is null then raise exception 'project {project_code} not found'; end if;",
        "  if exists (select 1 from public.project_tasks where project_id = v_project) then",
        f"    raise exception 'project {project_code} already has tasks; nothing imported';",
        '  end if;',
    ]
    return '\n'.join(head + lines + ['end', '$import$;', '']), counts


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, code = sys.argv[1], sys.argv[2]
    out = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(src).with_name(f'import-tasks-{code}.sql')
    wb_f = openpyxl.load_workbook(src, data_only=False)
    wb_v = openpyxl.load_workbook(src, data_only=True)
    deliverables = []
    for sheet, discipline in SHEETS.items():
        if sheet in wb_f.sheetnames:
            deliverables += parse_sheet(wb_f[sheet], wb_v[sheet], discipline)
    sql, counts = build_sql(deliverables, code, src)
    out.write_text(sql, encoding='utf8')
    print(f'wrote {out}')
    for dl in deliverables:
        w = f" weights={sorted(set(dl['weights'].values()))}" if dl['weights'] else ''
        n = sum(1 + len(t['children']) for t in dl['tasks'])
        print(f"  {dl['discipline']:<22} {dl['number']:>2} {dl['name']:<28} {n:>3} tasks{w}")


if __name__ == '__main__':
    main()
