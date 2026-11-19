// Allocation bar: the attendance day as one track, each work entry a block on it.
// Blocks sit side by side from the left; the rest of the track is unallocated (e.g. a break).

const DEFAULT_TRACK = 8;
const STEP = 0.5;

export const snapHalf = (h: number) => Math.max(0, Math.round(h / STEP) * STEP);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// Length of the track: attendance hours (rounded to half hours), or 8 h without attendance;
// never shorter than what is already logged.
export function trackHours(attendance: number | null, logged: number): number {
  const base = attendance != null && attendance > 0 ? snapHalf(attendance) : DEFAULT_TRACK;
  return Math.max(base, logged);
}

export const remaining = (hours: number[], track: number) => Math.max(0, track - sum(hours));

// Drag the right edge of block `index` to `edge` hours from the start of the track.
export function resizeTo(hours: number[], index: number, edge: number, track: number): number[] {
  const start = sum(hours.slice(0, index));
  const others = sum(hours) - hours[index];
  const max = Math.max(STEP, track - others);
  const next = Math.min(max, Math.max(STEP, snapHalf(edge - start)));
  return hours.map((h, i) => (i === index ? next : h));
}

export function fillRemaining(hours: number[], index: number, track: number): number[] {
  const left = remaining(hours, track);
  return hours.map((h, i) => (i === index ? h + left : h));
}
