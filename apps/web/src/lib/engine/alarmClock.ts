'use client';

import { nextOccurrence, type Alarm } from '@wake/domain';

/**
 * Browser alarm scheduler (nightstand / "clock" mode). A precise setTimeout loop fires the alarm at
 * the next wall-clock occurrence WHILE THE TAB IS OPEN. This is the honest web limitation (a browser
 * cannot ring a closed tab); the UI tells the user to keep the tab open, and the native app covers
 * the locked-phone case. A Wake Lock keeps the screen on when granted.
 */
export type ClockCallbacks = {
  onFire: (alarm: Alarm) => void;
  onTick?: (next: { alarm: Alarm; at: Date } | null) => void;
};

export class AlarmClock {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private alarms: Alarm[] = [];
  private wakeLock: WakeLockSentinel | null = null;
  private firedKeys = new Set<string>();
  private running = false;

  constructor(private readonly cb: ClockCallbacks) {}

  setAlarms(alarms: Alarm[]): void {
    this.alarms = alarms.filter((a) => a.enabled);
    this.schedule();
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.requestWakeLock();
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.tickTimer = setInterval(() => this.cb.onTick?.(this.nextAcross()), 1000);
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.timer = null;
    this.tickTimer = null;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    void this.releaseWakeLock();
  }

  /** The soonest upcoming (alarm, time) across all enabled alarms. */
  nextAcross(now = new Date()): { alarm: Alarm; at: Date } | null {
    let best: { alarm: Alarm; at: Date } | null = null;
    for (const alarm of this.alarms) {
      const at = nextOccurrence(alarm, now);
      if (at && (!best || at < best.at)) best = { alarm, at };
    }
    return best;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (!this.running) return;
    const next = this.nextAcross();
    if (!next) return;
    const delay = Math.max(0, next.at.getTime() - Date.now());
    // Cap setTimeout at ~24 h and re-arm to avoid drift on long waits.
    const cap = 60 * 60 * 1000;
    this.timer = setTimeout(() => this.onTimer(), Math.min(delay, cap));
  }

  private onTimer(): void {
    const next = this.nextAcross();
    if (!next) return;
    if (next.at.getTime() - Date.now() <= 1000) {
      const key = `${next.alarm.id}:${Math.floor(next.at.getTime() / 60000)}`;
      if (!this.firedKeys.has(key)) {
        this.firedKeys.add(key);
        this.cb.onFire(next.alarm);
      }
    }
    this.schedule();
  }

  private handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      void this.requestWakeLock();
      this.schedule();
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
