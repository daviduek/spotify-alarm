'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  describeSource,
  formatRecurrence,
  formatTime,
  formatTimeUntil,
  nextAlarmAmong,
  primarySource,
  relativeDayLabel,
  wakeSoundName,
  type Alarm,
} from '@wake/domain';

import { deleteAlarmRow, fetchAlarms, setAlarmEnabled } from '../lib/data/alarms';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { Switch } from './Switch';

export function AlarmsDashboard({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [alarms, setAlarms] = useState<Alarm[] | null>(null);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAlarms(await fetchAlarms(supabase, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load alarms');
    }
  }, [supabase, userId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = async (alarm: Alarm, enabled: boolean) => {
    setAlarms((prev) => prev?.map((a) => (a.id === alarm.id ? { ...a, enabled } : a)) ?? null);
    try {
      await setAlarmEnabled(supabase, userId, alarm.id, enabled);
    } catch {
      void load();
    }
  };

  const remove = async (alarm: Alarm) => {
    if (!confirm(`Delete “${alarm.name}”?`)) return;
    setAlarms((prev) => prev?.filter((a) => a.id !== alarm.id) ?? null);
    await deleteAlarmRow(supabase, userId, alarm.id).catch(() => void load());
  };

  const next = alarms ? nextAlarmAmong(alarms, now) : null;

  return (
    <main>
      <div className="next-alarm">
        {next ? (
          <>
            <div className="big">{formatTime(next.alarm.hour, next.alarm.minute)}</div>
            <div className="sub">
              Next alarm · {relativeDayLabel(next.at, now)} · in {formatTimeUntil(next.at, now)}
            </div>
          </>
        ) : (
          <>
            <div className="big" style={{ fontSize: 64, opacity: 0.5 }}>--:--</div>
            <div className="sub">No alarm scheduled</div>
          </>
        )}
      </div>

      <div className="row-between" style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Your alarms</h1>
        <Link href="/app/alarms/new" className="btn btn-primary" style={{ minHeight: 40 }}>
          + New alarm
        </Link>
      </div>

      {error ? <p className="alert error" style={{ marginTop: 12 }}>{error}</p> : null}

      {alarms === null ? (
        <p className="sub" style={{ marginTop: 24 }}>Loading…</p>
      ) : alarms.length === 0 ? (
        <div className="section" style={{ marginTop: 20, padding: 28, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px' }}>No alarms yet.</p>
          <Link href="/app/alarms/new" className="btn btn-primary">Create your first alarm</Link>
        </div>
      ) : (
        <div className="alarm-list">
          {alarms.map((alarm) => {
            const source = primarySource(alarm.audioPlan);
            return (
              <div key={alarm.id} className={`alarm-card ${alarm.enabled ? '' : 'off'}`}>
                <Link href={`/app/alarms/${alarm.id}`} style={{ flex: 1 }}>
                  <div className="time">{formatTime(alarm.hour, alarm.minute)}</div>
                  <div className="meta">
                    <span>{alarm.name}</span>
                    <span>·</span>
                    <span>{formatRecurrence(alarm.recurrence)}</span>
                    <span>·</span>
                    <span>{source ? describeSource(source, wakeSoundName) : 'Wake sound'}</span>
                  </div>
                </Link>
                <Switch checked={alarm.enabled} onChange={(v) => void toggle(alarm, v)} label={`Enable ${alarm.name}`} />
                <button className="btn btn-ghost" style={{ minHeight: 38, padding: '0 10px', fontSize: 18 }} aria-label={`Delete ${alarm.name}`} onClick={() => void remove(alarm)}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="sub" style={{ marginTop: 28, textAlign: 'center', fontSize: 13 }}>
        Open <Link href="/app/clock">Clock mode</Link> and keep the tab open for the alarm to ring in this browser. For a locked phone, use the mobile app.
      </p>
    </main>
  );
}
