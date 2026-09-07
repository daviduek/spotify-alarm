'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  ALL_WEEKDAYS,
  FADE_PRESETS,
  WAKE_SOUNDS,
  WORKDAYS,
  createSinglePlan,
  defaultAlarmDraft,
  describeFade,
  describeSource,
  fadeConfigFromPreset,
  primarySource,
  wakeSoundName,
  type Alarm,
  type AlarmDraft,
  type AudioSource,
  type FadePresetId,
  type Weekday,
} from '@wake/domain';

import { insertAlarm, updateAlarm } from '../lib/data/alarms';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { SourcePicker } from './SourcePicker';
import { Switch } from './Switch';

const WEEKDAY_LABELS: Record<Weekday, string> = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' };
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function AlarmEditor({ userId, existing, spotifyConnected }: { userId: string; existing?: Alarm; spotifyConnected: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const base = existing ?? { ...defaultAlarmDraft(), name: 'Morning' };

  const [name, setName] = useState(base.name);
  const [time, setTime] = useState(`${String(base.hour).padStart(2, '0')}:${String(base.minute).padStart(2, '0')}`);
  const [weekdays, setWeekdays] = useState<Weekday[]>(base.recurrence.type === 'weekly' ? base.recurrence.weekdays : []);
  const [source, setSource] = useState<AudioSource>(primarySource(base.audioPlan) ?? { type: 'local', soundId: base.fallbackSoundId });
  const [fallbackSoundId, setFallbackSoundId] = useState(base.fallbackSoundId);
  const [fadePreset, setFadePreset] = useState<FadePresetId | 'off'>(base.fadeIn.enabled ? 'normal' : 'off');
  const [snoozeMinutes, setSnoozeMinutes] = useState(base.snooze.enabled ? base.snooze.durationMinutes : 0);
  const [vibration, setVibration] = useState(base.vibration.enabled);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: Weekday) => setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const fade = fadePreset === 'off' ? { enabled: false, durationSeconds: 0, initialVolume: 1, finalVolume: 1 } : fadeConfigFromPreset(fadePreset);

  const buildDraft = (): AlarmDraft => {
    const [h, m] = time.split(':').map((x) => parseInt(x, 10));
    return {
      ...defaultAlarmDraft(),
      name: name.trim() || 'Alarm',
      hour: Number.isFinite(h) ? h : 7,
      minute: Number.isFinite(m) ? m : 0,
      enabled: existing?.enabled ?? true,
      recurrence: weekdays.length ? { type: 'weekly', weekdays } : { type: 'once' },
      snooze: { enabled: snoozeMinutes > 0, durationMinutes: snoozeMinutes || 10 },
      vibration: { enabled: vibration, pattern: 'default' },
      audioPlan: createSinglePlan(source),
      fadeIn: fade,
      fallbackSoundId,
    };
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const draft = buildDraft();
      if (existing) await updateAlarm(supabase, userId, existing.id, draft);
      else await insertAlarm(supabase, userId, draft);
      router.push('/app');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the alarm');
      setSaving(false);
    }
  };

  return (
    <main>
      <div className="row-between" style={{ padding: '8px 0 4px' }}>
        <button className="btn btn-ghost" onClick={() => router.back()}>Cancel</button>
        <strong>{existing ? 'Edit alarm' : 'New alarm'}</strong>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="time-picker">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Alarm time" />
      </div>

      <div className="section">
        <h2>Repeat</h2>
        <div className="day-toggle">
          {WEEKDAY_ORDER.map((d) => (
            <button key={d} className={weekdays.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)} aria-pressed={weekdays.includes(d)} aria-label={`Toggle ${d}`}>
              {WEEKDAY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="chips">
          <button className="chip" onClick={() => setWeekdays([...WORKDAYS])}>Weekdays</button>
          <button className="chip" onClick={() => setWeekdays([...ALL_WEEKDAYS])}>Every day</button>
          <button className="chip" onClick={() => setWeekdays([])}>Once</button>
        </div>
      </div>

      <div className="section">
        <h2>Sound</h2>
        <div className="list-row">
          <span className="label">Wake with</span>
          <button className="btn btn-ghost" onClick={() => setPickerOpen(true)}>{describeSource(source, wakeSoundName)} ›</button>
        </div>
        <div className="list-row">
          <span className="label">Fallback sound</span>
          <span className="value">always rings</span>
        </div>
        <div className="chips">
          {WAKE_SOUNDS.map((s) => (
            <button key={s.id} className={`chip ${fallbackSoundId === s.id ? 'active' : ''}`} onClick={() => setFallbackSoundId(s.id)}>{s.name}</button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>Progressive volume</h2>
        <div className="chips">
          <button className={`chip ${fadePreset === 'off' ? 'active' : ''}`} onClick={() => setFadePreset('off')}>Off</button>
          {Object.values(FADE_PRESETS).map((p) => (
            <button key={p.id} className={`chip ${fadePreset === p.id ? 'active' : ''}`} onClick={() => setFadePreset(p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="list-row"><span className="value">{describeFade(fade)}</span></div>
      </div>

      <div className="section">
        <h2>Snooze</h2>
        <div className="chips">
          {[0, 5, 10, 15, 20].map((m) => (
            <button key={m} className={`chip ${snoozeMinutes === m ? 'active' : ''}`} onClick={() => setSnoozeMinutes(m)}>{m === 0 ? 'Off' : `${m} min`}</button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="list-row">
          <span className="label">Vibration (mobile)</span>
          <Switch checked={vibration} onChange={setVibration} label="Vibration" />
        </div>
        <div className="list-row">
          <span className="label">Label</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 200 }} aria-label="Alarm label" />
        </div>
      </div>

      {error ? <p className="alert error" style={{ marginTop: 16 }}>{error}</p> : null}

      {pickerOpen ? (
        <SourcePicker
          userId={userId}
          spotifyConnected={spotifyConnected}
          onClose={() => setPickerOpen(false)}
          onPick={(s) => {
            setSource(s);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
