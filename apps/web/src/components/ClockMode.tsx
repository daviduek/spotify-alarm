'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  describeSource,
  fadeConfigFromPreset,
  formatTime,
  formatTimeUntil,
  planIncludesProvider,
  planIncludesRecording,
  primarySource,
  relativeDayLabel,
  wakeSoundName,
  type Alarm,
} from '@wake/domain';

import { fetchAlarms, setAlarmEnabled } from '../lib/data/alarms';
import { recordEvent } from '../lib/data/history';
import { signedUrl } from '../lib/data/recordings';
import { AlarmClock } from '../lib/engine/alarmClock';
import { WebAudioEngine } from '../lib/engine/webAudio';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';
import { soundUrl } from '../lib/sounds';
import { SpotifyBrowserPlayer } from '../lib/spotify/player';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

type Ringing = { alarm: Alarm; eventId: string; scheduledAt: Date; firedAt: number; snoozeCount: number };

/** Last alarms this device saw — lets Clock mode ring even if the server is unreachable at load. */
const ALARM_CACHE_KEY = 'wake_alarms_cache_v1';

const STR: Record<Locale, {
  wakeSoundPlaying: string;
  tapToAllowSound: string;
  startingSpotify: string;
  spotifyNotPlaying: string;
  yourRecording: string;
  myRecording: string;
  recordingFailed: string;
  recordingNotFound: string;
  hiddenTabWarning: string;
  soundNotAllowedWarning: string;
  snoozedUntil: (time: string) => string;
  alarmRinging: string;
  holdToStopAria: string;
  keepHolding: string;
  holdToStop: string;
  snoozeButton: (minutes: number) => string;
  nextAlarm: string;
  inWord: string;
  noAlarm: string;
  clockArmed: string;
  armedHint: string;
  disarm: string;
  armHint: string;
  enableFirst: string;
  armClockMode: string;
  footerBefore: string;
  footerLink: string;
  footerAfter: string;
  testAlarm: string;
  spotifyNoDevice: string;
  spotifyPremium: string;
  spotifyNotConnected: string;
  spotifyGeneric: string;
  offlineWarning: string;
  checkTitle: string;
  checkAlarm: (time: string) => string;
  checkNoAlarm: string;
  checkSoundOk: string;
  checkSoundBlocked: string;
  checkFallback: string;
  checkSpotifyNotConnected: string;
  checkSpotifyOk: string;
  checkSpotifyFail: string;
  checkRecordingOk: string;
  checkRecordingMissing: string;
}> = {
  en: {
    wakeSoundPlaying: 'Wake sound playing',
    tapToAllowSound: 'Tap the screen to allow sound',
    startingSpotify: 'Wake sound playing · starting Spotify…',
    spotifyNotPlaying: "Spotify accepted the request but isn't playing. Your fallback alarm keeps ringing.",
    yourRecording: 'Your recording',
    myRecording: 'My recording',
    recordingFailed: 'Your recording could not play. Fallback sound is ringing.',
    recordingNotFound: 'Recording not found. Fallback sound is ringing.',
    hiddenTabWarning: 'This tab was hidden. Keep Wake in the foreground so the alarm can ring on time.',
    soundNotAllowedWarning: "Your browser didn't allow sound yet. If the alarm is silent, tap the screen when it rings.",
    snoozedUntil: (time) => `Snoozed until ${time}`,
    alarmRinging: 'Alarm ringing',
    holdToStopAria: 'Hold to stop the alarm',
    keepHolding: 'KEEP HOLDING…',
    holdToStop: 'HOLD TO STOP',
    snoozeButton: (minutes) => `SNOOZE ${minutes} MIN`,
    nextAlarm: 'Next alarm',
    inWord: 'in',
    noAlarm: 'No alarm scheduled',
    clockArmed: 'Clock armed · keep this tab open',
    armedHint: 'Wake will ring in this browser at the alarm time. The screen stays awake when your browser allows it.',
    disarm: 'Disarm',
    armHint: 'Turn this device into a nightstand clock. Tap once to allow sound, then keep the tab open.',
    enableFirst: 'Enable an alarm first',
    armClockMode: 'Arm clock mode',
    footerBefore: "Browsers can't ring a closed tab, so Clock mode needs the tab open and the screen on. For a real locked-phone alarm, install the Wake mobile app. Manage alarms in ",
    footerLink: 'Alarms',
    footerAfter: '.',
    testAlarm: 'Test alarm now',
    spotifyNoDevice: "Spotify couldn't start on this device. Your fallback alarm is playing.",
    spotifyPremium: 'Spotify playback needs Premium. Your fallback alarm is playing.',
    spotifyNotConnected: 'Spotify is not connected. Your fallback alarm is playing.',
    spotifyGeneric: "Spotify couldn't start. Your fallback alarm is playing instead.",
    offlineWarning: 'Could not reach the server — using the alarms saved on this device.',
    checkTitle: 'Before-sleep check',
    checkAlarm: (time) => `Next alarm set for ${time}`,
    checkNoAlarm: 'No enabled alarm found',
    checkSoundOk: 'Sound allowed by the browser',
    checkSoundBlocked: 'Sound not unlocked — tap the screen once',
    checkFallback: 'Fallback sound ready',
    checkSpotifyNotConnected: 'Spotify not connected — the fallback will ring',
    checkSpotifyOk: 'Spotify ready on this device',
    checkSpotifyFail: 'Spotify could not start here — the fallback will ring',
    checkRecordingOk: 'Your recording is available',
    checkRecordingMissing: 'Recording not found — the fallback will ring',
  },
  es: {
    wakeSoundPlaying: 'Sonido de Wake sonando',
    tapToAllowSound: 'Toca la pantalla para permitir el sonido',
    startingSpotify: 'Sonido de Wake sonando · iniciando Spotify…',
    spotifyNotPlaying: 'Spotify aceptó la solicitud pero no está reproduciendo. Tu alarma de respaldo sigue sonando.',
    yourRecording: 'Tu grabación',
    myRecording: 'Mi grabación',
    recordingFailed: 'Tu grabación no se pudo reproducir. El sonido de respaldo está sonando.',
    recordingNotFound: 'No se encontró la grabación. El sonido de respaldo está sonando.',
    hiddenTabWarning: 'Esta pestaña quedó oculta. Mantén Wake en primer plano para que la alarma pueda sonar a tiempo.',
    soundNotAllowedWarning: 'Tu navegador todavía no permitió el sonido. Si la alarma no suena, toca la pantalla cuando se active.',
    snoozedUntil: (time) => `Snooze hasta las ${time}`,
    alarmRinging: 'Alarma sonando',
    holdToStopAria: 'Mantén presionado para detener la alarma',
    keepHolding: 'SIGUE PRESIONANDO…',
    holdToStop: 'MANTÉN PARA DETENER',
    snoozeButton: (minutes) => `SNOOZE ${minutes} MIN`,
    nextAlarm: 'Próxima alarma',
    inWord: 'en',
    noAlarm: 'Sin alarmas programadas',
    clockArmed: 'Reloj activado · mantén esta pestaña abierta',
    armedHint: 'Wake sonará en este navegador a la hora de la alarma. La pantalla se mantiene encendida cuando tu navegador lo permite.',
    disarm: 'Desactivar',
    armHint: 'Convierte este dispositivo en un reloj de mesa. Toca una vez para permitir el sonido y deja la pestaña abierta.',
    enableFirst: 'Primero activa una alarma',
    armClockMode: 'Activar modo reloj',
    footerBefore: 'Los navegadores no pueden hacer sonar una pestaña cerrada, así que el modo Reloj necesita la pestaña abierta y la pantalla encendida. Para una alarma real con el teléfono bloqueado, instala la app móvil de Wake. Administra tus alarmas en ',
    footerLink: 'Alarmas',
    footerAfter: '.',
    testAlarm: 'Probar alarma ahora',
    spotifyNoDevice: 'Spotify no pudo iniciarse en este dispositivo. Tu alarma de respaldo está sonando.',
    spotifyPremium: 'La reproducción de Spotify necesita Premium. Tu alarma de respaldo está sonando.',
    spotifyNotConnected: 'Spotify no está conectado. Tu alarma de respaldo está sonando.',
    spotifyGeneric: 'Spotify no pudo iniciarse. Tu alarma de respaldo está sonando en su lugar.',
    offlineWarning: 'No se pudo conectar al servidor — usando las alarmas guardadas en este dispositivo.',
    checkTitle: 'Chequeo antes de dormir',
    checkAlarm: (time) => `Próxima alarma a las ${time}`,
    checkNoAlarm: 'No hay ninguna alarma activada',
    checkSoundOk: 'Sonido permitido por el navegador',
    checkSoundBlocked: 'Sonido no desbloqueado — toca la pantalla una vez',
    checkFallback: 'Sonido de respaldo listo',
    checkSpotifyNotConnected: 'Spotify no está conectado — sonará el respaldo',
    checkSpotifyOk: 'Spotify listo en este dispositivo',
    checkSpotifyFail: 'Spotify no pudo iniciarse aquí — sonará el respaldo',
    checkRecordingOk: 'Tu grabación está disponible',
    checkRecordingMissing: 'No se encontró la grabación — sonará el respaldo',
  },
};

/** Nightstand mode: keep this tab open and Wake rings at the alarm time in the browser. */
export function ClockMode({ userId, spotifyConnected }: { userId: string; spotifyConnected: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const audio = useMemo(() => new WebAudioEngine(), []);
  const spotify = useMemo(() => new SpotifyBrowserPlayer(), []);
  const locale = useLocale();
  const t = STR[locale];
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [armed, setArmed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [next, setNext] = useState<{ alarm: Alarm; at: Date } | null>(null);
  const [ringing, setRinging] = useState<Ringing | null>(null);
  const [status, setStatus] = useState('');
  const [warning, setWarning] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [checks, setChecks] = useState<{ ok: boolean; label: string }[] | null>(null);
  const clockRef = useRef<AlarmClock | null>(null);
  const armedRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const snoozeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringingRef = useRef<Ringing | null>(null);
  ringingRef.current = ringing;
  const tRef = useRef(t);
  tRef.current = t;

  const fireAlarm = useCallback(
    async (alarm: Alarm, scheduledAt: Date, snoozeCount = 0, eventId = crypto.randomUUID()) => {
      const firedAt = Date.now();
      setRinging({ alarm, eventId, scheduledAt, firedAt, snoozeCount });
      setStatus(t.wakeSoundPlaying);
      void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), firedAt: new Date(firedAt).toISOString(), snoozeCount, audioSourceUsed: 'fallback' });

      // One-shot alarms are consumed once they ring (otherwise they would ring again tomorrow).
      if (alarm.recurrence.type === 'once' && snoozeCount === 0) {
        setAlarmEnabled(supabase, userId, alarm.id, false)
          .then(() => setAlarms((list) => list.map((a) => (a.id === alarm.id ? { ...a, enabled: false } : a))))
          .catch(() => undefined);
      }

      const fade = alarm.fadeIn.enabled ? alarm.fadeIn : fadeConfigFromPreset('normal');
      const audible = await audio.startFallback(soundUrl(alarm.fallbackSoundId), alarm.fadeIn.enabled ? fade : { ...fade, enabled: false });
      if (!audible) setStatus(t.tapToAllowSound);

      const source = primarySource(alarm.audioPlan);
      if (source?.type === 'music' && planIncludesProvider(alarm.audioPlan, 'spotify')) {
        setStatus(t.startingSpotify);
        const outcome = await spotify.play(source.uri);
        if (outcome.success) {
          // Only silence the fallback once Spotify is *actually* producing audio.
          const playing = await spotify.confirmPlaying(outcome.via === 'web_playback' ? 8000 : 4000);
          if (playing) {
            audio.fadeOutFallback();
            setStatus(`Spotify · ${source.title}`);
            void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), providerAttempted: true, providerSucceeded: true, audioSourceUsed: 'music' });
          } else {
            setStatus(t.spotifyNotPlaying);
            void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), providerAttempted: true, providerSucceeded: false, providerFailureReason: 'not_playing' });
          }
        } else {
          setStatus(spotifyMessage(outcome.reason, t));
          void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), providerAttempted: true, providerSucceeded: false, providerFailureReason: outcome.reason });
        }
      } else if (source?.type === 'recording' && planIncludesRecording(alarm.audioPlan)) {
        // Always re-sign at fire time: stored signed URLs expire.
        const url = source.recordingId ? await recordingUrl(supabase, source.recordingId) : source.fileUri ?? null;
        if (url) {
          try {
            await audio.crossfadeToRecording(url);
            setStatus(`${t.yourRecording} · ${source.title ?? t.myRecording}`);
            void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), audioSourceUsed: 'recording' });
          } catch (error) {
            console.warn('recording playback failed', error);
            setStatus(t.recordingFailed);
          }
        } else {
          setStatus(t.recordingNotFound);
        }
      }
    },
    [audio, spotify, supabase, userId, t],
  );

  useEffect(() => {
    fetchAlarms(supabase, userId)
      .then((list) => {
        setAlarms(list);
        try {
          localStorage.setItem(ALARM_CACHE_KEY, JSON.stringify(list));
        } catch {
          /* storage unavailable */
        }
      })
      .catch(() => {
        // Offline / server error: fall back to the last alarms this device saw (local-first).
        try {
          const raw = localStorage.getItem(ALARM_CACHE_KEY);
          if (raw) {
            setAlarms(JSON.parse(raw) as Alarm[]);
            setWarning(tRef.current.offlineWarning);
          }
        } catch {
          /* ignore */
        }
      });
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [supabase, userId]);

  useEffect(() => {
    if (!clockRef.current) clockRef.current = new AlarmClock({ onFire: (a, at) => void fireAlarm(a, at), onTick: setNext });
    clockRef.current.setAlarms(alarms);
  }, [alarms, fireAlarm]);

  // Warn when the tab is hidden while armed (mobile browsers throttle or suspend hidden tabs).
  useEffect(() => {
    const onVisibility = () => {
      if (!armedRef.current) return;
      if (document.visibilityState === 'hidden') setWarning(t.hiddenTabWarning);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [t]);

  useEffect(
    () => () => {
      clockRef.current?.stop();
      if (snoozeTimer.current) clearTimeout(snoozeTimer.current);
      if (holdTimer.current) clearInterval(holdTimer.current);
      audio.stop();
      spotify.disconnect();
    },
    [audio, spotify],
  );

  const arm = async () => {
    // A user gesture unlocks audio autoplay for later (required on iOS Safari).
    const unlocked = await audio.unlock();
    if (!unlocked) setWarning(t.soundNotAllowedWarning);
    else setWarning('');
    await clockRef.current?.start();
    armedRef.current = true;
    setArmed(true);

    // Before-sleep check (spec §28/§29): verify tonight's plan while the user is still awake.
    const target = clockRef.current?.nextAcross() ?? null;
    const list: { ok: boolean; label: string }[] = [
      target ? { ok: true, label: t.checkAlarm(formatTime(target.at.getHours(), target.at.getMinutes())) } : { ok: false, label: t.checkNoAlarm },
      unlocked ? { ok: true, label: t.checkSoundOk } : { ok: false, label: t.checkSoundBlocked },
      { ok: true, label: t.checkFallback },
    ];
    if (target && planIncludesProvider(target.alarm.audioPlan, 'spotify')) {
      if (!spotifyConnected) list.push({ ok: false, label: t.checkSpotifyNotConnected });
      else {
        const ok = await spotify.init();
        list.push(ok ? { ok: true, label: t.checkSpotifyOk } : { ok: false, label: t.checkSpotifyFail });
      }
    } else if (spotifyConnected) {
      void spotify.init();
    }
    if (target) {
      const src = primarySource(target.alarm.audioPlan);
      if (src?.type === 'recording' && src.recordingId) {
        const url = await recordingUrl(supabase, src.recordingId);
        list.push(url ? { ok: true, label: t.checkRecordingOk } : { ok: false, label: t.checkRecordingMissing });
      }
    }
    setChecks(list);
  };

  const disarm = () => {
    clockRef.current?.stop();
    if (snoozeTimer.current) clearTimeout(snoozeTimer.current);
    snoozeTimer.current = null;
    armedRef.current = false;
    setArmed(false);
    setWarning('');
    setChecks(null);
  };

  const stop = useCallback(() => {
    audio.stop();
    void spotify.pause();
    const r = ringingRef.current;
    if (r) void recordEvent(supabase, userId, { id: r.eventId, alarmId: r.alarm.id, scheduledAt: r.scheduledAt.toISOString(), stoppedAt: new Date().toISOString(), snoozeCount: r.snoozeCount });
    setRinging(null);
    setHoldProgress(0);
  }, [audio, spotify, supabase, userId]);

  const snooze = useCallback(() => {
    const r = ringingRef.current;
    if (!r) return;
    const minutes = r.alarm.snooze.enabled ? r.alarm.snooze.durationMinutes : 0;
    audio.stop();
    void spotify.pause();
    setRinging(null);
    setHoldProgress(0);
    if (minutes > 0) {
      const at = new Date(Date.now() + minutes * 60_000);
      if (snoozeTimer.current) clearTimeout(snoozeTimer.current);
      snoozeTimer.current = setTimeout(() => {
        snoozeTimer.current = null;
        if (armedRef.current) void fireAlarm(r.alarm, r.scheduledAt, r.snoozeCount + 1, r.eventId);
      }, minutes * 60_000);
      void recordEvent(supabase, userId, { id: r.eventId, alarmId: r.alarm.id, scheduledAt: r.scheduledAt.toISOString(), snoozeCount: r.snoozeCount + 1 });
      setStatus(t.snoozedUntil(formatTime(at.getHours(), at.getMinutes())));
    }
  }, [audio, spotify, fireAlarm, supabase, userId, t]);

  const startHold = () => {
    if (holdTimer.current) return;
    const start = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 1000);
      setHoldProgress(p);
      if (p >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        holdTimer.current = null;
        stop();
      }
    }, 30);
  };
  const endHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldProgress(0);
  };

  const enabledCount = alarms.filter((a) => a.enabled).length;

  if (ringing) {
    const source = primarySource(ringing.alarm.audioPlan);
    const snoozeMinutes = ringing.alarm.snooze.enabled ? ringing.alarm.snooze.durationMinutes : 0;
    return (
      <div className="ringing" role="alertdialog" aria-label={t.alarmRinging} onClick={() => void audio.unlock()}>
        <div style={{ textAlign: 'center' }}>
          <div className="clock">{formatTime(now.getHours(), now.getMinutes())}</div>
          <div className="label">{ringing.alarm.name}</div>
          <div className="status">{source ? describeSource(source, (id) => wakeSoundName(id, locale), locale) : ''}</div>
          <div className="status">{status}</div>
        </div>
        <div className="controls">
          <button
            className="hold-stop"
            style={{ background: `linear-gradient(90deg, #fff ${holdProgress * 100}%, #d0d0d0 ${holdProgress * 100}%)`, touchAction: 'none' }}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={t.holdToStopAria}
          >
            {holdProgress > 0 ? t.keepHolding : t.holdToStop}
          </button>
          {snoozeMinutes > 0 ? (
            <button className="snooze-btn" onClick={snooze}>{t.snoozeButton(snoozeMinutes)}</button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main>
      <div className="next-alarm">
        <div className="big">{formatTime(now.getHours(), now.getMinutes())}</div>
        <div className="sub">
          {next ? <>{t.nextAlarm} · {next.alarm.name} · {relativeDayLabel(next.at, now, locale)} {t.inWord} {formatTimeUntil(next.at, now)}</> : t.noAlarm}
        </div>
      </div>

      {warning ? <p className="alert warn" role="status">{warning}</p> : null}

      <div className="section" style={{ padding: 20, textAlign: 'center' }}>
        {armed ? (
          <>
            <span className="badge ready"><span className="dot" style={{ background: 'var(--success)' }} />{t.clockArmed}</span>
            <p className="sub" style={{ margin: '14px 0' }}>{t.armedHint}</p>
            {checks ? (
              <div className="sleep-check" role="list" aria-label={t.checkTitle}>
                <span className="sleep-check-title">{t.checkTitle}</span>
                {checks.map((c) => (
                  <div role="listitem" key={c.label}>
                    <span className={c.ok ? 'ok' : 'warn'} aria-hidden="true">{c.ok ? '✓' : '⚠'}</span> <span>{c.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button className="btn btn-ghost" onClick={disarm}>{t.disarm}</button>
          </>
        ) : (
          <>
            <p className="sub" style={{ margin: '4px 0 16px' }}>{t.armHint}</p>
            <button className="btn btn-primary btn-block" onClick={() => void arm()} disabled={enabledCount === 0}>
              {enabledCount === 0 ? t.enableFirst : t.armClockMode}
            </button>
          </>
        )}
      </div>

      <div className="section" style={{ padding: 18 }}>
        <p className="sub" style={{ margin: 0, fontSize: 13 }}>
          {t.footerBefore}<Link href="/app">{t.footerLink}</Link>{t.footerAfter}
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          className="btn btn-ghost btn-block"
          onClick={async () => {
            const target = alarms.find((a) => a.enabled) ?? alarms[0];
            if (!target) return;
            await audio.unlock();
            void fireAlarm({ ...target, recurrence: { type: 'weekly', weekdays: [0, 1, 2, 3, 4, 5, 6] } }, new Date());
          }}
          disabled={alarms.length === 0}
        >
          {t.testAlarm}
        </button>
      </div>
    </main>
  );
}

async function recordingUrl(supabase: ReturnType<typeof getSupabaseBrowserClient>, recordingId: string): Promise<string | null> {
  const { data } = await supabase.from('recordings').select('storage_path').eq('id', recordingId).maybeSingle();
  if (!data) return null;
  return signedUrl(supabase, (data as { storage_path: string }).storage_path);
}

function spotifyMessage(reason: string, t: (typeof STR)[Locale]): string {
  if (reason === 'no_active_device') return t.spotifyNoDevice;
  if (reason === 'premium_required') return t.spotifyPremium;
  if (reason === 'not_connected' || reason === 'token 404') return t.spotifyNotConnected;
  return t.spotifyGeneric;
}
