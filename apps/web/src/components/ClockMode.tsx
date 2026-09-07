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

import { fetchAlarms } from '../lib/data/alarms';
import { recordEvent } from '../lib/data/history';
import { signedUrl } from '../lib/data/recordings';
import { AlarmClock } from '../lib/engine/alarmClock';
import { WebAudioEngine } from '../lib/engine/webAudio';
import { soundUrl } from '../lib/sounds';
import { SpotifyBrowserPlayer } from '../lib/spotify/player';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

type Ringing = { alarm: Alarm; firedAt: number };

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
  const [holdProgress, setHoldProgress] = useState(0);
  const clockRef = useRef<AlarmClock | null>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fireAlarm = useCallback(
    async (alarm: Alarm) => {
      setRinging({ alarm, firedAt: Date.now() });
      setStatus('Wake sound playing');
      void recordEvent(supabase, userId, { alarmId: alarm.id, scheduledAt: new Date().toISOString(), firedAt: new Date().toISOString(), audioSourceUsed: 'fallback' });

      const fade = alarm.fadeIn.enabled ? alarm.fadeIn : fadeConfigFromPreset('normal');
      await audio.startFallback(soundUrl(alarm.fallbackSoundId), alarm.fadeIn.enabled ? fade : { ...fade, enabled: false });

      const source = primarySource(alarm.audioPlan);
      if (source?.type === 'music' && planIncludesProvider(alarm.audioPlan, 'spotify')) {
        setStatus('Wake sound playing · starting Spotify…');
        const outcome = await spotify.play(source.uri);
        if (outcome.success) {
          audio.fadeOutFallback();
          setStatus(`Spotify · ${source.title}`);
          void recordEvent(supabase, userId, { alarmId: alarm.id, scheduledAt: new Date().toISOString(), providerAttempted: true, providerSucceeded: true, audioSourceUsed: 'music' });
        } else {
          setStatus(spotifyMessage(outcome.reason));
          void recordEvent(supabase, userId, { alarmId: alarm.id, scheduledAt: new Date().toISOString(), providerAttempted: true, providerSucceeded: false, providerFailureReason: outcome.reason });
        }
      } else if (source?.type === 'recording' && planIncludesRecording(alarm.audioPlan)) {
        const url = source.fileUri ?? (source.recordingId ? await recordingUrl(supabase, source.recordingId) : null);
        if (url) {
          try {
            await audio.crossfadeToRecording(url);
            setStatus(`Your recording · ${source.title ?? 'My recording'}`);
          } catch {
            setStatus('Your recording could not play. Fallback sound is ringing.');
          }
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
    if (!clockRef.current) clockRef.current = new AlarmClock({ onFire: (a) => void fireAlarm(a), onTick: setNext });
    clockRef.current.setAlarms(alarms);
  }, [alarms, fireAlarm]);

  const arm = async () => {
    // A user gesture unlocks audio autoplay for later.
    await audio.preview(soundUrl('soft'), false, 0).catch(() => undefined);
    audio.stop();
    if (spotifyConnected) void spotify.init();
    await clockRef.current?.start();
    setArmed(true);
  };

  const disarm = () => {
    clockRef.current?.stop();
    setArmed(false);
  };

  const stop = useCallback(() => {
    audio.stop();
    void spotify.pause();
    if (ringing) void recordEvent(supabase, userId, { alarmId: ringing.alarm.id, scheduledAt: new Date(ringing.firedAt).toISOString(), stoppedAt: new Date().toISOString() });
    setRinging(null);
    setHoldProgress(0);
  }, [audio, spotify, ringing, supabase, userId]);

  const snooze = useCallback(() => {
    if (!ringing) return;
    const minutes = ringing.alarm.snooze.enabled ? ringing.alarm.snooze.durationMinutes : 0;
    audio.stop();
    void spotify.pause();
    setRinging(null);
    setHoldProgress(0);
    if (minutes > 0) {
      const at = new Date(Date.now() + minutes * 60_000);
      // A one-off snooze: fire again after the delay while armed.
      setTimeout(() => setArmed((a) => (a ? (void fireAlarm(ringing.alarm), a) : a)), minutes * 60_000);
      setStatus(`Snoozed until ${formatTime(at.getHours(), at.getMinutes())}`);
    }
  }, [ringing, audio, spotify, fireAlarm]);

  const startHold = () => {
    const start = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 1000);
      setHoldProgress(p);
      if (p >= 1) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        stop();
      }
    }, 30);
  };
  const endHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldProgress(0);
  };

  if (ringing) {
    const source = primarySource(ringing.alarm.audioPlan);
    const snoozeMinutes = ringing.alarm.snooze.enabled ? ringing.alarm.snooze.durationMinutes : 0;
    return (
      <div className="ringing" role="alertdialog" aria-label="Alarm ringing">
        <div style={{ textAlign: 'center' }}>
          <div className="clock">{formatTime(now.getHours(), now.getMinutes())}</div>
          <div className="label">{ringing.alarm.name}</div>
          <div className="status">{source ? describeSource(source, wakeSoundName) : ''}</div>
          <div className="status">{status}</div>
        </div>
        <div className="controls">
          <button
            className="hold-stop"
            style={{ background: `linear-gradient(90deg, #fff ${holdProgress * 100}%, #d0d0d0 ${holdProgress * 100}%)` }}
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
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
            <button className="btn btn-primary btn-block" onClick={() => void arm()} disabled={alarms.filter((a) => a.enabled).length === 0}>
              {alarms.filter((a) => a.enabled).length === 0 ? 'Enable an alarm first' : 'Arm clock mode'}
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
        <button className="btn btn-ghost btn-block" onClick={() => alarms[0] && void fireAlarm(alarms[0])} disabled={alarms.length === 0}>
          Test alarm now (5-second preview flow)
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
  return "Spotify couldn't start. Your fallback alarm is playing instead.";
}
