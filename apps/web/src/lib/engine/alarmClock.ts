'use client';

import { nextOccurrence, type Alarm } from '@wake/domain';

/**
 * Browser alarm scheduler (nightstand / "clock" mode). Fires the alarm at the next wall-clock
 * occurrence WHILE THE TAB IS OPEN. This is the honest web limitation (a browser cannot ring a
 * closed tab); the UI tells the user to keep the tab open, and the native app covers the
 * locked-phone case. A Wake Lock keeps the screen on when granted.
 *
 * Reliability rules:
 *  - The target occurrence is captured when armed; firing compares `Date.now()` against that
 *    captured instant, never against a freshly recomputed "next" (which would already be tomorrow).
 *  - A 1 s heartbeat and the visibilitychange event both re-check, so a throttled/suspended tab
 *    still rings as soon as the browser gives us CPU back (late window: 10 min).
 */
export type ClockCallbacks = {
  onFire: (alarm: Alarm, scheduledAt: Date) => void;
  onTick?: (next: { alarm: Alarm; at: Date } | null) => void;
};

const LATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TIMER_MS = 60 * 60 * 1000;

export class AlarmClock {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private alarms: Alarm[] = [];
  private target: { alarm: Alarm; at: Date } | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private firedKeys = new Set<string>();
  private running = false;

  constructor(private readonly cb: ClockCallbacks) {}

  setAlarms(alarms: Alarm[]): void {
    this.alarms = alarms.filter((a) => a.enabled);
    this.schedule();
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.requestWakeLock();
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.tickTimer = setInterval(() => {
      this.check();
      this.cb.onTick?.(this.target);
    }, 1000);
    this.schedule();
    this.cb.onTick?.(this.target);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.timer = null;
    this.tickTimer = null;
    this.target = null;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    void this.releaseWakeLock();
  }

  /** The soonest upcoming (alarm, time) across all enabled alarms. */
  nextAcross(now = new Date()): { alarm: Alarm; at: Date } | null {
    let best: { alarm: Alarm; at: Date } | null = null;
    for (const alarm of this.alarms) {
      const at = nextOccurrence(alarm, now);
      if (at && Number.isFinite(at.getTime()) && (!best || at < best.at)) best = { alarm, at };
    }
    return best;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.running) return;
    this.target = this.nextAcross();
    if (!this.target) return;
    const delay = Math.max(0, this.target.at.getTime() - Date.now());
    // Cap long waits and re-arm: avoids setTimeout overflow/drift and re-validates after sleep.
    this.timer = setTimeout(() => {
      this.timer = null;
      this.check();
    }, Math.min(delay + 5, MAX_TIMER_MS));
  }

  /** Fires the captured target if it is due (or overdue within the late window), then re-arms. */
  private check(): void {
    if (!this.running) return;
    const target = this.target;
    if (!target) {
      this.schedule();
      return;
    }
    const now = Date.now();
    const due = target.at.getTime();
    if (now < due) {
      // Timer fired early (clock adjustments, capped wait): re-arm for the remaining time.
      if (!this.timer) this.schedule();
      return;
    }
    const key = `${target.alarm.id}:${Math.floor(due / 60000)}`;
    if (now - due <= LATE_WINDOW_MS && !this.firedKeys.has(key)) {
      this.firedKeys.add(key);
      this.cb.onFire(target.alarm, target.at);
    }
    this.schedule();
  }

  private handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      void this.requestWakeLock();
      this.check();
    }
  };

  private async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible') {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      // Not supported or denied; the clock still works while the tab is focused.
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* ignore */
    }
    this.wakeLock = null;
  }
}
