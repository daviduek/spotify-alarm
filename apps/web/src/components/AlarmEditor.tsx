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
  describeSource,
  fadeConfigFromPreset,
  fadePresetFor,
  primarySource,
  wakeSoundName,
  weekdayShort,
  type Alarm,
  type AlarmDraft,
  type AudioSource,
  type FadePresetId,
  type Weekday,
} from '@wake/domain';

import { insertAlarm, updateAlarm } from '../lib/data/alarms';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';
import { getSupabaseBrowserClient } from '../lib/supabase/client';
import { SourcePicker } from './SourcePicker';
import { Switch } from './Switch';

const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

const STR: Record<Locale, {
  defaultName: string;
  fallbackName: string;
  saveError: string;
  cancel: string;
  editAlarm: string;
  newAlarm: string;
  saving: string;
  save: string;
  alarmTime: string;
  repeat: string;
  toggleDay: (day: string) => string;
  weekdays: string;
  everyDay: string;
  once: string;
  sound: string;
  wakeWith: string;
  fallbackSound: string;
  alwaysRings: string;
  progressiveVolume: string;
  off: string;
  fadePresets: Record<FadePresetId, string>;
  snooze: string;
  minutes: (m: number) => string;
  vibration: string;
  vibrationLabel: string;
  label: string;
  alarmLabel: string;
}> = {
  en: {
    defaultName: 'Morning',
    fallbackName: 'Alarm',
    saveError: 'Could not save the alarm',
    cancel: 'Cancel',
    editAlarm: 'Edit alarm',
    newAlarm: 'New alarm',
    saving: 'Saving…',
    save: 'Save',
    alarmTime: 'Alarm time',
    repeat: 'Repeat',
    toggleDay: (day) => `Toggle ${day}`,
    weekdays: 'Weekdays',
    everyDay: 'Every day',
    once: 'Once',
    sound: 'Sound',
    wakeWith: 'Wake with',
    fallbackSound: 'Fallback sound',
    alwaysRings: 'always rings',
    progressiveVolume: 'Progressive volume',
    off: 'Off',
    fadePresets: { gentle: 'Gentle', normal: 'Normal', strong: 'Strong' },
    snooze: 'Snooze',
    minutes: (m) => `${m} min`,
    vibration: 'Vibration (mobile)',
    vibrationLabel: 'Vibration',
    label: 'Label',
    alarmLabel: 'Alarm label',
  },
  es: {
    defaultName: 'Mañana',
    fallbackName: 'Alarma',
    saveError: 'No se pudo guardar la alarma',
    cancel: 'Cancelar',
    editAlarm: 'Editar alarma',
    newAlarm: 'Nueva alarma',
    saving: 'Guardando…',
    save: 'Guardar',
    alarmTime: 'Hora de la alarma',
    repeat: 'Repetir',
    toggleDay: (day) => `Alternar ${day}`,
    weekdays: 'Entre semana',
    everyDay: 'Todos los días',
    once: 'Una vez',
    sound: 'Sonido',
    wakeWith: 'Despertar con',
    fallbackSound: 'Sonido de respaldo',
    alwaysRings: 'siempre suena',
    progressiveVolume: 'Volumen progresivo',
    off: 'Apagado',
    fadePresets: { gentle: 'Suave', normal: 'Normal', strong: 'Fuerte' },
    snooze: 'Snooze',
    minutes: (m) => `${m} min`,
    vibration: 'Vibración (móvil)',
    vibrationLabel: 'Vibración',
    label: 'Etiqueta',
    alarmLabel: 'Etiqueta de la alarma',
  },
};

export function AlarmEditor({ userId, existing, spotifyConnected }: { userId: string; existing?: Alarm; spotifyConnected: boolean }) {
  const router = useRouter();
  const locale = useLocale();
  const t = STR[locale];
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const base = existing ?? { ...defaultAlarmDraft(), name: t.defaultName };

  const [name, setName] = useState(base.name);
  const [time, setTime] = useState(`${String(base.hour).padStart(2, '0')}:${String(base.minute).padStart(2, '0')}`);
  const [weekdays, setWeekdays] = useState<Weekday[]>(base.recurrence.type === 'weekly' ? base.recurrence.weekdays : []);
  const [source, setSource] = useState<AudioSource>(primarySource(base.audioPlan) ?? { type: 'local', soundId: base.fallbackSoundId });
  const [fallbackSoundId, setFallbackSoundId] = useState(base.fallbackSoundId);
  const [fadePreset, setFadePreset] = useState<FadePresetId | 'off'>(() => { const p = fadePresetFor(base.fadeIn); return p === 'custom' ? 'normal' : p; });
  const [snoozeMinutes, setSnoozeMinutes] = useState(base.snooze.enabled ? base.snooze.durationMinutes : 0);
  const [vibration, setVibration] = useState(base.vibration.enabled);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: Weekday) => setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const fade = fadePreset === 'off' ? { enabled: false, durationSeconds: 0, initialVolume: 1, finalVolume: 1 } : fadeConfigFromPreset(fadePreset);
  const fadeSummary = fadePreset === 'off' ? t.off : `${t.fadePresets[fadePreset]} · ${Math.round(fade.durationSeconds / 60)} min`;

  const buildDraft = (): AlarmDraft => {
    const [h, m] = time.split(':').map((x) => parseInt(x, 10));
    return {
      ...defaultAlarmDraft(),
      name: name.trim() || t.fallbackName,
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
      setError(e instanceof Error ? e.message : t.saveError);
      setSaving(false);
    }
  };

  return (
    <main>
      <div className="row-between" style={{ padding: '8px 0 4px' }}>
        <button className="btn btn-ghost" onClick={() => router.back()}>{t.cancel}</button>
        <strong>{existing ? t.editAlarm : t.newAlarm}</strong>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>{saving ? t.saving : t.save}</button>
      </div>

      <div className="time-picker">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t.alarmTime} />
      </div>

      <div className="section">
        <h2>{t.repeat}</h2>
        <div className="day-toggle">
          {WEEKDAY_ORDER.map((d) => (
            <button key={d} className={weekdays.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)} aria-pressed={weekdays.includes(d)} aria-label={t.toggleDay(weekdayShort(d, locale))}>
              {weekdayShort(d, locale).charAt(0).toUpperCase()}
            </button>
          ))}
        </div>
        <div className="chips">
          <button className="chip" onClick={() => setWeekdays([...WORKDAYS])}>{t.weekdays}</button>
          <button className="chip" onClick={() => setWeekdays([...ALL_WEEKDAYS])}>{t.everyDay}</button>
          <button className="chip" onClick={() => setWeekdays([])}>{t.once}</button>
        </div>
      </div>

      <div className="section">
        <h2>{t.sound}</h2>
        <div className="list-row">
          <span className="label">{t.wakeWith}</span>
          <button className="btn btn-ghost" onClick={() => setPickerOpen(true)}>{describeSource(source, (id) => wakeSoundName(id, locale), locale)} ›</button>
        </div>
        <div className="list-row">
          <span className="label">{t.fallbackSound}</span>
          <span className="value">{t.alwaysRings}</span>
        </div>
        <div className="chips">
          {WAKE_SOUNDS.map((s) => (
            <button key={s.id} className={`chip ${fallbackSoundId === s.id ? 'active' : ''}`} onClick={() => setFallbackSoundId(s.id)}>{wakeSoundName(s.id, locale) ?? s.name}</button>
          ))}
        </div>
      </div>

      <div className="section">
        <h2>{t.progressiveVolume}</h2>
        <div className="chips">
          <button className={`chip ${fadePreset === 'off' ? 'active' : ''}`} onClick={() => setFadePreset('off')}>{t.off}</button>
          {Object.values(FADE_PRESETS).map((p) => (
            <button key={p.id} className={`chip ${fadePreset === p.id ? 'active' : ''}`} onClick={() => setFadePreset(p.id)}>{t.fadePresets[p.id]}</button>
          ))}
        </div>
        <div className="list-row"><span className="value">{fadeSummary}</span></div>
      </div>

      <div className="section">
        <h2>{t.snooze}</h2>
        <div className="chips">
          {[0, 5, 10, 15, 20].map((m) => (
            <button key={m} className={`chip ${snoozeMinutes === m ? 'active' : ''}`} onClick={() => setSnoozeMinutes(m)}>{m === 0 ? t.off : t.minutes(m)}</button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="list-row">
          <span className="label">{t.vibration}</span>
          <Switch checked={vibration} onChange={setVibration} label={t.vibrationLabel} />
        </div>
        <div className="list-row">
          <span className="label">{t.label}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 200 }} aria-label={t.alarmLabel} />
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
