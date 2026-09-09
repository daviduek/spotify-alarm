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

import { deleteAlarmRow, ensureFlushLoop, fetchAlarms, setAlarmEnabled } from '../lib/data/offlineAlarms';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { Switch } from './Switch';

const STR: Record<Locale, {
  loadError: string;
  confirmDelete: (name: string) => string;
  nextAlarm: string;
  inWord: string;
  noAlarm: string;
  yourAlarms: string;
  newAlarm: string;
  loading: string;
  noAlarmsYet: string;
  createFirst: string;
  wakeSound: string;
  enable: (name: string) => string;
  delete: (name: string) => string;
  tipBefore: string;
  tipLink: string;
  tipAfter: string;
  onboardTitle: string;
  onboard1: string;
  onboard2: string;
  onboard3: string;
}> = {
  en: {
    loadError: 'Could not load alarms',
    confirmDelete: (name) => `Delete “${name}”?`,
    nextAlarm: 'Next alarm',
    inWord: 'in',
    noAlarm: 'No alarm scheduled',
    yourAlarms: 'Your alarms',
    newAlarm: '+ New alarm',
    loading: 'Loading…',
    noAlarmsYet: 'No alarms yet.',
    createFirst: 'Create your first alarm',
    wakeSound: 'Wake sound',
    enable: (name) => `Enable ${name}`,
    delete: (name) => `Delete ${name}`,
    tipBefore: 'Open ',
    tipLink: 'Clock mode',
    tipAfter: ' and keep the tab open for the alarm to ring in this browser. For a locked phone, use the mobile app.',
    onboardTitle: 'Welcome to Wake 👋',
    onboard1: 'Create an alarm: time, days and how gently it should wake you.',
    onboard2: 'Pick what you hear: a Wake sound, your own voice, or Spotify.',
    onboard3: 'At night, open Clock mode and keep the tab open — it always rings.',
  },
  es: {
    loadError: 'No se pudieron cargar las alarmas',
    confirmDelete: (name) => `¿Eliminar “${name}”?`,
    nextAlarm: 'Próxima alarma',
    inWord: 'en',
    noAlarm: 'Sin alarmas programadas',
    yourAlarms: 'Tus alarmas',
    newAlarm: '+ Nueva alarma',
    loading: 'Cargando…',
    noAlarmsYet: 'Todavía no hay alarmas.',
    createFirst: 'Crea tu primera alarma',
    wakeSound: 'Sonido de Wake',
    enable: (name) => `Activar ${name}`,
    delete: (name) => `Eliminar ${name}`,
    tipBefore: 'Abre el ',
    tipLink: 'modo Reloj',
    tipAfter: ' y deja la pestaña abierta para que la alarma suene en este navegador. Para un teléfono bloqueado, usa la app móvil.',
    onboardTitle: 'Bienvenido a Wake 👋',
    onboard1: 'Crea una alarma: hora, días y qué tan suave te despierta.',
    onboard2: 'Elige qué escuchar: un sonido Wake, tu propia voz o Spotify.',
    onboard3: 'A la noche, abre el modo Reloj y deja la pestaña abierta — siempre suena.',
  },
};

export function AlarmsDashboard({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const locale = useLocale();
  const t = STR[locale];
  const [alarms, setAlarms] = useState<Alarm[] | null>(null);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { alarms: list, fromCache } = await fetchAlarms(supabase, userId);
    // Offline with cached data: show the cache silently. Only surface the load
    // error when there is no cached data at all.
    if (fromCache && list.length === 0) {
      setError(t.loadError);
      return;
    }
    setError(null);
    setAlarms(list);
  }, [supabase, userId, t]);

  useEffect(() => {
    ensureFlushLoop(supabase);
    void load();
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [supabase, load]);

  const toggle = async (alarm: Alarm, enabled: boolean) => {
    setAlarms((prev) => prev?.map((a) => (a.id === alarm.id ? { ...a, enabled } : a)) ?? null);
    try {
      await setAlarmEnabled(supabase, userId, alarm.id, enabled);
    } catch {
      void load();
    }
  };

  const remove = async (alarm: Alarm) => {
    if (!confirm(t.confirmDelete(alarm.name))) return;
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
              {t.nextAlarm} · {relativeDayLabel(next.at, now, locale)} · {t.inWord} {formatTimeUntil(next.at, now)}
            </div>
          </>
        ) : (
          <>
            <div className="big" style={{ fontSize: 64, opacity: 0.5 }}>--:--</div>
            <div className="sub">{t.noAlarm}</div>
          </>
        )}
      </div>

      <div className="row-between" style={{ marginTop: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.yourAlarms}</h1>
        <Link href="/app/alarms/new" className="btn btn-primary" style={{ minHeight: 40 }}>
          {t.newAlarm}
        </Link>
      </div>

      {error ? <p className="alert error" style={{ marginTop: 12 }}>{error}</p> : null}

      {alarms === null ? (
        <p className="sub" style={{ marginTop: 24 }}>{t.loading}</p>
      ) : alarms.length === 0 ? (
        <div className="section" style={{ marginTop: 20, padding: '24px 20px' }}>
          <p style={{ margin: '0 0 14px', color: 'var(--text)', fontWeight: 600 }}>{t.onboardTitle}</p>
          <ol className="onboard-steps">
            <li>{t.onboard1}</li>
            <li>{t.onboard2}</li>
            <li>{t.onboard3}</li>
          </ol>
          <Link href="/app/alarms/new" className="btn btn-primary btn-block" style={{ marginTop: 18 }}>{t.createFirst}</Link>
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
                    <span>{formatRecurrence(alarm.recurrence, locale)}</span>
                    <span>·</span>
                    <span>{source ? describeSource(source, (id) => wakeSoundName(id, locale), locale) : t.wakeSound}</span>
                  </div>
                </Link>
                <Switch checked={alarm.enabled} onChange={(v) => void toggle(alarm, v)} label={t.enable(alarm.name)} />
                <button className="btn btn-ghost" style={{ minHeight: 38, padding: '0 10px', fontSize: 18 }} aria-label={t.delete(alarm.name)} onClick={() => void remove(alarm)}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="sub" style={{ marginTop: 28, textAlign: 'center', fontSize: 13 }}>
        {t.tipBefore}<Link href="/app/clock">{t.tipLink}</Link>{t.tipAfter}
      </p>
    </main>
  );
}
