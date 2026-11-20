import { NextRequest, NextResponse } from 'next/server';
import { verifyViewer } from '@/lib/apiAuth';
import { planManualMerge, type MergeRow } from '@/lib/manualMerge';
import { SCREENSHOT_BUCKET, slug } from '@/lib/screenshots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLS = 'id,user_id,log_date,project_id,hours,description,custom_project_name';

// POST { name, projectId } — admin only. Folds every manual entry named `name` (case/spacing ignored)
// into the registered project, moving their screenshots along, and records it in the admin log.
export async function POST(request: NextRequest) {
  const viewer = await verifyViewer(request);
  if (!viewer?.isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, projectId } = await request.json().catch(() => ({}));
  const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!key || typeof projectId !== 'string' || !projectId) return NextResponse.json({ error: 'name, projectId' }, { status: 400 });

  const { db } = viewer;
  const { data: project } = await db.from('projects').select('id,project_code,name').eq('id', projectId).single();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Narrow on the server with ilike, then match exactly (trimmed, case-insensitive) here.
  const { data: candidates, error: e1 } = await db.from('work_logs').select(COLS)
    .is('project_id', null).eq('category', 'project').eq('is_leave', false)
    .ilike('custom_project_name', `%${key.replace(/[%_\\]/g, '_')}%`); // wildcard chars become "any one char"
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const manual = ((candidates ?? []) as MergeRow[]).filter(r => (r.custom_project_name || '').trim().toLowerCase() === key);
  if (!manual.length) return NextResponse.json({ merged: 0 });

  const users = [...new Set(manual.map(r => r.user_id))];
  const dates = [...new Set(manual.map(r => r.log_date))];
  const { data: linked, error: e2 } = await db.from('work_logs').select(COLS)
    .eq('project_id', projectId).in('user_id', users).in('log_date', dates);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const plan = planManualMerge(manual, (linked ?? []) as MergeRow[], projectId);
  if (plan.relink.length) {
    const { error } = await db.from('work_logs').update({ project_id: projectId, custom_project_name: null, custom_project_code: null }).in('id', plan.relink);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  for (const a of plan.add) {
    const { error } = await db.from('work_logs').update({ hours: a.hours, description: a.description || null }).eq('id', a.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (plan.remove.length) {
    const { error } = await db.from('work_logs').delete().in('id', plan.remove);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Screenshots live under <user>/<date>/m-<name>; the registered project's folder is p-<id>.
  let movedShots = 0;
  const bucket = db.storage.from(SCREENSHOT_BUCKET);
  const folders = new Set(manual.map(r => `${r.user_id}/${r.log_date}|${slug((r.custom_project_name || '').trim())}`));
  for (const f of folders) {
    const [dir, s] = f.split('|');
    const { data: files } = await bucket.list(`${dir}/m-${s}`, { limit: 1000 });
    for (const file of files ?? []) {
      if (!file.id) continue; // sub-folder placeholder
      const { error } = await bucket.move(`${dir}/m-${s}/${file.name}`, `${dir}/p-${slug(projectId)}/${file.name}`);
      if (!error) movedShots++;
    }
  }

  await db.from('admin_logs').insert({
    admin_id: viewer.id, action: 'MERGE_MANUAL_PROJECT',
    details: { manual_name: name.trim(), project_id: projectId, project_code: project.project_code, project_name: project.name, entries: manual.length, combined: plan.remove.length, screenshots: movedShots },
  });
  return NextResponse.json({ merged: manual.length, combined: plan.remove.length, screenshots: movedShots });
}
