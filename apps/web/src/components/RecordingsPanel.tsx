'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { WAKE_SOUNDS, wakeSoundName } from '@wake/domain';

import { deleteRecording, fetchRecordings, renameRecording, signedUrl, uploadRecording, type Recording } from '../lib/data/recordings';
import { WebAudioEngine } from '../lib/engine/webAudio';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';
import { soundUrl } from '../lib/sounds';
import { getSupabaseBrowserClient } from '../lib/supabase/client';

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const STR: Record<Locale, {
  defaultName: (date: string) => string;
  micError: string;
  fallbackName: string;
  uploadError: string;
  renamePrompt: string;
  confirmDelete: (name: string) => string;
  title: string;
  myRecording: string;
  recording: string;
  readyToSave: string;
  recordPrompt: string;
  stop: string;
  namePlaceholder: string;
  saving: string;
  save: string;
  discard: string;
  recordNew: string;
  savedRecordings: string;
  nothingYet: string;
  play: (name: string) => string;
  rename: string;
  delete: string;
  wakeSounds: string;
  preview: string;
  stopPreview: string;
}> = {
  en: {
    defaultName: (date) => `Wake-up ${date}`,
    micError: 'Microphone permission is needed to record.',
    fallbackName: 'My recording',
    uploadError: 'Upload failed',
    renamePrompt: 'Rename recording',
    confirmDelete: (name) => `Delete “${name}”?`,
    title: 'Sounds & recordings',
    myRecording: 'My recording',
    recording: '● Recording',
    readyToSave: 'Ready to save',
    recordPrompt: 'Record your own wake-up message',
    stop: 'Stop',
    namePlaceholder: 'Name',
    saving: 'Saving…',
    save: 'Save',
    discard: 'Discard',
    recordNew: '+ Record a new wake-up',
    savedRecordings: 'Saved recordings',
    nothingYet: 'Nothing yet.',
    play: (name) => `Play ${name}`,
    rename: 'Rename',
    delete: 'Delete',
    wakeSounds: 'Wake sounds',
    preview: 'Preview',
    stopPreview: 'Stop preview',
  },
  es: {
    defaultName: (date) => `Despertador ${date}`,
    micError: 'Se necesita permiso del micrófono para grabar.',
    fallbackName: 'Mi grabación',
    uploadError: 'La subida falló',
    renamePrompt: 'Renombrar grabación',
    confirmDelete: (name) => `¿Eliminar “${name}”?`,
    title: 'Sonidos y grabaciones',
    myRecording: 'Mi grabación',
    recording: '● Grabando',
    readyToSave: 'Listo para guardar',
    recordPrompt: 'Graba tu propio mensaje para despertar',
    stop: 'Detener',
    namePlaceholder: 'Nombre',
    saving: 'Guardando…',
    save: 'Guardar',
    discard: 'Descartar',
    recordNew: '+ Grabar un nuevo mensaje',
    savedRecordings: 'Grabaciones guardadas',
    nothingYet: 'Todavía nada.',
    play: (name) => `Reproducir ${name}`,
    rename: 'Renombrar',
    delete: 'Eliminar',
    wakeSounds: 'Sonidos de Wake',
    preview: 'Escuchar',
    stopPreview: 'Detener la reproducción',
  },
};

export function RecordingsPanel({ userId }: { userId: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const audio = useMemo(() => new WebAudioEngine(), []);
  const locale = useLocale();
  const t = STR[locale];
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<{ blob: Blob; durationMs: number } | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => void fetchRecordings(supabase, userId).then(setRecordings).catch(() => undefined);
  useEffect(() => {
    load();
    return () => audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        setPending({ blob, durationMs: Date.now() - startedRef.current });
        setName(t.defaultName(new Date().toLocaleDateString()));
      };
      recorderRef.current = rec;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedRef.current), 200);
    } catch {
      setError(t.micError);
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const save = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await uploadRecording(supabase, userId, pending.blob, name.trim() || t.fallbackName, pending.durationMs);
      setPending(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.uploadError);
    } finally {
      setBusy(false);
    }
  };

  const play = async (rec: Recording) => {
    const url = await signedUrl(supabase, rec.storagePath);
    if (url) await audio.preview(url, false, 1);
  };

  const rename = async (rec: Recording) => {
    const next = prompt(t.renamePrompt, rec.name);
    if (next) {
      await renameRecording(supabase, userId, rec.id, next);
      load();
    }
  };

  const remove = async (rec: Recording) => {
    if (!confirm(t.confirmDelete(rec.name))) return;
    audio.stop();
    await deleteRecording(supabase, userId, rec);
    load();
  };

  return (
    <main>
      <h1 style={{ fontSize: 22 }}>{t.title}</h1>

      <div className="section">
        <h2>{t.myRecording}</h2>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 200 }}>{fmt(recording ? elapsed : pending?.durationMs ?? 0)}</div>
          <p className="sub">{recording ? t.recording : pending ? t.readyToSave : t.recordPrompt}</p>
          {recording ? (
            <button className="btn btn-danger" onClick={stop}>{t.stop}</button>
          ) : pending ? (
            <div className="stack" style={{ maxWidth: 320, margin: '0 auto' }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} style={{ minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', padding: '0 12px' }} />
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>{busy ? t.saving : t.save}</button>
              <button className="btn btn-ghost" onClick={() => setPending(null)}>{t.discard}</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => void start()}>{t.recordNew}</button>
          )}
        </div>
      </div>
      {error ? <p className="alert error" style={{ marginTop: 12 }}>{error}</p> : null}

      <div className="section">
        <h2>{t.savedRecordings}</h2>
        {recordings.length === 0 ? (
          <div className="list-row"><span className="value">{t.nothingYet}</span></div>
        ) : (
          recordings.map((r) => (
            <div key={r.id} className="list-row">
              <button className="btn btn-ghost" onClick={() => void play(r)} aria-label={t.play(r.name)}>▶ {r.name}</button>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="value">{fmt(r.durationMs)}</span>
                <button className="chip" onClick={() => void rename(r)}>{t.rename}</button>
                <button className="chip" onClick={() => void remove(r)}>{t.delete}</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="section">
        <h2>{t.wakeSounds}</h2>
        {WAKE_SOUNDS.map((s) => (
          <div key={s.id} className="list-row">
            <span className="label">{wakeSoundName(s.id, locale) ?? s.name}</span>
            <button className="chip" onClick={() => void audio.preview(soundUrl(s.id), false, 1)}>{t.preview}</button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => audio.stop()}>{t.stopPreview}</button>
    </main>
  );
}
