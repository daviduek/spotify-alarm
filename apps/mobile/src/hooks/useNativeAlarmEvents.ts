import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { WakeAlarm } from '../../modules/wake-alarm';
import { recordAlarmEvent } from '../services/history';
import { logger } from '../services/logger';
import { useRuntimeStore } from '../state/runtimeStore';

/** Deterministic history id so fired/stopped events land on the same row even across process restarts. */
export const historyIdFor = (alarmId: string, firedAtEpochMs: number) => `${alarmId}:${Math.floor(firedAtEpochMs / 1000)}`;

/**
 * Bridges native alarm events into the JS runtime store, the history table and navigation.
 * Mounted once in the root layout.
 */
export function useNativeAlarmEvents(): void {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const firedAtByAlarm = useRef(new Map<string, number>());

  useEffect(() => {
    const { setActiveAlarm, pushEvent } = useRuntimeStore.getState();

    const openAlarmScreen = (id: string) => {
      if (pathnameRef.current?.startsWith('/alarm/')) return;
      router.push({ pathname: '/alarm/[id]', params: { id } });
    };

    const subs = [
      WakeAlarm.addListener('onAlarmFired', (e) => {
        logger.info('native_alarm_fired', { alarmId: e.id, snoozeCount: e.snoozeCount });
        firedAtByAlarm.current.set(e.id, e.firedAtEpochMs);
        setActiveAlarm({ id: e.id, firedAtEpochMs: e.firedAtEpochMs, snoozeCount: e.snoozeCount });
        pushEvent(`Fired · ${e.id.slice(0, 8)} · snooze #${e.snoozeCount}`);
        void recordAlarmEvent({
          id: historyIdFor(e.id, e.firedAtEpochMs),
          alarmId: e.id,
          scheduledAt: new Date(e.firedAtEpochMs).toISOString(),
          firedAt: new Date(e.firedAtEpochMs).toISOString(),
          snoozeCount: e.snoozeCount,
          audioSourceUsed: 'fallback',
        });
        openAlarmScreen(e.id);
      }),
      WakeAlarm.addListener('onAlarmStopped', (e) => {
        logger.info('native_alarm_stopped', { alarmId: e.id, reason: e.reason });
        setActiveAlarm(null);
        pushEvent(`Stopped · ${e.id.slice(0, 8)} · ${e.reason}`);
        const firedAt = firedAtByAlarm.current.get(e.id);
        if (firedAt) {
          void recordAlarmEvent({
            id: historyIdFor(e.id, firedAt),
            alarmId: e.id,
            scheduledAt: new Date(firedAt).toISOString(),
            stoppedAt: new Date().toISOString(),
            snoozeCount: 0,
          });
          firedAtByAlarm.current.delete(e.id);
        }
      }),
      WakeAlarm.addListener('onAlarmSnoozed', (e) => {
        logger.info('native_alarm_snoozed', { alarmId: e.id, untilEpochMs: e.untilEpochMs });
        setActiveAlarm(null);
        pushEvent(`Snoozed · ${e.id.slice(0, 8)}${e.untilEpochMs ? ` · until ${new Date(e.untilEpochMs).toLocaleTimeString()}` : ''}`);
      }),
      WakeAlarm.addListener('onAlarmStateChanged', (e) => {
        pushEvent(`State · ${e.id.slice(0, 8)} → ${e.state}`);
      }),
    ];

    // Cold start while an alarm is ringing (Android notification tap without deep link).
    void WakeAlarm.getActiveAlarm().then((active) => {
      if (active) {
        setActiveAlarm(active);
        openAlarmScreen(active.id);
      }
    });

    return () => subs.forEach((s) => s.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
