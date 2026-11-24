import { describe, expect, it } from 'vitest';
import { fmtDelta, fmtHours, fmtPct, rateStatus, shortDay } from './dashboard';

describe('dashboard number formats (WEAVE_DASHBOARD.md §7)', () => {
  it('hours: thousands separator, 0 decimals from 100, else 1', () => {
    expect([2140, 312.5, 31.5, 8, 0].map(fmtHours)).toEqual(['2.140', '313', '31,5', '8', '0']);
  });
  it('percent: 1 decimal below 10, else whole; null is a dash', () => {
    expect([4.94, 82.6, 100, 0, null].map(v => fmtPct(v))).toEqual(['4,9%', '83%', '100%', '0%', '—']);
  });
  it('change: arrow and sign, null is a dash', () => {
    expect([4.9, -3.4, 0, null].map(fmtDelta)).toEqual([{ text: '▲ 4,9%', dir: 'up' }, { text: '▼ 3,4%', dir: 'down' }, { text: '0%', dir: 'flat' }, { text: '—', dir: 'none' }]);
  });
  it('status of a rate against good/warn thresholds', () => {
    expect([95, 90, 75, 69.9, null].map(v => rateStatus(v, 90, 70))).toEqual(['good', 'good', 'warn', 'bad', 'none']);
  });
  it('short Indonesian day label', () => {
    expect(shortDay('2026-11-24')).toBe('Sel, 24 Nov');
  });
});
