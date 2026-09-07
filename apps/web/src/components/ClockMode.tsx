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
import { soundUrl } from '../lib/sounds';
import { SpotifyBrowserPlayer } from '../lib/spotify/player';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

type Ringing = { alarm: Alarm; eventId: string; scheduledAt: Date; firedAt: number; snoozeCount: number };

/** Nightstand mode: keep this tab open and Wake rings at the alarm time in the browser. */
export function ClockMode({ userId, spotifyConnected }: { userId: string; spotifyConnected: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const audio = useMemo(() => new WebAudioEngine(), []);
  const spotify = useMemo(() => new SpotifyBrowserPlayer(), []);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [armed, setArmed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [next, setNext] = useState<{ alarm: Alarm; at: Date } | null>(null);
  const [ringing, setRinging] = useState<Ringing | null>(null);
  const [status, setStatus] = useState('');
  const [warning, setWarning] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const clockRef = useRef<AlarmClock | null>(null);
  const armedRef = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const snoozeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringingRef = useRef<Ringing | null>(null);
  ringingRef.current = ringing;

  const fireAlarm = useCallback(
    async (alarm: Alarm, scheduledAt: Date, snoozeCount = 0, eventId = crypto.randomUUID()) => {
      const firedAt = Date.now();
      setRinging({ alarm, eventId, scheduledAt, firedAt, snoozeCount });
      setStatus('Wake sound playing');
      void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), firedAt: new Date(firedAt).toISOString(), snoozeCount, audioSourceUsed: 'fallback' });

      // One-shot alarms are consumed once they ring (otherwise they would ring again tomorrow).
      if (alarm.recurrence.type === 'once' && snoozeCount === 0) {
        setAlarmEnabled(supabase, userId, alarm.id, false)
          .then(() => setAlarms((list) => list.map((a) => (a.id === alarm.id ? { ...a, enabled: false } : a))))
          .catch(() => undefined);
      }

      const fade = alarm.fadeIn.enabled ? alarm.fadeIn : fadeConfigFromPreset('normal');
      const audible = await audio.startFallback(soundUrl(alarm.fallbackSoundId), alarm.fadeIn.enabled ? fade : { ...fade, enabled: false });
      if (!audible) setStatus('Tap the screen to allow sound');

      const source = primarySource(alarm.audioPlan);
      if (source?.type === 'music' && planIncludesProvider(alarm.audioPlan, 'spotify')) {
        setStatus('Wake sound playing · starting Spotify…');
        const outcome = await spotify.play(source.uri);
        if (outcome.success) {
          // Only silence the fallback once Spotify is *actually* producing audio.
          const playing = await spotify.confirmPlaying(outcome.via === 'web_playback' ? 8000 : 4000);
          if (playing) {
            audio.fadeOutFallback();
            setStatus(`Spotify · ${source.title}`);
            void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), providerAttempted: true, providerSucceeded: true, audioSourceUsed: 'music' });
          } else {
            setStatus("Spotify accepted the request but isn't playing. Your fallback alarm keeps ringing.");
            void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), providerAttempted: true, providerSucceeded: false, providerFailureReason: 'not_playing' });
          }
        } else {
          setStatus(spotifyMessage(outcome.reason));
          void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), providerAttempted: true, providerSucceeded: false, providerFailureReason: outcome.reason });
        }
      } else if (source?.type === 'recording' && planIncludesRecording(alarm.audioPlan)) {
        // Always re-sign at fire time: stored signed URLs expire.
        const url = source.recordingId ? await recordingUrl(supabase, source.recordingId) : source.fileUri ?? null;
        if (url) {
          try {
            await audio.crossfadeToRecording(url);
            setStatus(`Your recording · ${source.title ?? 'My recording'}`);
            void recordEvent(supabase, userId, { id: eventId, alarmId: alarm.id, scheduledAt: scheduledAt.toISOString(), audioSourceUsed: 'recording' });
          } catch (error) {
            console.warn('recording playback failed', error);
            setStatus('Your recording could not play. Fallback sound is ringing.');
          }
        } else {
          setStatus('Recording not found. Fallback sound is ringing.');
        }
      }
    },
    [audio, spotify, supabase, userId],
  );

  useEffect(() => {
    void fetchAlarms(supabase, userId).then(setAlarms);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [supabase, userId]);

  useEffect(() => {
    if (!clockRef.current) clockRef.current = new AlarmClock({ onFire: (a, at) => void fireAlarm(a, at), onTick: setNext });
    clockRef.current.setAlarms(alarms);
  }, [alarms, fireAlarm]);

  // Warn when the tab is hidden while armed (mobile browsers throttle or suspend hidden tabs).
  useEffect(() => {
    const onVisibility = () => {
      if (!armedRef.current) return;
      if (document.visibilityState === 'hidden') setWarning('This tab was hidden. Keep Wake in the foreground so the alarm can ring on time.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

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
    if (!unlocked) setWarning("Your browser didn't allow sound yet. If the alarm is silent, tap the screen when it rings.");
    else setWarning('');
    if (spotifyConnected) void spotify.init();
    await clockRef.current?.start();
    armedRef.current = true;
    setArmed(true);
  };

  const disarm = () => {
    clockRef.current?.stop();
    if (snoozeTimer.current) clearTimeout(snoozeTimer.current);
    snoozeTimer.current = null;
    armedRef.current = false;
    setArmed(false);
    setWarning('');
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
      setStatus(`Snoozed until ${formatTime(at.getHours(), at.getMinutes())}`);
    }
  }, [audio, spotify, fireAlarm, supabase, userId]);

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
      <div className="ringing" role="alertdialog" aria-label="Alarm ringing" onClick={() => void audio.unlock()}>
        <div style={{ textAlign: 'center' }}>
          <div className="clock">{formatTime(now.getHours(), now.getMinutes())}</div>
          <div className="label">{ringing.alarm.name}</div>
          <div className="status">{source ? describeSource(source, wakeSoundName) : ''}</div>
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
            aria-label="Hold to stop the alarm"
          >
            {holdProgress > 0 ? 'KEEP HOLDING…' : 'HOLD TO STOP'}
          </button>
          {snoozeMinutes > 0 ? (
            <button className="snooze-btn" onClick={snooze}>SNOOZE {snoozeMinutes} MIN</button>
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
          {next ? <>Next alarm · {next.alarm.name} · {relativeDayLabel(next.at, now)} in {formatTimeUntil(next.at, now)}</> : 'No alarm scheduled'}
        </div>
      </div>

      {warning ? <p className="alert warn" role="status">{warning}</p> : null}

      <div className="section" style={{ padding: 20, textAlign: 'center' }}>
        {armed ? (
          <>
            <span className="badge ready"><span className="dot" style={{ background: 'var(--success)' }} />Clock armed · keep this tab open</span>
            <p className="sub" style={{ margin: '14px 0' }}>Wake will ring in this browser at the alarm time. The screen stays awake when your browser allows it.</p>
            <button className="btn btn-ghost" onClick={disarm}>Disarm</button>
          </>
        ) : (
          <>
            <p className="sub" style={{ margin: '4px 0 16px' }}>Turn this device into a nightstand clock. Tap once to allow sound, then keep the tab open.</p>
            <button className="btn btn-primary btn-block" onClick={() => void arm()} disabled={enabledCount === 0}>
              {enabledCount === 0 ? 'Enable an alarm first' : 'Arm clock mode'}
            </button>
          </>
        )}
      </div>

      <div className="section" style={{ padding: 18 }}>
        <p className="sub" style={{ margin: 0, fontSize: 13 }}>
          Browsers can&apos;t ring a closed tab, so Clock mode needs the tab open and the screen on. For a real locked-phone alarm, install the Wake mobile app.
          Manage alarms in <Link href="/app">Alarms</Link>.
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
          Test alarm now
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

function spotifyMessage(reason: string): string {
  if (reason === 'no_active_device') return "Spotify couldn't start on this device. Your fallback alarm is playing.";
  if (reason === 'premium_required') return 'Spotify playback needs Premium. Your fallback alarm is playing.';
  if (reason === 'not_connected' || reason === 'token 404') return 'Spotify is not connected. Your fallback alarm is playing.';
  return "Spotify couldn't start. Your fallback alarm is playing instead.";
}
