import { describe, expect, it } from 'vitest';
import { fillRemaining, remaining, resizeTo, snapHalf, trackHours } from './allocation';

describe('trackHours', () => {
  it('uses the attendance hours, rounded to half hours', () => {
    expect(trackHours(9.06, 0)).toBe(9);
    expect(trackHours(8.8, 3)).toBe(9);
  });
  it('grows to fit more logged hours than attendance', () => {
    expect(trackHours(8, 10)).toBe(10);
  });
  it('falls back to 8 hours without attendance', () => {
    expect(trackHours(null, 0)).toBe(8);
    expect(trackHours(null, 11.5)).toBe(11.5);
  });
});

describe('snapHalf', () => {
  it('rounds to half hours', () => {
    expect(snapHalf(2.2)).toBe(2);
    expect(snapHalf(2.3)).toBe(2.5);
    expect(snapHalf(-1)).toBe(0);
  });
});

describe('remaining', () => {
  it('is what is left of the track, never below zero', () => {
    expect(remaining([5, 3], 9)).toBe(1);
    expect(remaining([5, 6], 9)).toBe(0);
  });
});

describe('resizeTo', () => {
  it('moves the right edge of one block, snapping to half hours', () => {
    // blocks [5, 3] on a 9 h track; drag the first edge to 3.8 h from the start
    expect(resizeTo([5, 3], 0, 3.8, 9)).toEqual([4, 3]);
  });
  it('measures the edge from where the block starts', () => {
    expect(resizeTo([5, 3], 1, 7.1, 9)).toEqual([5, 2]);
  });
  it('keeps at least half an hour', () => {
    expect(resizeTo([5, 3], 1, 4, 9)).toEqual([5, 0.5]);
  });
  it('cannot push the blocks past the end of the track', () => {
    expect(resizeTo([5, 3], 0, 8.5, 9)).toEqual([6, 3]);
  });
});

describe('fillRemaining', () => {
  it('adds what is left to the chosen block', () => {
    expect(fillRemaining([5, 3], 1, 9)).toEqual([5, 4]);
    expect(fillRemaining([5, 4], 0, 9)).toEqual([5, 4]);
  });
});
