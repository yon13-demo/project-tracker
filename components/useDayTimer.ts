'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adoptStoredState, rolloverDay, addItem as addItemFn, backToTimer as backToTimerFn, canOwn, createDay, detectAway, HEARTBEAT_MS,
  IDLE_DETECTOR_THRESHOLD_MS, markIdle, pause as pauseFn, readOwner, releaseOwner,
  resolveAway as resolveAwayFn, resume as resumeFn, saveState, clearState, startReview as startReviewFn,
  switchTo as switchToFn, tick, writeOwner, type AwayChoice, type DayTimerState, type TimerItem,
} from '@/lib/dayTimer';

type IdleDetectorLike = EventTarget & {
  userState: 'active' | 'idle' | null;
  screenState: 'locked' | 'unlocked' | null;
  start(opts: { threshold: number; signal: AbortSignal }): Promise<void>;
};
type IdleDetectorCtor = { new (): IdleDetectorLike; requestPermission(): Promise<'granted' | 'denied'> };

export type DayTimer = ReturnType<typeof useDayTimer>;

export function useDayTimer(userId: string) {
  const [state, setState] = useState<DayTimerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isOwner, setIsOwner] = useState(true);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [tabId] = useState(() => crypto.randomUUID());
  const idleAbort = useRef<AbortController | null>(null);
  const ownerRef = useRef(false);
  const stateRef = useRef<DayTimerState | null>(null);
  stateRef.current = state;

  // Persist every change made by the owning tab, but only after it has adopted the stored day.
  useEffect(() => {
    if (!loaded || !isOwner) return;
    if (state) saveState(window.localStorage, state);
    else clearState(window.localStorage, userId);
  }, [state, loaded, isOwner, userId]);

  // Single owner across tabs; other tabs show a read-only notice. Becoming the owner always
  // re-reads storage first, so an old in-memory copy can never overwrite newer work.
  useEffect(() => {
    const claim = () => {
      const t = Date.now();
      const ok = canOwn(readOwner(window.localStorage), tabId, t);
      if (ok) writeOwner(window.localStorage, { tabId, at: t });
      if (ok && !ownerRef.current) {
        const adopted = adoptStoredState(window.localStorage, userId, t);
        setState(adopted.state);
        setStaleNotice(adopted.staleDate);
        setLoaded(true);
      }
      if (!ok) setLoaded(false);
      ownerRef.current = ok;
      setIsOwner(ok);
    };
    const release = () => releaseOwner(window.localStorage, tabId);
    claim();
    const id = window.setInterval(claim, HEARTBEAT_MS);
    window.addEventListener('pagehide', release);
    return () => { window.clearInterval(id); window.removeEventListener('pagehide', release); release(); };
  }, [tabId, userId]);

  // Clock for display (1 s), day rollover after midnight, and heartbeat (every HEARTBEAT_MS of state.lastSeen).
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = stateRef.current;
      if (!isOwner || !s) return;
      const rolled = rolloverDay(s, t);
      if (rolled.state !== s) {
        setState(rolled.state);
        if (rolled.staleDate) setStaleNotice(rolled.staleDate);
      } else if (t - s.lastSeen >= HEARTBEAT_MS) {
        setState(tick(s, t));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isOwner]);

  const startIdleDetection = useCallback(async (askPermission: boolean) => {
    const Detector = (window as unknown as { IdleDetector?: IdleDetectorCtor }).IdleDetector;
    if (!Detector || idleAbort.current) return;
    try {
      if (askPermission) {
        if ((await Detector.requestPermission()) !== 'granted') return;
      } else {
        const status = await navigator.permissions.query({ name: 'idle-detection' as PermissionName });
        if (status.state !== 'granted') return;
      }
      const controller = new AbortController();
      const detector = new Detector();
      detector.addEventListener('change', () => {
        const t = Date.now();
        if (detector.screenState === 'locked') setState(s => s && markIdle(s, t));
        else if (detector.userState === 'idle') setState(s => s && markIdle(s, t - IDLE_DETECTOR_THRESHOLD_MS));
        else setState(s => s && detectAway(s, t));
      });
      await detector.start({ threshold: IDLE_DETECTOR_THRESHOLD_MS, signal: controller.signal });
      idleAbort.current = controller;
    } catch {
      // Idle detection is optional; sleep/closed gaps are still caught by the heartbeat.
    }
  }, []);

  useEffect(() => {
    void startIdleDetection(false);
    return () => { idleAbort.current?.abort(); idleAbort.current = null; };
  }, [startIdleDetection]);

  const apply = useCallback((fn: (s: DayTimerState, t: number) => DayTimerState) => {
    setState(s => (s ? fn(s, Date.now()) : s));
  }, []);

  return {
    state, now, isOwner, staleNotice,
    dismissStale: () => setStaleNotice(null),
    startDay: () => { setState(createDay(userId, Date.now())); void startIdleDetection(true); },
    addItem: (item: TimerItem, start: boolean) => apply((s, t) => {
      const next = addItemFn(s, item);
      return start ? switchToFn(next, item.id, t) : next;
    }),
    switchTo: (itemId: string) => apply((s, t) => switchToFn(s, itemId, t)),
    pause: () => apply(pauseFn),
    resume: () => apply(resumeFn),
    resolveAway: (choice: AwayChoice) => apply(s => resolveAwayFn(s, choice)),
    startReview: () => apply(startReviewFn),
    backToTimer: () => apply(backToTimerFn),
    finishDay: () => { setState(null); setStaleNotice(null); },
  };
}
